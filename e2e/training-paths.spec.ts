import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

test.describe('Training Paths — scroll & collapsible phases', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/?tab=gallery');
    await page.waitForTimeout(500);
    // Switch to Training Paths mode
    await page.locator('.gallery-mode-btn', { hasText: 'Training Paths' }).click();
    await page.waitForTimeout(300);
  });

  test('training paths view is scrollable', async ({ page }) => {
    const scrollArea = page.locator('.gallery-scroll-area');
    await expect(scrollArea).toBeVisible();

    // Click Versioning in the sidebar to highlight it
    await page.locator('.gallery-training-btn', { hasText: 'Versioning' }).click();
    await page.waitForTimeout(300);

    // Click the Versioning path card hero to expand it (shows all phases)
    const pathHero = page.locator('.training-path-hero', { hasText: 'Versioning' });
    await expect(pathHero).toBeVisible();
    await pathHero.click();
    await page.waitForTimeout(300);

    // Verify phases are visible
    await expect(page.locator('.training-phase-header').first()).toBeVisible();

    // The training paths view should have scrollable content
    const scrollHeight = await scrollArea.evaluate(el => el.scrollHeight);
    const clientHeight = await scrollArea.evaluate(el => el.clientHeight);

    // Content MUST overflow when Versioning is expanded (15 manuals across 7 phases)
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    // Scroll down and verify it actually scrolls
    await scrollArea.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(200);
    const scrollTop = await scrollArea.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    // Scroll back to top
    await scrollArea.evaluate(el => el.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const scrollTopAfter = await scrollArea.evaluate(el => el.scrollTop);
    expect(scrollTopAfter).toBe(0);
  });

  test('phase sections are collapsible', async ({ page }) => {
    // Click Versioning in sidebar to highlight
    await page.locator('.gallery-training-btn', { hasText: 'Versioning' }).click();
    await page.waitForTimeout(300);

    // Click the Versioning path card hero to expand it
    const pathHero = page.locator('.training-path-hero', { hasText: 'Versioning' });
    await expect(pathHero).toBeVisible();
    await pathHero.click();
    await page.waitForTimeout(300);

    // Phases should be visible and expanded by default
    const phaseHeaders = page.locator('.training-phase-header');
    await expect(phaseHeaders.first()).toBeVisible();
    const chevron = phaseHeaders.first().locator('.training-phase-chevron');
    await expect(chevron).toHaveClass(/open/);

    // Manuals should be visible
    const manuals = page.locator('.training-manual-row');
    const initialCount = await manuals.count();
    expect(initialCount).toBeGreaterThan(0);

    // Click the first phase header to collapse it
    await phaseHeaders.first().click();
    await page.waitForTimeout(200);

    // Chevron should no longer have 'open' class
    await expect(chevron).not.toHaveClass(/open/);

    // Manual count should decrease
    const afterCollapseCount = await manuals.count();
    expect(afterCollapseCount).toBeLessThan(initialCount);

    // Click again to re-expand
    await phaseHeaders.first().click();
    await page.waitForTimeout(200);
    await expect(chevron).toHaveClass(/open/);
    const afterExpandCount = await manuals.count();
    expect(afterExpandCount).toBe(initialCount);
  });

  test('collapse all / expand all button works', async ({ page }) => {
    // Expand Versioning path
    await page.locator('.gallery-training-btn', { hasText: 'Versioning' }).click();
    await page.waitForTimeout(300);
    await page.locator('.training-path-hero', { hasText: 'Versioning' }).click();
    await page.waitForTimeout(300);

    const manuals = page.locator('.training-manual-row');
    const collapseBtn = page.locator('.training-path-collapse-all-btn');
    await expect(collapseBtn).toBeVisible();

    // Initially all expanded — button says "Collapse All"
    await expect(collapseBtn).toContainText('Collapse All');
    const initialCount = await manuals.count();
    expect(initialCount).toBeGreaterThan(0);

    // Click "Collapse All" — all manuals should disappear
    await collapseBtn.click();
    await page.waitForTimeout(200);
    await expect(manuals).toHaveCount(0);
    await expect(collapseBtn).toContainText('Expand All');

    // All chevrons should be closed
    const openChevrons = page.locator('.training-phase-chevron.open');
    await expect(openChevrons).toHaveCount(0);

    // Click "Expand All" — manuals should reappear
    await collapseBtn.click();
    await page.waitForTimeout(200);
    const afterExpandCount = await manuals.count();
    expect(afterExpandCount).toBe(initialCount);
    await expect(collapseBtn).toContainText('Collapse All');
  });
});
