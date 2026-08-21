/**
 * API Mock Studio — control-plane routes (Phase 2C).
 * Express router for /api/mock/* endpoints.
 */
import { Router, type Request, type Response } from 'express';
import { apiMockPool } from '../../api-mock/ApiMockServerPool.js';
import { validateServer } from '../../../src/shared/api-mock/validation.js';
import { classifyRuntimeError } from '../../../src/shared/api-mock/recoveryDiagnostics.js';
import type { ApiMockServerDefinitionV1, ApiMockLocalDiagnosticsV1 } from '../../../src/shared/api-mock/contracts.js';
import { emptyOutcomeCounts } from '../../../src/shared/api-mock/localDiagnostics.js';
import { isPortAvailable } from '../../api-mock/ApiMockNetworkListener.js';
import { AUTO_PORT_RANGE } from '../../../src/shared/api-mock/defaults.js';
import { generateSelfSigned, generateClientCredentials } from '../../api-mock/apiMockTls.js';
import { ApiMockTransactionJournal } from '../../api-mock/ApiMockTransactionJournal.js';
import { journalPersistPath } from '../../api-mock/apiMockJournalPersist.js';
import type { LogLine } from '../../../src/shared/types/server-api';

interface CreateApiMockRouterOptions {
  onLog?: (line: LogLine) => void;
}

function json200(res: Response, data: unknown) {
  res.status(200).json({ ok: true, data });
}

function jsonError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ ok: false, error: { code, message } });
}

/**
 * Expected idle (listener not running / no journal yet). HTTP 200 so Chrome does
 * not log "Failed to load resource" on the Runtime journal/state polls.
 * The client already treats `ok: false` + NOT_RUNNING / NOT_FOUND as terminal.
 */
function jsonIdle(res: Response, code: string, message: string) {
  jsonError(res, 200, code, message);
}

export function createApiMockRouter(options: CreateApiMockRouterOptions = {}): Router {
  const router = Router();
  const journals = new Map<string, ApiMockTransactionJournal>();

  function getOrCreateJournal(def: ApiMockServerDefinitionV1): ApiMockTransactionJournal {
    let journal = journals.get(def.id);
    if (!journal) {
      journal = new ApiMockTransactionJournal(def.settings, { persistFile: journalPersistPath(def.id) });
      journals.set(def.id, journal);
    } else {
      journal.updateSettings(def.settings);
    }
    return journal;
  }

  apiMockPool.setTransactionHandler(tx => {
    try {
      journals.get(tx.serverId)?.append(tx);
    } catch {
      // Isolation: journal persistence must never fail the mock response.
    }
  });

  router.post('/api/mock/servers/start', async (req: Request, res: Response) => {
    try {
      const definition = req.body as ApiMockServerDefinitionV1;
      if (!definition?.id) return jsonError(res, 400, 'INVALID_REQUEST', 'Server definition with id is required');
      const diags = validateServer(definition);
      const errors = diags.filter(d => d.severity === 'error');
      if (errors.length > 0) return jsonError(res, 400, 'VALIDATION_ERROR', errors.map(e => e.message).join('; '));
      getOrCreateJournal(definition);
      const status = await apiMockPool.start(definition);
      options.onLog?.({ ts: new Date().toISOString(), level: 'info', source: 'api-mock', message: `Started "${definition.name}" on :${status.port}` });
      json200(res, status);
    } catch (e) {
      const diag = classifyRuntimeError(e);
      jsonError(res, 409, diag.code, diag.message);
    }
  });

  router.post('/api/mock/servers/:serverId/stop', async (req: Request, res: Response) => {
    try {
      const status = await apiMockPool.stop(req.params.serverId);
      options.onLog?.({ ts: new Date().toISOString(), level: 'info', source: 'api-mock', message: `Stopped "${req.params.serverId}"` });
      json200(res, status);
    } catch (e) {
      jsonError(res, 404, 'NOT_FOUND', (e as Error).message);
    }
  });

  router.post('/api/mock/servers/:serverId/restart', async (req: Request, res: Response) => {
    try {
      const definition = req.body as ApiMockServerDefinitionV1;
      if (!definition?.id) return jsonError(res, 400, 'INVALID_REQUEST', 'Server definition with id is required');
      getOrCreateJournal(definition);
      const status = await apiMockPool.restart(definition);
      options.onLog?.({ ts: new Date().toISOString(), level: 'info', source: 'api-mock', message: `Restarted "${definition.name}" on :${status.port}` });
      json200(res, status);
    } catch (e) {
      const diag = classifyRuntimeError(e);
      jsonError(res, 409, diag.code, diag.message);
    }
  });

  router.put('/api/mock/servers/:serverId/definition', (req: Request, res: Response) => {
    try {
      const definition = req.body as ApiMockServerDefinitionV1;
      if (!definition?.id) return jsonError(res, 400, 'INVALID_REQUEST', 'Server definition with id is required');
      const diags = validateServer(definition);
      const errors = diags.filter(d => d.severity === 'error');
      if (errors.length > 0) return jsonError(res, 400, 'VALIDATION_ERROR', errors.map(e => e.message).join('; '));
      const status = apiMockPool.commit(req.params.serverId, definition);
      journals.get(req.params.serverId)?.updateSettings(definition.settings);
      options.onLog?.({ ts: new Date().toISOString(), level: 'info', source: 'api-mock', message: `Committed gen ${status.generation} for "${req.params.serverId}"` });
      json200(res, status);
    } catch (e) {
      jsonError(res, 409, 'COMMIT_FAILED', (e as Error).message);
    }
  });

  router.get('/api/mock/servers/:serverId/status', (req: Request, res: Response) => {
    const status = apiMockPool.status(req.params.serverId);
    if (!status) return jsonIdle(res, 'NOT_FOUND', `Server "${req.params.serverId}" not found`);
    json200(res, status);
  });

  router.get('/api/mock/servers/:serverId/state', (req: Request, res: Response) => {
    const state = apiMockPool.getRuntimeState(req.params.serverId);
    if (!state) return jsonIdle(res, 'NOT_RUNNING', `Server "${req.params.serverId}" is not running`);
    json200(res, state);
  });

  router.post('/api/mock/servers/:serverId/state/reset', (req: Request, res: Response) => {
    const ok = apiMockPool.resetScenarioState(req.params.serverId);
    if (!ok) return jsonError(res, 404, 'NOT_RUNNING', `Server "${req.params.serverId}" is not running`);
    json200(res, { reset: true });
  });

  router.get('/api/mock/servers', (_req: Request, res: Response) => {
    json200(res, apiMockPool.list());
  });

  router.post('/api/mock/tls/self-signed', async (req: Request, res: Response) => {
    const raw = Array.isArray(req.body?.hosts) ? req.body.hosts : [];
    const hosts = raw.filter((h: unknown): h is string => typeof h === 'string' && h.trim().length > 0);
    try {
      json200(res, await generateSelfSigned(hosts.length ? hosts : undefined));
    } catch (err) {
      jsonError(res, 500, 'TLS_GENERATE_FAILED', err instanceof Error ? err.message : 'Certificate generation failed');
    }
  });

  router.post('/api/mock/tls/client-credentials', async (req: Request, res: Response) => {
    const cn = typeof req.body?.commonName === 'string' ? req.body.commonName : '';
    try {
      json200(res, await generateClientCredentials(cn || undefined));
    } catch (err) {
      jsonError(res, 500, 'TLS_CLIENT_GENERATE_FAILED', err instanceof Error ? err.message : 'Client certificate generation failed');
    }
  });

  router.post('/api/mock/ports/probe', async (req: Request, res: Response) => {
    const port = typeof req.body?.port === 'number' ? req.body.port : 0;
    if (port < 1024 || port > 65535) return jsonError(res, 400, 'INVALID_PORT', 'Port must be 1024-65535');
    const available = await isPortAvailable(port);
    json200(res, { port, available });
  });

  /** Next free auto-port in 4600–4699, skipping tab excludes + pool-owned + OS-bound ports. */
  router.post('/api/mock/ports/next', async (req: Request, res: Response) => {
    const excludeRaw = Array.isArray(req.body?.exclude) ? req.body.exclude as unknown[] : [];
    const exclude = new Set<number>([
      ...excludeRaw.filter((p): p is number => typeof p === 'number' && Number.isInteger(p)),
      ...apiMockPool.list()
        .filter(s => s.state === 'running')
        .map(s => s.port),
    ]);
    for (let port = AUTO_PORT_RANGE.min; port <= AUTO_PORT_RANGE.max; port++) {
      if (exclude.has(port)) continue;
      if (await isPortAvailable(port)) {
        return json200(res, { port });
      }
    }
    return jsonError(
      res,
      503,
      'NO_PORT_AVAILABLE',
      `No available port in ${AUTO_PORT_RANGE.min}-${AUTO_PORT_RANGE.max}`,
    );
  });

  router.get('/api/mock/servers/:serverId/transactions', (req: Request, res: Response) => {
    const journal = journals.get(req.params.serverId);
    if (!journal) return jsonIdle(res, 'NOT_FOUND', `No journal for "${req.params.serverId}"`);
    const afterCursor = req.query.afterCursor ? parseInt(req.query.afterCursor as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    json200(res, journal.query({
      afterCursor,
      limit,
      methodFilter: req.query.method as string | undefined,
      pathFilter: req.query.path as string | undefined,
      outcomeFilter: req.query.outcome as string | undefined,
    }));
  });

  router.delete('/api/mock/servers/:serverId/transactions', (req: Request, res: Response) => {
    const journal = journals.get(req.params.serverId);
    if (!journal) return jsonError(res, 404, 'NOT_FOUND', `No journal for "${req.params.serverId}"`);
    journal.clear();
    json200(res, { cleared: true });
  });

  router.get('/api/mock/servers/:serverId/recorded-drafts', (req: Request, res: Response) => {
    const drafts = apiMockPool.getRecordedDrafts(req.params.serverId);
    json200(res, { drafts, total: drafts.length });
  });

  router.delete('/api/mock/servers/:serverId/recorded-drafts', (req: Request, res: Response) => {
    apiMockPool.clearRecordedDrafts(req.params.serverId);
    json200(res, { cleared: true });
  });

  router.post('/api/mock/servers/:serverId/recorded-drafts/ack', (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids as string[] : [];
    const removed = apiMockPool.acknowledgeRecordedDrafts(req.params.serverId, ids);
    json200(res, { removed });
  });

  router.get('/api/mock/servers/:serverId/diagnostics', (req: Request, res: Response) => {
    const journal = journals.get(req.params.serverId);
    const live = apiMockPool.getListenerDiagnostics(req.params.serverId);
    const status = apiMockPool.status(req.params.serverId);
    if (!journal && !live && !status) {
      return jsonIdle(res, 'NOT_FOUND', `No diagnostics for "${req.params.serverId}"`);
    }
    const data: ApiMockLocalDiagnosticsV1 = {
      generation: live?.generation ?? status?.generation ?? 0,
      routeCount: live?.routeCount ?? 0,
      predicateCount: live?.predicateCount ?? 0,
      openConnections: live?.openConnections ?? 0,
      inFlight: live?.inFlight ?? 0,
      matchDuration: live?.matchDuration ?? { lastMs: 0, p95Ms: 0, count: 0 },
      outcomes: live?.outcomes ?? emptyOutcomeCounts(),
      journal: journal?.getStats() ?? { drops: 0, truncations: 0, size: 0, maxEntries: 0 },
      templateErrors: live?.templateErrors ?? 0,
    };
    json200(res, data);
  });

  return router;
}
