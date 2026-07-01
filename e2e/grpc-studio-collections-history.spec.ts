/**
 * grpc-studio-collections-history.spec.ts — Phase 5I collections/history E2E.
 *
 * Shell tests: no Docker. Live tests skip when :50051 or :3001 is down.
 */
import { test, expect } from '@playwright/test';
import {
  ECHO_METHOD,
  ECHO_SERVICE,
  fillEchoMessage,
  gotoGrpcCollectionsView,
  gotoGrpcHistoryView,
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  openImportGrpcurlModal,
  reflectGrpcServices,
  saveCurrentRequestToCollection,
  seedGrpcUnarySavedRequestShell,
  selectEchoMethod,
  sendUnaryCall,
  setGrpcTarget,
  waitForUnarySuccess,
} from './grpc-helpers';

test.describe('gRPC Studio — collections/history shell (Phase 5I)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
  });

  test('sub-nav switches between studio, collections, and history', async ({ page }) => {
    await gotoGrpcCollectionsView(page);
    await expect(page.locator('[data-testid="grpc-collections-tree"]')).toBeVisible();

    await gotoGrpcHistoryView(page);
    await expect(page.locator('[data-testid="grpc-history-list"]')).toBeVisible();

    await page.locator('[data-testid="grpc-sub-nav-studio"]').click();
    await expect(page.locator('[data-testid="grpc-tab-bar"]')).toBeVisible();
  });

  test('connection bar save/import visible on collections view', async ({ page }) => {
    await gotoGrpcCollectionsView(page);
    await expect(page.locator('[data-testid="grpc-save-request-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-import-grpcurl-btn"]')).toBeVisible();
  });

  test('save request button disabled until method is selected', async ({ page }) => {
    await expect(page.locator('[data-testid="grpc-save-request-btn"]')).toBeDisabled();
  });

  test('import grpcurl modal parses a command preview', async ({ page }) => {
    await openImportGrpcurlModal(page);
    await page.locator('[data-testid="grpc-import-grpcurl-textarea"]').fill(
      'grpcurl -plaintext -d \'{"message":"hi"}\' localhost:50051 echo.EchoService/Echo',
    );
    await expect(page.locator('[data-testid="grpc-import-grpcurl-preview"]')).toContainText('echo.EchoService');
    await page.locator('[data-testid="grpc-import-grpcurl-cancel"]').click();
  });

  test('history panel shows empty hint before any calls', async ({ page }) => {
    await gotoGrpcHistoryView(page);
    await expect(page.locator('[data-testid="grpc-history-list"]')).toContainText(/No call history yet/i);
  });

  test('seeded unary saved request shows response snapshot panel in collections detail', async ({ page }) => {
    const { collectionId, savedId } = await seedGrpcUnarySavedRequestShell(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });

    await gotoGrpcCollectionsView(page);
    await page.locator(`[data-testid="grpc-collection-group-${collectionId}"]`).click();
    await page.locator(`[data-testid="grpc-collection-saved-${savedId}"]`).click();

    await expect(page.locator('[data-testid="grpc-response-snapshot-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-snapshot-badge-none"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-snapshot-update-baseline"]')).toBeDisabled();
  });
});

test.describe('gRPC Studio — collections/history live (Phase 5I)', () => {
  test.beforeEach(async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await reflectGrpcServices(page);
    await selectEchoMethod(page);
  });

  test('save request after unary appears in collections tree', async ({ page }) => {
    await fillEchoMessage(page, 'phase5i-save');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);

    await saveCurrentRequestToCollection(page, 'Phase 5I Echo Save');
    await expect(page.locator('[data-testid="grpc-collections-tree"]')).toContainText('Phase 5I Echo Save');
    await expect(page.locator('[data-testid="grpc-saved-request-detail"]')).toContainText('Phase 5I Echo Save');
  });

  test('unary call appends a history row and replay opens studio', async ({ page }) => {
    await fillEchoMessage(page, 'phase5i-history');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);

    await gotoGrpcHistoryView(page);
    await expect(page.locator('[data-testid="grpc-history-list"] .grpc-history-item').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="grpc-history-list"] .grpc-history-item').first().click();
    await expect(page.locator('[data-testid="grpc-history-detail"]')).toContainText(ECHO_SERVICE);
    await page.locator('[data-testid="grpc-history-replay-btn"]').click();
    await expect(page.locator('[data-testid="grpc-tab-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-call-method-name"]')).toContainText(ECHO_METHOD);
  });

  test('response snapshot baseline can be saved for unary saved request', async ({ page }) => {
    await fillEchoMessage(page, 'phase5i-baseline');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);
    await saveCurrentRequestToCollection(page, 'Phase 5I Baseline');

    await page.locator('[data-testid="grpc-snapshot-update-baseline"]').click();
    await expect(page.locator('[data-testid="grpc-snapshot-badge-match"]')).toBeVisible({ timeout: 10_000 });
  });

  test('clearing snapshot baseline shows no-baseline badge', async ({ page }) => {
    await fillEchoMessage(page, 'phase5i-clear-baseline');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);
    await saveCurrentRequestToCollection(page, 'Phase 5I Clear Baseline');

    await page.locator('[data-testid="grpc-snapshot-update-baseline"]').click();
    await expect(page.locator('[data-testid="grpc-snapshot-badge-match"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="grpc-snapshot-clear-baseline"]').click();
    await expect(page.locator('[data-testid="grpc-snapshot-badge-none"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="grpc-snapshot-badge-match"]')).toHaveCount(0);
  });
});
