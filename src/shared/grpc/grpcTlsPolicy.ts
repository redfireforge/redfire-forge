/**
 * Phase 4A — TLS/mTLS contract validation (shape + mode rules; transport wired in Phase 4F).
 */
import { GRPC_ERROR_CODES, defaultGrpcTlsMode, type GrpcTarget, type GrpcTlsConfig, type GrpcTlsMode } from './contracts';

export interface GrpcTlsValidationIssue {
  field: string;
  code: string;
  message: string;
}

/** @deprecated Phase 4F enabled transport — retained for API compatibility; always false. */
export const GRPC_TLS_TRANSPORT_BLOCKED_MESSAGE =
  'TLS/mTLS transport is enabled (Phase 4F).';

export function isGrpcTlsTransportBlocked(_tlsMode: GrpcTlsMode | undefined): boolean {
  return false;
}

export function createGrpcTlsTransportBlockedError(): {
  code: typeof GRPC_ERROR_CODES.INVALID_TARGET;
  message: string;
} {
  return {
    code: GRPC_ERROR_CODES.INVALID_TARGET,
    message: GRPC_TLS_TRANSPORT_BLOCKED_MESSAGE,
  };
}

const PEM_BLOCK_PATTERN = /-----BEGIN [A-Z0-9 ]+-----[\s\S]+?-----END [A-Z0-9 ]+-----/;

export function looksLikePem(value: string): boolean {
  return PEM_BLOCK_PATTERN.test(value.trim());
}

export function normalizeGrpcTlsConfig(
  tlsConfig: GrpcTlsConfig | undefined,
  tlsMode: GrpcTlsMode,
): GrpcTlsConfig | undefined {
  if (!tlsConfig) return undefined;
  const normalized: GrpcTlsConfig = {};
  const serverCaPem = tlsConfig.serverCaPem?.trim();
  const clientCertPem = tlsConfig.clientCertPem?.trim();
  const clientKeyPem = tlsConfig.clientKeyPem?.trim();
  const serverNameOverride = tlsConfig.serverNameOverride?.trim();

  if (serverCaPem) normalized.serverCaPem = serverCaPem;
  if (clientCertPem) normalized.clientCertPem = clientCertPem;
  if (clientKeyPem) normalized.clientKeyPem = clientKeyPem;
  if (serverNameOverride && (tlsMode === 'tls' || tlsMode === 'mtls')) {
    normalized.serverNameOverride = serverNameOverride;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function validateOptionalPem(
  value: string | undefined,
  field: string,
  issues: GrpcTlsValidationIssue[],
): void {
  if (value === undefined || value.trim() === '') return;
  if (!looksLikePem(value)) {
    issues.push({
      field,
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: `${field} must be a PEM-encoded certificate or key`,
    });
  }
}

export function validateGrpcTlsConfigContract(
  tlsMode: GrpcTlsMode,
  tlsConfig: GrpcTlsConfig | undefined,
): GrpcTlsValidationIssue[] {
  const issues: GrpcTlsValidationIssue[] = [];
  const config = tlsConfig ?? {};

  if (tlsMode === 'disabled') {
    const hasTlsMaterial = Boolean(
      config.serverCaPem?.trim()
      || config.clientCertPem?.trim()
      || config.clientKeyPem?.trim()
      || config.serverNameOverride?.trim(),
    );
    if (hasTlsMaterial) {
      issues.push({
        field: 'tlsConfig',
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: 'TLS configuration requires tls or mtls mode',
      });
    }
    return issues;
  }

  validateOptionalPem(config.serverCaPem, 'tlsConfig.serverCaPem', issues);
  validateOptionalPem(config.clientCertPem, 'tlsConfig.clientCertPem', issues);
  validateOptionalPem(config.clientKeyPem, 'tlsConfig.clientKeyPem', issues);

  if (tlsMode === 'mtls') {
    if (!config.clientCertPem?.trim()) {
      issues.push({
        field: 'tlsConfig.clientCertPem',
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: 'clientCertPem is required when tlsMode is mtls',
      });
    }
    if (!config.clientKeyPem?.trim()) {
      issues.push({
        field: 'tlsConfig.clientKeyPem',
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: 'clientKeyPem is required when tlsMode is mtls',
      });
    }
  }

  return issues;
}

/** Canonical plaintext echo target used by Demo Hub gRPC lessons. */
export const GRPC_DEMO_PLAINTEXT_TARGET = 'localhost:50051';

/**
 * Docker plaintext echo fixtures (`:50051` / `:50052`). TLS handshakes against
 * these ports always fail with UNAVAILABLE / HTTP 503 ("wrong version number").
 */
export function isKnownPlaintextLoopbackGrpcTarget(address: string): boolean {
  const trimmed = address.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  return /^(?:localhost|127\.0\.0\.1|\[::1\]):5005[12](?:\/|$)/.test(trimmed);
}

/**
 * Docker TLS/mTLS echo fixtures (`:50443` / `:50444`). Plaintext dials against
 * these ports return UNAVAILABLE / HTTP 503 — common after GRPC-5 leftovers.
 */
export function isKnownEncryptedLoopbackGrpcTarget(address: string): boolean {
  const trimmed = address.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  return /^(?:localhost|127\.0\.0\.1|\[::1\]):5044[34](?:\/|$)/.test(trimmed);
}

/** Validate + normalize TLS fields for target resolution and execute snapshots (Phase 4B). */
export function prepareGrpcTarget(
  target: Pick<GrpcTarget, 'address' | 'tlsMode' | 'tlsConfig'>,
): { target: GrpcTarget; issues: GrpcTlsValidationIssue[] } {
  let tlsMode = target.tlsMode ?? defaultGrpcTlsMode();
  let rawTlsConfig = target.tlsConfig;
  // Sticky TLS/mTLS from a prior tab (e.g. GRPC-5 demo) must not dial the
  // plaintext echo fixture — coerce to plaintext before validation/reflect.
  if (tlsMode !== 'disabled' && isKnownPlaintextLoopbackGrpcTarget(target.address)) {
    tlsMode = 'disabled';
    rawTlsConfig = undefined;
  }
  const issues = validateGrpcTlsConfigContract(tlsMode, rawTlsConfig);
  const tlsConfig = issues.length === 0
    ? normalizeGrpcTlsConfig(rawTlsConfig, tlsMode)
    : rawTlsConfig;
  return {
    target: {
      address: target.address,
      tlsMode,
      tlsConfig,
    },
    issues,
  };
}
