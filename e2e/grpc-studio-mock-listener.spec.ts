import { test, expect } from '@playwright/test';
import {
  gotoGrpcStudio,
  isBackendHealthy,
  isGrpcTestServerHealthy,
  reflectGrpcServices,
  setGrpcTarget,
} from './grpc-helpers';

test.describe('gRPC Studio — mock listener lifecycle smoke', () => {
  test('starts and stops network listener from Advanced > Mock panel', async ({ page, request }) => {
    const [backendHealthy, grpcHealthy] = await Promise.all([
      isBackendHealthy(request),
      isGrpcTestServerHealthy(request),
    ]);
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');
    test.skip(!grpcHealthy, 'gRPC fixture server not running on :50052 — run docker/grpc fixture');

    await gotoGrpcStudio(page);

    // Descriptor is required before Start can expose the network listener.
    await setGrpcTarget(page);
    await reflectGrpcServices(page);

    await page.locator('[data-testid="grpc-sub-nav-advanced"]').click();
    await expect(page.locator('[data-testid="grpc-advanced-shell"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="grpc-advanced-tab-mock_server"]').click();
    await expect(page.locator('[data-testid="grpc-mock-server-panel"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="grpc-mock-tab-runtime"]').click();

    await expect(page.locator('[data-testid="grpc-mock-start-btn"]')).toBeEnabled();

    await page.locator('[data-testid="grpc-mock-start-btn"]').click();
    await expect(page.locator('[data-testid="grpc-mock-status"]')).toContainText('Running', { timeout: 10_000 });
    await expect(page.locator('[data-testid="grpc-mock-listen-target"]')).toContainText('127.0.0.1:', { timeout: 10_000 });
    await expect(page.locator('[data-testid="grpc-mock-stop-btn"]')).toBeVisible();

    await page.locator('[data-testid="grpc-mock-stop-btn"]').click();
    await expect(page.locator('[data-testid="grpc-mock-status"]')).toContainText('Completed', { timeout: 10_000 });
    await expect(page.locator('[data-testid="grpc-mock-start-btn"]')).toBeVisible();
  });
});
