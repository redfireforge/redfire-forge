import type { APIRequestContext, Page } from '@playwright/test';
import { GQL_HTTP, makeProxyEnvelope } from '../graphql-helpers';
import { GQL13_MOCK_HTTP, GQL13_PROXY_HEALTH } from './constants';

export function isGql13LiveGraphqlUrl(url: string): boolean {
  return url.includes('localhost:4010') || url.includes('127.0.0.1:4010');
}

export function isGql13MockProxyUrl(url: string): boolean {
  return (
    url.includes('/api/graphql/mock') ||
    url.includes('localhost:3001') ||
    url.includes('127.0.0.1:3001')
  );
}

/** Forward Docker (4010) and mock proxy (3001) through /__proxy — required for GQL-13 E2E. */
export async function setupGql13LiveAndMockProxy(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await page.route('**/__proxy', async (route) => {
    const bodyStr = route.request().postData() ?? '';
    let payload: { url?: string; method?: string; headers?: Record<string, string>; body?: string } | null =
      null;
    try {
      payload = JSON.parse(bodyStr) as typeof payload;
    } catch {
      payload = null;
    }
    const targetUrl = payload?.url ?? '';

    if (isGql13MockProxyUrl(targetUrl) || bodyStr.includes('/api/graphql/mock')) {
      try {
        const gqlBody = payload?.body ? JSON.parse(payload.body) : {};
        const res = await request.post(GQL13_MOCK_HTTP, {
          headers: { 'Content-Type': 'application/json', ...(payload?.headers ?? {}) },
          data: gqlBody,
        });
        const text = await res.text();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyEnvelope(res.status(), text),
        });
      } catch {
        return route.abort('failed');
      }
    }

    if (
      isGql13LiveGraphqlUrl(targetUrl) ||
      bodyStr.includes('localhost:4010') ||
      bodyStr.includes('127.0.0.1:4010')
    ) {
      try {
        const url = targetUrl || GQL_HTTP;
        const method = (payload?.method ?? 'POST').toUpperCase();
        const headers = { ...(payload?.headers ?? {}) };
        const res =
          method === 'GET'
            ? await request.get(url, { headers })
            : await request.post(url, {
                headers: { 'Content-Type': 'application/json', ...headers },
                data: payload?.body ? JSON.parse(payload.body) : {},
              });
        const text = await res.text();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyEnvelope(res.status(), text),
        });
      } catch {
        return route.abort('failed');
      }
    }

    try {
      const response = await route.fetch();
      await route.fulfill({ response });
    } catch {
      await route.abort('failed');
    }
  });
}

/** Playwright E2E: inject desktop mock shim before any navigation (unlocks Start + mock helpers). */
export async function installGql13E2eDesktopShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
  });
}

/** Playwright E2E: set web-mock flag after app bootstrap (never __TAURI_INTERNALS__ — hangs on Loading). */
export async function activateGql13E2eWebMock(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 180_000 });
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
  });
}

export async function isGqlMockProxyHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(GQL13_PROXY_HEALTH, { timeout: 5_000 });
    return res.ok();
  } catch {
    return false;
  }
}
