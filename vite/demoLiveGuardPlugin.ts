import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { DEMO_LIVE_GUARD_ENDPOINT } from '../packages/demo-hub/src/demoLiveGuard';
import {
  DEMO_LIVE_GUARD_RELATIVE_PATH,
  parseDemoLiveGuardState,
  resolveDevServerStartupGuardState,
  validateIncomingDemoLiveGuardState,
  type DemoLiveGuardState,
} from '../packages/demo-hub/src/demoLiveGuardPolicy';

function guardFilePath(root: string): string {
  return resolve(root, DEMO_LIVE_GUARD_RELATIVE_PATH);
}

function writeGuardFile(root: string, state: DemoLiveGuardState): void {
  const filePath = guardFilePath(root);
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmpPath, filePath);
}

function readGuardFile(root: string): DemoLiveGuardState | null {
  try {
    const raw = JSON.parse(readFileSync(guardFilePath(root), 'utf8')) as unknown;
    return parseDemoLiveGuardState(raw);
  } catch {
    return null;
  }
}

async function readJsonBody(req: import('http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function attachDemoLiveGuardMiddleware(server: ViteDevServer | PreviewServer, root: string): void {
  writeGuardFile(root, resolveDevServerStartupGuardState(readGuardFile(root)));

  server.middlewares.use(DEMO_LIVE_GUARD_ENDPOINT, async (req, res) => {
    if (req.method === 'GET') {
      const state = readGuardFile(root) ?? resolveDevServerStartupGuardState(null);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    if (req.method === 'POST') {
      let payload: unknown;
      try {
        payload = await readJsonBody(req);
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      const parsed = parseDemoLiveGuardState(payload);
      if (!parsed) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid guard payload' }));
        return;
      }

      const validationError = validateIncomingDemoLiveGuardState(parsed);
      if (validationError) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: validationError }));
        return;
      }

      writeGuardFile(root, parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(405);
    res.end('Method not allowed');
  });
}

export function demoLiveGuardPlugin(): Plugin {
  return {
    name: 'demo-live-guard',
    configureServer(server) {
      attachDemoLiveGuardMiddleware(server, server.config.root);
    },
    configurePreviewServer(server) {
      attachDemoLiveGuardMiddleware(server, server.config.root);
    },
  };
}
