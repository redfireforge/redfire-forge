/**
 * grpc-studio-manage-schemas.spec.ts — Manage Schemas modal + schema browser E2E (Phase 3I).
 *
 * Shell tests: no Docker. Live tests skip when :50051 or :3001 is down.
 */
import { test, expect } from '@playwright/test';
import {
  ECHO_SCHEMA_BROWSER_METHOD_TESTID,
  gotoGrpcStudio,
  isGrpcLiveInfraReady,
  openManageSchemasModal,
  openSchemaBrowserTab,
  reflectGrpcServices,
  selectEchoMethod,
  setGrpcTarget,
  waitForGrpcRequestComposer,
} from './grpc-helpers';

test.describe('gRPC Studio — Manage Schemas modal (Phase 3I shell)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
  });

  test('opens modal with proto ingest tabs', async ({ page }) => {
    await openManageSchemasModal(page);
    await expect(page.locator('[data-testid="grpc-proto-tab-proto-files"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-proto-tab-protoset"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-proto-tab-url"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-proto-tab-bsr"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-proto-tab-schema-browser"]')).toBeVisible();
  });

  test('schema browser tab is disabled before descriptor load', async ({ page }) => {
    await openManageSchemasModal(page);
    await expect(page.locator('[data-testid="grpc-proto-tab-schema-browser"]')).toBeDisabled();
  });

  test('escape closes manage schemas modal', async ({ page }) => {
    await openManageSchemasModal(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="grpc-proto-manage-modal"]')).toHaveCount(0);
  });
});

test.describe('gRPC Studio — schema browser live (Phase 3I)', () => {
  test.beforeEach(async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'Skipped: gRPC Docker (:50051) or Express backend (:3001) not running');
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await reflectGrpcServices(page);
  });

  test('schema browser shows Echo method after reflect', async ({ page }) => {
    await openManageSchemasModal(page);
    await openSchemaBrowserTab(page);

    const echoMethodNode = page.locator(`[data-testid="${ECHO_SCHEMA_BROWSER_METHOD_TESTID}"]`);
    await expect(echoMethodNode).toBeVisible({ timeout: 10_000 });
    await echoMethodNode.click();

    await expect(page.locator('[data-testid="grpc-schema-browser-detail"]')).toContainText('Echo');
    await expect(page.locator('[data-testid="grpc-schema-browser-detail"]')).toContainText('echo.EchoRequest');
  });

  test('open in tab from schema browser binds explorer selection', async ({ page }) => {
    await openManageSchemasModal(page);
    await openSchemaBrowserTab(page);

    await page.locator(`[data-testid="${ECHO_SCHEMA_BROWSER_METHOD_TESTID}"]`).click();
    await page.locator('[data-testid="grpc-schema-open-tab-btn"]').click();

    await expect(page.locator('[data-testid="grpc-proto-manage-modal"]')).toHaveCount(0);
    await waitForGrpcRequestComposer(page);
    await expect(page.locator('[data-testid="grpc-call-method-name"]')).toContainText('Echo');
  });

  test('schema browser search filters methods', async ({ page }) => {
    await selectEchoMethod(page);
    await openManageSchemasModal(page);
    await openSchemaBrowserTab(page);

    await page.locator('[data-testid="grpc-schema-browser-search"]').fill('Bidi');
    await expect(page.locator('[data-testid="grpc-schema-browser-tree"]')).toContainText('BidiStream');
    await expect(page.locator('[data-testid="grpc-schema-browser-tree"]')).not.toContainText('ServerStream');
  });
});
