import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
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

  function attachProxyMiddleware(server: ViteDevServer | PreviewServer) {
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

          const round2 = (n: number) => Math.round(n * 100) / 100;

          /** Perform the fetch and format the result. */
          const doFetch = async (opts: Record<string, unknown>) => {
            const t0 = performance.now();
            const response = await fetch(payload.url, opts as RequestInit);
            const tFirstByte = performance.now();
            const responseBody = await response.text();
            const tDone = performance.now();
            return {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: responseBody,
              timing: {
                dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0,
                ttfb: round2(tFirstByte - t0),
                download: round2(tDone - tFirstByte),
                total: round2(tDone - t0),
              },
            };
          };

          let result;
          try {
            result = await doFetch(fetchOpts);
          } catch (proxyErr) {
            // If proxy is unreachable (DNS/connection error), retry without proxy
            const code = (proxyErr as NodeJS.ErrnoException).code
              ?? ((proxyErr as { cause?: NodeJS.ErrnoException }).cause as NodeJS.ErrnoException | undefined)?.code;
            if (dispatcher && (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT')) {
              const directOpts = { ...fetchOpts };
              delete directOpts.dispatcher;
              result = await doFetch(directOpts);
            } else {
              throw proxyErr;
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          // Walk the cause chain for detailed network errors (DNS, TLS, timeout, etc.)
          const parts: string[] = [];
          let cur: unknown = err;
          const seen = new Set<unknown>();
          while (cur && !seen.has(cur)) {
            seen.add(cur);
            if (cur instanceof Error) {
              const code = (cur as NodeJS.ErrnoException).code;
              parts.push(code ? `${cur.message} [${code}]` : cur.message);
              cur = cur.cause;
            } else {
              parts.push(String(cur));
              break;
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: parts.join(' — '),
          }));
        }
      });
  }

  return {
    name: 'api-proxy',
    configureServer(server) {
      attachProxyMiddleware(server);
    },
    configurePreviewServer(server) {
      attachProxyMiddleware(server);
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
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
