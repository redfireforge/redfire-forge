/**
 * Shared helpers for GraphQL Studio live E2E specs (port 4010 test server).
 *
 * Requires Vite dev server (5173). Docker GraphQL server on 4010 when
 * E2E_GRAPHQL_SERVER=1 or E2E_WITH_DOCKER=1 (see e2e/global-setup.ts).
 */

import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const GQL_STUDIO_URL = '/?tab=graphql-studio';
export const GQL_HTTP = 'http://localhost:4010/graphql';
export const GQL_HEALTH = 'http://localhost:4010/health';

export async function isGraphqlServerHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(GQL_HEALTH, { timeout: 5_000 });
    if (!res.ok()) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

export async function silenceLogStream(page: Page) {
  await page.route('**/api/logs/stream*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    }),
  );
}

/**
 * Build a raw /__proxy envelope from upstream HTTP status and body.
 *
 * The /__proxy bridge always returns HTTP 200 to the browser; the real
 * upstream HTTP status and body are encoded as JSON inside the response body.
 * This is the exact format that `httpFetchViaViteProxy` (src) expects.
 */
export function makeProxyEnvelope(
  upstreamStatus: number,
  upstreamBody: string,
  upstreamHeaders: Record<string, string> = { 'content-type': 'application/json' },
): string {
  return JSON.stringify({
    status: upstreamStatus,
    statusText: upstreamStatus === 200 ? 'OK' : String(upstreamStatus),
    headers: upstreamHeaders,
    body: upstreamBody,
    timing: { dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, ttfb: 1, download: 1, total: 2 },
  });
}

/**
 * Wrap a GraphQL JSON response object in the /__proxy envelope.
 *
 * Usage:
 *   await mockProxy(page, { data: { user: { id: '1' } } });
 *   await mockProxy(page, { error: 'Unauthorized' }, 401);
 */
export function makeProxyResponse(gqlBody: object, httpStatus = 200): string {
  return makeProxyEnvelope(httpStatus, JSON.stringify(gqlBody));
}

/**
 * Mock the /__proxy endpoint so all outbound GQL requests return the given body.
 *
 * In web mode, ALL outbound HTTP goes through POST /__proxy. This intercepts
 * browser→proxy requests and returns a response in HttpResponse format.
 * The `httpStatus` param is the upstream server's HTTP status (200, 401, etc.).
 */
export async function mockProxy(page: Page, gqlBody: object, httpStatus = 200): Promise<void> {
  await page.route('**/__proxy', (route) =>
    route.fulfill({
      status: 200, // /__proxy bridge always returns 200; upstream status is in body.status
      contentType: 'application/json',
      body: makeProxyResponse(gqlBody, httpStatus),
    }),
  );
}

/**
 * Navigate to GraphQL Studio (offline/mocked mode — no live server needed).
 * Silences the log stream to prevent ECONNREFUSED errors in CI.
 */
export async function gotoGqlStudioOffline(page: Page): Promise<void> {
  await silenceLogStream(page);
  await page.goto(GQL_STUDIO_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="gql-studio-page"]')).toBeVisible({ timeout: 15_000 });
}

interface ProxyPayload {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function isLiveGraphqlUrl(url: string): boolean {
  return url.includes('localhost:4010') || url.includes('127.0.0.1:4010');
}

/** Passthrough WebSocket for the live GraphQL test server (subscriptions). */
export async function setupLiveWebSocket(page: Page) {
  await page.routeWebSocket('ws://localhost:4010/graphql', (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => ws.send(message));
  });
}

/**
 * Intercept /__proxy: forward localhost:4010 via Playwright request (never route.fetch).
 */
export async function setupLiveProxy(page: Page, request: APIRequestContext) {
  await page.route('**/__proxy', async (route) => {
    const bodyStr = route.request().postData() ?? '';
    let payload: ProxyPayload | null = null;
    try {
      payload = JSON.parse(bodyStr) as ProxyPayload;
    } catch {
      payload = null;
    }

    const targetUrl = payload?.url ?? '';
    const shouldForward =
      isLiveGraphqlUrl(targetUrl) ||
      bodyStr.includes('localhost:4010') ||
      bodyStr.includes('127.0.0.1:4010');

    if (!shouldForward) {
      return route.abort('failed');
    }

    try {
      const url = targetUrl || GQL_HTTP;
      const method = (payload?.method ?? 'POST').toUpperCase();
      const headers = { ...(payload?.headers ?? {}) };
      if (method === 'GET') {
        const res = await request.get(url, { headers });
        const text = await res.text();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyEnvelope(res.status(), text),
        });
      }
      const res = await request.post(url, {
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
  });
}

export async function seedGqlStudioSettings(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((extra) => {
    localStorage.setItem(
      'gql_adv_settings_v1',
      JSON.stringify({
        apqEnabled: false,
        apqUseGet: false,
        batchEnabled: false,
        batchTimeoutMs: 30000,
        dedupEnabled: false,
        complexityBlockEnabled: false,
        complexityBlockThreshold: 1000,
        subscriptionTransport: 'graphql-transport-ws',
        sseMode: 'distinct',
        wsEndpointOverride: '',
        historyMaxItems: 100,
        subscriptionBufferSize: 5000,
        maxFileSizeMb: 50,
        ...extra,
      }),
    );
  }, overrides);
}

export async function gotoGqlStudio(page: Page, request?: APIRequestContext) {
  await seedGqlStudioSettings(page);
  await silenceLogStream(page);
  if (request) {
    await setupLiveProxy(page, request);
    await setupLiveWebSocket(page);
  }
  await page.goto(GQL_STUDIO_URL);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('[data-testid="gql-studio-page"]')).toBeVisible({ timeout: 15_000 });
}

export async function fillEndpoint(page: Page, url: string) {
  const input = page.locator('[data-testid="gql-endpoint-input"]');
  await input.fill(url);
  await page.waitForTimeout(300);
}

export async function fillMonacoEditor(page: Page, query: string, editorTestId = 'gql-editor') {
  await page.waitForSelector(`[data-testid="${editorTestId}"] .monaco-editor`, { timeout: 8_000 });
  const editor = page.locator(`[data-testid="${editorTestId}"] .monaco-editor`).first();
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(query, { delay: 15 });
  const needle = query.slice(0, Math.min(24, query.length));
  await page.waitForFunction(
    (args: { snippet: string; testId: string }) => {
      const w = window as unknown as Record<string, unknown>;
      const monaco = w['monaco'] as {
        editor?: { getModels?: () => { uri: { toString: () => string }; getValue: () => string }[] };
      };
      const models = monaco?.editor?.getModels?.() ?? [];
      const model = models.find((mod) => mod.uri.toString().includes('inmemory://graphql/'));
      return (model?.getValue() ?? '').includes(args.snippet);
    },
    { snippet: needle, testId: editorTestId },
    { timeout: 5_000 },
  );
  await page.waitForTimeout(300);
}

export async function introspectSchema(page: Page) {
  await page.locator('[data-testid="gql-introspect-btn"]').click();
  await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 25_000 });
}

export async function gotoSchemaTab(page: Page) {
  await page.locator('[data-testid="gql-right-tab-schema"]').click();
  await expect(page.locator('[data-testid="gql-schema-explorer"]')).toBeVisible({ timeout: 5_000 });
}

export async function executeQuery(page: Page, query: string) {
  await fillMonacoEditor(page, query);
  await page.locator('[data-testid="gql-execute-btn"]:not([disabled])').waitFor({ timeout: 5_000 }).catch(() => {});
  await page.locator('[data-testid="gql-execute-btn"]').click();
  await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 15_000 });
}

export async function openBuilderMode(page: Page) {
  await page.locator('[data-testid="gql-mode-builder"]').click();
  await expect(page.locator('[data-testid="gql-qb-field-tree"]')).toBeVisible({ timeout: 8_000 });
}

/** Create an order via the live test server and return its id. */
export async function createTestOrder(request: APIRequestContext): Promise<string> {
  const resp = await request.post(GQL_HTTP, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      query: 'mutation($input: OrderInput!) { createOrder(input: $input) { id status } }',
      variables: { input: { customerId: 'cust-e2e', items: ['widget'] } },
    },
  });
  expect(resp.ok()).toBeTruthy();
  const body = (await resp.json()) as { data?: { createOrder?: { id: string } }; errors?: unknown[] };
  expect(body.errors).toBeUndefined();
  const id = body.data?.createOrder?.id;
  expect(id).toBeTruthy();
  return id!;
}

export function subscriptionQuery(orderId: string): string {
  return `subscription { orderStatus(orderId: "${orderId}") { status updatedAt } }`;
}
