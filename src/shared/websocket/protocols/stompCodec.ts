// STOMP v1.2 commands
export const STOMP_CLIENT_COMMANDS = [
  'CONNECT', 'STOMP', 'SEND', 'SUBSCRIBE', 'UNSUBSCRIBE',
  'ACK', 'NACK', 'DISCONNECT', 'BEGIN', 'COMMIT', 'ABORT',
] as const;

export const STOMP_SERVER_COMMANDS = [
  'CONNECTED', 'MESSAGE', 'RECEIPT', 'ERROR',
] as const;

export type StompClientCommand = (typeof STOMP_CLIENT_COMMANDS)[number];
export type StompServerCommand = (typeof STOMP_SERVER_COMMANDS)[number];
export type StompCommand = StompClientCommand | StompServerCommand;

const ALL_COMMANDS = new Set<string>([...STOMP_CLIENT_COMMANDS, ...STOMP_SERVER_COMMANDS]);

export interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
  raw: string;
}

const NULL_CHAR = '\0';

/**
 * Decode a raw STOMP frame string.
 * Format: COMMAND\n header1:value1\n header2:value2\n \n body\0
 */
export function decodeStompFrame(raw: string): StompFrame {
  const cleaned = raw.endsWith(NULL_CHAR) ? raw.slice(0, -1) : raw;

  const headerEndIdx = cleaned.indexOf('\n\n');
  let headerSection: string;
  let body: string;

  if (headerEndIdx === -1) {
    const crlfEnd = cleaned.indexOf('\r\n\r\n');
    if (crlfEnd !== -1) {
      headerSection = cleaned.slice(0, crlfEnd);
      body = cleaned.slice(crlfEnd + 4);
    } else {
      headerSection = cleaned;
      body = '';
    }
  } else {
    headerSection = cleaned.slice(0, headerEndIdx);
    body = cleaned.slice(headerEndIdx + 2);
  }

  const lines = headerSection.split(/\r?\n/);
  const command = (lines[0] ?? '').trim().toUpperCase();

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = decodeStompHeaderValue(line.slice(0, colonIdx));
      const value = decodeStompHeaderValue(line.slice(colonIdx + 1));
      if (!(key in headers)) {
        headers[key] = value;
      }
    }
  }

  return { command, headers, body, raw };
}

/**
 * Decode STOMP header value escape sequences (v1.2).
 * Order matters: process \\ first to avoid misinterpreting \\n as \n.
 */
function decodeStompHeaderValue(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === '\\') { result += '\\'; i++; }
      else if (next === 'n') { result += '\n'; i++; }
      else if (next === 'r') { result += '\r'; i++; }
      else if (next === 'c') { result += ':'; i++; }
      else { result += value[i]; }
    } else {
      result += value[i];
    }
  }
  return result;
}

/**
 * Encode STOMP header value escape sequences (v1.2).
 * Order matters: escape \\ first to avoid double-escaping.
 */
function encodeStompHeaderValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/:/g, '\\c');
}

/**
 * Encode a STOMP frame from command, headers, and optional body.
 */
export function encodeStompFrame(
  command: string,
  headers: Record<string, string>,
  body?: string,
): string {
  let frame = command + '\n';
  for (const [key, value] of Object.entries(headers)) {
    frame += `${encodeStompHeaderValue(key)}:${encodeStompHeaderValue(value)}\n`;
  }
  frame += '\n';
  if (body) {
    frame += body;
  }
  frame += NULL_CHAR;
  return frame;
}

/**
 * Encode a STOMP CONNECT frame.
 */
export function encodeStompConnect(
  host?: string,
  login?: string,
  passcode?: string,
  heartBeat?: [number, number],
): string {
  const headers: Record<string, string> = {
    'accept-version': '1.2',
  };
  if (host) headers['host'] = host;
  if (login) headers['login'] = login;
  if (passcode) headers['passcode'] = passcode;
  if (heartBeat) headers['heart-beat'] = `${heartBeat[0]},${heartBeat[1]}`;
  return encodeStompFrame('CONNECT', headers);
}

/**
 * Encode a STOMP SEND frame.
 */
export function encodeStompSend(
  destination: string,
  body?: string,
  contentType?: string,
  extraHeaders?: Record<string, string>,
): string {
  const headers: Record<string, string> = {
    destination,
    ...extraHeaders,
  };
  if (contentType) headers['content-type'] = contentType;
  if (body) headers['content-length'] = String(new TextEncoder().encode(body).length);
  return encodeStompFrame('SEND', headers, body);
}

/**
 * Encode a STOMP SUBSCRIBE frame.
 */
export function encodeStompSubscribe(
  destination: string,
  id: string,
  ack: 'auto' | 'client' | 'client-individual' = 'auto',
): string {
  return encodeStompFrame('SUBSCRIBE', { destination, id, ack });
}

/**
 * Encode a STOMP DISCONNECT frame.
 */
export function encodeStompDisconnect(receipt?: string): string {
  const headers: Record<string, string> = {};
  if (receipt) headers['receipt'] = receipt;
  return encodeStompFrame('DISCONNECT', headers);
}

/**
 * Generate a human-readable summary for a decoded STOMP frame.
 */
export function getStompFrameSummary(frame: StompFrame): string {
  const dest = frame.headers['destination'];
  const msgId = frame.headers['message-id'];

  switch (frame.command) {
    case 'CONNECTED': {
      const version = frame.headers['version'] ?? '?';
      return `CONNECTED (v${version})`;
    }
    case 'MESSAGE':
      return dest ? `MESSAGE ← ${dest}` : 'MESSAGE';
    case 'SEND':
      return dest ? `SEND → ${dest}` : 'SEND';
    case 'SUBSCRIBE':
      return dest ? `SUBSCRIBE ${dest}` : 'SUBSCRIBE';
    case 'UNSUBSCRIBE':
      return `UNSUBSCRIBE ${frame.headers['id'] ?? ''}`.trim();
    case 'RECEIPT':
      return `RECEIPT #${frame.headers['receipt-id'] ?? '?'}`;
    case 'ERROR': {
      const msg = frame.headers['message'] ?? frame.body.slice(0, 40);
      return `ERROR: ${msg}`;
    }
    case 'DISCONNECT':
      return 'DISCONNECT';
    case 'CONNECT':
    case 'STOMP':
      return `CONNECT → ${frame.headers['host'] ?? 'server'}`;
    case 'ACK':
      return `ACK ${msgId ?? frame.headers['id'] ?? ''}`.trim();
    case 'NACK':
      return `NACK ${msgId ?? frame.headers['id'] ?? ''}`.trim();
    default:
      return frame.command;
  }
}

/**
 * Check if a raw frame is a STOMP heartbeat (empty frame, just whitespace/LF).
 */
export function isStompHeartbeat(raw: string): boolean {
  const trimmed = raw.replace(/[\r\n\0]/g, '');
  return trimmed.length === 0;
}

/**
 * Encode a STOMP heartbeat (single LF).
 */
export function encodeStompHeartbeat(): string {
  return '\n';
}

/**
 * Check if a raw string looks like a valid STOMP frame (starts with a known command).
 */
export function isStompFrame(raw: string): boolean {
  const firstLine = raw.split(/\r?\n/)[0]?.trim().toUpperCase() ?? '';
  return ALL_COMMANDS.has(firstLine);
}
