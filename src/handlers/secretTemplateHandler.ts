import { SecretType } from '../constructs/secretTemplate';
import { CustomResourceProviderRequest, CustomResourceProviderResponse } from '../types';
import {SSM, SecretsManager, STS} from 'aws-sdk';
import { randomUUID } from 'crypto';

export interface SecretTemplateOptions {
  ValueARN: string,
  SecretType: SecretType,
  AccessRole: string,
  JSONProp?: string
}

const stsClient = new STS();
export async function handler(event: CustomResourceProviderRequest<'Custom::SecretTemplate', SecretTemplateOptions>): Promise<CustomResourceProviderResponse<{Value: string}> | undefined> {
  if (event.RequestType === 'Delete') {
    return;
  }
  const {SecretType, AccessRole, ValueARN, JSONProp} = event.ResourceProperties;

  const creds = await stsClient.assumeRole({
    RoleArn: AccessRole,
    RoleSessionName: randomUUID(),
  }).promise();

  let valueString: any;

  switch (SecretType) {
    case 'SECRET_MANAGER':
      const secretManagerClient = new SecretsManager({
        credentials: {
          accessKeyId: creds.Credentials!.AccessKeyId,
          secretAccessKey: creds.Credentials!.SecretAccessKey,
          sessionToken: creds.Credentials!.SessionToken,
        }
      })

      const {SecretString} = await secretManagerClient.getSecretValue({SecretId: ValueARN}).promise()
      valueString = SecretString;
      break;
    case 'SSM':
      const ssmClient = new SSM({
        credentials: {
          accessKeyId: creds.Credentials!.AccessKeyId,
          secretAccessKey: creds.Credentials!.SecretAccessKey,
          sessionToken: creds.Credentials!.SessionToken,
        }
      });

      const {Parameter} = await ssmClient.getParameter({Name: ValueARN, WithDecryption: true}).promise()

      valueString = Parameter?.Value;
      break;
  }

  let value;
  if (valueString != null && JSONProp != null) {
    try {
      value = JSON.parse(valueString)[JSONProp];
    } catch (err) {}
  } else {
    value = valueString;
  }

  return {
    Data: {Value: value},
    NoEcho: true,
  }
}
