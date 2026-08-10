/**
 * gRPC Studio E2E helpers (Phase 1H).
 */
import { createConnection } from 'node:net';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { slugifyGrpcExplorerId } from '../src/features/grpc/utils/grpcExplorerUtils';
import { FIXTURE_ECHO_DESCRIPTOR_PAYLOAD } from '../src/shared/grpc/contractFixtures';
import type { GrpcMockRuleSet } from '../src/shared/grpc/grpcMockRuleContracts';
import { REDFIREFORGE_IDB_VERSION, seedAppData } from './helpers';

export const GRPC_HEALTH = 'http://localhost:50052/health';
export const GRPC_TARGET = 'localhost:50051';
export const BACKEND_HEALTH = 'http://localhost:3001/health';
/** Envoy gRPC-Web sidecar (Phase 12D) — has no HTTP health endpoint, only a raw listener. */
export const GRPC_ENVOY_TARGET = 'localhost:50055';

export const GRPC_STUDIO_URL = '/?tab=grpc-studio';

/** Shared copy for explorer, unary, and connection-probe recovery assertions. */
export const GRPC_RECOVERY_ERROR_PATTERN =
  /refused|unreachable|failed|proxy|express|unavailable|could not reach|no connection|503|service unavailable|backend server/i;

/** echo.EchoService / Echo — slug matches slugifyGrpcExplorerId. */
export const ECHO_SERVICE = 'echo.EchoService';
export const ECHO_METHOD = 'Echo';
export const ECHO_SERVICE_TESTID = 'grpc-service-echo-echoservice';
export const ECHO_METHOD_TESTID = 'grpc-method-echo-echoservice-echo';

export const SERVER_STREAM_METHOD_TESTID = 'grpc-method-echo-echoservice-serverstream';
export const CLIENT_STREAM_METHOD_TESTID = 'grpc-method-echo-echoservice-clientstream';
export const BIDI_STREAM_METHOD_TESTID = 'grpc-method-echo-echoservice-bidistream';

/** Matches `nodeId()` in grpcSchemaBrowserModel — slugified parts joined with `--`. */
export function schemaBrowserNodeTestId(...parts: string[]): string {
  return `grpc-schema-tree-node-${parts.map((part) => slugifyGrpcExplorerId(part)).join('--')}`;
}

export const ECHO_SCHEMA_BROWSER_METHOD_TESTID = schemaBrowserNodeTestId(
  'method',
  'echo.EchoService',
  'Echo',
);

export async function isGrpcTestServerHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const resp = await request.get(GRPC_HEALTH, { timeout: 3_000 });
    if (!resp.ok()) return false;
    const body = (await resp.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

export async function isBackendHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const resp = await request.get(BACKEND_HEALTH, { timeout: 3_000 });
    return resp.ok();
  } catch {
    return false;
  }
}

export async function startGrpcMockListener(
  request: APIRequestContext,
  options: {
    tabId: string;
    connectionId?: string;
    responseMessage?: string;
    ruleSet?: GrpcMockRuleSet;
    /** Omit to let the server auto-allocate a free port (avoids EADDRINUSE in parallel E2E). */
    port?: number;
  },
): Promise<{ listenTarget: string }> {
  const payload: Record<string, unknown> = {
      tabId: options.tabId,
      connectionId: options.connectionId ?? `conn-${options.tabId}`,
      descriptorKey: FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.descriptorKey,
      protosetBase64: FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64,
      contentSha256: FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.contentSha256,
      ruleSet: options.ruleSet ?? {
        rules: [{
          id: 'echo-e2e',
          name: 'Echo e2e rule',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { message: options.responseMessage ?? 'mock-e2e-response' } },
        }],
      },
  };
  if (options.port != null) {
    payload.port = options.port;
  }

  const response = await request.post('http://localhost:3001/api/grpc/mock/start', {
    data: payload,
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    data?: { status?: { listenTarget?: string } };
  };
  const listenTarget = body.data?.status?.listenTarget;
  expect(listenTarget).toBeTruthy();
  await waitForGrpcListenTargetOpen(listenTarget!);
  return { listenTarget: listenTarget! };
}

async function waitForGrpcListenTargetOpen(listenTarget: string, timeoutMs = 15_000): Promise<void> {
  const match = /^([^:]+):(\d+)$/.exec(listenTarget.trim());
  if (!match) {
    throw new Error(`Invalid listen target: ${listenTarget}`);
  }
  const host = match[1];
  const port = Number(match[2]);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const opened = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port, timeout: 1_000 });
      const done = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });
    if (opened) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`gRPC mock listener did not open on ${listenTarget} within ${timeoutMs}ms`);
}

export async function waitForGrpcMockListenerStopped(
  request: APIRequestContext,
  tabId: string,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const pollMs = options?.pollMs ?? 100;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let response;
    try {
      response = await request.get(
        `http://localhost:3001/api/grpc/mock/status?tabId=${encodeURIComponent(tabId)}`,
      );
    } catch (error) {
      const msg = String(error);
      // During test shutdown/reload the request context can be disposed.
      // Treat that as effectively stopped for best-effort cleanup paths.
      if (/disposed|closed/i.test(msg)) {
        return;
      }
      throw error;
    }
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      data?: { status?: { running?: boolean } };
    };
    if (body.data?.status?.running !== true) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`gRPC mock listener for tab ${tabId} is still running after ${timeoutMs}ms`);
}

/** Wait for a listener target to stop accepting TCP connections after shutdown. */
export async function waitForGrpcListenTargetClosed(
  listenTarget: string,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const pollMs = options?.pollMs ?? 100;
  const match = /^([^:]+):(\d+)$/.exec(listenTarget.trim());
  if (!match) {
    throw new Error(`Invalid listen target: ${listenTarget}`);
  }

  const host = match[1]!;
  const port = Number(match[2]);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const opened = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port, timeout: 1_000 });
      const done = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });

    if (!opened) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`gRPC listen target ${listenTarget} still accepts connections after ${timeoutMs}ms`);
}

export async function stopGrpcMockListener(request: APIRequestContext, tabId: string): Promise<void> {
  try {
    const response = await request.post('http://localhost:3001/api/grpc/mock/stop', {
      data: { tabId },
    });
    expect(response.ok()).toBeTruthy();
    await waitForGrpcMockListenerStopped(request, tabId);
  } catch (error) {
    const msg = String(error);
    if (/disposed|closed/i.test(msg)) {
      return;
    }
    throw error;
  }
}

export async function getGrpcStudioActiveTabId(page: Page): Promise<string> {
  const tab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
  const tabId = await tab.getAttribute('data-testid');
  if (!tabId) {
    throw new Error('Expected active gRPC studio tab id');
  }
  return tabId;
}

export async function isGrpcLiveInfraReady(request: APIRequestContext): Promise<boolean> {
  const [grpc, backend] = await Promise.all([
    isGrpcTestServerHealthy(request),
    isBackendHealthy(request),
  ]);
  return grpc && backend;
}

/** Raw TCP connect check — Envoy's grpc-web listener has no HTTP health endpoint. */
export async function isGrpcEnvoySidecarUp(host = 'localhost', port = 50055): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 3_000 });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** GRPC-19 Transport Modes lesson needs the Go echo server, Express proxy, AND the Envoy sidecar. */
export async function isGrpcTransportModesInfraReady(request: APIRequestContext): Promise<boolean> {
  const [base, envoy] = await Promise.all([
    isGrpcLiveInfraReady(request),
    isGrpcEnvoySidecarUp(),
  ]);
  return base && envoy;
}

/** Silence log-stream proxy noise when backend is down. */
export async function silenceLogStream(page: Page): Promise<void> {
  await page.route('**/api/logs/stream*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    }),
  );
}

export async function gotoGrpcStudio(page: Page, options?: { seed?: boolean }): Promise<void> {
  if (options?.seed !== false) {
    await seedAppData(page);
  }
  await silenceLogStream(page);
  await page.goto(GRPC_STUDIO_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
}

export async function setGrpcTarget(page: Page, target = GRPC_TARGET): Promise<void> {
  const input = page.locator('[data-testid="grpc-target-input"]');
  await input.fill(target);
  await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 5_000 });
}

/** Raise stream deadline for client/bidi E2E (default 30s is too tight with Playwright pacing). */
export async function setGrpcCallTimeout(page: Page, timeoutMs: number): Promise<void> {
  const input = page.locator('[data-testid="grpc-call-timeout-input"]');
  await input.fill(String(timeoutMs));
  await expect(input).toHaveValue(String(timeoutMs));
}

export const GRPC_REQUEST_COMPOSER_SELECTOR =
  '[data-testid="grpc-proto-form"], [data-testid="grpc-request-json"]';

export const GRPC_CLIENT_STREAM_PANEL_SELECTOR =
  '[data-testid="grpc-stream-pending-panel"], [data-testid="grpc-stream-panel"]';

export async function waitForGrpcRequestComposer(page: Page): Promise<void> {
  await expect(page.locator(GRPC_REQUEST_COMPOSER_SELECTOR)).toBeVisible({ timeout: 10_000 });
}

export async function waitForClientStreamPanel(page: Page): Promise<void> {
  await expect(page.locator(GRPC_CLIENT_STREAM_PANEL_SELECTOR)).toBeVisible({ timeout: 10_000 });
}

async function isHybridJsonComposerVisible(page: Page): Promise<boolean> {
  return page.locator('[data-testid="grpc-request-json"]').isVisible();
}

async function fillHybridJsonBody(page: Page, patch: Record<string, unknown>): Promise<void> {
  const jsonArea = page.locator('[data-testid="grpc-request-json"]');
  await expect(jsonArea).toBeVisible({ timeout: 10_000 });
  const current = await jsonArea.inputValue();
  let body: Record<string, unknown> = {};
  if (current.trim()) {
    try {
      const parsed = JSON.parse(current) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }
  }
  const nextBody = { ...body, ...patch };
  const nextText = JSON.stringify(nextBody, null, 2);

  const openFullFormBtn = page.locator('[data-testid="grpc-open-full-form-editor-btn-inline"]');
  if (await openFullFormBtn.isVisible().catch(() => false)) {
    await openFullFormBtn.click({ force: true });
    await expect(page.locator('[data-testid="grpc-hybrid-tab-option-c"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="grpc-hybrid-tab-option-c"]').click();
    await page.locator('[data-testid="grpc-hybrid-json-editor"]').fill(nextText);
    await page.locator('[data-testid="grpc-hybrid-apply-btn"]').click();
    await expect(page.locator('[data-testid="grpc-hybrid-tab-option-c"]')).toHaveCount(0, { timeout: 10_000 });
    await expect(jsonArea).toHaveValue(nextText);
    return;
  }

  await jsonArea.evaluate((el, text) => {
    const textarea = el as HTMLTextAreaElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    valueSetter?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }, nextText);
  await expect(jsonArea).toHaveValue(nextText);
}

export async function fillProtoField(page: Page, fieldName: string, value: string): Promise<void> {
  const protoInput = page.locator(`[data-testid="grpc-proto-field-input-${fieldName}"]`);
  if (await protoInput.isVisible()) {
    await protoInput.fill(value);
    await expect(protoInput).toHaveValue(value);
    return;
  }

  if (fieldName === 'message') {
    await fillHybridJsonBody(page, { message: value });
    return;
  }

  const numeric = Number(value);
  await fillHybridJsonBody(page, {
    [fieldName]: Number.isFinite(numeric) && value.trim() !== '' ? numeric : value,
  });
}

export async function reflectGrpcServices(page: Page): Promise<void> {
  const reflectBtn = page.locator('[data-testid="grpc-reflect-btn"]');
  const tree = page.locator('[data-testid="grpc-explorer-tree"]');
  const error = page.locator('[data-testid="grpc-explorer-error"]');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await reflectBtn.click();
    try {
      await expect(tree).toBeVisible({ timeout: 15_000 });
      break;
    } catch (firstError) {
      if (attempt === 1) {
        throw firstError;
      }
      // Transient boot/reflect races can briefly show error or empty state; retry once.
      if (await error.isVisible().catch(() => false)) {
        await page.waitForTimeout(250);
      }
    }
  }

  const serviceBtn = page.locator(`[data-testid="${ECHO_SERVICE_TESTID}"]`);
  await expect(serviceBtn).toBeVisible({ timeout: 10_000 });
  if (!(await page.locator(`[data-testid="${SERVER_STREAM_METHOD_TESTID}"]`).isVisible())) {
    await serviceBtn.click();
  }

  await expect(page.locator(`[data-testid="${ECHO_METHOD_TESTID}"]`)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`[data-testid="${SERVER_STREAM_METHOD_TESTID}"]`)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`[data-testid="${CLIENT_STREAM_METHOD_TESTID}"]`)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`[data-testid="${BIDI_STREAM_METHOD_TESTID}"]`)).toBeVisible({ timeout: 10_000 });
}

export async function selectEchoMethod(page: Page): Promise<void> {
  await selectGrpcMethod(page, {
    serviceTestId: ECHO_SERVICE_TESTID,
    methodTestId: ECHO_METHOD_TESTID,
  });
}

export async function selectGrpcMethod(
  page: Page,
  options: { serviceTestId: string; methodTestId: string },
): Promise<void> {
  const methodBtn = page.locator(`[data-testid="${options.methodTestId}"]`);
  if (!(await methodBtn.isVisible())) {
    await page.locator(`[data-testid="${options.serviceTestId}"]`).click();
  }
  await expect(methodBtn).toBeVisible({ timeout: 10_000 });
  await methodBtn.click();
  await waitForGrpcRequestComposer(page);
}

export async function fillStreamRequest(
  page: Page,
  fields: { message?: string; repeat_count?: number; interval_ms?: number },
): Promise<void> {
  const hasStreamNumericFields = fields.repeat_count !== undefined || fields.interval_ms !== undefined;
  if (!hasStreamNumericFields) {
    if (fields.message !== undefined) {
      await fillProtoField(page, 'message', fields.message);
    }
    return;
  }

  const body: Record<string, unknown> = {};
  if (fields.message !== undefined) body.message = fields.message;
  if (fields.repeat_count !== undefined) body.repeat_count = fields.repeat_count;
  if (fields.interval_ms !== undefined) body.interval_ms = fields.interval_ms;

  await page.locator('[data-testid="grpc-request-tab-form"]').click();
  if (await isHybridJsonComposerVisible(page)) {
    await fillHybridJsonBody(page, body);
    return;
  }

  if (fields.message !== undefined) {
    await expect(page.locator('[data-testid="grpc-proto-field-input-message"]')).toHaveValue(fields.message);
  }
  if (fields.repeat_count !== undefined) {
    await fillProtoField(page, 'repeat_count', String(fields.repeat_count));
    await expect(page.locator('[data-testid="grpc-proto-field-input-repeat_count"]')).toHaveValue(String(fields.repeat_count));
  }
  if (fields.interval_ms !== undefined) {
    await fillProtoField(page, 'interval_ms', String(fields.interval_ms));
    await expect(page.locator('[data-testid="grpc-proto-field-input-interval_ms"]')).toHaveValue(String(fields.interval_ms));
  }
}

export async function startGrpcStream(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="grpc-stream-start-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.click();
}

export async function restartGrpcStreamAfterTargetChange(page: Page): Promise<void> {
  const startBtn = page.locator('[data-testid="grpc-stream-start-btn"]');
  if (await startBtn.isVisible().catch(() => false)) {
    await startGrpcStream(page);
    return;
  }
  const cancelBtn = page.locator('[data-testid="grpc-stream-cancel-btn"]');
  if (await cancelBtn.isEnabled().catch(() => false)) {
    await cancelGrpcStream(page);
  }
  await expect(startBtn).toBeVisible({ timeout: 10_000 });
  await startGrpcStream(page);
}

export async function waitForStreamStatus(page: Page, label: string | RegExp): Promise<void> {
  await expect(page.locator('[data-testid="grpc-stream-status-badge"]')).toContainText(label, { timeout: 30_000 });
}

/** After a mock listener stops, streams may need end/write to surface dial failures on client/bidi RPCs. */
export async function waitForStreamErrorOnStoppedListener(
  page: Page,
  options?: { triggerEnd?: boolean },
): Promise<void> {
  await startGrpcStream(page);
  if (options?.triggerEnd !== false) {
    const endBtn = page.locator('[data-testid="grpc-stream-end-btn"]');
    if (await endBtn.isEnabled().catch(() => false)) {
      await endGrpcStream(page);
    }
  }

  const errorBlock = page.locator('[data-testid="grpc-stream-error-block"]');
  const badge = page.locator('[data-testid="grpc-stream-status-badge"]');
  await expect(async () => {
    if (await errorBlock.isVisible()) {
      return;
    }
    const badgeText = (await badge.textContent()) ?? '';
    if (/Error/i.test(badgeText)) {
      return;
    }
    throw new Error(`Expected stream failure UI, badge="${badgeText}"`);
  }).toPass({ timeout: 30_000 });
}

export async function waitForStreamEnded(page: Page): Promise<void> {
  await waitForStreamStatus(page, /Ended|Cancelled/);
}

export async function waitForStreamLogContains(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator('[data-testid="grpc-stream-log-list"]')).toContainText(text, { timeout: 30_000 });
}

async function readStreamCount(page: Page, testId: 'grpc-stream-outbound-count' | 'grpc-stream-inbound-count'): Promise<number> {
  const text = ((await page.locator(`[data-testid="${testId}"]`).textContent().catch(() => '')) ?? '').trim();
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function readPendingQueueCount(page: Page): Promise<number> {
  const items = page.locator('[data-testid^="grpc-stream-pending-item-"]');
  return items.count().catch(() => 0);
}

export async function enqueueStreamMessage(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="grpc-stream-add-queue-btn"]');
  const before = await readPendingQueueCount(page);
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.evaluate((node) => (node as HTMLButtonElement).click());
  await expect
    .poll(async () => readPendingQueueCount(page), { timeout: 10_000 })
    .toBeGreaterThan(before);
}

export async function sendAllPendingStreamMessages(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="grpc-stream-send-all-btn"]');
  const outboundBefore = await readStreamCount(page, 'grpc-stream-outbound-count');
  const pendingBefore = await readPendingQueueCount(page);
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.evaluate((node) => (node as HTMLButtonElement).click());

  if (pendingBefore > 0) {
    const expectedOutboundMin = outboundBefore + pendingBefore;
    await expect
      .poll(async () => readStreamCount(page, 'grpc-stream-outbound-count'), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(expectedOutboundMin);
  }
}

export async function waitForStreamStreaming(page: Page): Promise<void> {
  const badge = page.locator('[data-testid="grpc-stream-status-badge"]');
  const startBtn = page.locator('[data-testid="grpc-stream-start-btn"]');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await expect(badge).toContainText('Streaming', { timeout: 15_000 });
      return;
    } catch (error) {
      const errMsg = String(error);
      if (/closed|disposed|has been closed/i.test(errMsg)) {
        throw error;
      }

      let badgeText = '';
      try {
        badgeText = ((await badge.textContent()) ?? '').trim();
      } catch (readError) {
        const readMsg = String(readError);
        if (/closed|disposed|has been closed/i.test(readMsg)) {
          throw readError;
        }
      }

      // Some live-backed runs briefly transition to Cancelled before listeners settle.
      // Restart once to stabilize the stream before failing the test.
      if (/cancelled/i.test(badgeText) && await startBtn.isVisible().catch(() => false)) {
        await startBtn.click();
      }
    }
  }

  await expect(badge).toContainText('Streaming', { timeout: 15_000 });
}

export async function sendStreamMessage(page: Page): Promise<void> {
  await waitForStreamStreaming(page);
  const outboundBefore = await readStreamCount(page, 'grpc-stream-outbound-count');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sendNow = page.locator('[data-testid="grpc-stream-send-now-btn"]');
    if (await sendNow.count()) {
      if (await sendNow.isEnabled().catch(() => false)) {
        await sendNow.evaluate((node) => (node as HTMLButtonElement).click());
      }
    }

    const sendMessage = page.locator('[data-testid="grpc-stream-send-message-btn"]');
    if (await sendMessage.count()) {
      if (await sendMessage.isEnabled().catch(() => false)) {
        await sendMessage.evaluate((node) => (node as HTMLButtonElement).click());
      }
    }

    const addQueue = page.locator('[data-testid="grpc-stream-add-queue-btn"]');
    if (await addQueue.count()) {
      if (await addQueue.isEnabled().catch(() => false)) {
        await enqueueStreamMessage(page);
        const sendAll = page.locator('[data-testid="grpc-stream-send-all-btn"]');
        if (await sendAll.count() && await sendAll.isEnabled().catch(() => false)) {
          await sendAllPendingStreamMessages(page);
        }
      }
    }

    const outboundAfter = await readStreamCount(page, 'grpc-stream-outbound-count');
    if (outboundAfter > outboundBefore) {
      return;
    }

    await waitForStreamStreaming(page);
    await page.waitForTimeout(200);
  }

  throw new Error('Failed to send stream message: outbound count did not increase after retries');
}

export async function endGrpcStream(page: Page): Promise<void> {
  const pendingEnd = page.locator('[data-testid="grpc-stream-pending-end-btn"]');
  if (await pendingEnd.count()) {
    if (await pendingEnd.isEnabled().catch(() => false)) {
      await pendingEnd.evaluate((node) => (node as HTMLButtonElement).click());
      return;
    }
    const sendAll = page.locator('[data-testid="grpc-stream-send-all-btn"]');
    if (await sendAll.count() && await sendAll.isEnabled().catch(() => false)) {
      await sendAll.evaluate((node) => (node as HTMLButtonElement).click());
      await expect(pendingEnd).toBeEnabled({ timeout: 10_000 });
      await pendingEnd.evaluate((node) => (node as HTMLButtonElement).click());
      return;
    }
  }
  const btn = page.locator('[data-testid="grpc-stream-end-btn"]');
  if (await btn.count()) {
    await expect(btn).toBeEnabled({ timeout: 10_000 });
    await btn.evaluate((node) => (node as HTMLButtonElement).click());
    return;
  }

  const badge = page.locator('[data-testid="grpc-stream-status-badge"]');
  const badgeText = ((await badge.textContent().catch(() => '')) ?? '').trim();
  if (/Ended|Cancelled|Error/i.test(badgeText)) {
    return;
  }
  throw new Error(`Expected end-stream control or ended status, got badge="${badgeText}"`);
}

export async function cancelGrpcStream(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="grpc-stream-cancel-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.click();
}

export async function fillEchoMessage(page: Page, message: string): Promise<void> {
  await fillProtoField(page, 'message', message);
}

export async function sendUnaryCall(page: Page): Promise<void> {
  const sendBtn = page.locator('[data-testid="grpc-send-btn"]');
  await expect(sendBtn).toBeEnabled({ timeout: 10_000 });
  await sendBtn.evaluate((node) => (node as HTMLButtonElement).click());
}

export async function waitForUnarySuccess(page: Page): Promise<void> {
  const status = page.locator('[data-testid="grpc-response-status"]');
  const body = page.locator('[data-testid="grpc-response-body"]');
  const error = page.locator('[data-testid="grpc-response-error-panel"]');

  await expect
    .poll(async () => {
      if (await error.count().catch(() => 0)) {
        if (await error.first().isVisible().catch(() => false)) {
          return 'error';
        }
      }
      if (await status.count().catch(() => 0)) {
        if (await status.first().isVisible().catch(() => false)) {
          return 'status';
        }
      }
      if (await body.count().catch(() => 0)) {
        if (await body.first().isVisible().catch(() => false)) {
          return 'body';
        }
      }
      return 'pending';
    }, { timeout: 30_000 })
    .not.toBe('pending');

  await expect(error).toHaveCount(0);
  if (await status.count().catch(() => 0)) {
    await expect(status.first()).toContainText('OK');
  }
  await expect(body.first()).toBeVisible({ timeout: 10_000 });
}

export async function waitForCallCancelled(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="grpc-response-cancelled"]')).toBeVisible({ timeout: 15_000 });
}

/** Open Manage Schemas modal from explorer header gear button. */
export async function openManageSchemasModal(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-manage-schemas-btn"]').click();
  await expect(page.locator('[data-testid="grpc-proto-manage-modal"]')).toBeVisible({ timeout: 10_000 });
}

/** Switch to Schema Browser tab inside Manage Schemas (requires loaded descriptor). */
export async function openSchemaBrowserTab(page: Page): Promise<void> {
  const tab = page.locator('[data-testid="grpc-proto-tab-schema-browser"]');
  await expect(tab).toBeEnabled({ timeout: 10_000 });
  await tab.click();
  await expect(page.locator('[data-testid="grpc-schema-browser"]')).toBeVisible({ timeout: 10_000 });
}

/** Reflect via UI (no mock). */
export async function clickReflect(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-reflect-btn"]').click();
  await expect(page.locator('[data-testid="grpc-explorer-tree"]')).toBeVisible({ timeout: 30_000 });
}

/** Poll DELETE until the in-flight call is registered and cancelled (API E2E). */
export async function cancelInFlightGrpcCallViaApi(
  request: APIRequestContext,
  requestId: string,
  tabId: string,
  options?: { pollMs?: number; timeoutMs?: number },
): Promise<void> {
  const pollMs = options?.pollMs ?? 100;
  const deadline = Date.now() + (options?.timeoutMs ?? 10_000);

  while (Date.now() < deadline) {
    const cancelResp = await request.delete(`/api/grpc/call/${requestId}?tabId=${tabId}`);
    const cancelBody = await cancelResp.json();

    if (cancelResp.ok() && cancelBody.ok && cancelBody.data.cancelled) {
      return;
    }

    if (!cancelResp.ok() && cancelBody.error?.code === 'GRPC_REQUEST_NOT_FOUND') {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out cancelling in-flight call ${requestId}`);
}

/** Phase 5I — collections/history sub-nav helpers. */
export async function gotoGrpcCollectionsView(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-sub-nav-collections"]').click();
  await expect(page.locator('[data-testid="grpc-collections-panel"]')).toBeVisible({ timeout: 10_000 });
}

export async function gotoGrpcHistoryView(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-sub-nav-history"]').click();
  await expect(page.locator('[data-testid="grpc-history-panel"]')).toBeVisible({ timeout: 10_000 });
}

export async function openSaveRequestModal(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-save-request-btn"]').click();
  await expect(page.locator('[data-testid="grpc-save-request-modal"]')).toBeVisible({ timeout: 5_000 });
}

export async function openImportGrpcurlModal(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-import-grpcurl-btn"]').click();
  await expect(page.locator('[data-testid="grpc-import-grpcurl-modal"]')).toBeVisible({ timeout: 5_000 });
}

export async function saveCurrentRequestToCollection(page: Page, name: string): Promise<void> {
  await openSaveRequestModal(page);
  await page.locator('[data-testid="grpc-save-request-name"]').fill(name);
  await page.locator('[data-testid="grpc-save-request-submit"]').click();
  await expect(page.locator('[data-testid="grpc-save-request-modal"]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('[data-testid="grpc-collections-panel"]')).toBeVisible({ timeout: 10_000 });
}

/** Phase 5I — seed a unary saved request into IndexedDB for shell E2E (no Docker). */
export async function seedGrpcUnarySavedRequestShell(
  page: Page,
  options?: { collectionId?: string; savedId?: string; savedName?: string },
): Promise<{ collectionId: string; savedId: string }> {
  const collectionId = options?.collectionId ?? 'e2e-col-snapshot-shell';
  const savedId = options?.savedId ?? 'e2e-sr-snapshot-shell';
  const savedName = options?.savedName ?? 'E2E Shell Snapshot';

  await page.evaluate(async ({ collectionId: colId, savedId: srId, savedName: srName, dbVersion }) => {
    const TS = new Date().toISOString();
    const colRow = {
      id: colId,
      name: 'E2E Shell Collections',
      createdAt: TS,
      updatedAt: TS,
    };
    const savedRequest = {
      id: srId,
      name: srName,
      revisionId: 'rev-shell-1',
      createdAt: TS,
      updatedAt: TS,
      callType: 'unary',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: 'desc-shell',
      body: { message: 'shell-seed' },
      metadata: {},
      timeoutMs: 30_000,
    };
    const itemRow = {
      id: srId,
      collectionId: colId,
      sortOrder: 0,
      savedRequest,
    };

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('redfireforge', dbVersion);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('grpc-collections')
          || !db.objectStoreNames.contains('grpc-collection-items')) {
          db.close();
          reject(new Error('gRPC collections IDB stores missing'));
          return;
        }
        const tx = db.transaction(['grpc-collections', 'grpc-collection-items'], 'readwrite');
        tx.objectStore('grpc-collections').put(colRow);
        tx.objectStore('grpc-collection-items').put(itemRow);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('Failed to seed gRPC collections'));
      };
    });
  }, { collectionId, savedId, savedName, dbVersion: REDFIREFORGE_IDB_VERSION });

  return { collectionId, savedId };
}
