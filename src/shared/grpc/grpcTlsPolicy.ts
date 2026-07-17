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

/** Validate + normalize TLS fields for target resolution and execute snapshots (Phase 4B). */
export function prepareGrpcTarget(
  target: Pick<GrpcTarget, 'address' | 'tlsMode' | 'tlsConfig'>,
): { target: GrpcTarget; issues: GrpcTlsValidationIssue[] } {
  const tlsMode = target.tlsMode ?? defaultGrpcTlsMode();
  const issues = validateGrpcTlsConfigContract(tlsMode, target.tlsConfig);
  const tlsConfig = issues.length === 0
    ? normalizeGrpcTlsConfig(target.tlsConfig, tlsMode)
    : target.tlsConfig;
  return {
    target: {
      address: target.address,
      tlsMode,
      tlsConfig,
    },
    issues,
  };
}
