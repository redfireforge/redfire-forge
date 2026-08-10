/**
 * grpc-studio-bidi-stream.spec.ts — Bidirectional streaming UI E2E (Phase 2H / Sprint 4).
 */
import { test, expect } from '@playwright/test';
import {
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  reflectGrpcServices,
  setGrpcTarget,
  selectGrpcMethod,
  fillEchoMessage,
  setGrpcCallTimeout,
  startGrpcStream,
  sendStreamMessage,
  endGrpcStream,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForStreamStatus,
  ECHO_SERVICE_TESTID,
  BIDI_STREAM_METHOD_TESTID,
} from './grpc-helpers';

test.describe('gRPC Studio — bidirectional streaming (Phase 2H)', () => {
  test.beforeEach(async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await reflectGrpcServices(page);
  });

  test('BidiStream echoes inbound messages', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: BIDI_STREAM_METHOD_TESTID,
    });
    await setGrpcCallTimeout(page, 120_000);
    await expect(page.locator('[data-testid="grpc-stream-direction-legend"]')).toBeVisible();

    await startGrpcStream(page);
    await waitForStreamStatus(page, 'Streaming');

    await fillEchoMessage(page, 'bidi-ping');
    await sendStreamMessage(page);
    await waitForStreamLogContains(page, 'bidi-ping');
    await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓');

    await endGrpcStream(page);
    await waitForStreamEnded(page);
    await expect(page.locator('[data-testid="grpc-stream-outbound-count"]')).toContainText('↑');
  });
});
