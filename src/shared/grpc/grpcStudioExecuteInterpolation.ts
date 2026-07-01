/**
 * Phase 9H/9I — deep execute-time interpolation for gRPC Studio (parity with harness/workflow).
 */
import type { GrpcAuthConfig } from './contracts';
import { stripGrpcMapPendingKeysDeep } from './grpcMapPendingKeys';
import { normalizeGrpcMetadata } from './contracts';
import { validateGrpcAuthForExecute } from './grpcAuthPolicy';
import {
  assertGrpcInterpolationAuthTemplatesResolved,
  assertGrpcInterpolationJsonTemplatesResolved,
  assertGrpcInterpolationMetadataNormalizeUnique,
  assertGrpcInterpolationTemplatesResolved,
  resolveGrpcInterpolationAuthConfig,
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
} from './grpcInterpolationDeepResolver';
import type { GrpcInterpolationEnvSnapshot } from './grpcInterpolationEnvSnapshot';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import { validateGrpcMetadataRecord } from './metadataValidation';

export interface GrpcStudioExecuteInterpolatedFields {
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  auth?: GrpcAuthConfig;
}

/** Post-resolve validation — mirrors harness/workflow snapshot builders (Phase 9H). */
export function assertGrpcStudioExecuteFieldsReady(
  fields: GrpcStudioExecuteInterpolatedFields,
): void {
  const metadataError = validateGrpcMetadataRecord(fields.metadata);
  if (metadataError) {
    throw new Error(metadataError);
  }
  const authIssues = validateGrpcAuthForExecute(fields.auth);
  if (authIssues.length > 0) {
    throw new Error(authIssues[0]?.message ?? 'Invalid auth configuration');
  }
}

/** Deep-resolve tab body/metadata/auth using the bound execute env snapshot. */
export function resolveGrpcStudioTabFieldsForExecute(
  tab: {
    body: Record<string, unknown>;
    metadata: Record<string, string>;
    auth?: GrpcAuthConfig;
  },
  env: Readonly<Record<string, string>>,
): GrpcStudioExecuteInterpolatedFields {
  const resolveTemplate = createGrpcInterpolationTemplateResolver(env);
  const body = stripGrpcMapPendingKeysDeep(
    resolveGrpcInterpolationJsonValue(tab.body ?? {}, resolveTemplate),
  ) as Record<string, unknown>;
  assertGrpcInterpolationJsonTemplatesResolved(body);
  const metadataResolved = resolveGrpcInterpolationMetadata(tab.metadata, resolveTemplate);
  for (const [key, value] of Object.entries(metadataResolved)) {
    assertGrpcInterpolationTemplatesResolved('gRPC metadata key', key);
    assertGrpcInterpolationTemplatesResolved('gRPC metadata value', value);
  }
  assertGrpcInterpolationMetadataNormalizeUnique(metadataResolved);
  const metadata = normalizeGrpcMetadata(metadataResolved);
  const auth = resolveGrpcInterpolationAuthConfig(tab.auth, resolveTemplate);
  assertGrpcInterpolationAuthTemplatesResolved(auth);
  const fields = { body, metadata, auth };
  assertGrpcStudioExecuteFieldsReady(fields);
  return fields;
}

/**
 * Deep-resolve a stream message body using the frozen execute env from stream start (Phase 9I).
 * In-flight streams must not re-bind live env — matches harness sendMessages at snapshot time.
 */
export function resolveGrpcStudioStreamMessageBodyForSend(
  body: Record<string, unknown>,
  interpolationEnv: GrpcInterpolationEnvSnapshot | undefined,
): Record<string, unknown> {
  if (!interpolationEnv?.env) {
    throw new Error(
      'Cannot send stream message without an active execute snapshot — restart the stream',
    );
  }
  const resolveTemplate = createGrpcInterpolationTemplateResolver(interpolationEnv.env);
  const resolved = stripGrpcMapPendingKeysDeep(
    resolveGrpcInterpolationJsonValue(body ?? {}, resolveTemplate),
  ) as Record<string, unknown>;
  assertGrpcInterpolationJsonTemplatesResolved(resolved);
  return resolved;
}
