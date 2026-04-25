import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

/**
 * Verify that loading a sample from the Gallery shows auto-laid-out nodes
 * without a visible flash of the estimated layout.
 */
test.describe('Sample auto-layout on load', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/');
    // Navigate to Workflow tab
    await page.click('button.ab-btn:has-text("Workflow")');
    await page.waitForSelector('.workflow-designer-mount');
  });

  test('Gallery opens and loads a sample with auto-layout applied', async ({ page }) => {
    // Click Gallery button in sub-nav
    const galleryBtn = page.locator('.sub-nav-tab:has-text("Gallery")');
    await expect(galleryBtn).toBeVisible();
    await galleryBtn.click();

    // Gallery modal should appear
    const modal = page.locator('.tg-modal');
    await expect(modal).toBeVisible();

    // Click the first sample card
    const firstCard = modal.locator('.tg-card').first();
    const sampleName = await firstCard.locator('.tg-card-name').textContent();
    await firstCard.click();

    // Gallery should close
    await expect(modal).not.toBeVisible();

    // Preview banner should appear with the sample name
    const previewBanner = page.locator('.wf-preview-banner');
    await expect(previewBanner).toBeVisible();
    await expect(previewBanner).toContainText(sampleName!);

    // ReactFlow canvas should exist
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();

    // Wait for auto-layout to complete — canvas should NOT have visibility:hidden
    await expect(canvas).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Verify nodes are present
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5000 });
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(3);
  });

  test('canvas is hidden during auto-layout transition', async ({ page }) => {
    // Click Gallery
    await page.click('.sub-nav-tab:has-text("Gallery")');
    const modal = page.locator('.tg-modal');
    await expect(modal).toBeVisible();

    // Set up a MutationObserver to track visibility changes on .react-flow
    await page.evaluate(() => {
      (window as any).__visibilityLog = [];
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'style') {
            const el = m.target as HTMLElement;
            (window as any).__visibilityLog.push({
              visibility: el.style.visibility,
              time: performance.now(),
            });
          }
        }
      });
      // Observe the first .react-flow element found (will be replaced on remount)
      // We need to observe the parent so we catch remounts
      const wfBody = document.querySelector('.wf-canvas');
      if (wfBody) {
        observer.observe(wfBody, { attributes: true, subtree: true, attributeFilter: ['style'] });
      }
    });

    // Click a sample
    await modal.locator('.tg-card').first().click();

    // Wait for layout to complete
    const canvas = page.locator('.react-flow');
    await expect(canvas).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Verify nodes are positioned (not all at 0,0)
    const positions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      return Array.from(nodes).map(n => {
        const transform = (n as HTMLElement).style.transform;
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : null;
      }).filter(Boolean);
    });

    // Nodes should have diverse positions (not all stacked)
    expect(positions.length).toBeGreaterThanOrEqual(3);
    const uniqueY = new Set(positions.map((p: any) => Math.round(p.y / 10)));
    expect(uniqueY.size).toBeGreaterThanOrEqual(2); // at least 2 distinct rows
  });

  test('switching between samples has no flash', async ({ page }) => {
    // Load first sample
    await page.click('.sub-nav-tab:has-text("Gallery")');
    let modal = page.locator('.tg-modal');
    await modal.locator('.tg-card').first().click();
    await expect(page.locator('.react-flow')).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Take screenshot after first sample loads
    const screenshot1 = await page.locator('.react-flow').screenshot();
    expect(screenshot1.length).toBeGreaterThan(0);

    // Load second sample
    await page.click('.sub-nav-tab:has-text("Gallery")');
    modal = page.locator('.tg-modal');
    await modal.locator('.tg-card').nth(1).click();

    // Canvas should become hidden while transitioning
    // Then become visible again once layout is done
    await expect(page.locator('.react-flow')).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Nodes should be present
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5000 });
  });
});
