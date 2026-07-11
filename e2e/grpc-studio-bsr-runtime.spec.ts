/**
 * grpc-studio-bsr-runtime.spec.ts
 *
 * Validates that a BSR-loaded descriptor can be executed against the local
 * Docker gRPC fixture (ElizaService implemented in docker/grpc/go-server).
 */
import { test, expect } from '@playwright/test';
import { setupBsrDescribeFallbackIfNeeded } from './grpc-bsr-fixtures';
import {
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  openManageSchemasModal,
  fillProtoField,
  sendUnaryCall,
  setGrpcTarget,
  waitForGrpcRequestComposer,
  waitForUnarySuccess,
} from './grpc-helpers';

const ELIZA_SERVICE_TESTID = 'grpc-service-connectrpc-eliza-v1-elizaservice';
const ELIZA_SAY_METHOD_TESTID = 'grpc-method-connectrpc-eliza-v1-elizaservice-say';
const BSR_MODULE = 'buf.build/connectrpc/eliza';
const BSR_VERSION = 'main';

test.describe.configure({ retries: 0 });

test.describe('gRPC Studio — BSR runtime parity', () => {
  test('loads BSR descriptor and executes ElizaService/Say successfully', async ({ page, request }) => {
    test.setTimeout(120_000);
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');

    await setupBsrDescribeFallbackIfNeeded(page, request, {
      bsrModule: BSR_MODULE,
      bsrVersion: BSR_VERSION,
    });

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

    await expect(page.locator(`[data-testid="${ELIZA_SERVICE_TESTID}"]`)).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.locator('[data-testid="grpc-explorer-source"]')).toContainText('BSR');
    await page.locator('[data-testid="grpc-proto-cancel-btn"]').evaluate((node) => {
      (node as HTMLButtonElement).click();
    });

    const elizaService = page.locator(`[data-testid="${ELIZA_SERVICE_TESTID}"]`);
    if (!(await page.locator(`[data-testid="${ELIZA_SAY_METHOD_TESTID}"]`).isVisible())) {
      await elizaService.click();
    }

    await page.locator(`[data-testid="${ELIZA_SAY_METHOD_TESTID}"]`).click();
    await waitForGrpcRequestComposer(page);

    await fillProtoField(page, 'sentence', 'bsr-e2e-hello');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);
    await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('bsr-e2e-hello');
  });
});
