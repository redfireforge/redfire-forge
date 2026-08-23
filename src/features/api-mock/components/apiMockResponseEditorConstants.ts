import type { ApiMockFaultKind, ApiMockResponseBodyKind } from '@shared/api-mock/contracts';

export const FAULT_CARDS: Array<{ id: ApiMockFaultKind; title: string; description: string }> = [
  { id: 'none', title: 'No fault', description: 'Return the configured response normally.' },
  { id: 'timeout', title: 'Timeout / no response', description: 'Hold the socket with no HTTP response. Set the hold below — each hung request occupies one connection.' },
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

export interface HttpStatusEntry {
  code: number;
  reason: string;
  description: string;
}

export interface HttpStatusCategory {
  label: string;
  range: string;
  entries: HttpStatusEntry[];
}

export const HTTP_STATUS_CATALOG: HttpStatusCategory[] = [
  {
    label: 'Informational', range: '1xx',
    entries: [
      { code: 100, reason: 'Continue', description: 'Server received the request headers; client should proceed to send the body.' },
      { code: 101, reason: 'Switching Protocols', description: 'Server is switching protocols as requested (e.g. WebSocket upgrade).' },
      { code: 102, reason: 'Processing', description: 'Server has received and is processing the request (WebDAV).' },
      { code: 103, reason: 'Early Hints', description: 'Lets the client start preloading resources while the server prepares a response.' },
    ],
  },
  {
    label: 'Success', range: '2xx',
    entries: [
      { code: 200, reason: 'OK', description: 'Standard response for successful requests.' },
      { code: 201, reason: 'Created', description: 'Request fulfilled and a new resource was created.' },
      { code: 202, reason: 'Accepted', description: 'Request accepted for processing, but not yet completed.' },
      { code: 203, reason: 'Non-Authoritative Information', description: 'Returned meta-information is from a local or third-party copy.' },
      { code: 204, reason: 'No Content', description: 'Request succeeded but there is no content to send back.' },
      { code: 205, reason: 'Reset Content', description: 'Request succeeded; the client should reset the document view.' },
      { code: 206, reason: 'Partial Content', description: 'Server is delivering only part of the resource due to a range header.' },
      { code: 207, reason: 'Multi-Status', description: 'Multiple status codes for multiple sub-requests (WebDAV).' },
      { code: 208, reason: 'Already Reported', description: 'Members of a DAV binding have already been enumerated.' },
      { code: 226, reason: 'IM Used', description: 'Server fulfilled a GET for the resource with instance-manipulations applied.' },
    ],
  },
  {
    label: 'Redirection', range: '3xx',
    entries: [
      { code: 300, reason: 'Multiple Choices', description: 'Multiple options for the resource from which the client may choose.' },
      { code: 301, reason: 'Moved Permanently', description: 'Resource has been permanently moved to a new URI.' },
      { code: 302, reason: 'Found', description: 'Resource temporarily resides under a different URI.' },
      { code: 303, reason: 'See Other', description: 'Response to the request can be found under another URI using GET.' },
      { code: 304, reason: 'Not Modified', description: 'Resource has not been modified since the version specified by request headers.' },
      { code: 307, reason: 'Temporary Redirect', description: 'Request should be repeated with another URI, preserving the method.' },
      { code: 308, reason: 'Permanent Redirect', description: 'Request and all future requests should be repeated using another URI, preserving the method.' },
    ],
  },
  {
    label: 'Client Error', range: '4xx',
    entries: [
      { code: 400, reason: 'Bad Request', description: 'Server cannot process the request due to a client error (malformed syntax, etc.).' },
      { code: 401, reason: 'Unauthorized', description: 'Authentication is required and has not been provided or has failed.' },
      { code: 402, reason: 'Payment Required', description: 'Reserved for future use; sometimes used for digital payment systems.' },
      { code: 403, reason: 'Forbidden', description: 'Server understood the request but refuses to authorize it.' },
      { code: 404, reason: 'Not Found', description: 'Requested resource could not be found on the server.' },
      { code: 405, reason: 'Method Not Allowed', description: 'Request method is not supported for the target resource.' },
      { code: 406, reason: 'Not Acceptable', description: 'No content matching the Accept headers is available.' },
      { code: 407, reason: 'Proxy Authentication Required', description: 'Client must first authenticate itself with the proxy.' },
      { code: 408, reason: 'Request Timeout', description: 'Server timed out waiting for the request.' },
      { code: 409, reason: 'Conflict', description: 'Request conflicts with the current state of the target resource.' },
      { code: 410, reason: 'Gone', description: 'Resource is no longer available and will not be available again.' },
      { code: 411, reason: 'Length Required', description: 'Request did not specify the length of its content as required.' },
      { code: 412, reason: 'Precondition Failed', description: 'One or more preconditions in the request headers evaluated to false.' },
      { code: 413, reason: 'Payload Too Large', description: 'Request entity is larger than the server is willing to process.' },
      { code: 414, reason: 'URI Too Long', description: 'URI provided was too long for the server to process.' },
      { code: 415, reason: 'Unsupported Media Type', description: 'Request entity has a media type which the server does not support.' },
      { code: 416, reason: 'Range Not Satisfiable', description: 'Client has asked for a portion of the file the server cannot supply.' },
      { code: 417, reason: 'Expectation Failed', description: 'Server cannot meet the requirements of the Expect request header.' },
      { code: 418, reason: "I'm a Teapot", description: 'Server refuses to brew coffee because it is a teapot (RFC 2324).' },
      { code: 422, reason: 'Unprocessable Entity', description: 'Request was well-formed but semantically erroneous (WebDAV).' },
      { code: 423, reason: 'Locked', description: 'Resource that is being accessed is locked (WebDAV).' },
      { code: 424, reason: 'Failed Dependency', description: 'Request failed due to failure of a previous request (WebDAV).' },
      { code: 425, reason: 'Too Early', description: 'Server is unwilling to risk processing a request that might be replayed.' },
      { code: 426, reason: 'Upgrade Required', description: 'Client should switch to a different protocol (e.g. TLS/1.0).' },
      { code: 428, reason: 'Precondition Required', description: 'Origin server requires the request to be conditional.' },
      { code: 429, reason: 'Too Many Requests', description: 'User has sent too many requests in a given amount of time (rate limiting).' },
      { code: 431, reason: 'Request Header Fields Too Large', description: 'Server refuses the request because header fields are too large.' },
      { code: 451, reason: 'Unavailable For Legal Reasons', description: 'Resource is unavailable due to a legal demand.' },
    ],
  },
  {
    label: 'Server Error', range: '5xx',
    entries: [
      { code: 500, reason: 'Internal Server Error', description: 'Server encountered an unexpected condition.' },
      { code: 501, reason: 'Not Implemented', description: 'Server does not support the functionality required to fulfill the request.' },
      { code: 502, reason: 'Bad Gateway', description: 'Server acting as a gateway received an invalid response from the upstream server.' },
      { code: 503, reason: 'Service Unavailable', description: 'Server is currently unable to handle the request (overloaded or maintenance).' },
      { code: 504, reason: 'Gateway Timeout', description: 'Server acting as a gateway did not receive a timely response from the upstream server.' },
      { code: 505, reason: 'HTTP Version Not Supported', description: 'Server does not support the HTTP version used in the request.' },
      { code: 506, reason: 'Variant Also Negotiates', description: 'Transparent content negotiation resulted in a circular reference.' },
      { code: 507, reason: 'Insufficient Storage', description: 'Server is unable to store the representation needed to complete the request (WebDAV).' },
      { code: 508, reason: 'Loop Detected', description: 'Server detected an infinite loop while processing the request (WebDAV).' },
      { code: 510, reason: 'Not Extended', description: 'Further extensions to the request are required for the server to fulfill it.' },
      { code: 511, reason: 'Network Authentication Required', description: 'Client needs to authenticate to gain network access (captive portal).' },
    ],
  },
];

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
