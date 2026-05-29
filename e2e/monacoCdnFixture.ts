/**
 * Playwright fixture that intercepts Monaco Editor CDN requests and serves
 * the files from local node_modules instead. This eliminates CDN latency and
 * prevents Monaco loading timeouts during full-suite parallel runs.
 *
 * Usage: import { test, expect } from './monacoCdnFixture' in Monaco spec files.
 */
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONACO_MIN_VS = path.resolve(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');

function contentType(filePath: string): string {
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.ttf')) return 'font/ttf';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export const test = base.extend<{ page: typeof base.prototype['page'] }>({
  page: async ({ page }, use) => {
    // Intercept all Monaco CDN requests from cdn.jsdelivr.net
    await page.route(
      (url) => url.href.includes('cdn.jsdelivr.net') && url.href.includes('monaco-editor'),
      async (route) => {
        const url = route.request().url();
        // Extract the path after /min/vs/
        const match = url.match(/\/min\/vs\/(.+)$/);
        if (!match) {
          await route.continue();
          return;
        }
        const localPath = path.join(MONACO_MIN_VS, match[1]);
        if (fs.existsSync(localPath)) {
          await route.fulfill({
            path: localPath,
            contentType: contentType(localPath),
          });
        } else {
          // Fall back to CDN if local file not found
          await route.continue();
        }
      },
    );
    await use(page); // eslint-disable-line react-hooks/rules-of-hooks
  },
});

export { expect };
