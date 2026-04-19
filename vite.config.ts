import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function proxyPlugin(): Plugin {
  let pooledDispatcher: import('undici').Dispatcher | undefined;

  async function getDispatcher(): Promise<import('undici').Dispatcher | undefined> {
    if (pooledDispatcher) return pooledDispatcher;
    try {
      const undici = await import('undici');
      const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
        || process.env.HTTP_PROXY || process.env.http_proxy;
      if (proxy) {
        pooledDispatcher = undici.EnvHttpProxyAgent
          ? new undici.EnvHttpProxyAgent()
          : new undici.ProxyAgent(proxy);
      } else {
        pooledDispatcher = new undici.Agent({
          keepAliveTimeout: 30_000,
          keepAliveMaxTimeout: 60_000,
          connections: 128,
          pipelining: 1,
        });
      }
    } catch { /* undici not available — fall back to default dispatcher */ }
    return pooledDispatcher;
  }

  return {
    name: 'api-proxy',
    configureServer(server) {
      server.httpServer?.on('close', () => {
        pooledDispatcher?.close?.();
        pooledDispatcher = undefined;
      });

      server.middlewares.use('/__proxy', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end('Method not allowed');
          return;
        }

        let rawBody = '';
        for await (const chunk of req) {
          rawBody += chunk;
        }

        let payload: {
          url: string;
          method: string;
          headers: Record<string, string>;
          body?: string;
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        try {
          const headers = { ...payload.headers, 'Connection': 'keep-alive' };
          const fetchOpts: Record<string, unknown> = {
            method: payload.method,
            headers,
          };
          if (payload.body && payload.method !== 'GET') {
            fetchOpts.body = payload.body;
          }

          const dispatcher = await getDispatcher();
          if (dispatcher) fetchOpts.dispatcher = dispatcher;

          const response = await fetch(payload.url, fetchOpts as RequestInit);
          const responseBody = await response.text();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
          }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      });
    },
  };
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), proxyPlugin()],
  clearScreen: false,
  server: {
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
