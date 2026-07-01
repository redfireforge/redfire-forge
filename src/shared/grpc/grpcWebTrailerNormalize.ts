/**
 * gRPC-Web trailer and status normalization — Phase 10C.
 *
 * Maps HTTP headers and in-body trailer frames to canonical grpc status fields.
 */
import {
  decodeGrpcWebResponseBody,
  splitGrpcWebResponseFrames,
  type GrpcWebFrame,
} from './grpcWebFramingCodec';

const GRPC_STATUS_HEADER = 'grpc-status';
const GRPC_MESSAGE_HEADER = 'grpc-message';

export interface GrpcWebCanonicalUnaryResponse {
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  dataPayloads: Uint8Array[];
}

function decodeGrpcMessageHeader(value: string): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function headerRecordFromFetch(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function parseTrailerBlock(payload: Uint8Array): Record<string, string> {
  const text = new TextDecoder().decode(payload);
  const trailers: Record<string, string> = {};
  for (const line of text.split('\r\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    const value = trimmed.slice(separator + 1).trim();
    trailers[key] = value;
  }
  return trailers;
}

function parseGrpcStatus(value: string | undefined, fallbackMessage: string): {
  status: number;
  statusMessage: string;
} {
  if (value === undefined || value.trim() === '') {
    return { status: 0, statusMessage: fallbackMessage || 'OK' };
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return { status: 2, statusMessage: fallbackMessage || `Invalid grpc-status: ${value}` };
  }
  return {
    status: parsed,
    statusMessage: fallbackMessage || (parsed === 0 ? 'OK' : `gRPC status ${parsed}`),
  };
}

function mergeTrailerSources(
  httpHeaders: Record<string, string>,
  trailerFrames: readonly GrpcWebFrame[],
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const frame of trailerFrames) {
    Object.assign(merged, parseTrailerBlock(frame.payload));
  }
  for (const [key, value] of Object.entries(httpHeaders)) {
    if (key.startsWith('grpc-') || key.endsWith('-bin')) {
      merged[key] = value;
    }
  }
  return merged;
}

/** Normalize unary grpc-web response from fetch result into canonical status + payloads. */
export function normalizeGrpcWebUnaryResponse(input: {
  responseHeaders: Headers;
  body: Uint8Array | string;
  contentType: string;
}): GrpcWebCanonicalUnaryResponse {
  const headers = headerRecordFromFetch(input.responseHeaders);
  const frames = decodeGrpcWebResponseBody(input.body, input.contentType);
  const { dataFrames, trailerFrames } = splitGrpcWebResponseFrames(frames);
  const trailers = mergeTrailerSources(headers, trailerFrames);

  const headerStatus = headers[GRPC_STATUS_HEADER];
  const headerMessage = headers[GRPC_MESSAGE_HEADER];
  const trailerStatus = trailers[GRPC_STATUS_HEADER];
  const trailerMessage = trailers[GRPC_MESSAGE_HEADER];

  const statusSource = headerStatus ?? trailerStatus;
  const messageSource = headerMessage ?? trailerMessage ?? '';
  const decodedMessage = decodeGrpcMessageHeader(messageSource);
  const { status, statusMessage } = parseGrpcStatus(statusSource, decodedMessage);

  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key === GRPC_STATUS_HEADER || key === GRPC_MESSAGE_HEADER) continue;
    if (key.startsWith('grpc-')) continue;
    responseHeaders[key] = value;
  }

  const responseTrailers: Record<string, string> = { ...trailers };
  delete responseTrailers[GRPC_STATUS_HEADER];
  delete responseTrailers[GRPC_MESSAGE_HEADER];

  return {
    status,
    statusMessage,
    headers: responseHeaders,
    trailers: responseTrailers,
    dataPayloads: dataFrames.map((frame) => frame.payload.slice()),
  };
}

export function resetGrpcWebTrailerNormalizeForTests(): void {
  // Stateless module — symmetry hook for test suites.
}
