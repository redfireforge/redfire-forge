import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  ECHO_SERVICE_TESTID,
  SERVER_STREAM_METHOD_TESTID,
  gotoGrpcStudio,
  isBackendHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  selectGrpcMethod,
  sendUnaryCall,
  startGrpcStream,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForStreamStatus,
} from './grpc-helpers';

const GO_MOCK_TARGET = 'localhost:50061';
const GO_MOCK_HEALTH = 'http://localhost:50062/health';
const CREATE_COMPLEX_ECHO_METHOD_TESTID = 'grpc-method-echo-echoservice-createcomplexecho';

async function isGoMockServicerHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const resp = await request.get(GO_MOCK_HEALTH, { timeout: 3_000 });
    if (!resp.ok()) return false;
    const body = (await resp.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

test.describe('gRPC Studio — Go mock servicer (localhost:50061)', () => {
  test.beforeEach(async ({ page, request }) => {
    const [backendHealthy, goMockHealthy] = await Promise.all([
      isBackendHealthy(request),
      isGoMockServicerHealthy(request),
    ]);

    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');
    test.skip(!goMockHealthy, 'Go mock servicer not running on :50061/:50062 — run docker compose --profile mock-servicer up -d --build in docker/grpc');

    await gotoGrpcStudio(page);
    await page.locator('[data-testid="grpc-target-input"]').fill(GO_MOCK_TARGET);
    await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 5_000 });
    await reflectGrpcServices(page);
  });

  test('metadata_equals predicate routes Echo unary response', async ({ page }) => {
    await selectEchoMethod(page);

    await page.locator('[data-testid="grpc-request-tab-metadata"]').click();
    await page.locator('[data-testid="grpc-metadata-add-btn"]').click();
    await page.getByLabel('Metadata key 1').fill('x-tenant');
    await page.getByLabel('Metadata value 1').fill('acme');

    await sendUnaryCall(page);

    await expect(page.locator('[data-testid="grpc-response-status"]')).toContainText('OK', { timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('mock-tenant-acme');
  });

  test('body_path_equals predicate routes CreateComplexEcho unary response', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: CREATE_COMPLEX_ECHO_METHOD_TESTID,
    });

    await page.locator('[data-testid="grpc-request-tab-json"]').click();
    await page.locator('[data-testid="grpc-request-json"]').fill(JSON.stringify({
      message: 'ui-body-path-probe',
      attributes: {
        order_id: '123',
      },
      labels: ['mock'],
    }, null, 2));

    await sendUnaryCall(page);

    await expect(page.locator('[data-testid="grpc-response-status"]')).toContainText('OK', { timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('mock-order-123');
  });

  test('method_equals predicate returns canned server stream sequence', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: SERVER_STREAM_METHOD_TESTID,
    });

    await startGrpcStream(page);
    await waitForStreamStatus(page, /Streaming|Starting/);
    await waitForStreamLogContains(page, 'mock-stream-1');
    await waitForStreamLogContains(page, 'mock-stream-2');
    await waitForStreamEnded(page);
  });
});
