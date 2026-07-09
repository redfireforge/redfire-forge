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
  },
): Promise<{ listenTarget: string }> {
  const response = await request.post('http://localhost:3001/api/grpc/mock/start', {
    data: {
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
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    data?: { status?: { listenTarget?: string } };
  };
  const listenTarget = body.data?.status?.listenTarget;
  expect(listenTarget).toBeTruthy();
  return { listenTarget: listenTarget! };
}

export async function stopGrpcMockListener(request: APIRequestContext, tabId: string): Promise<void> {
  await request.post('http://localhost:3001/api/grpc/mock/stop', {
    data: { tabId },
  });
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

export async function fillProtoField(page: Page, fieldName: string, value: string): Promise<void> {
  const input = page.locator(`[data-testid="grpc-proto-field-input-${fieldName}"]`);
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

export async function reflectGrpcServices(page: Page): Promise<void> {
  await page.locator('[data-testid="grpc-reflect-btn"]').click();
  await expect(page.locator('[data-testid="grpc-explorer-tree"]')).toBeVisible({ timeout: 30_000 });

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
  await expect(page.locator('[data-testid="grpc-proto-form"]')).toBeVisible({ timeout: 10_000 });
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
  if (fields.message !== undefined) {
    await expect(page.locator('[data-testid="grpc-proto-field-input-message"]')).toHaveValue(fields.message);
  }
  if (fields.repeat_count !== undefined) {
    await fillProtoField(page, 'repeat_count', String(fields.repeat_count));
  }
  if (fields.repeat_count !== undefined) {
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

export async function waitForStreamStatus(page: Page, label: string | RegExp): Promise<void> {
  await expect(page.locator('[data-testid="grpc-stream-status-badge"]')).toContainText(label, { timeout: 30_000 });
}

export async function waitForStreamEnded(page: Page): Promise<void> {
  await waitForStreamStatus(page, /Ended|Cancelled/);
}

export async function waitForStreamLogContains(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator('[data-testid="grpc-stream-log-list"]')).toContainText(text, { timeout: 30_000 });
}

export async function enqueueStreamMessage(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="grpc-stream-compose-panel"] [data-testid="grpc-stream-add-queue-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.evaluate((node) => (node as HTMLButtonElement).click());
}

export async function sendAllPendingStreamMessages(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="grpc-stream-send-all-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.evaluate((node) => (node as HTMLButtonElement).click());
}

export async function waitForStreamStreaming(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="grpc-stream-status-badge"]')).toContainText('Streaming', { timeout: 30_000 });
}

export async function sendStreamMessage(page: Page): Promise<void> {
  await waitForStreamStreaming(page);
  const sendNow = page.locator('[data-testid="grpc-stream-compose-panel"] [data-testid="grpc-stream-send-now-btn"]');
  if (await sendNow.count()) {
    await expect(sendNow).toBeEnabled({ timeout: 10_000 });
    await sendNow.evaluate((node) => (node as HTMLButtonElement).click());
    return;
  }
  const addQueue = page.locator('[data-testid="grpc-stream-compose-panel"] [data-testid="grpc-stream-add-queue-btn"]');
  if (await addQueue.count()) {
    await enqueueStreamMessage(page);
    return;
  }
  const btn = page.locator('[data-testid="grpc-stream-compose-panel"] [data-testid="grpc-stream-send-message-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.evaluate((node) => (node as HTMLButtonElement).click());
}

export async function endGrpcStream(page: Page): Promise<void> {
  const pendingEnd = page.locator('[data-testid="grpc-stream-pending-end-btn"]');
  if (await pendingEnd.count()) {
    await expect(pendingEnd).toBeEnabled({ timeout: 10_000 });
    await pendingEnd.evaluate((node) => (node as HTMLButtonElement).click());
    return;
  }
  const btn = page.locator('[data-testid="grpc-stream-compose-panel"] [data-testid="grpc-stream-end-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.evaluate((node) => (node as HTMLButtonElement).click());
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
  await sendBtn.click();
}

export async function waitForUnarySuccess(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="grpc-response-status"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="grpc-response-body"]')).toBeVisible({ timeout: 5_000 });
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
