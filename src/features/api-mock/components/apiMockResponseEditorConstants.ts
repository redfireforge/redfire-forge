import type { ApiMockFaultKind, ApiMockResponseBodyKind } from '../../../shared/api-mock/contracts';

export const FAULT_CARDS: Array<{ id: ApiMockFaultKind; title: string; description: string }> = [
  { id: 'none', title: 'No fault', description: 'Return the configured response normally.' },
  { id: 'timeout', title: 'Timeout / no response', description: 'Hold the connection until the safety limit.' },
  { id: 'reset', title: 'Connection reset', description: 'Reset the socket before completing the body.' },
  { id: 'dribble', title: 'Dribble chunks', description: 'Leak the body in scheduled pieces. An empty row waits without writing bytes.' },
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

/** Map a Content-Type to the body kind the editor and renderer should use. */
export function kindFromContentType(contentType: string | undefined): ApiMockResponseBodyKind {
  const v = (contentType ?? '').toLowerCase();
  if (v.includes('json')) return 'json';
  if (v.includes('html')) return 'html';
  if (v.includes('xml')) return 'xml';
  if (v.includes('octet-stream')) return 'binary_base64';
  if (v.startsWith('text/') || v.includes('csv')) return 'text';
  return 'text';
}

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

/** Cookie flag meanings shown under Cookies and on the SameSite menu. */
export const COOKIE_FLAG_HELP: Array<{ term: string; meaning: string }> = [
  { term: 'HttpOnly', meaning: 'JavaScript cannot read this cookie (`document.cookie`).' },
  { term: 'Secure', meaning: 'Sent only over HTTPS.' },
  { term: 'SameSite=Strict', meaning: 'This site only — never sent on cross-site requests, including clicked links.' },
  { term: 'SameSite=Lax', meaning: 'Sent on top-level GET navigations (a clicked link); blocked on cross-site POSTs and embeds. Default.' },
  { term: 'SameSite=None', meaning: 'Sent on cross-site requests. Browsers require Secure as well.' },
];

export const COOKIE_SAMESITE_OPTIONS = [
  { value: 'Strict', label: 'SameSite=Strict', detail: 'This site only — no cross-site requests.' },
  { value: 'Lax', label: 'SameSite=Lax', detail: 'Sent on clicked links; blocked on cross-site POSTs. Default.' },
  { value: 'None', label: 'SameSite=None', detail: 'Sent cross-site; requires Secure.' },
] as const;
