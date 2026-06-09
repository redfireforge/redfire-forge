/**
 * Protocol metadata builders and auto-respond helpers for WebSocket Studio.
 * Extracted from useWebSocketStudio.ts to reduce its line count.
 */

import type { WsFrame, WsFrameProtocolMeta } from '../../shared/websocket/types';
import { createFrame } from '../../shared/websocket/types';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import { resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import {
  decodeSioPacket,
  getSioPacketSummary,
  encodeSioPong,
  encodeSioConnect,
  isSioPing,
  isSioOpen,
  ENGINE_TYPES,
  SOCKET_TYPES,
} from '../../shared/websocket/protocols/socketIoCodec';
import {
  decodeStompFrame,
  getStompFrameSummary,
  isStompHeartbeat,
  encodeStompHeartbeat,
} from '../../shared/websocket/protocols/stompCodec';
import {
  decodeGqlWsMessage,
  getGqlWsMessageSummary,
  encodeGqlWsConnectionInit,
  encodeGqlWsPong,
  isGqlWsPing,
} from '../../shared/websocket/protocols/graphqlWsCodec';

import type { WsDirectionFilter } from './useWebSocketStudio';

// ── Protocol Meta Builders ────────────────────────────────────────────────────

export function buildSioMeta(raw: string): WsFrameProtocolMeta {
  const packet = decodeSioPacket(raw);
  const summary = getSioPacketSummary(packet);
  const isSystem =
    packet.engineType === ENGINE_TYPES.PING ||
    packet.engineType === ENGINE_TYPES.PONG ||
    packet.engineType === ENGINE_TYPES.OPEN ||
    packet.engineType === ENGINE_TYPES.CLOSE ||
    packet.engineType === ENGINE_TYPES.NOOP ||
    packet.engineType === ENGINE_TYPES.UPGRADE ||
    (packet.engineType === ENGINE_TYPES.MESSAGE && packet.socketType === SOCKET_TYPES.CONNECT);

  return {
    protocol: 'socket-io',
    packetType: packet.socketTypeName ?? packet.engineTypeName,
    summary,
    namespace: packet.namespace,
    eventName: packet.eventName,
    ackId: packet.ackId,
    isSystemPacket: isSystem,
  };
}

export function buildStompMeta(raw: string): WsFrameProtocolMeta {
  if (isStompHeartbeat(raw)) {
    return {
      protocol: 'stomp',
      packetType: 'HEARTBEAT',
      summary: '♥',
      isSystemPacket: true,
    };
  }
  const frame = decodeStompFrame(raw);
  const summary = getStompFrameSummary(frame);
  const isSystem = frame.command === 'CONNECTED' || frame.command === '';
  return {
    protocol: 'stomp',
    packetType: frame.command || 'HEARTBEAT',
    summary,
    namespace: frame.headers['destination'],
    isSystemPacket: isSystem,
  };
}

export function buildGqlWsMeta(raw: string): WsFrameProtocolMeta {
  const msg = decodeGqlWsMessage(raw);
  const summary = getGqlWsMessageSummary(msg);
  const isSystem =
    msg.type === 'connection_init' ||
    msg.type === 'connection_ack' ||
    msg.type === 'ping' ||
    msg.type === 'pong';
  return {
    protocol: 'graphql-ws',
    packetType: msg.type,
    summary,
    eventName: msg.id,
    isSystemPacket: isSystem,
  };
}

// ── Protocol Auto-Respond ─────────────────────────────────────────────────────

export interface SioServerParams {
  sid: string;
  pingInterval: number;
  pingTimeout: number;
}

export interface AutoRespondAction {
  /** Reply data to send back to the server. */
  replyData: string;
  /** Frame to log as "sent". */
  replyFrame: WsFrame;
  /** Extracted SIO server params from OPEN packet (only set for Socket.IO OPEN). */
  sioServerParams?: SioServerParams;
}

/**
 * Given a received text message and the effective protocol, check if it requires
 * an automatic protocol-level response (ping→pong, open→connect, etc.).
 *
 * Returns the auto-respond action if needed, or `undefined` if no response required.
 * Also sets `frame.protocolMeta` as a side-effect.
 */
export function checkAutoRespond(
  frame: WsFrame,
  data: string,
  protocolMode: WsProtocolMode,
  detectedProtocol: WsProtocolDetectionResult | null,
): AutoRespondAction | undefined {
  const effective = resolveEffectiveProtocol(protocolMode, detectedProtocol);

  if (effective === 'socket-io') {
    frame.protocolMeta = buildSioMeta(data);

    if (isSioPing(data)) {
      const pong = encodeSioPong();
      const replyFrame = createFrame('sent', 'text', pong);
      replyFrame.protocolMeta = buildSioMeta(pong);
      return { replyData: pong, replyFrame };
    }

    if (isSioOpen(data)) {
      const connectPacket = encodeSioConnect();
      const replyFrame = createFrame('sent', 'text', connectPacket);
      replyFrame.protocolMeta = buildSioMeta(connectPacket);
      const packet = decodeSioPacket(data);
      let sioServerParams: SioServerParams | undefined;
      if (packet.openPayload) {
        sioServerParams = {
          sid: packet.openPayload.sid,
          pingInterval: packet.openPayload.pingInterval,
          pingTimeout: packet.openPayload.pingTimeout,
        };
      }
      return { replyData: connectPacket, replyFrame, sioServerParams };
    }
    return undefined;
  }

  if (effective === 'stomp') {
    frame.protocolMeta = buildStompMeta(data);

    if (isStompHeartbeat(data)) {
      const hb = encodeStompHeartbeat();
      const replyFrame = createFrame('sent', 'text', hb);
      replyFrame.protocolMeta = buildStompMeta(hb);
      return { replyData: hb, replyFrame };
    }
    return undefined;
  }

  if (effective === 'graphql-ws') {
    frame.protocolMeta = buildGqlWsMeta(data);

    const msg = decodeGqlWsMessage(data);
    if (isGqlWsPing(msg)) {
      const pong = encodeGqlWsPong(msg.payload);
      const replyFrame = createFrame('sent', 'text', pong);
      replyFrame.protocolMeta = buildGqlWsMeta(pong);
      return { replyData: pong, replyFrame };
    }
    return undefined;
  }

  return undefined;
}

/**
 * Annotate a sent frame's protocolMeta based on the effective protocol.
 */
export function annotateSentFrame(
  frame: WsFrame,
  data: string,
  isBinary: boolean,
  protocolMode: WsProtocolMode,
  detectedProtocol: WsProtocolDetectionResult | null,
): void {
  if (isBinary) return;
  const effective = resolveEffectiveProtocol(protocolMode, detectedProtocol);
  if (effective === 'socket-io') {
    frame.protocolMeta = buildSioMeta(data);
  } else if (effective === 'stomp') {
    frame.protocolMeta = buildStompMeta(data);
  } else if (effective === 'graphql-ws') {
    frame.protocolMeta = buildGqlWsMeta(data);
  }
}

/**
 * Build a graphql-ws connection_init frame (sent automatically on connect).
 */
export function buildGqlWsInitAction(): AutoRespondAction {
  const initPacket = encodeGqlWsConnectionInit();
  const replyFrame = createFrame('sent', 'text', initPacket);
  replyFrame.protocolMeta = buildGqlWsMeta(initPacket);
  return { replyData: initPacket, replyFrame };
}

// ── Message Filtering ─────────────────────────────────────────────────────────

export function applyFilters(
  messages: WsFrame[],
  searchText: string,
  directionFilter: WsDirectionFilter,
): WsFrame[] {
  let result = messages;
  if (directionFilter !== 'all') {
    result = result.filter((m) => m.direction === directionFilter);
  }
  if (searchText.trim().length > 0) {
    const needle = searchText.toLowerCase();
    result = result.filter((m) => {
      if (m.data.toLowerCase().includes(needle)) return true;
      if (m.protocolMeta?.summary.toLowerCase().includes(needle)) return true;
      if (m.protocolMeta?.eventName?.toLowerCase().includes(needle)) return true;
      if (m.protocolMeta?.namespace?.toLowerCase().includes(needle)) return true;
      return false;
    });
  }
  return result;
}
