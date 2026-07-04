import type { GrpcAuthConfig } from './contracts';
import type { GrpcTauriAuthConfig } from './grpcTauriContracts';

export function toGrpcTauriAuthConfig(
  auth: GrpcAuthConfig | undefined,
): GrpcTauriAuthConfig | undefined {
  if (!auth) {
    return undefined;
  }

  switch (auth.type) {
    case 'none':
    case 'inherit':
      return undefined;
    case 'bearer':
      return {
        type: 'bearer',
        bearerToken: auth.bearerToken,
      };
    case 'basic':
      return {
        type: 'basic',
        basicUsername: auth.basicUsername,
        basicPassword: auth.basicPassword,
      };
    case 'api_key':
      return {
        type: 'api_key',
        apiKeyName: auth.apiKeyName,
        apiKeyValue: auth.apiKeyValue,
      };
    case 'oauth2':
      return {
        type: 'oauth2',
        oauth2: auth.oauth2,
      };
    default:
      return undefined;
  }
}
