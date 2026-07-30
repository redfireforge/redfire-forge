import { test, expect } from '@playwright/test';
import { seedAppDataWithTest } from './helpers';

test('SLA modal layout and resize', async ({ page }) => {
  await seedAppDataWithTest(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
  await page.waitForLoadState('networkidle');

  // Expand feature group
  await page.locator('.feature-group-card .feature-group-name, .feature-group-card >> text=E2E Feature').first().click();
  await page.waitForTimeout(300);

  // Expand scenario 
  await page.locator('.scenario-group-name').first().click();
  await page.waitForTimeout(300);

  // Find and click a SLA button (🎯)
  const slaBtn = page.locator('button[title="Configure SLA targets for this test"]').first();
  await expect(slaBtn).toBeVisible({ timeout: 5000 });
  await slaBtn.click();
  await page.waitForTimeout(500);

  const modal = page.locator('.test-sla-modal');
  await expect(modal).toBeVisible();

  // Add two SLA target rows so we can see the column layout
  const addBtn = modal.locator('button.test-sla-add-btn');
  await addBtn.click();
  await page.waitForTimeout(200);
  await addBtn.click();
  await page.waitForTimeout(200);

  // Fill in labels to test Label column width
  const labelInputs = modal.locator('.test-sla-input--label');
  if (await labelInputs.count() >= 2) {
    await labelInputs.nth(0).fill('Users P95 Response Time');
    await labelInputs.nth(1).fill('Error Rate Threshold');
  }

  // Check normal state
  const normalBox = await modal.boundingBox();
  console.log('Normal modal box:', JSON.stringify(normalBox));
  await page.screenshot({ path: 'test-results/sla-normal.png', fullPage: false });

  // Verify no expand button (removed)
  const expandBtn = modal.locator('.modal-expand-btn');
  expect(await expandBtn.count()).toBe(0);

  // Verify resize handles exist
  const resizeRight = modal.locator('.modal-resize-edge-right');
  const resizeCorner = modal.locator('.modal-resize-corner');
  expect(await resizeRight.count()).toBe(1);
  expect(await resizeCorner.count()).toBe(1);

  // Check header visible
  const header = modal.locator('.modal-header');
  await expect(header).toBeVisible();

  // Check footer visible and within viewport
  const footer = modal.locator('.test-sla-modal-footer');
  await expect(footer).toBeVisible();
  const footerBox = await footer.boundingBox();
  const viewport = page.viewportSize();
  console.log('Footer box:', JSON.stringify(footerBox));
  console.log('Viewport:', JSON.stringify(viewport));
  if (footerBox && viewport) {
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height + 5);
  }

  // Verify modal is within viewport
  if (normalBox && viewport) {
    expect(normalBox.x + normalBox.width).toBeLessThanOrEqual(viewport.width + 5);
    expect(normalBox.y + normalBox.height).toBeLessThanOrEqual(viewport.height + 5);
  }

  console.log('All checks passed');
});
