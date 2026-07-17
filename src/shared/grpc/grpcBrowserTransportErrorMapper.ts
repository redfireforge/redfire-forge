/**
 * Browser-direct transport failure taxonomy — Phase 10E.
 *
 * Classifies grpc-web / spring-servlet fetch failures into stable
 * `details.browserTransportFailure` kinds with remediation hints.
 */
import type { GrpcErrorBody, GrpcOperation } from './contracts';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import { withGrpcExpressFallbackOffer } from './grpcTransportFallback';

export const GRPC_BROWSER_TRANSPORT_FAILURE_KINDS = [
  'cors',
  'proxy_unreachable',
  'protocol_mismatch',
  'timeout',
  'server_status',
] as const;

export type GrpcBrowserTransportFailureKind = typeof GRPC_BROWSER_TRANSPORT_FAILURE_KINDS[number];

export interface GrpcBrowserTransportFailureDetails {
  browserTransportFailure: GrpcBrowserTransportFailureKind;
  transportMode?: GrpcStudioTransportMode;
  httpStatus?: number;
  suggestExpressProxy?: boolean;
}

const CORS_PATTERN = /cors|cross-origin|access-control|preflight request/i;
const NETWORK_UNREACHABLE_PATTERN = /failed to fetch|networkerror|network request failed|load failed|net::err_|enotfound|econnrefused|ehostunreach|unable to connect|could not connect|connection refused|dns/i;
const PROTOCOL_MISMATCH_PATTERN = /unexpected content-type|not valid grpc|invalid grpc|html response|text\/html|application\/json|decode.*frame|incomplete.*frame|frame header|malformed|unexpected token/i;

export function isBrowserDirectTransportMode(mode: GrpcStudioTransportMode): boolean {
  return mode === 'grpc-web' || mode === 'spring-servlet';
}

export function transportModeLabel(mode: GrpcStudioTransportMode): string {
  switch (mode) {
    case 'grpc-web': return 'gRPC-Web';
    case 'spring-servlet': return 'Spring Servlet';
    case 'express': return 'Express Proxy';
    case 'tauri': return 'Tauri Native';
    default: return mode;
  }
}

export function extractBrowserTransportFailure(
  error: GrpcErrorBody | undefined,
): GrpcBrowserTransportFailureDetails | undefined {
  if (!error?.details || typeof error.details !== 'object') {
    return undefined;
  }
  const details = error.details as GrpcBrowserTransportFailureDetails;
  if (!details.browserTransportFailure) {
    return undefined;
  }
  return details;
}

export function shouldSuggestExpressProxyForBrowserFailure(
  kind: GrpcBrowserTransportFailureKind,
): boolean {
  return kind === 'cors' || kind === 'proxy_unreachable' || kind === 'protocol_mismatch';
}

export function isBrowserTransportExpressFallbackEligible(error: GrpcErrorBody): boolean {
  if (!error?.details || typeof error.details !== 'object') {
    return false;
  }
  const details = error.details as GrpcBrowserTransportFailureDetails;
  if (details.suggestExpressProxy === true) {
    return true;
  }
  if (!details.browserTransportFailure) {
    return false;
  }
  return shouldSuggestExpressProxyForBrowserFailure(details.browserTransportFailure);
}

export function grpcApiErrorToBrowserExpressFallbackBody(
  error: GrpcApiClientError,
  transportMode: GrpcStudioTransportMode,
): GrpcErrorBody {
  const body = error.toErrorBody();
  if (!isBrowserTransportExpressFallbackEligible(body)) {
    return body;
  }
  const details = body.details as GrpcBrowserTransportFailureDetails | undefined;
  const attemptedMode = details?.transportMode
    ?? extractBrowserTransportFailure(body)?.transportMode
    ?? transportMode;
  return withGrpcExpressFallbackOffer(body, body.message, attemptedMode);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? '');
}

export function classifyBrowserTransportFetchFailure(input: {
  error: unknown;
  transportMode: GrpcStudioTransportMode;
}): GrpcBrowserTransportFailureKind | undefined {
  if (!isBrowserDirectTransportMode(input.transportMode)) {
    return undefined;
  }

  const message = errorMessage(input.error);
  if (CORS_PATTERN.test(message)) {
    return 'cors';
  }
  if (PROTOCOL_MISMATCH_PATTERN.test(message)) {
    return 'protocol_mismatch';
  }
  if (NETWORK_UNREACHABLE_PATTERN.test(message)) {
    return 'proxy_unreachable';
  }
  if (message.trim()) {
    return 'proxy_unreachable';
  }
  return undefined;
}

export function classifyBrowserTransportHttpResponse(input: {
  httpStatus: number;
  contentType?: string;
  bodyLength: number;
  transportMode: GrpcStudioTransportMode;
}): GrpcBrowserTransportFailureKind {
  const contentType = input.contentType?.toLowerCase() ?? '';
  if (contentType.includes('text/html')) {
    return 'protocol_mismatch';
  }
  if (contentType.includes('application/json')) {
    return 'protocol_mismatch';
  }
  if (input.httpStatus === 415 || input.httpStatus === 406) {
    return 'protocol_mismatch';
  }
  if (input.httpStatus === 404 && isBrowserDirectTransportMode(input.transportMode)) {
    return 'protocol_mismatch';
  }
  return 'server_status';
}

export function formatBrowserTransportFailureMessage(
  kind: GrpcBrowserTransportFailureKind,
  options: {
    transportMode: GrpcStudioTransportMode;
    httpStatus?: number;
    fallbackMessage?: string;
  },
): string {
  const modeLabel = transportModeLabel(options.transportMode);
  switch (kind) {
    case 'cors':
      return 'Browser blocked the cross-origin request (CORS).';
    case 'proxy_unreachable':
      return options.fallbackMessage?.trim()
        || `Could not reach the server using ${modeLabel}.`;
    case 'protocol_mismatch':
      return `Server response is not compatible with ${modeLabel} transport.`;
    case 'timeout':
      return `${modeLabel} call timed out before a response was received.`;
    case 'server_status':
      if (options.httpStatus) {
        return `${modeLabel} request failed with HTTP ${options.httpStatus}.`;
      }
      return options.fallbackMessage?.trim() || `${modeLabel} request failed.`;
    default:
      return options.fallbackMessage?.trim() || `${modeLabel} request failed.`;
  }
}

export function formatBrowserTransportFailureHint(
  error: GrpcErrorBody | undefined,
): string | undefined {
  const details = extractBrowserTransportFailure(error);
  if (!details) {
    return undefined;
  }

  const modeLabel = transportModeLabel(details.transportMode ?? 'grpc-web');
  switch (details.browserTransportFailure) {
    case 'cors':
      return 'Allow CORS on the server for your Studio origin and include gRPC-Web or application/grpc '
        + 'headers (e.g. `x-grpc-web`, `content-type`, `grpc-timeout`, and custom metadata). '
        + 'Or switch to Express Proxy for local HTTP/2 without browser CORS.';
    case 'proxy_unreachable':
      return 'Verify the target address is reachable from your browser and the server is running. '
        + 'Express Proxy routes through the local Node server for true HTTP/2 gRPC.';
    case 'protocol_mismatch':
      return `Confirm the server exposes ${modeLabel} endpoints (Envoy grpc-web proxy vs Spring servlet vs native gRPC). `
        + 'Wrong transport mode often returns HTML or JSON instead of gRPC frames. Try Express Proxy.';
    case 'timeout':
      return 'Increase the call timeout or check server load. Express Proxy may behave differently for long calls.';
    case 'server_status':
      if (details.httpStatus && details.httpStatus >= 500) {
        return 'The server returned an HTTP error. Check server logs. Express Proxy may bypass browser HTTP/1.1 limits.';
      }
      return 'The server rejected the HTTP request. Verify path, TLS, and transport mode.';
    default:
      return undefined;
  }
}

function failureCodeAndCategory(kind: GrpcBrowserTransportFailureKind): {
  code: string;
  category: 'unreachable' | 'call_failed';
  retryable: boolean;
} {
  switch (kind) {
    case 'cors':
      return { code: GRPC_ERROR_CODES.UNREACHABLE, category: 'unreachable', retryable: true };
    case 'proxy_unreachable':
      return { code: GRPC_ERROR_CODES.UNREACHABLE, category: 'unreachable', retryable: true };
    case 'timeout':
      return { code: GRPC_ERROR_CODES.UNREACHABLE, category: 'unreachable', retryable: true };
    case 'protocol_mismatch':
      return { code: GRPC_ERROR_CODES.CALL_FAILED, category: 'call_failed', retryable: false };
    case 'server_status':
      return { code: GRPC_ERROR_CODES.UNREACHABLE, category: 'unreachable', retryable: true };
    default:
      return { code: GRPC_ERROR_CODES.UNREACHABLE, category: 'unreachable', retryable: true };
  }
}

export function buildBrowserTransportGrpcApiError(
  op: GrpcOperation,
  kind: GrpcBrowserTransportFailureKind,
  options: {
    transportMode: GrpcStudioTransportMode;
    httpStatus?: number;
    fallbackMessage?: string;
  },
): GrpcApiClientError {
  const { code, category, retryable } = failureCodeAndCategory(kind);
  const suggestExpressProxy = shouldSuggestExpressProxyForBrowserFailure(kind);
  return new GrpcApiClientError(
    op,
    formatBrowserTransportFailureMessage(kind, options),
    {
      code,
      category,
      retryable,
      details: {
        browserTransportFailure: kind,
        transportMode: options.transportMode,
        ...(options.httpStatus !== undefined ? { httpStatus: options.httpStatus } : {}),
        suggestExpressProxy,
      } satisfies GrpcBrowserTransportFailureDetails,
    },
  );
}

export function mapBrowserTransportFetchFailure(
  op: GrpcOperation,
  error: unknown,
  options: {
    transportMode: GrpcStudioTransportMode;
    abortCause?: 'cancel' | 'timeout';
  },
): GrpcApiClientError {
  if (options.abortCause === 'timeout') {
    return buildBrowserTransportGrpcApiError(op, 'timeout', {
      transportMode: options.transportMode,
    });
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new GrpcApiClientError(op, 'Call cancelled', {
      code: GRPC_ERROR_CODES.CANCELLED,
      category: 'cancelled',
      retryable: false,
    });
  }

  if (error instanceof GrpcApiClientError) {
    return error;
  }

  const kind = classifyBrowserTransportFetchFailure({
    error,
    transportMode: options.transportMode,
  });
  if (kind) {
    return buildBrowserTransportGrpcApiError(op, kind, {
      transportMode: options.transportMode,
      fallbackMessage: errorMessage(error),
    });
  }

  const message = errorMessage(error) || 'Browser transport fetch failed';
  return new GrpcApiClientError(op, message, {
    code: GRPC_ERROR_CODES.UNREACHABLE,
    category: 'unreachable',
    retryable: true,
  });
}

export function assertIncompatibleBrowserTransportContentType(
  contentType: string,
  transportMode: GrpcStudioTransportMode,
  httpStatus?: number,
): GrpcApiClientError | undefined {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('text/html')) {
    return buildBrowserTransportGrpcApiError('call', 'protocol_mismatch', {
      transportMode,
      httpStatus,
      fallbackMessage: 'Server returned HTML instead of gRPC frames.',
    });
  }
  if (normalized.includes('application/json')) {
    return buildBrowserTransportGrpcApiError('call', 'protocol_mismatch', {
      transportMode,
      httpStatus,
      fallbackMessage: 'Server returned JSON instead of gRPC frames.',
    });
  }
  return undefined;
}

/** Map decode/framing failures to protocol_mismatch for browser-direct transports. */
export function mapBrowserTransportDecodeFailure(
  transportMode: GrpcStudioTransportMode,
  error: unknown,
): GrpcApiClientError | undefined {
  if (!isBrowserDirectTransportMode(transportMode)) {
    return undefined;
  }
  const message = errorMessage(error);
  if (PROTOCOL_MISMATCH_PATTERN.test(message)) {
    return buildBrowserTransportGrpcApiError('call', 'protocol_mismatch', {
      transportMode,
      fallbackMessage: message,
    });
  }
  return undefined;
}

export function resetGrpcBrowserTransportErrorMapperForTests(): void {
  // Stateless module — symmetry hook for test suites.
}
