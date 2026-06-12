// Engine.IO v4 packet types
export const ENGINE_TYPES = {
  OPEN: 0,
  CLOSE: 1,
  PING: 2,
  PONG: 3,
  MESSAGE: 4,
  UPGRADE: 5,
  NOOP: 6,
} as const;

export type EngineType = (typeof ENGINE_TYPES)[keyof typeof ENGINE_TYPES];

export const ENGINE_TYPE_NAMES: Record<number, string> = {
  0: 'OPEN',
  1: 'CLOSE',
  2: 'PING',
  3: 'PONG',
  4: 'MESSAGE',
  5: 'UPGRADE',
  6: 'NOOP',
};

// Socket.IO v4 packet types (carried inside Engine.IO MESSAGE packets)
export const SOCKET_TYPES = {
  CONNECT: 0,
  DISCONNECT: 1,
  EVENT: 2,
  ACK: 3,
  CONNECT_ERROR: 4,
  BINARY_EVENT: 5,
  BINARY_ACK: 6,
} as const;

export type SocketType = (typeof SOCKET_TYPES)[keyof typeof SOCKET_TYPES];

export const SOCKET_TYPE_NAMES: Record<number, string> = {
  0: 'CONNECT',
  1: 'DISCONNECT',
  2: 'EVENT',
  3: 'ACK',
  4: 'CONNECT_ERROR',
  5: 'BINARY_EVENT',
  6: 'BINARY_ACK',
};

export interface SioOpenPayload {
  sid: string;
  upgrades: string[];
  pingInterval: number;
  pingTimeout: number;
  maxPayload?: number;
}

export interface SioDecodedPacket {
  engineType: EngineType;
  engineTypeName: string;
  socketType?: SocketType;
  socketTypeName?: string;
  namespace?: string;
  eventName?: string;
  data?: unknown;
  ackId?: number;
  raw: string;
  openPayload?: SioOpenPayload;
}

/**
 * Decode a raw Socket.IO/Engine.IO packet string.
 */
export function decodeSioPacket(raw: string): SioDecodedPacket {
  if (raw.length === 0) {
    return { engineType: 6, engineTypeName: 'NOOP', raw };
  }

  const engineTypeChar = raw.charCodeAt(0) - 48; // '0' = 48
  const engineType = (engineTypeChar >= 0 && engineTypeChar <= 6 ? engineTypeChar : 6) as EngineType;
  const engineTypeName = ENGINE_TYPE_NAMES[engineType] ?? 'UNKNOWN';

  const result: SioDecodedPacket = { engineType, engineTypeName, raw };

  if (engineType === ENGINE_TYPES.OPEN) {
    try {
      const payload = JSON.parse(raw.slice(1));
      result.openPayload = payload as SioOpenPayload;
    } catch {
      // malformed OPEN payload
    }
    return result;
  }

  if (engineType !== ENGINE_TYPES.MESSAGE) {
    return result;
  }

  // Engine.IO MESSAGE → contains Socket.IO packet
  const sioPayload = raw.slice(1);
  if (sioPayload.length === 0) {
    return result;
  }

  const socketTypeChar = sioPayload.charCodeAt(0) - 48;
  if (socketTypeChar < 0 || socketTypeChar > 6) {
    return result;
  }

  result.socketType = socketTypeChar as SocketType;
  result.socketTypeName = SOCKET_TYPE_NAMES[socketTypeChar] ?? 'UNKNOWN';

  const rest = sioPayload.slice(1);

  // Parse namespace (starts with / and ends with ,)
  let namespace: string | undefined;
  let dataStr = rest;

  if (rest.startsWith('/')) {
    const commaIdx = rest.indexOf(',');
    if (commaIdx !== -1) {
      namespace = rest.slice(0, commaIdx);
      dataStr = rest.slice(commaIdx + 1);
    } else {
      namespace = rest;
      dataStr = '';
    }
    result.namespace = namespace;
  }

  // For BINARY_EVENT/BINARY_ACK, strip the attachment count prefix (<N>-)
  if (socketTypeChar === SOCKET_TYPES.BINARY_EVENT || socketTypeChar === SOCKET_TYPES.BINARY_ACK) {
    const attachMatch = dataStr.match(/^(\d+)-/);
    if (attachMatch) {
      dataStr = dataStr.slice(attachMatch[0].length);
    }
  }

  // Parse ACK ID (sequence of digits before the JSON data)
  const ackMatch = dataStr.match(/^(\d+)(?=[[{])/);
  if (ackMatch) {
    result.ackId = parseInt(ackMatch[1], 10);
    dataStr = dataStr.slice(ackMatch[1].length);
  }

  // Parse data payload
  if (dataStr.length > 0) {
    try {
      const parsed = JSON.parse(dataStr);
      result.data = parsed;

      if (
        (socketTypeChar === SOCKET_TYPES.EVENT || socketTypeChar === SOCKET_TYPES.BINARY_EVENT) &&
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === 'string'
      ) {
        result.eventName = parsed[0];
      }
    } catch {
      result.data = dataStr;
    }
  }

  return result;
}

/**
 * Generate a human-readable summary for a decoded packet.
 */
export function getSioPacketSummary(packet: SioDecodedPacket): string {
  if (packet.engineType === ENGINE_TYPES.OPEN) {
    const sid = packet.openPayload?.sid;
    return sid ? `OPEN (sid: ${sid.slice(0, 8)}…)` : 'OPEN';
  }

  if (packet.engineType === ENGINE_TYPES.PING) return 'PING';
  if (packet.engineType === ENGINE_TYPES.PONG) return 'PONG';
  if (packet.engineType === ENGINE_TYPES.CLOSE) return 'CLOSE';
  if (packet.engineType === ENGINE_TYPES.NOOP) return 'NOOP';
  if (packet.engineType === ENGINE_TYPES.UPGRADE) return 'UPGRADE';

  if (!packet.socketTypeName) return `EIO:${packet.engineTypeName}`;

  const ns = packet.namespace && packet.namespace !== '/' ? ` [${packet.namespace}]` : '';

  if (packet.socketType === SOCKET_TYPES.EVENT) {
    return `EVENT: ${packet.eventName ?? '?'}${ns}`;
  }

  if (packet.socketType === SOCKET_TYPES.ACK) {
    return `ACK #${packet.ackId ?? '?'}${ns}`;
  }

  if (packet.socketType === SOCKET_TYPES.CONNECT) {
    return `CONNECT${ns}`;
  }

  if (packet.socketType === SOCKET_TYPES.DISCONNECT) {
    return `DISCONNECT${ns}`;
  }

  if (packet.socketType === SOCKET_TYPES.CONNECT_ERROR) {
    return `CONNECT_ERROR${ns}`;
  }

  if (packet.socketType === SOCKET_TYPES.BINARY_EVENT) {
    return `BINARY_EVENT: ${packet.eventName ?? '?'}${ns}`;
  }

  if (packet.socketType === SOCKET_TYPES.BINARY_ACK) {
    return `BINARY_ACK #${packet.ackId ?? '?'}${ns}`;
  }

  return `${packet.socketTypeName}${ns}`;
}

/**
 * Encode a Socket.IO EVENT packet.
 */
export function encodeSioEvent(
  eventName: string,
  data?: unknown,
  namespace?: string,
  ackId?: number,
): string {
  const payload = data !== undefined ? [eventName, data] : [eventName];
  const ns = namespace && namespace !== '/' ? `${namespace},` : '';
  const ack = ackId != null ? String(ackId) : '';
  return `42${ns}${ack}${JSON.stringify(payload)}`;
}

/**
 * Encode a Socket.IO CONNECT packet.
 */
export function encodeSioConnect(namespace?: string): string {
  if (namespace && namespace !== '/') {
    return `40${namespace},`;
  }
  return '40';
}

/**
 * Encode an Engine.IO PONG packet.
 */
export function encodeSioPong(): string {
  return '3';
}

/**
 * Check if a raw packet is an Engine.IO PING.
 */
export function isSioPing(raw: string): boolean {
  return raw === '2' || raw.startsWith('2');
}

/**
 * Check if a raw packet is an Engine.IO OPEN.
 */
export function isSioOpen(raw: string): boolean {
  return raw.startsWith('0{') || raw === '0';
}
