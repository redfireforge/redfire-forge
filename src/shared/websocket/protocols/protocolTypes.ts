export type WsProtocolMode = 'auto' | 'raw' | 'socket-io' | 'stomp' | 'graphql-ws';

export interface WsProtocolInfo {
  id: WsProtocolMode;
  label: string;
  description: string;
  available: boolean;
}

export const PROTOCOL_REGISTRY: WsProtocolInfo[] = [
  { id: 'auto', label: 'Auto-detect', description: 'Detect protocol from URL, subprotocol header, or first message', available: true },
  { id: 'raw', label: 'Raw', description: 'Raw WebSocket frames (text / binary)', available: true },
  { id: 'socket-io', label: 'Socket.IO', description: 'Socket.IO v4 packet framing', available: true },
  { id: 'stomp', label: 'STOMP', description: 'Simple Text Oriented Messaging Protocol', available: true },
  { id: 'graphql-ws', label: 'GraphQL-WS', description: 'GraphQL over WebSocket (graphql-ws protocol)', available: true },
];

export function getProtocolInfo(mode: WsProtocolMode): WsProtocolInfo {
  return PROTOCOL_REGISTRY.find((p) => p.id === mode) ?? PROTOCOL_REGISTRY[0];
}

export type WsDetectionConfidence = 'high' | 'medium' | 'low';

export interface WsProtocolDetectionResult {
  protocol: Exclude<WsProtocolMode, 'auto'>;
  confidence: WsDetectionConfidence;
  reason: string;
}
