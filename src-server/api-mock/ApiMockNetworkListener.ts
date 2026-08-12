/**
 * API Mock Studio — HTTP network listener (Phase 2A).
 * Creates one HTTP server per mock-server definition on its configured port.
 */
import http from 'node:http';
import net from 'node:net';
import type {
  ApiMockServerDefinitionV1,
  ApiMockCapturedRequestV1,
  ApiMockTransactionV1,
  ApiMockTransactionOutcome,
  ApiMockRouteV1,
  ApiMockResponseVariantV1,
} from '../../src/shared/api-mock/contracts.js';
import { normalizeRequest } from '../../src/shared/api-mock/requestNormalization.js';
import { selectRoute } from '../../src/shared/api-mock/routeSelector.js';
import {
  selectSequenceResponse, selectWeightedResponse, selectStateResponse,
  createSequenceState, resetSequence, type SequenceState,
} from '../../src/shared/api-mock/responseSelector.js';
import {
  createInitialState, applyTransition, resetState, type ScenarioState,
} from '../../src/shared/api-mock/scenarioRuntime.js';

/** Server-scoped state key shared by all state-mode routes on this listener. */
const DEFAULT_STATE_KEY = 'default';

const LISTEN_HOST = '127.0.0.1';

export interface ListenerConfig {
  serverId: string;
  definition: ApiMockServerDefinitionV1;
  onTransaction?: (tx: ApiMockTransactionV1) => void;
}

export class ApiMockNetworkListener {
  private server: http.Server | null = null;
  private port = 0;
  private generation = 0;
  private definition: ApiMockServerDefinitionV1;
  private readonly serverId: string;
  private activeConnections = new Set<net.Socket>();
  private readonly onTransaction: ((tx: ApiMockTransactionV1) => void) | undefined;
  private draining = false;
  private scenario: ScenarioState = createInitialState();
  private sequence: SequenceState = createSequenceState();

  constructor(config: ListenerConfig) {
    this.serverId = config.serverId;
    this.definition = config.definition;
    this.onTransaction = config.onTransaction;
  }

  /** Mode-aware response-variant selection (sequence/weighted/state/rules). */
  private selectVariant(route: ApiMockRouteV1): ApiMockResponseVariantV1 | undefined {
    switch (route.responseMode) {
      case 'sequence': return selectSequenceResponse(route, this.sequence);
      case 'weighted': return selectWeightedResponse(route);
      case 'state': return selectStateResponse(route, this.scenario, DEFAULT_STATE_KEY);
      default: return route.responses.find(v => v.enabled && v.isDefault) ?? route.responses.find(v => v.enabled);
    }
  }

  /** Snapshot of live scenario state + counters for the control plane. */
  getScenarioState(): ScenarioState {
    return { states: { ...this.scenario.states }, counters: { ...this.scenario.counters } };
  }

  resetScenario(): void {
    resetState(this.scenario);
    resetSequence(this.sequence);
  }

  async start(): Promise<{ port: number; generation: number }> {
    if (this.server) throw new Error(`Listener ${this.serverId} is already running`);
    this.port = this.definition.port;
    this.generation = 1;
    this.draining = false;

    const server = http.createServer((req, res) => this.handleRequest(req, res));
    server.on('connection', (socket: net.Socket) => {
      this.activeConnections.add(socket);
      socket.on('close', () => this.activeConnections.delete(socket));
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      const host = this.definition.host === '0.0.0.0' ? '0.0.0.0' : LISTEN_HOST;
      server.listen(this.port, host, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });

    this.server = server;
    return { port: this.port, generation: this.generation };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    this.draining = true;
    const drainMs = this.definition.settings.limits.gracefulDrainMs;
    const server = this.server;
    this.server = null;

    await Promise.race([
      new Promise<void>(resolve => server.close(() => resolve())),
      new Promise<void>(resolve => setTimeout(() => {
        for (const socket of this.activeConnections) socket.destroy();
        this.activeConnections.clear();
        resolve();
      }, drainMs)),
    ]);
    this.draining = false;
  }

  commit(definition: ApiMockServerDefinitionV1): number {
    this.definition = definition;
    this.generation++;
    return this.generation;
  }

  getPort(): number { return this.port; }
  getGeneration(): number { return this.generation; }
  getServerId(): string { return this.serverId; }
  isRunning(): boolean { return this.server !== null && !this.draining; }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const gen = this.generation;
    const startTime = Date.now();
    const bodyChunks: Buffer[] = [];
    const maxBody = this.definition.settings.limits.maxInboundBodyBytes;
    let bodySize = 0;
    let truncated = false;

    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize <= maxBody) bodyChunks.push(chunk);
      else truncated = true;
    });

    req.on('end', () => {
      const bodyStr = bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString('utf8') : null;
      const { captured } = normalizeRequest({
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: bodyStr,
        remoteAddress: req.socket.remoteAddress,
      });
      captured.bodyTruncated = truncated;

      const result = selectRoute(this.definition.routes, captured, this.definition.settings, this.definition.basePath);
      const outcome: ApiMockTransactionOutcome = result.outcome;

        if (outcome === 'matched' && result.selectedRouteId) {
          const route = this.definition.routes.find(r => r.id === result.selectedRouteId)!;
          const variant = this.selectVariant(route);
        const status = variant?.status ?? 200;
        const headers: Record<string, string> = {};
        for (const h of variant?.headers ?? []) {
          if (h.enabled) headers[h.key] = h.value;
        }
        const ct = variant?.body.contentType;
        if (ct) headers['Content-Type'] = ct;
        const body = variant?.body.content ?? '';
        const delayMs = variant?.behavior.delayMs ?? 0;

        const send = () => {
          // Apply the variant's state transition once the response is committed.
          if (variant?.transition) applyTransition(this.scenario, DEFAULT_STATE_KEY, variant.transition);
          res.writeHead(status, headers);
          res.end(body);
          this.recordTransaction(captured, outcome, status, body, gen, startTime, result);
        };

        if (delayMs > 0) setTimeout(send, delayMs);
        else send();
      } else if (outcome === 'ambiguous') {
        const ambResp = this.definition.settings.selection.ambiguityResponse;
        res.writeHead(ambResp.status, { 'Content-Type': ambResp.contentType });
        res.end(ambResp.body);
        this.recordTransaction(captured, outcome, ambResp.status, ambResp.body, gen, startTime, result);
      } else {
        const fallback = this.definition.settings.fallback.unmatchedResponse;
        res.writeHead(fallback.status, { 'Content-Type': fallback.contentType });
        res.end(fallback.body);
        this.recordTransaction(captured, outcome, fallback.status, fallback.body, gen, startTime, result);
      }
    });

    req.on('error', () => {
      if (!res.headersSent) res.writeHead(400).end();
    });
  }

  private recordTransaction(
    request: ApiMockCapturedRequestV1, outcome: ApiMockTransactionOutcome,
    status: number, body: string, generation: number, startTime: number,
    result: ReturnType<typeof selectRoute>,
  ): void {
    if (!this.onTransaction) return;
    this.onTransaction({
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      serverId: this.serverId,
      generation,
      receivedAt: request.receivedAt,
      completedAt: new Date().toISOString(),
      request,
      response: {
        status,
        headers: {},
        cookies: [],
        body: body.length > 1024 ? body.slice(0, 1024) : body,
        bodyTruncated: body.length > 1024,
        durationMs: Date.now() - startTime,
        generationAtResponse: generation,
      },
      outcome,
      matchedRouteId: result.selectedRouteId,
      matchedResponseId: result.selectedResponseId,
      explanation: result.explanation,
      durationMs: Date.now() - startTime,
    });
  }
}

export async function isPortAvailable(port: number, host = LISTEN_HOST): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });
}
