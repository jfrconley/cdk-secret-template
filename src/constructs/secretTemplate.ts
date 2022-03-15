import { Construct } from 'constructs';
import { CustomResource, SecretValue, Stack } from 'aws-cdk-lib';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import * as Statement from 'cdk-iam-floyd'
import { ArnPrincipal, Policy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {join} from 'path'

export const enum SecretType {
  SSM = 'SSM',
  SECRET_MANAGER = 'SECRET_MANAGER'
}

export class SecretTemplate extends Construct {
  public readonly value: string;
  private readonly resource: CustomResource;

  private static getId(jsonProp?: string) {
    return `secret-template-${jsonProp}`
  }

  private static getRolePrincipal(scope: Construct) {
    return new ArnPrincipal(SecretTemplateProvider.getOrCreate(scope).lambda.role!.roleArn)
  }

  private constructor(scope: Construct, {secretType, jsonProp, valueArn, accessRole}: {
    valueArn: string,
    secretType: SecretType,
    accessRole: Role,
    jsonProp?: string,
  }) {
    super(scope, SecretTemplate.getId(jsonProp));

    const provider = SecretTemplateProvider.getOrCreate(this);

    provider.lambda.role?.addToPrincipalPolicy(new Statement.Sts()
      .allow()
      .toAssumeRole()
      .on(accessRole.roleArn))

    this.resource = new CustomResource(this, 'secret-template', {
      serviceToken: provider.provider.serviceToken,
      resourceType: 'Custom::SecretTemplate',
      properties: {
        ValueARN: valueArn,
        JSONProp: jsonProp,
        SecretType: secretType,
        AccessRole: accessRole.roleArn
      }
    });

    this.value = this.resource.getAttString('Value')
  }

  private static tryResolveTemplate(scope: Construct, jsonProp?: string): SecretTemplate | undefined {
    return scope.node.tryFindChild(this.getId(jsonProp)) as SecretTemplate
  }

  public static secretManager(secret: Secret, jsonProp?: string) {
    let template = this.tryResolveTemplate(secret, jsonProp);

    if (!template) {
      const role = new Role(secret, 'secret-access-role', {
        assumedBy: this.getRolePrincipal(secret)
      })

      secret.grantRead(role);
      template = new SecretTemplate(secret,  {
        jsonProp,
        accessRole: role,
        secretType: SecretType.SECRET_MANAGER,
        valueArn: secret.secretArn
      })
    }

    return template;
  }

  public static secretManagerValue(secret: Secret, jsonProp?: string) {
    return this.secretManager(secret, jsonProp).value
  }

  public static ssmSecret(secret: StringParameter, jsonProp?: string) {
    let template = this.tryResolveTemplate(secret, jsonProp);

    if (!template) {
      const role = new Role(secret, 'secret-access-role', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com')
      });

      secret.grantRead(role);
      secret.encryptionKey?.grantDecrypt(role)
      template = new SecretTemplate(secret, {
        jsonProp,
        accessRole: role,
        secretType: SecretType.SSM,
        valueArn: secret.parameterArn
      })
    }

    return template;
  }

  public static ssmSecretValue(secret: StringParameter, jsonProp?: string) {
    return this.ssmSecret(secret, jsonProp).value;
  }
}

class SecretTemplateProvider extends Construct {
  private static secretTemplateProviderId = 'secret-template-provider'
  public readonly provider: Provider;
  public readonly lambda: NodejsFunction;

  private constructor(scope: Construct) {
    super(scope, SecretTemplateProvider.secretTemplateProviderId);

    this.lambda = new NodejsFunction(this, 'secret-template-lambda', {
      bundling: {
        minify: true
      },
      entry: join(__dirname, '..', 'handlers', 'secretTemplateHandler.js')
    });

    this.provider = new Provider(this, 'secret-template-provider', {
      onEventHandler: this.lambda,

    })
  }

  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    return stack.node.tryFindChild(this.secretTemplateProviderId) as SecretTemplateProvider ?? new SecretTemplateProvider(stack);
  }

}
