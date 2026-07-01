/**
 * grpc-studio-native-transport.spec.ts — Phase 7I desktop CI smoke.
 *
 * Runs only when E2E_TAURI_NATIVE_GRPC=1 (Tauri desktop build).
 * Default web Playwright CI skips this file.
 */
import { test, expect } from '@playwright/test';
import { gotoGrpcStudio } from './grpc-helpers';

const isNativeTransportE2e = process.env.E2E_TAURI_NATIVE_GRPC === '1';

test.describe('gRPC Studio — native transport smoke (Phase 7I)', () => {
  test.skip(!isNativeTransportE2e, 'desktop CI only — set E2E_TAURI_NATIVE_GRPC=1');

  test('studio shell loads with transport panel on desktop', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible();
    await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="grpc-settings-nav-transport"]').click();
    await expect(page.locator('[data-testid="grpc-settings-panel-transport"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-transport-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-transport-mode-express"]')).toBeVisible();
    // Native card is rendered on all platforms; enabled only inside a real Tauri webview.
    const tauriMode = page.locator('[data-testid="grpc-transport-mode-tauri"]');
    await expect(tauriMode).toBeVisible();
    await expect(tauriMode).toBeEnabled();
  });
});
