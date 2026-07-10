/**
 * grpc-studio-shell.spec.ts — gRPC Studio shell E2E navigation & session (Phase 1H, no Docker).
 */
import { test, expect } from '@playwright/test';
import { gotoGrpcStudio } from './grpc-helpers';
import {
  GRPC_STUDIO_SESSION_STORAGE_KEY,
  gotoFreshGrpcStudio,
  gotoGrpcStudioWithCorruptedSession,
  gotoGrpcStudioWithStaleSession,
  gotoGrpcStudioWithWrongVersionSession,
  gotoGrpcStudioWithInvalidTabsSession,
  gotoGrpcStudioWithMissingActiveTabSession,
  gotoGrpcStudioWithOverflowTabsSession,
  gotoGrpcStudioWithSecondActiveSession,
  gotoGrpcStudioWithEmptyTabsSession,
  gotoGrpcStudioWithLegacyMissingDescriptorMapSession,
  gotoGrpcStudioWithNullDescriptorMapSession,
} from './helpers/grpc-studio-shell-helpers';

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

  test('auth badge focuses the call panel Auth tab', async ({ page }) => {
    await gotoGrpcStudio(page);

    await page.locator('[data-testid="grpc-auth-badge"]').click();

    await expect(page.locator('[data-testid="grpc-request-tab-auth"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="grpc-auth-panel"]')).toBeVisible();
  });

  test('active tab target persists across reload', async ({ page }) => {
    const restoredTarget = 'localhost:50099';

    await gotoFreshGrpcStudio(page);

    await page.locator('[data-testid="grpc-add-tab"]').click();
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    await targetInput.fill(restoredTarget);
    await expect(targetInput).toHaveValue(restoredTarget);

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; target?: string }>;
        };
        const activeTab = session.tabs?.find((tab) => tab.id === session.activeTabId);
        return activeTab?.target ?? null;
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toBe(restoredTarget);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(restoredTarget);
  });

  test('duplicated tab state survives closing the source tab and reloading', async ({ page }) => {
    const sourceTarget = 'localhost:50051';
    const copiedTarget = 'localhost:50077';

    await gotoFreshGrpcStudio(page);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    await targetInput.fill(sourceTarget);
    await expect(targetInput).toHaveValue(sourceTarget);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab').first();
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator(`[data-testid="grpc-tab-duplicate-${firstTabId}"]`).click();
    const tabs = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab');
    await expect(tabs).toHaveCount(2);

    const activeTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const activeTabId = await activeTab.getAttribute('data-testid');
    if (!activeTabId || activeTabId === firstTabId) {
      throw new Error('Expected duplicated tab to become active');
    }

    await targetInput.fill(copiedTarget);
    await expect(targetInput).toHaveValue(copiedTarget);

    await page.locator(`[data-testid="grpc-tab-close-${firstTabId}"]`).click();
    await expect(tabs).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(copiedTarget);

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; target?: string }>;
        };
        return {
          tabCount: session.tabs?.length ?? 0,
          activeTarget: session.tabs?.find((tab) => tab.id === session.activeTabId)?.target ?? null,
        };
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toEqual({ tabCount: 1, activeTarget: copiedTarget });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(copiedTarget);
  });

  test('collapsed services sidebar persists across reload', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
    await page.locator('[data-testid="grpc-explorer-collapse-btn"]').click();

    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toHaveCount(0);

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; servicesCollapsed?: boolean }>;
        };
        return session.tabs?.find((tab) => tab.id === session.activeTabId)?.servicesCollapsed ?? null;
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toHaveCount(0);
  });

  test('services sidebar collapse state stays isolated per tab across tab switching', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const tabs = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab');
    await page.locator('[data-testid="grpc-explorer-collapse-btn"]').click();
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator('[data-testid="grpc-add-tab"]').click();
    await expect(tabs).toHaveCount(2);
    const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const secondTabId = await secondTab.getAttribute('data-testid');
    if (!secondTabId || secondTabId === firstTabId) {
      throw new Error('Expected newly added tab to become active');
    }
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();

    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toHaveCount(0);

    await expect
      .poll(async () => page.evaluate(({ key, firstTabId, secondTabId }) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          tabs?: Array<{ id: string; servicesCollapsed?: boolean }>;
        };
        const firstTab = session.tabs?.find((tab) => tab.id === firstTabId);
        const secondTab = session.tabs?.find((tab) => tab.id === secondTabId);
        return {
          firstCollapsed: firstTab?.servicesCollapsed ?? null,
          secondCollapsed: secondTab?.servicesCollapsed ?? null,
        };
      }, {
        key: GRPC_STUDIO_SESSION_STORAGE_KEY,
        firstTabId,
        secondTabId,
      }))
      .toEqual({ firstCollapsed: true, secondCollapsed: false });
  });

  test('tablet widths use side-by-side request and response panes', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoGrpcStudio(page);

    const splitDirection = await page.locator('.grpc-call-split').evaluate((node) => getComputedStyle(node).flexDirection);
    expect(splitDirection).toBe('row');
  });

  test('mobile widths keep request and response panes stacked', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await gotoGrpcStudio(page);

    const splitDirection = await page.locator('.grpc-call-split').evaluate((node) => getComputedStyle(node).flexDirection);
    expect(splitDirection).toBe('column');
  });

  test('mobile stage tabs switch between request, response, and auth panes', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await gotoGrpcStudio(page);

    await expect(page.locator('[data-testid="grpc-mobile-stage-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-request-pane"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-shell"]')).toBeHidden();

    await page.locator('[data-testid="grpc-mobile-stage-response"]').click();
    await expect(page.locator('[data-testid="grpc-request-pane"]')).toBeHidden();
    await expect(page.locator('[data-testid="grpc-response-shell"]')).toBeVisible();

    await page.locator('[data-testid="grpc-mobile-stage-auth"]').click();
    await expect(page.locator('[data-testid="grpc-request-pane"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-shell"]')).toBeHidden();
    await expect(page.locator('[data-testid="grpc-request-tab-auth"]')).toHaveClass(/active/);
  });

  test('desktop shell avoids page-level vertical overflow at 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoGrpcStudio(page);

    const overflow = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));

    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
  });

  test('auth configuration stays isolated per tab', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-select"]').selectOption('bearer');
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('tab-one-token');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await page.locator('[data-testid="grpc-add-tab"]').click();
    const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const secondTabId = await secondTab.getAttribute('data-testid');
    if (!secondTabId || secondTabId === firstTabId) {
      throw new Error('Expected newly added gRPC tab id');
    }

    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-select"]')).toHaveValue('none');

    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-select"]')).toHaveValue('bearer');
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('tab-one-token');
  });

  test('active tab auth configuration persists across reload', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-select"]').selectOption('bearer');
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('reload-token');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; auth?: { type?: string; bearerToken?: string } }>;
        };
        return session.tabs?.find((tab) => tab.id === session.activeTabId)?.auth ?? null;
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toEqual({ type: 'bearer', bearerToken: 'reload-token' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-select"]')).toHaveValue('bearer');
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('reload-token');
  });

  test('duplicated tab copies auth state and keeps it independent', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-select"]').selectOption('bearer');
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('source-token');

    await page.locator(`[data-testid="grpc-tab-duplicate-${firstTabId}"]`).click();
    const activeTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const activeTabId = await activeTab.getAttribute('data-testid');
    if (!activeTabId || activeTabId === firstTabId) {
      throw new Error('Expected duplicated tab to become active');
    }

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-select"]')).toHaveValue('bearer');
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('source-token');

    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('duplicate-token');
    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('source-token');
  });

  test('duplicated tabs preserve independent target and auth state across reload', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await targetInput.fill('source.example.com:50051');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-select"]').selectOption('bearer');
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('source-token');

    await page.locator(`[data-testid="grpc-tab-duplicate-${firstTabId}"]`).click();
    const duplicatedTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const duplicatedTabId = await duplicatedTab.getAttribute('data-testid');
    if (!duplicatedTabId || duplicatedTabId === firstTabId) {
      throw new Error('Expected duplicated tab to become active');
    }

    await targetInput.fill('duplicate.example.com:50052');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('duplicate-token');

    await expect
      .poll(async () => page.evaluate(({ key, firstTabId, duplicatedTabId }) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; target?: string; auth?: { type?: string; bearerToken?: string } }>;
        };
        const firstTab = session.tabs?.find((tab) => tab.id === firstTabId);
        const duplicatedTab = session.tabs?.find((tab) => tab.id === duplicatedTabId);
        return {
          tabCount: session.tabs?.length ?? 0,
          activeTabId: session.activeTabId ?? null,
          firstTarget: firstTab?.target ?? null,
          firstToken: firstTab?.auth?.bearerToken ?? null,
          duplicatedTarget: duplicatedTab?.target ?? null,
          duplicatedToken: duplicatedTab?.auth?.bearerToken ?? null,
        };
      }, {
        key: GRPC_STUDIO_SESSION_STORAGE_KEY,
        firstTabId,
        duplicatedTabId,
      }))
      .toEqual({
        tabCount: 2,
        activeTabId: duplicatedTabId,
        firstTarget: 'source.example.com:50051',
        firstToken: 'source-token',
        duplicatedTarget: 'duplicate.example.com:50052',
        duplicatedToken: 'duplicate-token',
      });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });

    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('duplicate.example.com:50052');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('duplicate-token');

    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('source.example.com:50051');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('source-token');
  });

  test('corrupted persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithCorruptedSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
  });

  test('stale persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithStaleSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('wrong-version persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithWrongVersionSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('invalid-tabs persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithInvalidTabsSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('missing active tab id restores the first persisted tab safely', async ({ page }) => {
    await gotoGrpcStudioWithMissingActiveTabSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('fallback-one.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('fallback-one-token');
  });

  test('persisted tabs beyond the max limit are truncated and recover to the first surviving tab', async ({ page }) => {
    await gotoGrpcStudioWithOverflowTabsSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(8);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('overflow-1.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('overflow-one-token');
  });

  test('valid persisted active tab restores a non-first tab and keeps sibling state intact', async ({ page }) => {
    await gotoGrpcStudioWithSecondActiveSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('seeded-two.example.com:50052');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('seeded-two-token');

    await page.locator('[data-testid="seeded-tab-1"]').click();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('seeded-one.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('empty persisted tabs leave the default workspace intact', async ({ page }) => {
    await gotoGrpcStudioWithEmptyTabsSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('legacy persisted session without descriptor map restores active tab and sibling state safely', async ({ page }) => {
    await gotoGrpcStudioWithLegacyMissingDescriptorMapSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('legacy-two.example.com:50052');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('legacy-two-token');

    await page.locator('[data-testid="legacy-tab-1"]').click();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('legacy-one.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
  });

  test('persisted session with null descriptor map restores without crashing and keeps explorer collapse state', async ({ page }) => {
    await gotoGrpcStudioWithNullDescriptorMapSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('legacy-null.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('legacy-null-token');
  });
});
