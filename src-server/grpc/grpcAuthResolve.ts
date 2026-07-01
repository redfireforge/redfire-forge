/**
 * Phase 4D — resolve auth metadata for execute/stream (server-side OAuth2 acquisition).
 */
import type { GrpcAuthConfig } from '../../src/shared/grpc/contracts.js';
import { mergeGrpcExecuteMetadata } from '../../src/shared/grpc/grpcAuthPolicy.js';
import { sanitizeGrpcErrorMessage } from '../../src/shared/grpc/grpcRedaction.js';
import {
  GrpcOAuth2TokenError,
  type GrpcOAuth2TokenService,
} from './grpcOAuth2TokenService.js';

export function resolveGrpcExecuteAuthMetadataSync(
  metadata: Record<string, string>,
  auth: GrpcAuthConfig | undefined,
): Record<string, string> {
  const merged = mergeGrpcExecuteMetadata(metadata, auth);
  if (!merged.ok) {
    throw new Error(merged.error);
  }
  return merged.metadata;
}

export async function resolveGrpcExecuteAuthMetadata(
  metadata: Record<string, string>,
  auth: GrpcAuthConfig | undefined,
  tokenService: GrpcOAuth2TokenService,
): Promise<Record<string, string>> {
  if (auth?.type !== 'oauth2') {
    return resolveGrpcExecuteAuthMetadataSync(metadata, auth);
  }

  if (!auth.oauth2) {
    throw new Error('OAuth2 configuration is required');
  }
  const accessToken = await tokenService.acquireToken(auth.oauth2);
  return resolveGrpcExecuteAuthMetadataSync(metadata, {
    type: 'bearer',
    bearerToken: accessToken,
  });
}

export function mapGrpcOAuth2TokenErrorForEnvelope(
  error: GrpcOAuth2TokenError,
): { field: string; message: string } {
  return {
    field: 'auth.oauth2',
    message: sanitizeGrpcErrorMessage(error.message),
  };
}

export function mapGrpcAuthResolveErrorForEnvelope(
  error: unknown,
): { field: string; message: string } {
  if (error instanceof GrpcOAuth2TokenError) {
    return mapGrpcOAuth2TokenErrorForEnvelope(error);
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    field: 'auth',
    message: sanitizeGrpcErrorMessage(message),
  };
}
