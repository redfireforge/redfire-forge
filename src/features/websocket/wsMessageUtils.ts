/**
 * Pure utility functions for WebSocket message rendering and validation.
 * Extracted from WebSocketMessageDetail.tsx to satisfy react-refresh/only-export-components.
 */

// Re-export shared JSON helpers so existing imports from wsMessageUtils don't break
export { isValidJson, prettyJson } from '../../shared/utils/helpers';

/** Decode a base64 string to Uint8Array. Falls back to UTF-8 encoding on decode error. */
export function decodeBase64ToBytes(data: string): Uint8Array {
  try {
    return decodeBase64ToBytesStrict(data);
  } catch {
    return new TextEncoder().encode(data);
  }
}

/** Decode a base64 string to Uint8Array. Throws on invalid base64. */
export function decodeBase64ToBytesStrict(data: string): Uint8Array {
  const binaryStr = atob(data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/** Check if a WebSocket URL starts with ws:// or wss:// (allows {{var}} templates) */
export function isValidWsUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  return lower.startsWith('ws://') || lower.startsWith('wss://');
}

/** Replace {{varName}} placeholders with env values; unresolved placeholders stay as-is */
export function resolveEnvVars(text: string, env: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    return env[trimmed] ?? _match;
  });
}

/** Returns true if text still contains unresolved {{…}} placeholders */
export function hasUnresolvedVars(text: string): boolean {
  return /\{\{[^}]+\}\}/.test(text);
}

/** Convert an HTTP base URL to a WebSocket URL (https→wss, http→ws) */
function httpToWsUrl(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) return 'wss://' + baseUrl.slice(8);
  if (baseUrl.startsWith('http://')) return 'ws://' + baseUrl.slice(7);
  return baseUrl;
}

/** Extract hostname + port from a URL string; returns empty string on failure */
function extractHost(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    return u.host;
  } catch {
    const noProto = baseUrl.replace(/^https?:\/\//, '');
    const slashIdx = noProto.indexOf('/');
    return slashIdx >= 0 ? noProto.slice(0, slashIdx) : noProto;
  }
}

/**
 * Build an env var map from the app's selected environment/microservice context.
 * Empty values are omitted so unresolved placeholders remain visible in the URL.
 */
export function buildWsEnvVarMap(
  resolvedBaseUrl?: string,
  envName?: string,
  svcName?: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  const base = resolvedBaseUrl?.trim();
  if (base) {
    map.baseUrl = base;
    map.wsBaseUrl = httpToWsUrl(base);
    const host = extractHost(base);
    if (host) map.host = host;
  }
  if (envName?.trim()) map.envName = envName.trim();
  if (svcName?.trim()) map.svcName = svcName.trim();
  return map;
}

/**
 * Build a fully resolved effective URL from a draft + env var map.
 * Resolves env vars in URL, query param keys, and query param values
 * BEFORE URL-encoding — so `{{token}}` in a query param is resolved
 * to its value before `encodeURIComponent` runs.
 */
export function buildResolvedEffectiveUrl(
  draft: { url: string; queryParams: { enabled: boolean; key: string; value: string }[] },
  envVarMap: Record<string, string>,
): string {
  const base = resolveEnvVars(draft.url.trim(), envVarMap);
  const enabledParams = draft.queryParams.filter((p) => p.enabled && p.key.trim().length > 0);
  if (enabledParams.length === 0) return base;

  const separator = base.includes('?') ? '&' : '?';
  const queryString = enabledParams
    .map((p) => {
      const key = resolveEnvVars(p.key.trim(), envVarMap);
      const value = resolveEnvVars(p.value, envVarMap);
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
  return `${base}${separator}${queryString}`;
}

/** Human-readable relative time for profile "Updated X ago" tags */
export function formatTimeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return isoDate;
  const diffMs = Math.max(0, Date.now() - then);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w ago`;
  return new Date(isoDate).toLocaleDateString();
}

/** Binary row preview: [N bytes] 0x.. 0x.. ... */
export function buildBinaryPreview(data: string, byteCount: number): string {
  const bytes = decodeBase64ToBytes(data);

  const count = byteCount > 0 ? byteCount : bytes.length;
  const maxShow = 8;
  const hexParts: string[] = [];
  for (let i = 0; i < Math.min(bytes.length, maxShow); i++) {
    hexParts.push(`0x${bytes[i].toString(16).padStart(2, '0').toUpperCase()}`);
  }
  const suffix = bytes.length > maxShow ? ' ...' : '';
  return `[${count} bytes] ${hexParts.join(' ')}${suffix}`;
}

/** UTF-8 byte length of a string */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}

/** Check if a string is valid base64 */
export function isValidBase64(s: string): boolean {
  if (s.trim().length === 0) return false;
  try {
    atob(s.trim());
    return true;
  } catch {
    return false;
  }
}

export type JsonTokenType = 'key' | 'string' | 'number' | 'bool' | 'null' | 'punct';

export function tokenizeJson(json: string): Array<{ type: JsonTokenType; text: string }> {
  const tokens: Array<{ type: JsonTokenType; text: string }> = [];
  const re = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\]:,\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(json)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({ type: 'key', text: match[1] });
      tokens.push({ type: 'punct', text: ':' });
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'string', text: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'number', text: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'bool', text: match[4] });
    } else if (match[5] !== undefined) {
      tokens.push({ type: 'null', text: match[5] });
    } else if (match[6] !== undefined) {
      tokens.push({ type: 'punct', text: match[6] });
    }
  }
  return tokens;
}

export interface HexDumpLine {
  offset: string;
  hexLeft: string;
  hexRight: string;
  ascii: string;
}

export function buildHexDumpLines(data: string, isBinary = false): HexDumpLine[] {
  let bytes: Uint8Array;
  if (isBinary) {
    bytes = decodeBase64ToBytes(data);
  } else {
    bytes = new TextEncoder().encode(data);
  }
  const lines: HexDumpLine[] = [];

  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const hexParts: string[] = [];
    const asciiParts: string[] = [];

    for (let i = 0; i < 16; i++) {
      if (i < chunk.length) {
        hexParts.push(chunk[i].toString(16).padStart(2, '0'));
        asciiParts.push(chunk[i] >= 0x20 && chunk[i] <= 0x7e ? String.fromCharCode(chunk[i]) : '.');
      } else {
        hexParts.push('  ');
        asciiParts.push(' ');
      }
    }

    lines.push({
      offset: offset.toString(16).padStart(8, '0'),
      hexLeft: hexParts.slice(0, 8).join(' '),
      hexRight: hexParts.slice(8).join(' '),
      ascii: asciiParts.join(''),
    });
  }

  return lines;
}

export function buildHexDump(data: string, isBinary = false): string {
  const lines = buildHexDumpLines(data, isBinary);
  if (lines.length === 0) return '(empty)';
  return lines
    .map((line) => `${line.offset}  ${line.hexLeft}  ${line.hexRight}  |${line.ascii}|`)
    .join('\n');
}

/** Format an ISO timestamp to HH:mm:ss.SSS for WebSocket message display. */
export function formatWsTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  } catch {
    return iso;
  }
}
