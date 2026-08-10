/**
 * grpc-studio-client-stream.spec.ts — Client streaming UI E2E (Phase 2H / Sprint 4).
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
  waitForStreamCountAtLeast,
  ECHO_SERVICE_TESTID,
  CLIENT_STREAM_METHOD_TESTID,
  waitForGrpcRequestComposer,
} from './grpc-helpers';

test.describe('gRPC Studio — client streaming (Phase 2H)', () => {
  test.beforeEach(async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await reflectGrpcServices(page);
  });

  test('ClientStream aggregates messages on end', async ({ page }) => {
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: CLIENT_STREAM_METHOD_TESTID,
    });
    await setGrpcCallTimeout(page, 120_000);
    await waitForGrpcRequestComposer(page);
    await expect(page.locator('[data-testid="grpc-stream-start-btn"]')).toBeVisible();

    await startGrpcStream(page);
    await waitForStreamStatus(page, 'Streaming');

    await fillEchoMessage(page, 'alpha');
    await sendStreamMessage(page);
    await waitForStreamCountAtLeast(page, 'grpc-stream-outbound-count', 1);

    await waitForStreamStatus(page, 'Streaming');
    await fillEchoMessage(page, 'beta');
    await sendStreamMessage(page);
    await waitForStreamCountAtLeast(page, 'grpc-stream-outbound-count', 2);

    await endGrpcStream(page);
    await waitForStreamLogContains(page, 'alpha,beta');
    await waitForStreamEnded(page);
  });
});
