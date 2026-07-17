import { test, expect } from '@playwright/test';
import {
  fillEchoMessage,
  gotoGrpcStudio,
  isBackendHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  sendUnaryCall,
  startGrpcMockListener,
  stopGrpcMockListener,
  waitForUnarySuccess,
} from './grpc-helpers';

test.describe('gRPC Studio — mock unary flow (no Docker)', () => {
  test('reflects and sends unary against backend mock listener', async ({ page, request }, testInfo) => {
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');

    const tabId = `grpc-mock-e2e-${testInfo.workerIndex}-${Date.now()}`;
    const responseMessage = 'mock-e2e-unary-response';
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      responseMessage,
    });

    try {
      await gotoGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 5_000 });

      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await fillEchoMessage(page, 'ignored-by-mock');
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);

      await expect(page.locator('[data-testid="grpc-response-status"]')).toContainText('OK');
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText(responseMessage);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });
});