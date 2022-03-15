import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { SecretTemplate } from '../constructs/secretTemplate';

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const secretData = {
      username: 'test',
    }
    const secret = new Secret(this, 'test-secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify(secretData),
        generateStringKey: 'password'
      }
    });


    new CfnOutput(this, 'test-value', {
      exportName: 'Password',
      value: SecretTemplate.secretManagerValue(secret, 'password')
    })
  }
}

new TestStack(new App(), 'test-stack', {})
