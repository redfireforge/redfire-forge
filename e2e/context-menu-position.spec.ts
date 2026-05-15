import { test, expect, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  offers: [
    { associatedOfferingCode: 'ONZFCNCP01MCALM', rank: 1, offerName: 'OnStar One - Trial' },
    { associatedOfferingCode: 'IHUTRNCPOBYCAUL', rank: 3, offerName: 'IHU Connectivity' },
  ],
};

async function openValidationMapper(page: Page) {
  await seedAppData(page);

  await page.route('**/__proxy', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleResponse),
      }),
    });
  });

  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('CtxMenu-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('CtxMenu-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/offers');
  await page.locator('.builder-tab:has-text("Validation")').click();

  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();

  await page.locator('button:has-text("⚡ Visual Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();

  return mapper;
}

test.describe('Context menu positioning in Data Mapper', () => {
  test('right-click context menu appears near the cursor, not off to the right', async ({ page }) => {
    const mapper = await openValidationMapper(page);

    // Auto-map to create mappings
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();

    // Wait for at least one mapped node to appear
    const mappedNode = mapper.locator('.dm-panel--target .dm-tree-node--mapped').first();
    await expect(mappedNode).toBeVisible();

    // Get the bounding box of the mapped node
    const nodeBox = await mappedNode.boundingBox();
    expect(nodeBox).toBeTruthy();

    // Right-click in the middle of the node
    const clickX = nodeBox!.x + nodeBox!.width / 2;
    const clickY = nodeBox!.y + nodeBox!.height / 2;
    await page.mouse.click(clickX, clickY, { button: 'right' });

    // Context menu should appear
    const contextMenu = page.locator('.dm-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Get the context menu's bounding box
    const menuBox = await contextMenu.boundingBox();
    expect(menuBox).toBeTruthy();

    // The menu's left edge should be near the click point, NOT way off to the right.
    const horizontalDistance = Math.abs(menuBox!.x - clickX);
    expect(horizontalDistance).toBeLessThan(200);

    // Also verify the menu is within the viewport width
    const viewportSize = page.viewportSize()!;
    expect(menuBox!.x).toBeLessThan(viewportSize.width);
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/context-menu-position.png' });
  });

  test('context menu contains expected items for a mapped validation node', async ({ page }) => {
    const mapper = await openValidationMapper(page);
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();

    const mappedNode = mapper.locator('.dm-panel--target .dm-tree-node--mapped').first();
    await expect(mappedNode).toBeVisible();

    await mappedNode.click({ button: 'right' });

    const contextMenu = page.locator('.dm-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Should have key menu items
    await expect(contextMenu.locator('button:has-text("Set operator")')).toBeVisible();
    await expect(contextMenu.locator('button:has-text("Edit expression")')).toBeVisible();
    await expect(contextMenu.locator('button:has-text("Remove mapping")')).toBeVisible();
  });

  test('clicking "Set operator…" in context menu opens the operator picker', async ({ page }) => {
    const mapper = await openValidationMapper(page);
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();

    const mappedNode = mapper.locator('.dm-panel--target .dm-tree-node--mapped').first();
    await expect(mappedNode).toBeVisible();

    // Right-click to open context menu
    await mappedNode.click({ button: 'right' });
    const contextMenu = page.locator('.dm-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Click "Set operator…"
    await contextMenu.locator('button:has-text("Set operator")').click();

    // Context menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 2000 });

    // Operator picker should appear
    const operatorPicker = page.locator('.dm-operator-picker');
    await expect(operatorPicker).toBeVisible({ timeout: 3000 });

    // Picker should contain operator options
    await expect(operatorPicker.locator('[role="listbox"]')).toBeVisible();

    // Verify the picker is positioned within the mapper (not overflowing far right)
    const pickerBox = await operatorPicker.boundingBox();
    const mapperBox = await mapper.boundingBox();
    expect(pickerBox).toBeTruthy();
    expect(mapperBox).toBeTruthy();
    expect(pickerBox!.x).toBeGreaterThanOrEqual(mapperBox!.x - 20);
    expect(pickerBox!.x + pickerBox!.width).toBeLessThanOrEqual(mapperBox!.x + mapperBox!.width + 20);

    // Click an operator (e.g., "contains")
    await operatorPicker.locator('button:has-text("contains")').first().click();

    // Picker should close after selection
    await expect(operatorPicker).not.toBeVisible({ timeout: 2000 });

    // The operator pill should now show "contains"
    const pill = mappedNode.locator('.dm-operator-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('contains');
  });
});
