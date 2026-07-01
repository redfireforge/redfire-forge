/**
 * grpc-studio-shell.spec.ts — gRPC Studio shell E2E (Phase 1H, no Docker).
 *
 * Validates navigation and idle UI without a live gRPC backend.
 */
import { test, expect } from '@playwright/test';
import { gotoGrpcStudio } from './grpc-helpers';

test.describe('gRPC Studio — navigation (Phase 1H shell)', () => {
  test('navigates to gRPC Studio via URL param', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible();
  });

  test('shows target input and explorer idle hint', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-service-explorer"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('reflect button is disabled until target is valid', async ({ page }) => {
    await gotoGrpcStudio(page);
    const reflectBtn = page.locator('[data-testid="grpc-reflect-btn"]');
    await expect(reflectBtn).toBeDisabled();
  });

  test('Protocols sub-nav reaches gRPC Studio', async ({ page }) => {
    await gotoGrpcStudio(page, { seed: true });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.click('text=Protocols');
    await page.click('button:has-text("gRPC")');
    await expect(page).toHaveURL(new RegExp(`tab=grpc-studio`));
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test('call panel shows empty method hint before selection', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-call-panel-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-idle"]')).toBeVisible();
  });
});

test.describe('gRPC Studio — target validation', () => {
  test('valid host:port enables reflect', async ({ page }) => {
    await gotoGrpcStudio(page);
    await page.locator('[data-testid="grpc-target-input"]').fill('localhost:50051');
    await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-reflect-btn"]')).toBeEnabled();
  });
});
