import { Router, type Request, type Response } from 'express';
import type { LogLine } from '../../../src/shared/types/server-api.js';
import { toErrorMessage } from '../../../src/shared/utils/helpers.js';
import type {
  GrpcMockListenerCommitRequest,
  GrpcMockListenerStartRequest,
} from '../../../src/shared/grpc/grpcMockListenerContracts.js';
import { scanGrpcObjectForSecretLeakage, detectGrpcSecretMaterialInDiagnosticText } from '../../../src/shared/grpc/grpcSecretLeakScan.js';
import { grpcMockServerPool, type GrpcMockServerPool } from '../../grpc/grpcMockServerPool.js';

interface CreateGrpcMockRouterOptions {
  pool?: GrpcMockServerPool;
  onLog?: (line: LogLine) => void;
}

function json200(res: Response, data: unknown) {
  return res.status(200).json({ ok: true, data });
}

function jsonError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

function requireTabId(req: Request, res: Response): string | undefined {
  const tabId = typeof req.query.tabId === 'string'
    ? req.query.tabId
    : typeof req.body?.tabId === 'string'
      ? req.body.tabId
      : undefined;
  if (!tabId?.trim()) {
    jsonError(res, 400, 'MOCK_INVALID_TAB', 'tabId is required');
    return undefined;
  }
  return tabId.trim();
}

function redactStatusForExport<T extends Record<string, unknown>>(status: T): T {
  const leaks = scanGrpcObjectForSecretLeakage(status, { rootPath: 'mockListenerStatus' });
  const lastError = typeof status.lastError === 'string' ? status.lastError : undefined;
  const redactLastError = lastError != null && (
    leaks.length > 0 || detectGrpcSecretMaterialInDiagnosticText(lastError)
  );
  if (!redactLastError) {
    return status;
  }
  return {
    ...status,
    lastError: '[redacted]',
  };
}

export function createGrpcMockRouter(options: CreateGrpcMockRouterOptions = {}): Router {
  const router = Router();
  const pool = options.pool ?? grpcMockServerPool;

  const log = (text: string) => {
    if (!options.onLog) return;
    options.onLog({ prefix: '*', text: `[gRPC-Mock] ${text}`, ts: Date.now() });
  };

  router.post('/api/grpc/mock/start', async (req: Request, res: Response) => {
    const body = req.body as GrpcMockListenerStartRequest | undefined;
    if (!body || typeof body !== 'object') {
      return jsonError(res, 400, 'MOCK_INVALID_REQUEST', 'Request body must be a JSON object');
    }
    log(`start tab=${body.tabId} descriptor=${body.descriptorKey}`);
    try {
      const result = await pool.start(body);
      return json200(res, {
        status: redactStatusForExport(result.status as unknown as Record<string, unknown>),
      });
    } catch (error) {
      const message = toErrorMessage(error);
      log(`start failed: ${message}`);
      return jsonError(res, 500, 'MOCK_START_FAILED', message);
    }
  });

  router.post('/api/grpc/mock/stop', async (req: Request, res: Response) => {
    const tabId = requireTabId(req, res);
    if (!tabId) return undefined;
    log(`stop tab=${tabId}`);
    try {
      const status = await pool.stop(tabId);
      return json200(res, { status: redactStatusForExport(status as unknown as Record<string, unknown>) });
    } catch (error) {
      return jsonError(res, 500, 'MOCK_STOP_FAILED', toErrorMessage(error));
    }
  });

  router.post('/api/grpc/mock/commit', (req: Request, res: Response) => {
    const body = req.body as GrpcMockListenerCommitRequest | undefined;
    if (!body?.tabId?.trim()) {
      return jsonError(res, 400, 'MOCK_INVALID_REQUEST', 'tabId is required');
    }
    try {
      const result = pool.commit(body);
      return json200(res, result);
    } catch (error) {
      return jsonError(res, 500, 'MOCK_COMMIT_FAILED', toErrorMessage(error));
    }
  });

  router.get('/api/grpc/mock/status', (req: Request, res: Response) => {
    const tabId = requireTabId(req, res);
    if (!tabId) return undefined;
    const status = pool.getStatus(tabId);
    return json200(res, { status: redactStatusForExport(status as unknown as Record<string, unknown>) });
  });

  router.get('/api/grpc/mock/log', (req: Request, res: Response) => {
    const tabId = requireTabId(req, res);
    if (!tabId) return undefined;
    const since = typeof req.query.since === 'string'
      ? Number.parseInt(req.query.since, 10)
      : -1;
    const entries = pool.getLogs(tabId, Number.isFinite(since) ? since : -1);
    const nextCursor = entries.length > 0 ? entries[entries.length - 1]!.id : since;
    return json200(res, { entries, nextCursor });
  });

  return router;
}
