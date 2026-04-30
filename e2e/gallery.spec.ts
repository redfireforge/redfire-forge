import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

test.describe('Gallery Page', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/?tab=gallery');
    await page.waitForTimeout(500);
  });

  test('gallery page renders with cards', async ({ page }) => {
    const cards = page.locator('.gallery-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('gallery shows domain filter buttons', async ({ page }) => {
    const domainBtns = page.locator('.gallery-domain-btn');
    // All + 5 domains
    await expect(domainBtns).toHaveCount(6);
  });

  test('can filter by domain', async ({ page }) => {
    const allCards = await page.locator('.gallery-card').count();
    // Click Assertions domain (has fewer than page-size entries)
    await page.locator('.gallery-domain-btn', { hasText: 'Assertions' }).click();
    await page.waitForTimeout(200);
    const filteredCards = await page.locator('.gallery-card').count();
    expect(filteredCards).toBeLessThan(allCards);
    expect(filteredCards).toBeGreaterThan(0);
  });

  test('can search gallery entries', async ({ page }) => {
    const searchInput = page.locator('[aria-label="Search gallery"]');
    await searchInput.fill('pokemon');
    await page.waitForTimeout(200);
    const cards = page.locator('.gallery-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    // All visible cards should relate to pokemon
    const firstCardText = await cards.first().textContent();
    expect(firstCardText?.toLowerCase()).toContain('pok');
  });

  test('clicking a card opens detail panel', async ({ page }) => {
    await page.locator('.gallery-card').first().click();
    await expect(page.locator('.gallery-detail-panel')).toBeVisible();
    await expect(page.locator('[aria-label="Close detail panel"]')).toBeVisible();
  });

  test('detail panel shows entry info', async ({ page }) => {
    await page.locator('.gallery-card').first().click();
    const panel = page.locator('.gallery-detail-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    // Should show difficulty dots and action button inside the detail panel
    await expect(panel.locator('.gallery-difficulty-dots')).toBeVisible({ timeout: 5000 });
    await expect(panel.locator('.gallery-detail-actions')).toBeVisible({ timeout: 5000 });
  });

  test('closing detail panel works', async ({ page }) => {
    await page.locator('.gallery-card').first().click();
    await expect(page.locator('.gallery-detail-panel')).toBeVisible();
    await page.locator('[aria-label="Close detail panel"]').click();
    await expect(page.locator('.gallery-detail-panel')).not.toBeVisible();
  });

  test('can filter by category', async ({ page }) => {
    const catSelect = page.locator('[aria-label="Filter by category"]');
    // Get first non-empty option
    const options = await catSelect.locator('option').allTextContents();
    const firstCategory = options.find(o => o !== 'All Categories');
    if (firstCategory) {
      await catSelect.selectOption({ label: firstCategory });
      await page.waitForTimeout(200);
      const cards = await page.locator('.gallery-card').count();
      expect(cards).toBeGreaterThan(0);
    }
  });

  test('can filter by difficulty', async ({ page }) => {
    const diffSelect = page.locator('[aria-label="Filter by difficulty"]');
    await diffSelect.selectOption('easy');
    await page.waitForTimeout(200);
    const cards = await page.locator('.gallery-card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('pagination shows when many entries', async ({ page }) => {
    // The gallery has 65+ entries, default page size is 12
    const pagination = page.locator('.gallery-pagination');
    // Might or might not be visible depending on filter state
    // With all entries it should paginate
    const domainBtns = page.locator('.gallery-domain-btn');
    await domainBtns.first().click(); // "All" button
    await page.waitForTimeout(200);
    await expect(pagination).toBeVisible();
  });

  test('importing a request entry navigates to requests tab', async ({ page }) => {
    // Filter to requests
    await page.locator('.gallery-domain-btn', { hasText: 'Requests' }).click();
    await page.waitForTimeout(200);
    // Click first card
    await page.locator('.gallery-card').first().click();
    // Click import button
    await page.locator('.gallery-detail-btn-primary').click();
    await page.waitForTimeout(500);
    // Requests is the default tab so ?tab= param is removed from URL.
    // Verify we left the gallery by checking the URL does NOT contain tab=gallery.
    const url = page.url();
    expect(url).not.toContain('tab=gallery');
  });

  test('importing a workflow entry navigates to workflow tab', async ({ page }) => {
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(200);
    await page.locator('.gallery-card').first().click();
    await page.locator('.gallery-detail-btn-primary').click();
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('tab=workflow');
  });
});
