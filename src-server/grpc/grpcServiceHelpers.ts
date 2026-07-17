import {
  GRPC_ERROR_CODES,
  type GrpcCallRequest,
  type GrpcErrorCode,
} from '../../src/shared/grpc/contracts.js';
import {
  resolveGrpcExecuteAuthMetadata,
  resolveGrpcExecuteAuthMetadataSync,
} from './grpcAuthResolve.js';
import type { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';
import type { DescriptorLoaderError } from './descriptorLoader.js';

export function mapDescriptorLoaderErrorCode(
  error: DescriptorLoaderError,
  op: 'reflect' | 'describe',
): GrpcErrorCode {
  switch (error.code) {
    case 'unreachable':
      return GRPC_ERROR_CODES.UNREACHABLE;
    case 'invalid_target':
      return GRPC_ERROR_CODES.INVALID_TARGET;
    case 'invalid_descriptor':
      return GRPC_ERROR_CODES.INVALID_DESCRIPTOR;
    case 'describe_failed':
      return GRPC_ERROR_CODES.DESCRIBE_FAILED;
    case 'import_resolution_failed':
      return GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED;
    case 'reflection_failed':
      return GRPC_ERROR_CODES.REFLECTION_FAILED;
    default:
      return op === 'reflect'
        ? GRPC_ERROR_CODES.REFLECTION_FAILED
        : GRPC_ERROR_CODES.DESCRIBE_FAILED;
  }
}

export async function appendAuthMetadata(
  metadata: Record<string, string>,
  auth: GrpcCallRequest['auth'],
  oauth2TokenService: GrpcOAuth2TokenService,
): Promise<Record<string, string>> {
  if (auth?.type === 'oauth2') {
    return resolveGrpcExecuteAuthMetadata(metadata, auth, oauth2TokenService);
  }
  return resolveGrpcExecuteAuthMetadataSync(metadata, auth);
}