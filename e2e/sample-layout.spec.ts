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
    // Click +New → From Template to navigate to Gallery
    const newBtn = page.locator('button:has-text("+ New")');
    await newBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newBtn.click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();

    // Gallery page should appear — filter to Workflow domain
    await page.locator('.gallery-domain-btn:has-text("Workflow")').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.gallery-domain-btn:has-text("Workflow")').click();
    await page.waitForTimeout(300);

    // Click the first workflow card and note its name
    const firstCard = page.locator('.gallery-card').first();
    const _sampleName = await firstCard.locator('.gallery-card-name').textContent();
    await firstCard.click();
    await page.waitForTimeout(300);

    // Click "Load Workflow" action button in detail panel
    await page.locator('button:has-text("Load Workflow")').click();
    await page.waitForTimeout(500);

    // Should be back on Workflow tab with the workflow loaded
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // Wait for auto-layout to complete — canvas should NOT have visibility:hidden
    await expect(canvas).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Verify nodes are present
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5000 });
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(3);
  });

  test('canvas is visible after loading workflow from gallery', async ({ page }) => {
    // Click +New → From Template
    const newBtn = page.locator('button:has-text("+ New")');
    await newBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newBtn.click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();

    // Gallery page — filter to Workflow
    await page.locator('.gallery-domain-btn:has-text("Workflow")').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.gallery-domain-btn:has-text("Workflow")').click();
    await page.waitForTimeout(300);

    // Click a sample and load it
    await page.locator('.gallery-card').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Load Workflow")').click();

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
    const uniqueY = new Set(positions.map((p: Record<string, number>) => Math.round(p.y / 10)));
    expect(uniqueY.size).toBeGreaterThanOrEqual(2); // at least 2 distinct rows
  });

  test('switching between workflow samples works', async ({ page }) => {
    // Load first sample via Gallery
    const newBtn = page.locator('button:has-text("+ New")');
    await newBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newBtn.click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();
    await page.locator('.gallery-domain-btn:has-text("Workflow")').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.gallery-domain-btn:has-text("Workflow")').click();
    await page.waitForTimeout(300);
    await page.locator('.gallery-card').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Load Workflow")').click();
    await expect(page.locator('.react-flow')).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Take screenshot after first sample loads
    const screenshot1 = await page.locator('.react-flow').screenshot();
    expect(screenshot1.length).toBeGreaterThan(0);

    // Load second sample
    await newBtn.click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();
    await page.locator('.gallery-domain-btn:has-text("Workflow")').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.gallery-domain-btn:has-text("Workflow")').click();
    await page.waitForTimeout(300);
    await page.locator('.gallery-card').nth(1).click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Load Workflow")').click();

    // Canvas should become visible once layout is done
    await expect(page.locator('.react-flow')).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Nodes should be present
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5000 });
  });
});
