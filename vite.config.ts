import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function proxyPlugin(): Plugin {
  return {
    name: 'api-proxy',
    configureServer(server) {
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
          const fetchOpts: Record<string, unknown> = {
            method: payload.method,
            headers: payload.headers,
          };
          if (payload.body && payload.method !== 'GET') {
            fetchOpts.body = payload.body;
          }

          const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
            || process.env.HTTP_PROXY || process.env.http_proxy;
          if (proxy) {
            try {
              const undici = await import('undici');
              if (undici.EnvHttpProxyAgent) {
                fetchOpts.dispatcher = new undici.EnvHttpProxyAgent();
              } else if (undici.ProxyAgent) {
                fetchOpts.dispatcher = new undici.ProxyAgent(proxy);
              }
            } catch { /* undici not available */ }
          }

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
