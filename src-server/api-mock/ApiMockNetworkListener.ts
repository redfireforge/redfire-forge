/**
 * API Mock Studio — HTTP network listener (Phase 2A + Phase 7 response/fault runtime).
 * Creates one HTTP server per mock-server definition on its configured port.
 */
import http from 'node:http';
import https from 'node:https';
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
  selectResponseForRoute,
  isVariantEligible,
  createSequenceState,
  resetSequence,
  type SequenceState,
} from '../../src/shared/api-mock/responseSelector.js';
import {
  createInitialState, applyTransition, resetState, type ScenarioState,
} from '../../src/shared/api-mock/scenarioRuntime.js';
import { renderResponseVariant } from '../../src/shared/api-mock/responseRenderer.js';
import { renderFallbackBody, newTransactionId } from '../../src/shared/api-mock/fallbackBody.js';
import { computeVirtualDelayMs } from '../../src/shared/api-mock/faultPreview.js';
import { buildClosestMatchDebugBody } from '../../src/shared/api-mock/closestMatchDebug.js';
import { hasAntiRecursionHeader } from '../../src/shared/api-mock/proxyPolicy.js';
import { DEFAULT_PROXY_SETTINGS } from '../../src/shared/api-mock/proxyContracts.js';
import { DEFAULT_CALLBACK_SETTINGS } from '../../src/shared/api-mock/callbackContracts.js';
import {
  draftFingerprint,
  proxiedExchangeToDraft,
  toRecordedDraft,
  type ApiMockRecordedDraftV1,
} from '../../src/shared/api-mock/proxyRecording.js';
import { applyResponseTransforms } from '../../src/shared/api-mock/responseTransforms.js';
import { deliverWithFault } from './apiMockFaultExecutor.js';
import { buildUpstreamUrl, executeProxy, pickAllowlistedOrigin } from './apiMockProxyExecutor.js';
import { executeCallbacks } from './apiMockCallbackExecutor.js';

/** Server-scoped state key shared by all state-mode routes on this listener. */
const DEFAULT_STATE_KEY = 'default';

const LISTEN_HOST = '127.0.0.1';

export interface ListenerConfig {
  serverId: string;
  definition: ApiMockServerDefinitionV1;
  onTransaction?: (tx: ApiMockTransactionV1) => void;
  /** Phase 9C — inactive drafts from successful proxied exchanges. */
  onRecordedDraft?: (draft: ApiMockRecordedDraftV1) => void;
  /** Active mock listener ports — used to block self-recursion when proxying. */
  getActiveMockPorts?: () => number[];
}

export class ApiMockNetworkListener {
  private server: http.Server | https.Server | null = null;
  private port = 0;
  private generation = 0;
  private definition: ApiMockServerDefinitionV1;
  private readonly serverId: string;
  private activeConnections = new Set<net.Socket>();
  private readonly onTransaction: ((tx: ApiMockTransactionV1) => void) | undefined;
  private readonly onRecordedDraft: ((draft: ApiMockRecordedDraftV1) => void) | undefined;
  private readonly getActiveMockPorts: (() => number[]) | undefined;
  private draining = false;
  private scenario: ScenarioState = createInitialState();
  private sequence: SequenceState = createSequenceState();
  private variantMatchCounts: Record<string, number> = {};

  constructor(config: ListenerConfig) {
    this.serverId = config.serverId;
    this.definition = config.definition;
    this.onTransaction = config.onTransaction;
    this.onRecordedDraft = config.onRecordedDraft;
    this.getActiveMockPorts = config.getActiveMockPorts;
  }

  /** Mode-aware response-variant selection (sequence/weighted/state/rules). */
  private selectVariant(route: ApiMockRouteV1, request: ApiMockCapturedRequestV1): ApiMockResponseVariantV1 | undefined {
    const selected = selectResponseForRoute(route, request, this.scenario, this.sequence, {
      basePath: this.definition.basePath,
      stateKey: DEFAULT_STATE_KEY,
      seed: `${request.receivedAt}:${route.id}:${request.path}`,
    });
    if (!selected) return undefined;
    const count = this.variantMatchCounts[selected.id] ?? 0;
    const eligibility = isVariantEligible(selected, count);
    if (!eligibility.eligible) {
      // Fall back to default/enabled sibling when the chosen variant is exhausted.
      const fallback = route.responses.find(v => (
        v.enabled && v.id !== selected.id && isVariantEligible(v, this.variantMatchCounts[v.id] ?? 0).eligible
      ));
      return fallback ?? selected;
    }
    return selected;
  }

  /** Snapshot of live scenario state + counters for the control plane. */
  getScenarioState(): ScenarioState {
    return { states: { ...this.scenario.states }, counters: { ...this.scenario.counters } };
  }

  /** Live sequence cursor per route (next index to serve). */
  getSequenceState(): SequenceState {
    return { positions: { ...this.sequence.positions } };
  }

  resetScenario(): void {
    resetState(this.scenario);
    resetSequence(this.sequence);
    this.variantMatchCounts = {};
  }

  async start(): Promise<{ port: number; generation: number }> {
    if (this.server) throw new Error(`Listener ${this.serverId} is already running`);
    this.port = this.definition.port;
    this.generation = 1;
    this.draining = false;

    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => this.handleRequest(req, res);
    const tls = this.definition.settings.tls;
    let server: http.Server | https.Server;
    if (tls?.enabled) {
      if (!tls.certPem?.trim() || !tls.keyPem?.trim()) {
        throw new Error('TLS is enabled but no certificate and key are configured.');
      }
      try {
        const mtls = tls.mtls;
        if (mtls?.enabled && !mtls.clientCaPem?.trim()) {
          throw new Error('Client certificates are required but no client CA is configured.');
        }
        server = https.createServer(
          {
            cert: tls.certPem,
            key: tls.keyPem,
            passphrase: tls.passphrase || undefined,
            ...(mtls?.enabled
              ? { ca: mtls.clientCaPem, requestCert: true, rejectUnauthorized: true }
              : {}),
          },
          handler,
        );
      } catch (err) {
        throw new Error(`TLS material rejected: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      server = http.createServer(handler);
    }
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
      void this.processRequest(req, res, bodyChunks, truncated, gen, startTime);
    });

    req.on('error', () => {
      if (!res.headersSent) res.writeHead(400).end();
    });
  }

  private async processRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    bodyChunks: Buffer[],
    truncated: boolean,
    gen: number,
    startTime: number,
  ): Promise<void> {
    if (hasAntiRecursionHeader(req.headers as Record<string, string | string[] | undefined>)) {
      res.writeHead(508, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'loop_detected', message: 'X-RedfireForge-Mock recursion rejected' }));
      return;
    }

    const bodyBuf = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;
    const bodyStr = bodyBuf ? bodyBuf.toString('utf8') : null;
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
    // Generated up front so the id echoed in a fallback body is the same id the
    // journal records, making an unmatched request traceable.
    const requestId = newTransactionId();

    if (outcome === 'matched' && result.selectedRouteId) {
      const route = this.definition.routes.find(r => r.id === result.selectedRouteId)!;
      const variant = this.selectVariant(route, captured);
      if (variant) this.variantMatchCounts[variant.id] = (this.variantMatchCounts[variant.id] ?? 0) + 1;

      let rendered = renderResponseVariant({
        variant,
        request: captured,
        route,
        basePath: this.definition.basePath,
        scenario: this.scenario,
        variables: this.definition.variables,
        seed: `${captured.receivedAt}:${route.id}`,
        maxResponseBodyBytes: this.definition.settings.limits.maxResponseBodyBytes,
      });
      // Phase 9D transforms — failure-isolated (errors ignored for delivery).
      const transformed = applyResponseTransforms(rendered, variant?.transforms);
      rendered = transformed.rendered;
      const delayMs = computeVirtualDelayMs(variant, this.definition.settings.limits.maxDelayMs).totalMs;

      const deliver = async () => {
        if (variant?.transition) applyTransition(this.scenario, DEFAULT_STATE_KEY, variant.transition);
        const fault = variant?.behavior.fault ?? 'none';
        const delivery = await deliverWithFault({
          req,
          res,
          fault,
          behavior: variant?.behavior ?? { delayMs: 0, jitterMs: 0 },
          longRunningMaxMs: this.definition.settings.limits.longRunningMaxMs,
          status: rendered.status,
          headers: rendered.headers,
          body: rendered.body,
        });
        this.recordTransaction(
          captured,
          delivery.outcome,
          delivery.status || rendered.status,
          delivery.body || rendered.body,
          gen,
          startTime,
          result,
          variant?.id,
          rendered.headers,
        );
        // Fire-and-forget callbacks after the client response is committed.
        if (variant?.callbacks?.some(c => c.enabled)) {
          const cbSettings = this.definition.settings.callbacks ?? DEFAULT_CALLBACK_SETTINGS;
          void executeCallbacks({
            callbacks: variant.callbacks,
            settings: cbSettings,
            activeMockPorts: this.getActiveMockPorts?.() ?? [this.port],
            blockPrivateNetworks: this.definition.settings.proxy?.blockPrivateNetworks ?? true,
          }).catch(() => { /* isolation */ });
        }
      };

      if (delayMs > 0) setTimeout(() => { void deliver(); }, delayMs);
      else await deliver();
      return;
    }

    if (outcome === 'ambiguous') {
      const ambResp = this.definition.settings.selection.ambiguityResponse;
      const body = renderFallbackBody(ambResp.body, {
        requestId,
        competingRuleCount: result.explanation?.candidates?.length ?? 0,
      });
      res.writeHead(ambResp.status, { 'Content-Type': ambResp.contentType });
      res.end(body);
      this.recordTransaction(captured, outcome, ambResp.status, body, gen, startTime, result, undefined, undefined, requestId);
      return;
    }

    const fallback = this.definition.settings.fallback.unmatchedResponse;
    if (this.definition.settings.fallback.mode === 'closest_match_debug') {
      const debug = buildClosestMatchDebugBody(result.explanation, fallback);
      res.writeHead(debug.status, { 'Content-Type': debug.contentType });
      res.end(debug.body);
      this.recordTransaction(captured, outcome, debug.status, debug.body, gen, startTime, result, undefined, undefined, requestId);
      return;
    }

    const proxy = this.definition.settings.proxy ?? DEFAULT_PROXY_SETTINGS;
    if (this.definition.settings.fallback.mode === 'proxy' && proxy.enabled) {
      const origin = pickAllowlistedOrigin(proxy);
      if (!origin) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        const errBody = JSON.stringify({ error: 'proxy_misconfigured', message: 'Proxy enabled but allowlist is empty' });
        res.end(errBody);
        this.recordTransaction(captured, 'error', 502, errBody, gen, startTime, result);
        return;
      }
      const upstreamUrl = buildUpstreamUrl(origin, captured.path, req.url ?? captured.path);
      const proxied = await executeProxy({
        req,
        proxy,
        upstreamUrl,
        activeMockPorts: this.getActiveMockPorts?.() ?? [this.port],
        body: bodyBuf,
      });
      if (!proxied.ok) {
        // Failure isolation: return diagnostic 502 without mutating scenario/sequence.
        const errBody = JSON.stringify({ error: 'proxy_failed', message: proxied.error ?? 'upstream error' });
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(errBody);
        this.recordTransaction(captured, 'error', 502, errBody, gen, startTime, result);
        return;
      }
      if (!res.headersSent) {
        const headers = Object.fromEntries(
          Object.entries(proxied.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]),
        );
        res.writeHead(proxied.status, headers);
        res.end(proxied.body);
      }
      this.recordTransaction(captured, 'proxied', proxied.status, proxied.body, gen, startTime, result, undefined, proxied.headers);
      if (proxy.recordAsDrafts && this.onRecordedDraft) {
        try {
          const conversion = proxiedExchangeToDraft(captured, {
            status: proxied.status,
            headers: proxied.headers,
            body: proxied.body,
          }, this.definition.settings);
          const fingerprint = draftFingerprint(captured.method, captured.path, proxied.status);
          this.onRecordedDraft(toRecordedDraft(conversion, fingerprint));
        } catch { /* recording must never affect proxy delivery */ }
      }
      return;
    }

    const fallbackBody = renderFallbackBody(fallback.body, { requestId });
    res.writeHead(fallback.status, { 'Content-Type': fallback.contentType });
    res.end(fallbackBody);
    this.recordTransaction(captured, outcome, fallback.status, fallbackBody, gen, startTime, result, undefined, undefined, requestId);
  }

  private recordTransaction(
    request: ApiMockCapturedRequestV1, outcome: ApiMockTransactionOutcome,
    status: number, body: string, generation: number, startTime: number,
    result: ReturnType<typeof selectRoute>,
    matchedResponseId?: string,
    responseHeaders?: Record<string, string | string[]>,
    transactionId?: string,
  ): void {
    if (!this.onTransaction) return;
    const maxBody = this.definition.settings.journal.maxCapturedBodyBytes;
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(responseHeaders ?? {})) {
      headers[k] = Array.isArray(v) ? v.map(String) : [String(v)];
    }
    this.onTransaction({
      id: transactionId ?? newTransactionId(),
      serverId: this.serverId,
      generation,
      receivedAt: request.receivedAt,
      completedAt: new Date().toISOString(),
      request,
      response: {
        status,
        headers,
        cookies: [],
        body: body.length > maxBody ? body.slice(0, maxBody) : body,
        bodyTruncated: body.length > maxBody,
        durationMs: Date.now() - startTime,
        generationAtResponse: generation,
      },
      outcome,
      matchedRouteId: result.selectedRouteId,
      matchedResponseId: matchedResponseId ?? result.selectedResponseId,
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
