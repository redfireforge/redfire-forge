/**
 * grpc-studio-server-stream.spec.ts — Server streaming UI E2E (Phase 2H / Sprint 4).
 *
 * Prerequisites: npm run server + docker/grpc (:50051) or E2E_GRPC_SERVER=1
 */
import { test, expect } from '@playwright/test';
import {
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  reflectGrpcServices,
  setGrpcTarget,
  selectGrpcMethod,
  fillStreamRequest,
  startGrpcStream,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForStreamStatus,
  cancelGrpcStream,
  ECHO_SERVICE_TESTID,
  SERVER_STREAM_METHOD_TESTID,
} from './grpc-helpers';

test.describe('gRPC Studio — server streaming (Phase 2H)', () => {
  test.beforeEach(async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await reflectGrpcServices(page);
  });

  test('ServerStream emits inbound messages and ends', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: SERVER_STREAM_METHOD_TESTID,
    });
    await expect(page.locator('[data-testid="grpc-stream-panel"]')).toBeVisible();

    await fillStreamRequest(page, {
      message: 'e2e-ss',
      repeat_count: 3,
      interval_ms: 0,
    });
    await startGrpcStream(page);

    await waitForStreamStatus(page, /Streaming|Starting/);
    await waitForStreamLogContains(page, 'e2e-ss [1/3]');
    await waitForStreamLogContains(page, 'e2e-ss [3/3]');
    await waitForStreamEnded(page);

    await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓ 3');
  });

  test('cancel aborts an active server stream', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: SERVER_STREAM_METHOD_TESTID,
    });
    await fillStreamRequest(page, {
      message: 'slow-stream',
      repeat_count: 20,
      interval_ms: 500,
    });
    await startGrpcStream(page);
    await waitForStreamStatus(page, /Streaming|Starting/);

    await cancelGrpcStream(page);
    await waitForStreamStatus(page, 'Cancelled');
  });

  test('second tab log stays empty while first tab streams', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: SERVER_STREAM_METHOD_TESTID,
    });
    await fillStreamRequest(page, { message: 'tab-a-stream', repeat_count: 2, interval_ms: 0 });

    await page.locator('[data-testid^="grpc-tab-duplicate-"]').first().click();
    const tabs = page.locator('[data-testid="grpc-tab-bar"] [role="tab"]');
    await expect(tabs).toHaveCount(2);

    await tabs.first().click();
    await expect(page.locator('[data-testid^="grpc-tab-call-type-pill-"]').first()).toHaveText('SS');
    await startGrpcStream(page);
    await waitForStreamLogContains(page, 'tab-a-stream');

    await tabs.nth(1).click();
    await expect(page.locator('[data-testid="grpc-stream-log-empty"]')).toBeVisible();
  });
});
