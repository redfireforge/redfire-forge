/**
 * Phase 4F — transport failure classification and user-facing messages.
 */
import {
  GRPC_ERROR_CODES,
  type GrpcErrorCategory,
  type GrpcErrorCode,
  type GrpcTlsFailureCategory,
} from './contracts';

export type GrpcAuthTransportFailure = 'auth_denied';

export interface GrpcTransportErrorDetails {
  tlsFailure?: GrpcTlsFailureCategory;
  authFailure?: GrpcAuthTransportFailure;
  grpcStatus?: number;
  statusMessage?: string;
  trailers?: Record<string, string>;
}

export interface GrpcTransportFailureClassification {
  message: string;
  code: GrpcErrorCode;
  category: GrpcErrorCategory;
  retryable: boolean;
  details: GrpcTransportErrorDetails;
}

const UNKNOWN_CA_PATTERN = /self[- ]signed certificate|unable to verify the first certificate|unknown ca|UNABLE_TO_VERIFY_LEAF_SIGNATURE|certificate signed by unknown authority|certificate verify failed/i;
const HOSTNAME_MISMATCH_PATTERN = /Hostname\/IP does not match|ERR_TLS_CERT_ALTNAME_INVALID|altnames|does not match certificate/i;
const EXPIRED_CERT_PATTERN = /certificate has expired|CERT_HAS_EXPIRED|certificate expired/i;
const EXPLICIT_HANDSHAKE_TIMEOUT_PATTERN = /handshake timeout|handshake timed out|SSL handshake timeout|TLS handshake timeout|SSL handshake timed out|TLS handshake timed out/i;
const INVALID_CLIENT_CERT_PATTERN = /alert bad certificate|peer did not return a certificate|certificate required|tlsv1 alert unknown ca.*client/i;
const INVALID_PEM_PATTERN = /PEM routines|bad decrypt|no start line|not enough data|error:090/i;
const UNREACHABLE_PATTERN = /ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EHOSTUNREACH/i;
const CONNECT_FAILURE_PATTERN = /failed to connect to all addresses|No connection established|DNS resolution failed/i;
const TLS_CONTEXT_PATTERN = /tls|ssl|certificate|handshake|cert|x509/i;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function combinedMessage(error: unknown, grpcDetails?: string): string {
  const base = errorMessage(error);
  if (grpcDetails?.trim() && !base.includes(grpcDetails.trim())) {
    return `${base} ${grpcDetails}`.trim();
  }
  return base;
}

export function formatGrpcTransportFailureMessage(input: {
  tlsFailure?: GrpcTlsFailureCategory;
  authFailure?: GrpcAuthTransportFailure;
  fallback?: string;
}): string {
  if (input.authFailure === 'auth_denied') {
    return 'The server rejected the call credentials (authentication or permission denied).';
  }
  switch (input.tlsFailure) {
    case 'unknown_ca':
      return 'TLS handshake failed: server certificate is not trusted (unknown or self-signed CA).';
    case 'hostname_mismatch':
      return 'TLS handshake failed: certificate hostname does not match the target address.';
    case 'expired_cert':
      return 'TLS handshake failed: server certificate has expired.';
    case 'handshake_timeout':
      return 'TLS handshake timed out before the connection was established.';
    case 'invalid_client_cert':
      return 'TLS handshake failed: client certificate was rejected by the server.';
    case 'invalid_pem':
      return 'TLS configuration contains invalid PEM material.';
    default:
      return input.fallback?.trim() || 'Transport connection failed.';
  }
}

function classifyTlsMessage(message: string): GrpcTlsFailureCategory | undefined {
  if (INVALID_PEM_PATTERN.test(message)) return 'invalid_pem';
  if (HOSTNAME_MISMATCH_PATTERN.test(message)) return 'hostname_mismatch';
  if (EXPIRED_CERT_PATTERN.test(message)) return 'expired_cert';
  if (UNKNOWN_CA_PATTERN.test(message)) return 'unknown_ca';
  if (INVALID_CLIENT_CERT_PATTERN.test(message)) return 'invalid_client_cert';
  if (EXPLICIT_HANDSHAKE_TIMEOUT_PATTERN.test(message)) return 'handshake_timeout';
  if (/ETIMEDOUT|ECONNRESET/i.test(message) && TLS_CONTEXT_PATTERN.test(message)) {
    return 'handshake_timeout';
  }
  return undefined;
}

function isAuthDeniedGrpcStatus(grpcStatus: number | undefined): boolean {
  return grpcStatus === 16 || grpcStatus === 7;
}

function isDialPhaseMessage(message: string): boolean {
  return classifyTlsMessage(message) !== undefined
    || UNREACHABLE_PATTERN.test(message)
    || CONNECT_FAILURE_PATTERN.test(message)
    || /not dialable/i.test(message);
}

/** User-facing message for stream/RPC terminal status (non-zero gRPC status). */
export function formatGrpcTransportStatusMessage(
  status: number,
  statusMessage: string,
): string {
  if (status === 0) return statusMessage;
  return classifyGrpcTransportFailure(statusMessage, { grpcStatus: status }).message;
}

export function classifyGrpcTransportFailure(
  error: unknown,
  options?: {
    grpcStatus?: number;
    grpcDetails?: string;
  },
): GrpcTransportFailureClassification {
  const message = combinedMessage(error, options?.grpcDetails);
  const grpcStatus = options?.grpcStatus
    ?? (typeof (error as { grpcStatus?: number }).grpcStatus === 'number'
      ? (error as { grpcStatus: number }).grpcStatus
      : undefined);

  if (isAuthDeniedGrpcStatus(grpcStatus)) {
    const details: GrpcTransportErrorDetails = {
      authFailure: 'auth_denied',
      grpcStatus,
      statusMessage: options?.grpcDetails,
    };
    return {
      message: formatGrpcTransportFailureMessage({ authFailure: 'auth_denied' }),
      code: GRPC_ERROR_CODES.CALL_FAILED,
      category: 'call_failed',
      retryable: false,
      details,
    };
  }

  if (typeof grpcStatus === 'number' && grpcStatus !== 0 && !isDialPhaseMessage(message)) {
    const details: GrpcTransportErrorDetails = {
      grpcStatus,
      statusMessage: options?.grpcDetails,
    };
    const displayMessage = options?.grpcDetails?.trim()
      ? `RPC failed: ${options.grpcDetails}`
      : message;
    return {
      message: displayMessage,
      code: GRPC_ERROR_CODES.CALL_FAILED,
      category: 'call_failed',
      retryable: false,
      details,
    };
  }

  const tlsFailure = classifyTlsMessage(message);
  if (tlsFailure) {
    const code = tlsFailure === 'invalid_pem'
      ? GRPC_ERROR_CODES.INVALID_REQUEST
      : GRPC_ERROR_CODES.UNREACHABLE;
    const category = tlsFailure === 'invalid_pem' ? 'validation' : 'unreachable';
    const details: GrpcTransportErrorDetails = { tlsFailure };
    return {
      message: formatGrpcTransportFailureMessage({ tlsFailure, fallback: message }),
      code,
      category,
      retryable: tlsFailure === 'handshake_timeout',
      details,
    };
  }

  const unreachable = UNREACHABLE_PATTERN.test(message)
    || CONNECT_FAILURE_PATTERN.test(message)
    || /not dialable/i.test(message);
  const decodeFailure = /Type .* not found|Invalid descriptor schema/i.test(message);

  if (decodeFailure) {
    return {
      message,
      code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      category: 'validation',
      retryable: false,
      details: {},
    };
  }

  if (unreachable) {
    return {
      message,
      code: GRPC_ERROR_CODES.UNREACHABLE,
      category: 'unreachable',
      retryable: true,
      details: {},
    };
  }

  return {
    message,
    code: GRPC_ERROR_CODES.CALL_FAILED,
    category: 'call_failed',
    retryable: false,
    details: {},
  };
}
