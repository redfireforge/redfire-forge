import { test, expect } from '@playwright/test';
import {
  gotoGrpcStudio,
  isBackendHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  startGrpcMockListener,
  stopGrpcMockListener,
} from './grpc-helpers';

test.describe('gRPC Studio — files and proto export shell', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGrpcStudio(page);
  });

  test('files tab is enabled before method selection and shows empty state', async ({ page }) => {
    await expect(page.locator('[data-testid="grpc-request-tab-files"]')).toBeEnabled();
    await page.locator('[data-testid="grpc-request-tab-files"]').click();
    await expect(page.locator('[data-testid="grpc-call-panel-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-call-panel-empty"]')).toContainText(/select a method/i);
  });

  test('collapse button remains accessible after collapse/expand', async ({ page }) => {
    const collapseBtn = page.locator('[data-testid="grpc-explorer-collapse-btn"]');
    await expect(collapseBtn).toBeVisible();

    await collapseBtn.click();
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-collapse-btn"]')).toBeVisible();

    await page.locator('[data-testid="grpc-explorer-collapse-btn"]').click();
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });
});

test.describe('gRPC Studio — files and proto export live-backed', () => {
  test.beforeEach(async ({ request }) => {
    const ready = await isBackendHealthy(request);
    test.skip(!ready, 'Skipped: Express backend (:3001) not running');
  });

  test('files tab supports upload, remove, and clear', async ({ page, request }, testInfo) => {
    const tabId = `grpc-files-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, { tabId });

    try {
      await gotoGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);

      await page.locator('[data-testid="grpc-request-tab-files"]').click();
      await expect(page.locator('[data-testid="grpc-request-files-empty"]')).toBeVisible();

      await page.locator('[data-testid="grpc-request-files-input"]').setInputFiles([
        'sample_json_template.json',
        'sample_csv_template.csv',
      ]);

      await expect(page.locator('[data-testid="grpc-request-files-count"]')).toContainText('2 selected');
      await expect(page.locator('[data-testid="grpc-request-files-list"]')).toContainText('sample_json_template.json');
      await expect(page.locator('[data-testid="grpc-request-files-list"]')).toContainText('sample_csv_template.csv');

      await page.locator('[data-testid="grpc-request-files-remove-0"]').click();
      await expect(page.locator('[data-testid="grpc-request-files-count"]')).toContainText('1 selected');

      await page.locator('[data-testid="grpc-request-files-clear"]').click();
      await expect(page.locator('[data-testid="grpc-request-files-empty"]')).toBeVisible();
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('proto export is only available on proto tab after method reflection', async ({ page, request }, testInfo) => {
    const tabId = `grpc-proto-export-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      responseMessage: 'proto-export-response',
    });

    try {
      await gotoGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);

      await page.locator('[data-testid="grpc-response-top-tab-response"]').click();
      await expect(page.locator('[data-testid="grpc-response-top-tab-response"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-testid="grpc-response-proto-export"]')).toHaveCount(0);

      await page.locator('[data-testid="grpc-response-top-tab-proto"]').click();
      await expect(page.locator('[data-testid="grpc-response-top-tab-proto"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-testid="grpc-response-proto-export"]')).toBeVisible();
      await expect(page.locator('[data-testid="grpc-response-proto-code"]')).toContainText('rpc Echo (echo.EchoRequest) returns (echo.EchoResponse)');
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

});
