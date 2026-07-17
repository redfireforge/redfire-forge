/**
 * GraphqlResponseViewer helpers — extracted from component files for
 * react-refresh/only-export-components compliance.
 */

export interface JsonToken {
  cls?: string;
  text: string;
}

export function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const n = json.length;
  let i = 0;

  while (i < n) {
    const ch = json[i];

    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      let j = i;
      while (j < n && (json[j] === '\n' || json[j] === '\r' || json[j] === ' ' || json[j] === '\t')) {
        j++;
      }
      tokens.push({ text: json.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (json[j] === '\\') { j += 2; continue; }
        if (json[j] === '"') { j++; break; }
        j++;
      }
      const text = json.slice(i, j);
      let k = j;
      while (k < n && (json[k] === ' ' || json[k] === '\t')) k++;
      tokens.push({ cls: json[k] === ':' ? 'gql-json-key' : 'gql-json-str', text });
      i = j;
      continue;
    }

    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i;
      while (j < n && /[-\d.eE+]/.test(json[j])) j++;
      tokens.push({ cls: 'gql-json-num', text: json.slice(i, j) });
      i = j;
      continue;
    }

    if (json.startsWith('true', i))  { tokens.push({ cls: 'gql-json-bool', text: 'true'  }); i += 4; continue; }
    if (json.startsWith('false', i)) { tokens.push({ cls: 'gql-json-bool', text: 'false' }); i += 5; continue; }
    if (json.startsWith('null', i))  { tokens.push({ cls: 'gql-json-null', text: 'null'  }); i += 4; continue; }

    tokens.push({ cls: 'gql-json-punc', text: ch });
    i++;
  }

  return tokens;
}

export function humanizeBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function statusColorClass(httpStatus: number): string {
  if (httpStatus === 0)       return 'gql-status--network-error';
  if (httpStatus < 300)       return 'gql-status--ok';
  if (httpStatus < 400)       return 'gql-status--redirect';
  if (httpStatus < 500)       return 'gql-status--client-error';
  return 'gql-status--server-error';
}

export function statusBadgeLabel(httpStatus: number): string {
  if (httpStatus === 0) return 'Error';
  const map: Record<number, string> = {
    200: '200 OK',        201: '201 Created',   204: '204 No Content',
    301: '301 Moved',     302: '302 Found',      304: '304 Not Modified',
    400: '400 Bad Request', 401: '401 Unauthorized', 403: '403 Forbidden',
    404: '404 Not Found', 408: '408 Timeout',   422: '422 Unprocessable',
    429: '429 Too Many',
    500: '500 Server Error', 502: '502 Bad Gateway',
    503: '503 Unavailable', 504: '504 Timeout',
  };
  return map[httpStatus] ?? String(httpStatus);
}

export function statusFullLabel(httpStatus: number): string {
  if (httpStatus === 0) return 'Network Error';
  const map: Record<number, string> = {
    200: '200 OK',          201: '201 Created',         204: '204 No Content',
    301: '301 Moved Permanently', 302: '302 Found',     304: '304 Not Modified',
    400: '400 Bad Request', 401: '401 Unauthorized',    403: '403 Forbidden',
    404: '404 Not Found',   408: '408 Request Timeout', 422: '422 Unprocessable Entity',
    429: '429 Too Many Requests',
    500: '500 Internal Server Error', 502: '502 Bad Gateway',
    503: '503 Service Unavailable',   504: '504 Gateway Timeout',
  };
  return map[httpStatus] ?? String(httpStatus);
}

export const LARGE_RESPONSE_THRESHOLD = 512 * 1024;
