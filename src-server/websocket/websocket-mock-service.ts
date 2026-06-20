import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type {
  WsMockRule,
  WsMockFallbackMode,
  WsMockLogEntry,
  WsMockClientInfo,
  WsMockStatus,
  WsMockServerConfig,
} from '../../src/shared/websocket/types.js';
import { evaluateRules, expandTemplate } from '../../src/features/websocket/wsMockRuleEngine.js';
import { toErrorMessage } from '../../src/shared/utils/helpers.js';

const MAX_LOG_ENTRIES = 200;

interface MockClient {
  id: string;
  ws: WebSocket;
  connectedAt: string;
  messageCount: number;
  counter: number;
  remoteAddress?: string;
}

export class WebSocketMockService {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, MockClient>();
  private rules: WsMockRule[] = [];
  private fallback: WsMockFallbackMode = 'echo';
  private port = 9876;
  private logBuffer: WsMockLogEntry[] = [];
  private logCursor = 0;
  private lastError: string | null = null;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  private pushLog(event: WsMockLogEntry['event'], data?: string, clientId?: string, ruleName?: string): void {
    this.logBuffer.push({
      id: this.logCursor++,
      ts: new Date().toISOString(),
      event,
      clientId,
      data: data ? (data.length > 500 ? data.slice(0, 500) + '\u2026' : data) : undefined,
      ruleName,
    });
    if (this.logBuffer.length > MAX_LOG_ENTRIES) {
      this.logBuffer = this.logBuffer.slice(-MAX_LOG_ENTRIES);
    }
  }

  start(config: WsMockServerConfig): Promise<WsMockStatus> {
    return new Promise((resolve, reject) => {
      // Idempotent: if already running on the same port, skip restart
      if (this.wss && this.port === config.port) {
        this.rules = config.rules;
        this.fallback = config.fallback;
        resolve(this.getStatus());
        return;
      }
      if (this.wss) {
        this.stopSync();
      }

      this.port = config.port;
      this.rules = config.rules;
      this.fallback = config.fallback;
      this.lastError = null;
      this.logBuffer = [];
      this.logCursor = 0;

      let settled = false;

      try {
        this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' });
      } catch (err) {
        const msg = toErrorMessage(err);
        this.lastError = msg;
        this.pushLog('error', msg);
        reject(new Error(msg));
        return;
      }

      this.wss.on('error', (err) => {
        this.lastError = err.message;
        this.pushLog('error', err.message);
        if (!settled) {
          settled = true;
          this.wss = null;
          reject(err);
        }
      });

      this.wss.on('listening', () => {
        settled = true;
        this.pushLog('server-start', `Mock server listening on port ${this.port}`);
        resolve(this.getStatus());
      });

      this.wss.on('connection', (ws, req) => {
        const clientId = randomUUID().slice(0, 8);
        const remoteAddress = req.socket.remoteAddress;
        const client: MockClient = {
          id: clientId,
          ws,
          connectedAt: new Date().toISOString(),
          messageCount: 0,
          counter: 0,
          remoteAddress: remoteAddress ?? undefined,
        };
        this.clients.set(clientId, client);
        this.pushLog('client-connect', remoteAddress ?? 'unknown', clientId);

        ws.on('message', (raw) => {
          const message = typeof raw === 'string' ? raw : raw.toString('utf-8');
          client.messageCount++;
          client.counter++;
          this.pushLog('message-in', message, clientId);
          this.handleMessage(client, message);
        });

        ws.on('close', () => {
          this.pushLog('client-disconnect', undefined, clientId);
          this.clients.delete(clientId);
        });

        ws.on('error', (err) => {
          this.pushLog('error', err.message, clientId);
        });
      });
    });
  }

  private handleMessage(client: MockClient, message: string): void {
    const result = evaluateRules(this.rules, message, this.fallback);
    if (!result.response) return;

    const response = result.response;
    const delay = response.delay ?? 0;

    const execute = () => {
      if (client.ws.readyState !== WebSocket.OPEN) return;

      switch (response.type) {
        case 'echo':
          client.ws.send(message);
          this.pushLog('response-out', message, client.id, result.rule?.name ?? '(echo fallback)');
          break;

        case 'static':
          if (response.data != null) {
            client.ws.send(response.data);
            this.pushLog('response-out', response.data, client.id, result.rule?.name);
          }
          break;

        case 'template':
          if (response.data != null) {
            const expanded = expandTemplate(response.data, {
              message,
              clientId: client.id,
              counter: client.counter,
            });
            client.ws.send(expanded);
            this.pushLog('response-out', expanded, client.id, result.rule?.name);
          }
          break;

        case 'close': {
          const code = response.closeCode ?? 1000;
          const valid = (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006)
            || (code >= 3000 && code <= 4999);
          const safeCode = valid ? code : 1000;
          client.ws.close(safeCode, response.closeReason ?? '');
          this.pushLog('response-out', `CLOSE ${safeCode}`, client.id, result.rule?.name);
          break;
        }
      }
    };

    if (delay > 0) {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        execute();
      }, delay);
      this.pendingTimers.add(timer);
    } else {
      execute();
    }
  }

  private stopSync(): void {
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    if (!this.wss) return;
    for (const client of this.clients.values()) {
      try {
        // Send close frame then immediately terminate the underlying socket.
        // Using close() alone is insufficient: the server may be destroyed
        // (via wss.close()) before the close handshake completes, causing the
        // browser's WebSocket to never receive the close and stay "Connected".
        client.ws.close(1001, 'Mock server stopping');
        client.ws.terminate();
      } catch { /* already closed */ }
    }
    this.clients.clear();
    try {
      this.wss.close();
    } catch { /* already closed */ }
    this.wss = null;
    this.pushLog('server-stop', `Mock server stopped`);
  }

  stop(): void {
    this.stopSync();
    this.lastError = null;
  }

  updateRules(rules: WsMockRule[], fallback?: WsMockFallbackMode): void {
    this.rules = rules;
    if (fallback !== undefined) this.fallback = fallback;
  }

  broadcast(data: string): number {
    let sent = 0;
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
        sent++;
      }
    }
    if (sent > 0) {
      this.pushLog('response-out', `[broadcast to ${sent}] ${data}`);
    }
    return sent;
  }

  getStatus(): WsMockStatus {
    const clients: WsMockClientInfo[] = [];
    for (const c of this.clients.values()) {
      clients.push({
        id: c.id,
        connectedAt: c.connectedAt,
        messageCount: c.messageCount,
        remoteAddress: c.remoteAddress,
      });
    }
    return {
      running: this.wss !== null,
      port: this.port,
      clientCount: clients.length,
      clients,
      error: this.lastError ?? undefined,
    };
  }

  getLogs(sinceCursor?: number): WsMockLogEntry[] {
    if (sinceCursor === undefined) {
      return [...this.logBuffer];
    }
    return this.logBuffer.filter((e) => e.id > sinceCursor);
  }

  destroy(): void {
    this.stopSync();
    this.logBuffer = [];
    this.logCursor = 0;
  }
}

export const wsMockService = new WebSocketMockService();

/** Manages a pool of independent mock servers, one per port.
 *  Each WebSocket tab gets its own port (9876, 9877, …) so tabs are fully isolated. */
export class WebSocketMockPool {
  private pool = new Map<number, WebSocketMockService>();

  /** Returns the service for `port`, creating one if it doesn't exist yet. */
  getOrCreate(port: number): WebSocketMockService {
    let svc = this.pool.get(port);
    if (!svc) {
      svc = new WebSocketMockService();
      this.pool.set(port, svc);
    }
    return svc;
  }

  /** Returns the service for `port` if it exists, otherwise undefined. */
  get(port: number): WebSocketMockService | undefined {
    return this.pool.get(port);
  }

  /** Stops and removes the service for `port`. */
  release(port: number): void {
    const svc = this.pool.get(port);
    if (svc) {
      svc.stop();
      this.pool.delete(port);
    }
  }

  /** Stops all running servers (e.g. on process exit). */
  stopAll(): void {
    for (const svc of this.pool.values()) svc.stop();
    this.pool.clear();
  }
}

export const wsMockPool = new WebSocketMockPool();
