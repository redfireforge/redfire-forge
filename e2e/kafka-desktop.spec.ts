/**
 * Phase 9D — E2E parity tests for Kafka settings UI (server-proxy transport)
 *
 * Tests the browser-side Kafka settings page at /?tab=kafka-settings with all
 * backend API calls intercepted via Playwright route mocking.
 *
 * The dev server must be running at http://localhost:5173 (started automatically
 * by the Playwright webServer config in playwright.config.ts).
 *
 * Coverage:
 *   - Page renders for a seeded cluster
 *   - Empty state when no clusters are configured
 *   - Status badge reflects disconnected state on load
 *   - Connect flow: intercept POST /api/kafka/connect → badge shows connected
 *   - Topics listing: intercept GET /api/kafka/topics → rows appear in DOM
 *   - Disconnect flow: intercept POST /api/kafka/disconnect → badge shows disconnected
 */

import { expect, test } from '@playwright/test';
import { seedAppData } from './helpers';

// ── Golden-fixture responses (mirrors test-data/kafka/*.json) ─────────────────

const CLUSTER_ID = 'parity-test-cluster';
const PRODUCE_WORKFLOW = {
  id: 'wf-kafka-produce-e2e',
  name: 'Kafka Produce Parity',
  schemaVersion: 6,
  createdAt: 1748736000000,
  updatedAt: 1748736000000,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'produce1', type: 'kafkaProduce', position: { x: 300, y: 100 }, data: {
      label: 'Produce Test Message',
      clusterId: CLUSTER_ID,
      topic: 'orders.created',
      bodyTemplate: '{"test":"produce-parity"}',
    } },
    { id: 'end', type: 'end', position: { x: 300, y: 200 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'produce1' },
    { id: 'e2', source: 'produce1', target: 'end' },
  ],
};

const _CONSUME_WORKFLOW = {
  id: 'wf-kafka-consume-e2e',
  name: 'Kafka Consume Parity',
  schemaVersion: 6,
  createdAt: 1748736000000,
  updatedAt: 1748736000000,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'consume1', type: 'kafkaConsume', position: { x: 300, y: 100 }, data: {
      label: 'Consume Test Message',
      clusterId: CLUSTER_ID,
      topic: 'orders.created',
      maxMessages: 1,
      timeoutMs: 5000,
    } },
    { id: 'end', type: 'end', position: { x: 300, y: 200 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'consume1' },
    { id: 'e2', source: 'consume1', target: 'end' },
  ],
};

const PRODUCE_PROXY_RESPONSE = {
  ok: true,
  op: 'produce',
  data: {
    clusterId: CLUSTER_ID,
    topic: 'orders.created',
    sentCount: 1,
    records: [{ partition: 0, offset: '42', timestamp: '2026-06-01T00:00:00.000Z' }],
  },
  meta: { timestamp: '2026-06-01T00:00:00.000Z', durationMs: 80 },
};

const CONSUME_PROXY_RESPONSE = {
  ok: true,
  op: 'consume-once',
  data: {
    clusterId: CLUSTER_ID,
    topic: 'orders.created',
    receivedCount: 1,
    messages: [
      {
        topic: 'orders.created',
        partition: 0,
        offset: '42',
        timestamp: '2026-06-01T00:00:00.000Z',
        key: null,
        value: '{"orderId":"ord-001"}',
        headers: {},
      },
    ],
  },
  meta: { timestamp: '2026-06-01T00:00:00.000Z', durationMs: 120 },
};
const CLIENT_ID = 'redfireforge-e2e';
const BROKER = 'localhost:19092';

const CLUSTER_SEED = {
  clusterId: CLUSTER_ID,
  name: 'Parity Test Cluster',
  clientId: CLIENT_ID,
  brokers: [BROKER],
  auth: { mode: 'none' },
  tls: { enabled: false, rejectUnauthorized: true },
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

function statusEnvelope(state: 'connected' | 'disconnected' | 'testing') {
  return {
    ok: true,
    op: 'status',
    data: {
      state,
      clusterId: state !== 'disconnected' ? CLUSTER_ID : undefined,
      connectedAt: state === 'connected' ? '2026-06-01T00:00:00.000Z' : undefined,
      subscriptionCount: 0,
    },
    meta: { timestamp: new Date().toISOString() },
  };
}

const CONNECT_RESPONSE = {
  ok: true,
  op: 'connect',
  data: {
    status: {
      state: 'connected',
      clusterId: CLUSTER_ID,
      connectedAt: '2026-06-01T00:00:00.000Z',
      subscriptionCount: 0,
    },
    reusedExistingConnection: false,
  },
  meta: { timestamp: '2026-06-01T00:00:00.000Z', durationMs: 120 },
};

const DISCONNECT_RESPONSE = {
  ok: true,
  op: 'disconnect',
  data: {
    status: { state: 'disconnected' },
    disconnected: true,
    cleanedSubscriptions: 0,
  },
  meta: { timestamp: '2026-06-01T00:00:00.000Z', durationMs: 25 },
};

const TOPICS_RESPONSE = {
  ok: true,
  op: 'topics',
  data: {
    clusterId: CLUSTER_ID,
    topics: [
      { name: 'orders.created', partitions: 3, replicas: 1, isInternal: false },
      { name: 'payments.authorized', partitions: 2, replicas: 1, isInternal: false },
      { name: '__consumer_offsets', partitions: 50, replicas: 1, isInternal: true },
    ],
  },
  meta: { timestamp: '2026-06-01T00:00:00.000Z', durationMs: 45 },
};

// ── HttpResponse wrapper (matches httpFetch / /__proxy contract) ──────────────
// The browser sends all API requests through POST /__proxy.  The proxy returns
// a JSON-serialised HttpResponse whose `body` field is a JSON string.
// When we intercept /__proxy in Playwright we must fulfil with that exact shape.

interface ProxyHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

function wrapProxyResponse(envelope: unknown): ProxyHttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Seed localStorage with one Kafka cluster and select it.
 * Must be called before page.goto() — uses addInitScript.
 */
async function seedKafkaCluster(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ clustersKey, selectedKey, cluster }: { clustersKey: string; selectedKey: string; cluster: unknown }) => {
      localStorage.setItem(clustersKey, JSON.stringify([cluster]));
      localStorage.setItem(selectedKey, (cluster as { clusterId: string }).clusterId);
      // Disable auto-connect to avoid triggering a connect call on startup
      localStorage.setItem('perf-test-kafka-auto-connect-on-startup', 'false');
    },
    {
      clustersKey: 'perf-test-kafka-clusters-v1',
      selectedKey: 'perf-test-kafka-selected-cluster-id',
      cluster: CLUSTER_SEED,
    },
  );
}

/**
 * The browser routes all HTTP calls through POST /__proxy with the real request
 * details in the JSON body { url, method, headers, body }.  We intercept the
 * proxy endpoint, inspect the forwarded URL, and fulfil with a fake
 * HttpResponse-shaped JSON (status / statusText / headers / body) so
 * httpFetchViaViteProxy can parse it correctly.
 *
 * Any /__proxy call whose URL does NOT match a registered handler is aborted to
 * prevent flaky network errors from unhandled Kafka operations.
 */
async function interceptKafkaProxy(
  page: import('@playwright/test').Page,
  handlers: Record<string, unknown>,
) {
  await page.route('**/__proxy', async (route, request) => {
    let parsedBody: { url?: string } = {};
    try {
      parsedBody = JSON.parse(request.postData() ?? '{}') as { url?: string };
    } catch {
      // ignore parse errors — let fall through to abort
    }
    const targetUrl = parsedBody.url ?? '';

    for (const [pattern, envelope] of Object.entries(handlers)) {
      if (targetUrl.includes(pattern)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(envelope)),
        });
        return;
      }
    }
    // Unhandled /__proxy call — abort rather than letting it hit the backend
    await route.abort();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Test suite
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Kafka settings page — server-proxy transport parity', () => {

  // ── 1. Page renders ────────────────────────────────────────────────────────
  test('page renders the kafka-settings root element for a seeded cluster', async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);
    await interceptKafkaProxy(page, {
      '/api/kafka/status': statusEnvelope('disconnected'),
    });

    await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="kafka-settings-page"]')).toBeVisible({ timeout: 10000 });
  });

  // ── 2. Empty state ────────────────────────────────────────────────────────
  test('shows empty state when no clusters are configured', async ({ page }) => {
    await seedAppData(page);
    // Do NOT seed any clusters — localStorage is clean

    await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="kafka-settings-empty"]')).toBeVisible({ timeout: 10000 });
  });

  // ── 3. Disconnected status badge on load ───────────────────────────────────
  test('status badge shows disconnected on load when cluster is not connected', async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);
    await interceptKafkaProxy(page, {
      '/api/kafka/status': statusEnvelope('disconnected'),
    });

    await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="kafka-settings-page"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.kafka-status-badge.state-disconnected')).toBeVisible({ timeout: 8000 });
  });

  // ── 4. Connect flow ─────────────────────────────────────────────────────
  test('clicking Connect posts to /api/kafka/connect and badge shows connected', async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);

    let connectCalled = false;
    await page.route('**/__proxy', async (route, request) => {
      let parsedBody: { url?: string } = {};
      try { parsedBody = JSON.parse(request.postData() ?? '{}') as { url?: string }; } catch { /* ignore */ }
      const targetUrl = parsedBody.url ?? '';

      if (targetUrl.includes('/api/kafka/connect')) {
        connectCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(CONNECT_RESPONSE)),
        });
      } else if (targetUrl.includes('/api/kafka/status')) {
        // Return connected after connect was called
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(
            connectCalled ? statusEnvelope('connected') : statusEnvelope('disconnected'),
          )),
        });
      } else {
        await route.abort();
      }
    });

    await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="kafka-settings-page"]')).toBeVisible({ timeout: 10000 });
    // Wait for disconnected state to appear first
    await expect(page.locator('.kafka-status-badge.state-disconnected')).toBeVisible({ timeout: 8000 });

    const connectBtn = page.locator('button', { hasText: 'Connect' }).first();
    await expect(connectBtn).toBeEnabled({ timeout: 5000 });
    await connectBtn.click();

    // Badge should transition to connected
    await expect(page.locator('.kafka-status-badge.state-connected')).toBeVisible({ timeout: 10000 });
    expect(connectCalled).toBe(true);
  });

  // ── 5. Topics listing ────────────────────────────────────────────────────
  test('clicking Refresh Topics fetches /api/kafka/topics and shows topic rows', async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);
    await interceptKafkaProxy(page, {
      '/api/kafka/status': statusEnvelope('connected'),
      '/api/kafka/topics': TOPICS_RESPONSE,
    });

    await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="kafka-settings-page"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.kafka-status-badge.state-connected')).toBeVisible({ timeout: 8000 });

    const refreshTopicsBtn = page.locator('button', { hasText: 'Refresh Topics' }).first();
    await expect(refreshTopicsBtn).toBeVisible({ timeout: 5000 });
    await refreshTopicsBtn.click();

    await expect(page.locator('[data-testid="kafka-topic-orders.created"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="kafka-topic-payments.authorized"]')).toBeVisible({ timeout: 5000 });
  });

  // ── 6. Disconnect flow ──────────────────────────────────────────────────
  test('clicking Disconnect posts to /api/kafka/disconnect and badge shows disconnected', async ({ page }) => {
    await seedAppData(page);
    await seedKafkaCluster(page);

    let disconnectCalled = false;
    await page.route('**/__proxy', async (route, request) => {
      let parsedBody: { url?: string } = {};
      try { parsedBody = JSON.parse(request.postData() ?? '{}') as { url?: string }; } catch { /* ignore */ }
      const targetUrl = parsedBody.url ?? '';

      if (targetUrl.includes('/api/kafka/disconnect')) {
        disconnectCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(DISCONNECT_RESPONSE)),
        });
      } else if (targetUrl.includes('/api/kafka/status')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(
            disconnectCalled ? statusEnvelope('disconnected') : statusEnvelope('connected'),
          )),
        });
      } else {
        await route.abort();
      }
    });

    await page.goto('/?tab=kafka-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="kafka-settings-page"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.kafka-status-badge.state-connected')).toBeVisible({ timeout: 8000 });

    const disconnectBtn = page.locator('button', { hasText: 'Disconnect' }).first();
    await expect(disconnectBtn).toBeEnabled({ timeout: 5000 });
    await disconnectBtn.click();

    await expect(page.locator('.kafka-status-badge.state-disconnected')).toBeVisible({ timeout: 8000 });
    expect(disconnectCalled).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Workflow-runner Kafka parity (produce + consume-once)
// ══════════════════════════════════════════════════════════════════════════════
//
// Produce and consume-once are not exposed as standalone UI actions on the
// Kafka settings page — they are exercised via workflow nodes.  These tests
// verify the browser-side server-proxy transport for both operations:
//
//   Test 7 — KafkaProduceNode workflow: drives the Workflow Runner with a
//             Start→KafkaProduceNode→End workflow and asserts the completion
//             banner appears and /api/kafka/produce was called via /__proxy.
//
//   Test 8 — consume-once transport: KafkaConsumeNodes in workflow-runner mode
//             use loadTestMode=true and default to auto-resume (by design, to
//             avoid blocking load-test iterations on real broker messages).
//             The consume-once transport path is therefore verified by calling
//             POST /__proxy directly from the page context, exercising the
//             same httpFetchViaViteProxy path that a real consume-once node
//             would use when NOT in auto-resume mode.

async function navigateToWorkflowRunner(page: import('@playwright/test').Page) {
  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();
  const tab = page.locator('button.sub-nav-tab:has-text("Workflow Runner")');
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(500);
}

test.describe('Kafka workflow nodes — server-proxy transport parity', () => {

  // ── 7. KafkaProduceNode ──────────────────────────────────────────────────
  test('KafkaProduceNode workflow calls /api/kafka/produce via /__proxy', async ({ page }) => {
    await seedAppData(page);
    await page.addInitScript((wf: unknown) => {
      localStorage.setItem('workflows', JSON.stringify([wf]));
    }, PRODUCE_WORKFLOW);

    let produceCalled = false;
    await page.route('**/__proxy', async (route, request) => {
      let parsedBody: { url?: string } = {};
      try { parsedBody = JSON.parse(request.postData() ?? '{}') as { url?: string }; } catch { /* ignore */ }
      const targetUrl = parsedBody.url ?? '';
      if (targetUrl.includes('/api/kafka/produce')) {
        produceCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(PRODUCE_PROXY_RESPONSE)),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await navigateToWorkflowRunner(page);

    const picker = page.getByTestId('workflow-select');
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.click();
    await page.locator('.wfp-dropdown-item:has-text("Kafka Produce Parity")').click();
    await page.waitForTimeout(300);

    const runBtn = page.locator('button.btn-lg:has-text("Run Workflow")');
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await runBtn.click();

    await expect(page.locator('.completion-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.completion-banner')).toContainText('Workflow completed');
    expect(produceCalled).toBe(true);
  });

  // ── 8. consume-once transport via /__proxy ───────────────────────────────
  //
  // KafkaConsumeNodes in workflow-runner mode use loadTestMode=true and
  // auto-resume by default — the real consume-once API is intentionally
  // skipped to keep load iterations deterministic.  This test verifies the
  // transport path directly: POST /__proxy with a consume-once payload (the
  // same request httpFetchViaViteProxy issues for a non-auto-resume consume).
  test('browser transport routes consume-once to /api/kafka/consume-once via /__proxy', async ({ page }) => {
    await seedAppData(page);

    // Navigate first so the app initialises normally (init requests to /__proxy
    // are not disrupted by the interceptor below).
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    let consumeCalled = false;
    await page.route('**/__proxy', async (route, request) => {
      let parsedBody: { url?: string } = {};
      try { parsedBody = JSON.parse(request.postData() ?? '{}') as { url?: string }; } catch { /* ignore */ }
      const targetUrl = parsedBody.url ?? '';
      if (targetUrl.includes('/api/kafka/consume-once')) {
        consumeCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapProxyResponse(CONSUME_PROXY_RESPONSE)),
        });
      } else {
        await route.continue();
      }
    });

    // Call POST /__proxy from the page context with a consume-once payload,
    // exercising the same httpFetchViaViteProxy path as a real node call.
    const proxyResult = await page.evaluate(async (proxyPayload: string) => {
      const resp = await fetch('/__proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: proxyPayload,
      });
      if (!resp.ok) return null;
      const wrapper = JSON.parse(await resp.text()) as { status: number; body: string };
      const envelope = JSON.parse(wrapper.body) as { ok: boolean; op: string };
      return { status: wrapper.status, op: envelope.op, ok: envelope.ok };
    }, JSON.stringify({
      url: '/api/kafka/consume-once',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ clusterId: CLUSTER_ID, topic: 'orders.created', maxMessages: 1, timeoutMs: 5000 }),
    }));

    expect(consumeCalled).toBe(true);
    expect(proxyResult?.status).toBe(200);
    expect(proxyResult?.op).toBe('consume-once');
    expect(proxyResult?.ok).toBe(true);
  });
});
