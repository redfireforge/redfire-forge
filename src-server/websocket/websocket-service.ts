import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import https from 'node:https';
import {
  createWsSuccessEnvelope,
  createWsErrorEnvelope,
  type WsProxyConnectRequest,
  type WsProxyConnectResult,
  type WsProxyDisconnectRequest,
  type WsProxyDisconnectResult,
  type WsProxySendRequest,
  type WsProxySendResult,
  type WsProxyPingRequest,
  type WsProxyPingResult,
  type WsProxyMessagesRequest,
  type WsProxyMessagesResult,
  type WsProxyMessageRecord,
  type WsProxyStatusRequest,
  type WsProxyStatusResult,
  type WsTlsConfig,
  type WsRouteEnvelope,
} from './contracts.js';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER_SIZE = 2000;
const IDLE_TTL_MS = 5 * 60 * 1000;
const GC_INTERVAL_MS = 60 * 1000;

interface ConnectionHandle {
  id: string;
  ws: WebSocket;
  url: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectedAt?: string;
  closedAt?: string;
  closeCode?: number;
  closeReason?: string;
  lastError?: string;
  protocol: string;
  extensions: string;
  sentCount: number;
  receivedCount: number;
  messageBuffer: WsProxyMessageRecord[];
  cursor: number;
  lastActivity: number;
}

export class WebSocketProxyService {
  private readonly connections = new Map<string, ConnectionHandle>();
  private readonly maxBufferSize: number;
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxBufferSize = DEFAULT_MAX_BUFFER_SIZE) {
    this.maxBufferSize = maxBufferSize;
    this.startGc();
  }

  /** Lookup a connection by ID; returns the handle or an error envelope. */
  private getConnection<T>(connectionId: string | undefined, action: string): ConnectionHandle | WsRouteEnvelope<T> {
    const handle = this.connections.get(connectionId ?? '');
    if (!handle) {
      return createWsErrorEnvelope(action, {
        code: 'WS_NOT_FOUND',
        message: `Connection ${connectionId ?? '(none)'} not found`,
      });
    }
    return handle;
  }

  /** Lookup + require WebSocket.OPEN; returns the handle or an error envelope. */
  private requireOpenConnection<T>(connectionId: string | undefined, action: string): ConnectionHandle | WsRouteEnvelope<T> {
    const result = this.getConnection<T>(connectionId, action);
    if (!('id' in result)) return result;  // error envelope
    if (result.state !== 'connected' || result.ws.readyState !== WebSocket.OPEN) {
      return createWsErrorEnvelope(action, {
        code: 'WS_NOT_CONNECTED',
        message: `Connection ${connectionId} is not open (state: ${result.state})`,
      });
    }
    return result;
  }

  private startGc(): void {
    this.gcTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, handle] of this.connections) {
        if (now - handle.lastActivity > IDLE_TTL_MS) {
          this.closeAndRemove(id, handle, 1001, 'Idle timeout');
        }
      }
    }, GC_INTERVAL_MS);
    if (this.gcTimer.unref) {
      this.gcTimer.unref();
    }
  }

  stopGc(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  async connect(request: WsProxyConnectRequest): Promise<WsRouteEnvelope<WsProxyConnectResult>> {
    if (!request?.url || typeof request.url !== 'string' || request.url.trim().length === 0) {
      return createWsErrorEnvelope('connect', {
        code: 'WS_INVALID_URL',
        message: 'url is required',
      });
    }

    const url = request.url.trim();
    const urlLower = url.toLowerCase();
    if (!urlLower.startsWith('ws://') && !urlLower.startsWith('wss://')) {
      return createWsErrorEnvelope('connect', {
        code: 'WS_INVALID_URL',
        message: 'url must start with ws:// or wss://',
      });
    }

    const connectionId = randomUUID();
    const timeoutMs = request.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const startTime = Date.now();

    const wsOptions: WebSocket.ClientOptions = {};
    if (request.headers && typeof request.headers === 'object') {
      wsOptions.headers = request.headers;
    }

    if (request.tls) {
      wsOptions.agent = this.buildTlsAgent(request.tls, url);
    } else if (url.toLowerCase().startsWith('wss://')) {
      // Even without explicit TLS config, create an agent for wss:// localhost
      // connections to bypass corporate proxy env vars (HTTP_PROXY / HTTPS_PROXY).
      wsOptions.agent = this.buildTlsAgent({ rejectUnauthorized: true }, url);
    }

    const protocols = Array.isArray(request.subprotocols)
      ? request.subprotocols.filter((s) => typeof s === 'string' && s.trim().length > 0)
      : undefined;

    return new Promise<WsRouteEnvelope<WsProxyConnectResult>>((resolve) => {
      let resolved = false;
      let ws: WebSocket;

      try {
        ws = protocols && protocols.length > 0
          ? new WebSocket(url, protocols, wsOptions)
          : new WebSocket(url, wsOptions);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return resolve(createWsErrorEnvelope('connect', {
          code: 'WS_CONNECT_FAILED',
          message: `Failed to initiate connection: ${message}`,
        }));
      }

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { ws.close(); } catch { /* ignore */ }
          resolve(createWsErrorEnvelope('connect', {
            code: 'WS_CONNECT_TIMEOUT',
            message: `Connection timed out after ${timeoutMs}ms`,
            retryable: true,
          }));
        }
      }, timeoutMs);

      ws.on('open', () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        const latencyMs = Date.now() - startTime;
        const handle: ConnectionHandle = {
          id: connectionId,
          ws,
          url,
          state: 'connected',
          connectedAt: new Date().toISOString(),
          protocol: ws.protocol || '',
          extensions: ws.extensions || '',
          sentCount: 0,
          receivedCount: 0,
          messageBuffer: [],
          cursor: 0,
          lastActivity: Date.now(),
        };

        this.connections.set(connectionId, handle);
        this.attachListeners(handle);

        resolve(createWsSuccessEnvelope('connect', {
          connectionId,
          protocol: handle.protocol,
          extensions: handle.extensions,
          latencyMs,
        }));
      });

      ws.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const message = err instanceof Error ? err.message : String(err);
          resolve(createWsErrorEnvelope('connect', {
            code: 'WS_CONNECT_FAILED',
            message: `Connection failed: ${message}`,
            retryable: true,
          }));
        }
      });
    });
  }

  buildTlsAgent(tls: WsTlsConfig, url: string): https.Agent | undefined {
    if (!url.toLowerCase().startsWith('wss://')) return undefined;
    const agentOptions: https.AgentOptions = {};

    // Detect localhost/loopback — self-signed certs are expected here.
    let isLocal = false;
    try {
      const host = new URL(url).hostname.toLowerCase();
      isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch { /* handled elsewhere */ }

    if (tls.rejectUnauthorized === false) {
      agentOptions.rejectUnauthorized = false;
    } else if (isLocal && !tls.caCert) {
      // Localhost with no CA cert provided — skip validation by default since
      // self-signed certs are the norm for local dev/Docker servers.
      agentOptions.rejectUnauthorized = false;
    }
    if (tls.caCert) {
      agentOptions.ca = tls.caCert;
    }
    if (tls.clientCert) {
      agentOptions.cert = tls.clientCert;
    }
    if (tls.clientKey) {
      agentOptions.key = tls.clientKey;
    }
    // Bypass corporate HTTP proxy for localhost/loopback — prevents VPN/proxy
    // interference with local dev servers (e.g. Docker TLS echo containers).
    if (isLocal) {
      (agentOptions as Record<string, unknown>).proxy = false;
    }
    return new https.Agent(agentOptions);
  }

  private attachListeners(handle: ConnectionHandle): void {
    handle.ws.on('message', (rawData, isBinary) => {
      handle.lastActivity = Date.now();
      handle.receivedCount += 1;

      const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
      const type = isBinary ? 'binary' as const : 'text' as const;
      const data = isBinary ? buf.toString('base64') : buf.toString('utf-8');
      const size = buf.byteLength;

      const record: WsProxyMessageRecord = {
        data,
        type,
        receivedAt: new Date().toISOString(),
        size,
      };

      handle.messageBuffer.push(record);
      handle.cursor += 1;

      if (handle.messageBuffer.length > this.maxBufferSize) {
        handle.messageBuffer = handle.messageBuffer.slice(
          handle.messageBuffer.length - this.maxBufferSize,
        );
      }
    });

    handle.ws.on('close', (code, reason) => {
      handle.state = 'disconnected';
      handle.closedAt = new Date().toISOString();
      handle.closeCode = code;
      handle.closeReason = reason?.toString('utf-8') || undefined;
    });

    handle.ws.on('error', (err) => {
      handle.state = 'error';
      handle.lastError = err instanceof Error ? err.message : String(err);
    });
  }

  send(request: WsProxySendRequest): WsRouteEnvelope<WsProxySendResult> {
    const result = this.requireOpenConnection<WsProxySendResult>(request?.connectionId, 'send');
    if (!('id' in result)) return result;
    const handle = result;

    try {
      if (request.type === 'binary') {
        handle.ws.send(Buffer.from(request.data, 'base64'));
      } else {
        handle.ws.send(request.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createWsErrorEnvelope('send', {
        code: 'WS_SEND_FAILED',
        message: `Failed to send message: ${message}`,
      });
    }

    handle.sentCount += 1;
    handle.lastActivity = Date.now();

    return createWsSuccessEnvelope('send', {
      connectionId: request.connectionId,
      sentAt: new Date().toISOString(),
    });
  }

  ping(request: WsProxyPingRequest): WsRouteEnvelope<WsProxyPingResult> {
    const result = this.requireOpenConnection<WsProxyPingResult>(request?.connectionId, 'ping');
    if (!('id' in result)) return result;
    const handle = result;

    try {
      const pingData = request.data ? Buffer.from(request.data) : undefined;
      handle.ws.ping(pingData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createWsErrorEnvelope('ping', {
        code: 'WS_SEND_FAILED',
        message: `Failed to send ping: ${message}`,
      });
    }

    handle.lastActivity = Date.now();

    return createWsSuccessEnvelope('ping', {
      connectionId: request.connectionId,
      sentAt: new Date().toISOString(),
    });
  }

  getMessages(request: WsProxyMessagesRequest): WsRouteEnvelope<WsProxyMessagesResult> {
    const result = this.getConnection<WsProxyMessagesResult>(request?.connectionId, 'messages');
    if (!('id' in result)) return result;
    const handle = result;

    handle.lastActivity = Date.now();

    const sinceCursor = request.sinceCursor ?? 0;
    const bufferStartCursor = handle.cursor - handle.messageBuffer.length;
    const startIndex = Math.max(0, sinceCursor - bufferStartCursor);
    const messages = handle.messageBuffer.slice(startIndex);

    return createWsSuccessEnvelope('messages', {
      connectionId: request.connectionId,
      messages,
      cursor: handle.cursor,
      bufferSize: handle.messageBuffer.length,
      state: handle.state as 'connecting' | 'connected' | 'disconnected' | 'error',
      closeCode: handle.closeCode,
      closeReason: handle.closeReason,
    });
  }

  getStatus(request: WsProxyStatusRequest): WsRouteEnvelope<WsProxyStatusResult> {
    const result = this.getConnection<WsProxyStatusResult>(request?.connectionId, 'status');
    if (!('id' in result)) return result;
    const handle = result;

    handle.lastActivity = Date.now();

    const uptimeMs = handle.connectedAt && handle.state === 'connected'
      ? Date.now() - new Date(handle.connectedAt).getTime()
      : undefined;

    return createWsSuccessEnvelope('status', {
      connectionId: handle.id,
      state: handle.state,
      url: handle.url,
      connectedAt: handle.connectedAt,
      closedAt: handle.closedAt,
      closeCode: handle.closeCode,
      closeReason: handle.closeReason,
      lastError: handle.lastError,
      protocol: handle.protocol || undefined,
      extensions: handle.extensions || undefined,
      sentCount: handle.sentCount,
      receivedCount: handle.receivedCount,
      uptimeMs,
    });
  }

  disconnect(request: WsProxyDisconnectRequest): WsRouteEnvelope<WsProxyDisconnectResult> {
    const result = this.getConnection<WsProxyDisconnectResult>(request?.connectionId, 'disconnect');
    if (!('id' in result)) return result;
    const handle = result;

    const code = request.code ?? 1000;
    const reason = request.reason ?? 'Client disconnect';
    this.closeAndRemove(request.connectionId, handle, code, reason);

    return createWsSuccessEnvelope('disconnect', {
      connectionId: request.connectionId,
      disconnected: true,
    });
  }

  private closeAndRemove(id: string, handle: ConnectionHandle, code: number, reason: string): void {
    try {
      if (handle.ws.readyState === WebSocket.OPEN || handle.ws.readyState === WebSocket.CONNECTING) {
        handle.ws.close(code, reason);
      }
    } catch { /* ignore close errors */ }

    handle.ws.removeAllListeners();
    this.connections.delete(id);
  }

  async disconnectAll(): Promise<void> {
    for (const [id, handle] of this.connections) {
      this.closeAndRemove(id, handle, 1001, 'Server shutdown');
    }
  }

  reset(): void {
    for (const [id, handle] of this.connections) {
      this.closeAndRemove(id, handle, 1001, 'Service reset');
    }
  }
}

export const wsProxyService = new WebSocketProxyService();
