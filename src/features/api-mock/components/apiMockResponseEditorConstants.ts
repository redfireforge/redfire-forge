import type { ApiMockFaultKind } from '../../../shared/api-mock/contracts';

export const FAULT_CARDS: Array<{ id: ApiMockFaultKind; title: string; description: string }> = [
  { id: 'none', title: 'No fault', description: 'Return the configured response normally.' },
  { id: 'timeout', title: 'Timeout / no response', description: 'Hold the connection until the safety limit.' },
  { id: 'reset', title: 'Connection reset', description: 'Reset the socket before completing the body.' },
  { id: 'dribble', title: 'Dribble chunks', description: 'Emit bounded body chunks on a schedule.' },
  { id: 'close', title: 'Empty / close', description: 'Close the connection with an empty body.' },
  { id: 'malformed', title: 'Malformed', description: 'Send a deliberately invalid HTTP framing.' },
];

export const CONTENT_TYPE_PRESETS = [
  'application/json',
  'application/problem+json',
  'text/plain',
  'text/html',
  'application/xml',
  'text/csv',
  'application/octet-stream',
];

export const CUSTOM_CONTENT_TYPE = '__custom__';

/** Reason phrases for the statuses a mock realistically returns. */
export const STATUS_REASONS: Record<number, string> = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 409: 'Conflict', 410: 'Gone',
  415: 'Unsupported Media Type', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

export const QUICK_STATUSES = [200, 201, 400, 401, 404, 409, 500];
