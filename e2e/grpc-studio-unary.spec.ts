/**
 * grpc-studio-unary.spec.ts — Live Docker-backed gRPC Studio unary E2E (Phase 1H).
 *
 * Prerequisites (live UI tests):
 *   npm run server              — Express :3001
 *   docker/grpc fixture         — ports 50051/50052 (or E2E_GRPC_SERVER=1 to auto-start)
 *
 * Run:
 *   npx playwright test e2e/grpc-studio-unary.spec.ts --reporter=list
 *   npm run test:e2e:grpc
 */
import { test, expect } from '@playwright/test';
import {
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  reflectGrpcServices,
  selectEchoMethod,
  setGrpcTarget,
  fillEchoMessage,
  sendUnaryCall,
  waitForGrpcRequestComposer,
  waitForUnarySuccess,
  waitForCallCancelled,
} from './grpc-helpers';

test.describe('gRPC Studio — live unary flow (Phase 1H)', () => {
  test.beforeEach(async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
  });

  test('reflect loads EchoService and unary call returns echoed body', async ({ page }) => {
    await reflectGrpcServices(page);
    await selectEchoMethod(page);
    await fillEchoMessage(page, 'e2e-unary-hello');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);

    await expect(page.locator('[data-testid="grpc-response-status"]')).toContainText('OK');
    await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('e2e-unary-hello');
  });

  test('cancel aborts a slow unary call', async ({ page }) => {
    await reflectGrpcServices(page);
    await selectEchoMethod(page);
    await fillEchoMessage(page, '@sleep:8000');
    await sendUnaryCall(page);

    await expect(page.locator('[data-testid="grpc-response-in-flight"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="grpc-cancel-btn"]')).toBeVisible();
    await page.locator('[data-testid="grpc-cancel-btn"]').click();

    await waitForCallCancelled(page);
    await expect(page.locator('[data-testid="grpc-response-status"]')).toHaveCount(0);
  });

  test('second tab stays idle when first tab executes unary', async ({ page }) => {
    await reflectGrpcServices(page);
    await selectEchoMethod(page);

    await page.locator('[data-testid="grpc-add-tab"]').click();
    const tabs = page.locator('[data-testid="grpc-tab-bar"] [role="tab"]');
    await expect(tabs).toHaveCount(2);

    await tabs.first().click();
    await waitForGrpcRequestComposer(page);
    await fillEchoMessage(page, 'tab-a-only');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);

    await tabs.nth(1).click();
    await expect(page.locator('[data-testid="grpc-response-idle"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-body"]')).toHaveCount(0);
  });
});
