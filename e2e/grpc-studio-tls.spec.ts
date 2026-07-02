/**
 * grpc-studio-tls.spec.ts — gRPC Studio Phase 4J shell E2E (no Docker).
 *
 * Validates connection bar → TLS modal and settings drawer entry points
 * without a live gRPC backend.
 */
import { test, expect } from '@playwright/test';
import { gotoGrpcStudio } from './grpc-helpers';

async function ensureValidTarget(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-testid="grpc-target-input"]').fill('localhost:50051');
  await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
}

test.describe('gRPC Studio — Phase 4J TLS modal (shell)', () => {
  test('TLS badge opens modal with save and cancel controls', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-tls-badge"]').click();
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-tls-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-tls-cancel"]')).toBeVisible();
  });

  test('Cancel closes TLS modal and reverts unsaved mode change', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await expect(page.locator('[data-testid="grpc-tls-badge"]')).toContainText('Plaintext');
    await page.locator('[data-testid="grpc-tls-badge"]').click();
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toBeVisible();
    await page.locator('[data-testid="grpc-tls-mode-tls"]').click();
    await page.locator('[data-testid="grpc-tls-cancel"]').click();
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-tls-badge"]')).toContainText('Plaintext');
  });

  test('Close button dismisses TLS modal and keeps live edits', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await expect(page.locator('[data-testid="grpc-tls-badge"]')).toContainText('Plaintext');
    await page.locator('[data-testid="grpc-tls-badge"]').click();
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toBeVisible();
    await page.locator('[data-testid="grpc-tls-mode-tls"]').click();
    await page.locator('[data-testid="grpc-tls-close"]').click();
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-tls-badge"]')).not.toContainText('Plaintext');
  });

  test('Save closes TLS modal and updates badge label', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await expect(page.locator('[data-testid="grpc-tls-badge"]')).toContainText('Plaintext');
    await page.locator('[data-testid="grpc-tls-badge"]').click();
    await page.locator('[data-testid="grpc-tls-mode-tls"]').click();
    await page.locator('[data-testid="grpc-tls-save"]').click();
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-tls-badge"]')).toContainText('TLS');
  });
});

test.describe('gRPC Studio — Phase 4J settings drawer (shell)', () => {
  test('gear opens connection settings drawer on TLS nav', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-settings-panel-tls"]')).toBeVisible();
  });

  test('deadline badge opens drawer on Call settings nav', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-deadline-badge"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-settings-panel-call"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-call-settings-timeout"]')).toBeVisible();
  });

  test('settings drawer navigates to Compression panel', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await page.locator('[data-testid="grpc-settings-nav-compression"]').click();
    await expect(page.locator('[data-testid="grpc-settings-panel-compression"]')).toBeVisible();
  });

  test('settings drawer navigates to Health check panel', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await page.locator('[data-testid="grpc-settings-nav-health"]').click();
    await expect(page.locator('[data-testid="grpc-settings-panel-health"]')).toBeVisible();
  });

  test('settings drawer closes via footer Close', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await page.locator('[data-testid="grpc-settings-close"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toHaveCount(0);
  });

  test('settings drawer closes via Escape key', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toHaveCount(0);
  });

  test('TLS badge closes open settings drawer and opens modal', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await page.locator('[data-testid="grpc-tls-badge"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-tls-body"]')).toBeVisible();
  });

  test('settings drawer navigates to K8s port-forward panel', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await page.locator('[data-testid="grpc-settings-nav-k8s"]').click();
    await expect(page.locator('[data-testid="grpc-settings-panel-k8s"]')).toBeVisible();
    await page.locator('[data-testid="grpc-k8s-name"]').fill('order-service');
    await expect(page.locator('[data-testid="grpc-k8s-start-btn"]')).toBeEnabled();
    await page.locator('[data-testid="grpc-k8s-start-btn"]').click();
    await expect(page.locator('[data-testid="grpc-k8s-status"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('localhost:50051');
  });

  test('settings drawer navigates to Transport panel', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await page.locator('[data-testid="grpc-settings-nav-transport"]').click();
    await expect(page.locator('[data-testid="grpc-settings-panel-transport"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-transport-panel"]')).toBeVisible();
  });

  test('connection bar shows connect dot and toggle', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await expect(page.locator('[data-testid="grpc-connection-status-dot"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-connection-toggle-btn"]')).toBeVisible();
  });

  test('settings drawer navigates to Auth panel', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await page.locator('[data-testid="grpc-settings-nav-auth"]').click();
    await expect(page.locator('[data-testid="grpc-settings-panel-auth"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-auth-type-pills"]')).toBeVisible();
  });
});

test.describe('gRPC Studio — Phase 4J auth entry (shell)', () => {
  test('auth badge opens settings drawer on Auth panel', async ({ page }) => {
    await gotoGrpcStudio(page);
    await ensureValidTarget(page);
    await page.locator('[data-testid="grpc-auth-badge"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-settings-panel-auth"]')).toBeVisible();
  });
});
