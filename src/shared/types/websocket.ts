/**
 * WebSocket runner action types — transport action type, assertion targets,
 * action configs, result metadata, and match criteria for the test harness.
 *
 * Follows the same pattern as `kafka.ts` for Kafka scenarios.
 * Studio types (WsTlsConfig, WsProtocolMode, etc.) are re-exported from
 * `src/shared/websocket/types.ts` for convenience.
 */

import type { WsTlsConfig, WsProtocolMode } from '../websocket/types';
import type { KafkaActionType } from './kafka';
import type { GrpcHarnessActionType } from './grpc-harness';
import type { KeyValue } from './index';

// Re-export Studio types used by harness action configs
export type { WsTlsConfig, WsProtocolMode } from '../websocket/types';

// ─── Action Type ──────────────────────────────────────────────────────────────

/**
 * WebSocket action type for runner scenarios.
 * Distinct from `KafkaActionType` — the two are combined via `ScenarioActionType`
 * on the `Scenario.actionType` field.
 */
export type WsActionType = 'wsConnect' | 'wsSend' | 'wsReceive';

/**
 * Combined action type union for `Scenario.actionType`.
 * Extends `KafkaActionType` with WebSocket and gRPC harness actions.
 */
export type ScenarioActionType = KafkaActionType | WsActionType | GrpcHarnessActionType;

// ─── Match Criteria ───────────────────────────────────────────────────────────

/**
 * Match criteria for filtering received WebSocket messages in harness scenarios.
 * Same shape as workflow `WsMatchCriteria` but defined independently to avoid
 * coupling harness types to workflow node types.
 */
export interface WsHarnessMatchCriteria {
  /** Substring that must appear in the message body. */
  contentContains?: string;
  /** Regex pattern the message body must match. */
  contentRegex?: string;
  /** JSONPath expression to evaluate against parsed JSON messages. */
  jsonPathMatch?: string;
  /** Expected value at the JSONPath (exact string equality). */
  jsonPathValue?: string;
  /** Frame type filter. Default: `'any'`. */
  messageType?: 'text' | 'binary' | 'any';
}

// ─── Action Configs ───────────────────────────────────────────────────────────

/** Configuration for a WebSocket connect harness action. */
export interface WsConnectActionConfig {
  /** WebSocket endpoint URL. Supports `{{variable}}` interpolation. */
  url: string;
  /** Custom handshake headers. */
  headers?: KeyValue[];
  /** Query string parameters appended to the URL. */
  queryParams?: KeyValue[];
  /** Comma-separated list of subprotocols to negotiate. */
  subprotocols?: string;
  /** Connection timeout in ms. Default: `10000`. */
  timeoutMs?: number;
  /** Protocol mode for message parsing. */
  protocolMode?: WsProtocolMode;
  /** Optional TLS overrides (e.g., self-signed certs). */
  tlsConfig?: WsTlsConfig;
  /**
   * Logical connection identifier for multi-connection scenarios.
   * Send/Receive actions reference this via `connectionRef`.
   */
  connectionId?: string;
}

/** Configuration for a WebSocket send harness action. */
export interface WsSendActionConfig {
  /**
   * References a prior `wsConnect` scenario in the same test group by
   * scenario name or ID. When set, the send re-uses that connection.
   */
  connectionRef?: string;
  /** If standalone (no prior connect), auto-connects to this URL. */
  url?: string;
  /** Message body to send. Supports `{{variable}}` interpolation. */
  message: string;
  /** Frame type. Default: `'text'`. */
  messageType?: 'text' | 'binary';
  /** If true, waits for the next message after sending. */
  waitForResponse?: boolean;
  /** Timeout for response wait in ms. Default: `5000`. */
  responseTimeoutMs?: number;
}

/** Configuration for a WebSocket receive (wait + assert) harness action. */
export interface WsReceiveActionConfig {
  /**
   * References a prior `wsConnect` scenario in the same test group by
   * scenario name or ID. When set, listens on that connection.
   */
  connectionRef?: string;
  /** If standalone (no prior connect), auto-connects to this URL. */
  url?: string;
  /** Maximum wait time in ms. Default: `10000`. */
  timeoutMs?: number;
  /** Optional filter applied to incoming messages before matching. */
  matchCriteria?: WsHarnessMatchCriteria;
}

// ─── Result Metadata ──────────────────────────────────────────────────────────

/** Metadata captured from an executed WebSocket action result. */
export interface WsResultMeta {
  /** Logical connection identifier (from `WsConnectActionConfig.connectionId`). */
  connectionId?: string;
  /** Frame type of the received message. */
  frameType?: 'text' | 'binary';
  /** Negotiated subprotocol (populated on connect). */
  protocol?: string;
  /** Connected WebSocket URL. */
  url?: string;
  /** Close code (populated when the connection is closed). */
  closeCode?: number;
  /** Message body size in bytes. */
  messageSize?: number;
}

// ─── Assertion Types ──────────────────────────────────────────────────────────

/**
 * WebSocket assertion target selector paths.
 * Use with `Assertion` type `'wsField'` (string operators) or `'wsNumericField'` (numeric operators).
 *
 * - `ws.body` — received message body (string)
 * - `ws.type` — frame type: `'text'` or `'binary'`
 * - `ws.protocol` — negotiated subprotocol
 * - `ws.connectionId` — logical connection identifier
 * - `ws.size` — message body size in bytes (numeric)
 * - `ws.latencyMs` — operation latency in ms (numeric)
 * - `` `ws.header.<name>` `` — upgrade response header by name
 * - `` `ws.$.<path>` `` — JSONPath into parsed message body
 */
export type WsAssertionTarget =
  | 'ws.body'
  | 'ws.type'
  | 'ws.size'
  | 'ws.latencyMs'
  | 'ws.protocol'
  | 'ws.connectionId'
  | `ws.header.${string}`
  | `ws.$.${string}`;

/**
 * Numeric-only assertion targets for `wsNumericField` assertions.
 * These targets use `ComparisonOperator` (`<`, `>`, `<=`, `>=`, `=`, `!=`).
 */
export type WsNumericAssertionTarget = 'ws.latencyMs' | 'ws.size';

// ─── Helper Type Guards ───────────────────────────────────────────────────────

const WS_ACTION_TYPES: ReadonlySet<string> = new Set<WsActionType>([
  'wsConnect', 'wsSend', 'wsReceive',
]);

/** Returns true if the given action type string is a WebSocket action type. */
export function isWsActionType(actionType: string | undefined): actionType is WsActionType {
  return actionType != null && WS_ACTION_TYPES.has(actionType);
}

/** Returns true if the given assertion target is a numeric WS target. */
export function isWsNumericTarget(target: WsAssertionTarget): target is WsNumericAssertionTarget {
  return target === 'ws.latencyMs' || target === 'ws.size';
}
