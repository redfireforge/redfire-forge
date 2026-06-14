import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

/**
 * Phase 11E — accessibility & persistence E2E for the redesigned WebSocket
 * studio shell (split-pane + tab strips). The shell chrome renders without a
 * live backend, so these checks exercise the shared `useSplitPaneResize` hook
 * and `tabListKeyboard` helper end-to-end in a real browser:
 *   - the divider exposes WAI-ARIA `separator` semantics,
 *   - keyboard resize updates the width,
 *   - the width persists across a reload, and
 *   - the tab strips support arrow-key navigation.
 *
 * The redesigned shell is the default studio layout.
 */
test.describe('WebSocket studio shell (Phase 11 a11y)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/?tab=websocket-studio', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="ws-studio-shell"]')).toBeVisible({ timeout: 20000 });
  });

  test('exposes WAI-ARIA separator semantics on the divider', async ({ page }) => {
    const divider = page.locator('[data-testid="ws-studio-divider"]');
    await expect(divider).toBeVisible();
    await expect(divider).toHaveAttribute('role', 'separator');
    await expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    await expect(divider).toHaveAttribute('aria-label', 'Resize left and right panes');
    await expect(divider).toHaveAttribute('tabindex', '0');
    await expect(divider).toHaveAttribute('aria-valuenow', /\d+/);
    await expect(divider).toHaveAttribute('aria-valuemin', '440');
  });

  test('resizes the split with the keyboard', async ({ page }) => {
    const divider = page.locator('[data-testid="ws-studio-divider"]');
    await divider.focus();
    const before = Number(await divider.getAttribute('aria-valuenow'));

    await page.keyboard.press('ArrowRight');
    const afterRight = Number(await divider.getAttribute('aria-valuenow'));
    expect(afterRight).toBeGreaterThan(before);

    await page.keyboard.press('ArrowLeft');
    const afterLeft = Number(await divider.getAttribute('aria-valuenow'));
    expect(afterLeft).toBe(before);

    // Home collapses the left pane to its configured minimum.
    await page.keyboard.press('Home');
    await expect(divider).toHaveAttribute('aria-valuenow', '440');
  });

  test('persists the pane width across a reload', async ({ page }) => {
    const divider = page.locator('[data-testid="ws-studio-divider"]');
    await divider.focus();
    // Several page-steps to move clearly off the default width.
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageUp');
    const widthBefore = Number(await divider.getAttribute('aria-valuenow'));

    // Allow the debounced save to flush before reloading.
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const dividerAfter = page.locator('[data-testid="ws-studio-divider"]');
    await expect(dividerAfter).toBeVisible({ timeout: 20000 });
    await expect
      .poll(async () => Number(await dividerAfter.getAttribute('aria-valuenow')))
      .toBe(widthBefore);
  });

  test('navigates the left tab strip with arrow keys', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: 'Left pane' });
    await expect(tablist).toBeVisible();
    const selectedBefore = tablist.locator('[role="tab"][aria-selected="true"]');
    const idBefore = await selectedBefore.getAttribute('data-testid');

    await selectedBefore.focus();
    await page.keyboard.press('ArrowRight');

    const selectedAfter = tablist.locator('[role="tab"][aria-selected="true"]');
    await expect(selectedAfter).toHaveCount(1);
    const idAfter = await selectedAfter.getAttribute('data-testid');
    expect(idAfter).not.toBe(idBefore);
  });

  test('navigates the mode strip with arrow keys', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: 'Studio mode' });
    await expect(page.locator('[data-testid="mode-client"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-testid="mode-client"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="mode-mock"]')).toHaveAttribute('aria-selected', 'true');
    await expect(tablist).toBeVisible();
  });
});
