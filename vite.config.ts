import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { isLoopbackUrl, preferLocalhostHostname, resolveLoopbackUrl } from './src/shared/utils/loopbackUrl'
import { demoHubRootImportsPlugin } from './vite/demoHubRootImports'
import { demoLiveGuardPlugin } from './vite/demoLiveGuardPlugin'
import { createMonacoAwareLogger, monacoDevNoisePlugin } from './vite/monacoDevNoisePlugin'

const PROXY_RETRY_CODES = new Set([
  'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET',
  'UND_ERR_ABORTED', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
]);

function isProxyError(err: unknown): boolean {
  const codes = new Set<string>();
  const messages: string[] = [];
  let cur: unknown = err;
  const seen = new Set<unknown>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      const code = (cur as NodeJS.ErrnoException).code;
      if (code) codes.add(code);
      messages.push(cur.message);
      cur = cur.cause;
    } else break;
  }
  if ([...codes].some(c => PROXY_RETRY_CODES.has(c))) return true;
  return messages.some(m => /Proxy response \(\d+\) !== 200 when HTTP Tunneling/i.test(m));
}

function proxyRound2(n: number): number { return Math.round(n * 100) / 100; }

function proxyPlugin(): Plugin {
  let pooledDispatcher: import('undici').Dispatcher | undefined;
  let isProxyDispatcher = false;

  async function getDispatcher(): Promise<{ dispatcher: import('undici').Dispatcher | undefined; isProxy: boolean }> {
    if (pooledDispatcher) return { dispatcher: pooledDispatcher, isProxy: isProxyDispatcher };
    try {
      const undici = await import('undici');
      const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
        || process.env.HTTP_PROXY || process.env.http_proxy;
      if (proxy) {
        pooledDispatcher = undici.EnvHttpProxyAgent
          ? new undici.EnvHttpProxyAgent()
          : new undici.ProxyAgent(proxy);
        isProxyDispatcher = true;
      } else {
        pooledDispatcher = new undici.Agent({
          keepAliveTimeout: 30_000,
          keepAliveMaxTimeout: 60_000,
          connect: { timeout: 10_000 },
          connections: 512,
          pipelining: 10,
        });
        isProxyDispatcher = false;
      }
    } catch { /* undici not available — fall back to default dispatcher */ }
    return { dispatcher: pooledDispatcher, isProxy: isProxyDispatcher };
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

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');

        let payload: {
          url: string;
          method: string;
          headers: Record<string, string>;
          body?: string;
          /** When true, TLS certificate validation is skipped (self-signed / dev endpoints) */
          skipTlsVerify?: boolean;
          caCert?: string;
          clientCert?: string;
          clientKey?: string;
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        try {
          // HTTPS loopback: keep localhost for Docker TLS/mTLS lesson stacks; plain HTTP
          // still resolves to 127.0.0.1 for Node/undici corporate-proxy quirks.
          if (payload.url.startsWith('https://')) {
            payload.url = preferLocalhostHostname(payload.url);
          } else {
            payload.url = resolveLoopbackUrl(payload.url);
          }
          payload.headers['Connection'] = 'keep-alive';
          const fetchOpts: Record<string, unknown> = {
            method: payload.method,
            headers: payload.headers,
          };
          if (payload.body && payload.method !== 'GET') {
            fetchOpts.body = payload.body;
          }

          // TLS: create a one-off Agent when skip-cert, CA, or mTLS client creds are set.
          let isProxy = false;
          const loopback = isLoopbackUrl(payload.url);
          const hasCustomTls =
            (payload.skipTlsVerify && payload.url.startsWith('https://')) ||
            !!payload.caCert?.trim() ||
            !!payload.clientCert?.trim() ||
            !!payload.clientKey?.trim();
          if (hasCustomTls && payload.url.startsWith('https://')) {
            try {
              const { Agent } = await import('undici');
              const connect: Record<string, unknown> = {};
              if (payload.skipTlsVerify) {
                connect.rejectUnauthorized = false;
              } else if (loopback && !payload.caCert?.trim()) {
                connect.rejectUnauthorized = false;
              }
              if (payload.caCert?.trim()) connect.ca = payload.caCert;
              if (payload.clientCert?.trim()) connect.cert = payload.clientCert;
              if (payload.clientKey?.trim()) connect.key = payload.clientKey;
              fetchOpts.dispatcher = new Agent({ connect });
            } catch { /* undici unavailable — fall through to global default */ }
          } else if (!loopback) {
            const dispatched = await getDispatcher();
            if (dispatched.dispatcher) fetchOpts.dispatcher = dispatched.dispatcher;
            isProxy = dispatched.isProxy;
          }

          const MAX_PROXY_BODY = 2 * 1024 * 1024; // 2 MB cap to prevent pathological responses

          /** Perform the fetch and format the result. */
          const doFetch = async (opts: Record<string, unknown>) => {
            const t0 = performance.now();
            const response = await fetch(payload.url, opts as RequestInit);
            const tFirstByte = performance.now();
            const rawBody = await response.text();
            const responseBody = rawBody.length > MAX_PROXY_BODY ? rawBody.slice(0, MAX_PROXY_BODY) : rawBody;
            const tDone = performance.now();
            const resHeaders: Record<string, string> = {};
            response.headers.forEach((v, k) => { resHeaders[k] = v; });
            return {
              status: response.status,
              statusText: response.statusText,
              headers: resHeaders,
              body: responseBody,
              timing: {
                dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0,
                ttfb: proxyRound2(tFirstByte - t0),
                download: proxyRound2(tDone - tFirstByte),
                total: proxyRound2(tDone - t0),
              },
            };
          };

          let result;
          try {
            result = await doFetch(fetchOpts);
          } catch (proxyErr) {
            if (isProxy && isProxyError(proxyErr)) {
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

function docsPlugin(): Plugin {
  const docsRoot = resolve(__dirname, 'docs');

  function attachDocsMiddleware(server: ViteDevServer | PreviewServer) {
    server.middlewares.use('/docs', (req, res, next) => {
      const urlPath = (req.url ?? '/').split('?')[0];
      const filePath = join(docsRoot, decodeURIComponent(urlPath));
      if (!filePath.startsWith(docsRoot) || !existsSync(filePath)) {
        next();
        return;
      }
      const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
      const mimeTypes: Record<string, string> = {
        html: 'text/html', css: 'text/css', js: 'application/javascript',
        json: 'application/json', png: 'image/png', svg: 'image/svg+xml',
        jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] ?? 'application/octet-stream' });
      res.end(readFileSync(filePath));
    });
  }

  return {
    name: 'docs-static',
    configureServer(server) { attachDocsMiddleware(server); },
    configurePreviewServer(server) { attachDocsMiddleware(server); },
  };
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [demoHubRootImportsPlugin(), monacoDevNoisePlugin(), react(), proxyPlugin(), demoLiveGuardPlugin(), docsPlugin()],
  customLogger: createMonacoAwareLogger(),
  resolve: {
    alias: {
      '@redfireforge/demo-hub': resolve(__dirname, 'packages/demo-hub/src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@graphql': resolve(__dirname, 'src/features/graphql'),
      '@grpc': resolve(__dirname, 'src/features/grpc'),
      '@workflow': resolve(__dirname, 'src/features/workflow'),
    },
  },
  clearScreen: false,
  server: {
    strictPort: true,
    port: 5173,
    hmr: process.env.PHASE8_E2E_SWEEP !== '1',
    watch: {
      // Runtime writes (API correlation store, E2E artifacts) must not trigger full reloads.
      ignored: [
        '**/data/**',
        '**/*.db',
        '**/*.db-journal',
        '**/.cursor/**',
        '**/coverage/**',
        '**/e2e/screenshots/**',
        '**/playwright-report/**',
        '**/test-results/**',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 60000,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res) { (res as import('http').ServerResponse).writeHead(502); (res as import('http').ServerResponse).end(); }
          });
        },
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 5000,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res) { (res as import('http').ServerResponse).writeHead(502); (res as import('http').ServerResponse).end(); }
          });
        },
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
