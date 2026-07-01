/**
 * Phase 4A — secret field classification and persistence policy.
 */
import type { GrpcSecretStorageClass } from './contracts';

/** Dot-paths for secret-bearing fields across gRPC Studio payloads. */
export const GRPC_SECRET_FIELD_PATHS = [
  'auth.bearerToken',
  'auth.basicPassword',
  'auth.apiKeyValue',
  'auth.oauth2.clientSecret',
  'target.tlsConfig.serverCaPem',
  'target.tlsConfig.clientCertPem',
  'target.tlsConfig.clientKeyPem',
  'tlsConfig.serverCaPem',
  'tlsConfig.clientCertPem',
  'tlsConfig.clientKeyPem',
  'protoIngest.bsrToken',
  'bsrToken',
] as const;

export type GrpcSecretFieldPath = (typeof GRPC_SECRET_FIELD_PATHS)[number];

/** Surfaces that must never receive raw secret values (Phase 4A contract). */
export const GRPC_REDACTION_CONSUMERS = [
  'call_history',
  'workflow_export',
  'harness_export',
  'runner_artifacts',
  'toast_messages',
  'error_envelopes',
  'server_logs',
  'diagnostics',
  'clipboard_copy',
] as const;

export type GrpcRedactionConsumer = (typeof GRPC_REDACTION_CONSUMERS)[number];

const SECRET_PATH_SET = new Set<string>(GRPC_SECRET_FIELD_PATHS);

export function isGrpcSecretFieldPath(path: string): boolean {
  return SECRET_PATH_SET.has(path);
}

/** Default storage class per secret surface (browser vs desktop resolved in Phase 4E). */
export function defaultGrpcSecretStorageClass(
  surface: 'tls_pem' | 'auth_token' | 'bsr_token',
  platform: 'web' | 'desktop',
): GrpcSecretStorageClass {
  if (surface === 'tls_pem') {
    return 'encrypted_local';
  }
  if (surface === 'bsr_token') {
    return platform === 'desktop' ? 'encrypted_local' : 'session_memory';
  }
  if (platform === 'desktop') {
    return 'encrypted_local';
  }
  return 'session_memory';
}

/** Secrets must never be written to these persistence keys without redaction. */
export const GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS = [
  'grpc_collections_v1',
  'grpc_call_history_v1',
  'grpc_export_bundle',
  'workflow_node_snapshot',
  'harness_scenario_export',
  'harness_result_export',
  'runner_artifacts',
  'grpc_load_test_export',
  'grpc_schema_diff_export',
] as const;

export function isForbiddenGrpcSecretPersistTarget(key: string): boolean {
  return (GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS as readonly string[]).includes(key);
}

/** Heuristic for dynamic metadata keys that carry secret material (export/display redaction). */
export function isGrpcSecretMetadataKey(key: string): boolean {
  const lower = key.trim().toLowerCase();
  if (!lower) return false;
  if (lower === 'authorization') return true;
  return lower.includes('token')
    || lower.includes('secret')
    || lower.includes('password')
    || lower.includes('api-key')
    || lower.includes('apikey')
    || lower.endsWith('-key');
}
