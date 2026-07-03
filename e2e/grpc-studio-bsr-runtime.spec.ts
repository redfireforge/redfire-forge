/**
 * grpc-studio-bsr-runtime.spec.ts
 *
 * Validates that a BSR-loaded descriptor can be executed against the local
 * Docker gRPC fixture (ElizaService implemented in docker/grpc/go-server).
 */
import { test, expect } from '@playwright/test';
import {
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  openManageSchemasModal,
  sendUnaryCall,
  setGrpcTarget,
  waitForUnarySuccess,
} from './grpc-helpers';

const ELIZA_SERVICE_TESTID = 'grpc-service-connectrpc-eliza-v1-elizaservice';
const ELIZA_SAY_METHOD_TESTID = 'grpc-method-connectrpc-eliza-v1-elizaservice-say';
const BSR_MODULE = 'buf.build/connectrpc/eliza';
const BSR_VERSION = 'main';

test.describe.configure({ retries: 0 });

test.describe('gRPC Studio — BSR runtime parity', () => {
  test('loads BSR descriptor and executes ElizaService/Say successfully', async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');

    await gotoGrpcStudio(page);
    await setGrpcTarget(page);

    await openManageSchemasModal(page);
    await page.locator('[data-testid="grpc-proto-tab-bsr"]').click();
    await expect(page.locator('[data-testid="grpc-proto-bsr-module-input"]')).toBeVisible();

    await page.locator('[data-testid="grpc-proto-bsr-module-input"]').fill(BSR_MODULE);
    await page.locator('[data-testid="grpc-proto-bsr-version-input"]').fill(BSR_VERSION);

    await page.locator('[data-testid="grpc-proto-load-btn"]').evaluate((node) => {
      (node as HTMLButtonElement).click();
    });

    // Allow either successful load or explicit load-error visibility.
    const loadError = page.locator('[data-testid="grpc-proto-load-error"]');
    await expect.poll(async () => {
      if (await loadError.isVisible().catch(() => false)) return 'error';
      const source = await page.locator('[data-testid="grpc-explorer-source"]').textContent().catch(() => '');
      return source?.includes('BSR') ? 'loaded' : 'pending';
    }, { timeout: 30_000 }).toBe('loaded');

    await expect(loadError).toHaveCount(0);
    await page.locator('[data-testid="grpc-proto-cancel-btn"]').evaluate((node) => {
      (node as HTMLButtonElement).click();
    });

    const elizaService = page.locator(`[data-testid="${ELIZA_SERVICE_TESTID}"]`);
    if (!(await page.locator(`[data-testid="${ELIZA_SAY_METHOD_TESTID}"]`).isVisible())) {
      await elizaService.click();
    }

    await page.locator(`[data-testid="${ELIZA_SAY_METHOD_TESTID}"]`).click();
    await expect(page.locator('[data-testid="grpc-proto-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="grpc-proto-field-input-sentence"]').fill('bsr-e2e-hello');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);
    await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('bsr-e2e-hello');
  });
});
