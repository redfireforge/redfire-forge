/**
 * grpc-studio-interpolation.spec.ts — interpolation-focused shell E2E (Phase 9 deferred follow-up).
 *
 * Runs without Docker/live gRPC backend.
 */
import { test, expect } from '@playwright/test';
import { gotoGrpcStudio } from './grpc-helpers';

test.describe('@grpc-interpolation gRPC Studio — interpolation shell', () => {
  test('shows interpolation syntax banner for invalid token template', async ({ page }) => {
    await gotoGrpcStudio(page);
    await page.locator('[data-testid="grpc-target-input"]').fill('{{9bad}}');
    await expect(page.locator('[data-testid="grpc-interpolation-error-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-interpolation-error-message"]')).toContainText(
      /invalid interpolation syntax/i,
    );
  });

  test('shows resolved payload preview block in resolved mode', async ({ page }) => {
    await gotoGrpcStudio(page);
    await page.locator('[data-testid="grpc-target-input"]').fill('{{missingPreviewHost}}');
    await page.locator('[data-testid="grpc-interpolation-preview-resolved"]').click();

    await expect(page.locator('[data-testid="grpc-interpolation-payload-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-interpolation-payload-preview-value"]')).toContainText(
      /"body": \{\}/,
    );
    await expect(page.locator('[data-testid="grpc-interpolation-payload-preview-value"]')).toContainText(
      /"metadata": \{\}/,
    );
  });
});
