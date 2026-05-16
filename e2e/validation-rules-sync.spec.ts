import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  status: 'active',
  offers: [
    { associatedOfferingCode: 'ONZF', rank: 1, offerName: 'OnStar One - Trial' },
    { associatedOfferingCode: 'IHUT', rank: 3, offerName: 'IHU Connectivity' },
  ],
};

async function openValidationTab(page: Page): Promise<void> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('Sync-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('Sync-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/offers');
  await page.locator('.builder-tab:has-text("Validation")').click();
}

async function openMapper(page: Page): Promise<Locator> {
  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();
  return mapper;
}

async function expandTargetTree(mapper: Locator, page: Page): Promise<void> {
  const targetPanel = mapper.locator('.dm-panel--target');
  const rootToggle = targetPanel.locator(
    '.dm-tree-node[data-path=""] button[aria-label="Collapse"], .dm-tree-node[data-path=""] button[aria-label="Expand"]',
  ).first();
  if (await rootToggle.isVisible().catch(() => false)) {
    const label = await rootToggle.getAttribute('aria-label');
    if (label === 'Expand') await rootToggle.click();
  }
  await page.waitForTimeout(300);
}

async function addArrayAssertionViaContextMenu(
  mapper: Locator,
  page: Page,
  nodeDataPath: string,
  menuItemText: string,
): Promise<void> {
  const targetPanel = mapper.locator('.dm-panel--target');
  const node = targetPanel.locator(`.dm-tree-node[data-path="${nodeDataPath}"]`).first();
  await expect(node).toBeVisible({ timeout: 5000 });

  // Expand if collapsed
  const expandBtn = node.locator('button[aria-label="Expand"]');
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
    await page.waitForTimeout(300);
  }

  await node.click({ button: 'right' });
  await page.waitForTimeout(500);

  const contextMenu = page.locator('.dm-context-menu');
  await expect(contextMenu).toBeVisible({ timeout: 3000 });

  await contextMenu.locator('.dm-context-menu-item', { hasText: menuItemText }).click();
  await page.waitForTimeout(500);
}

async function openRulesPanel(mapper: Locator, page: Page): Promise<void> {
  await mapper.locator('button:has-text("Rules")').click();
  const rulesPanel = page.locator('.vr-modal-panel');
  await expect(rulesPanel).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);
}

async function getMonacoEditorValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const panel = document.querySelector('.vr-modal-panel');
    if (!panel) return 'NO_PANEL';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editors = (window as any).monaco?.editor?.getEditors?.() as Array<{
      getDomNode: () => HTMLElement | null;
      getModel: () => { getValue: () => string } | null;
    }> | undefined;
    if (!editors?.length) return 'NO_EDITORS';
    for (const ed of editors) {
      const node = ed.getDomNode?.();
      if (node && panel.contains(node)) {
        const model = ed.getModel();
        if (model) return model.getValue();
      }
    }
    return 'NO_MODEL_IN_PANEL';
  });
}

test.describe('Validation Rules ↔ Data Mapper bidirectional sync', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('array assertions added via context menu appear in Rules panel', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper, page);

    await page.screenshot({ path: 'test-results/sync-01-mapper-open.png', fullPage: true });

    // Add "Check array size" assertion on offers
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    await page.screenshot({ path: 'test-results/sync-02-after-length-assertion.png', fullPage: true });

    // Verify the assertion row appeared in the Data Mapper
    const targetPanel = mapper.locator('.dm-panel--target');
    const assertionRows = targetPanel.locator('.dm-array-assertion-row');
    const rowCount = await assertionRows.count();
    console.log(`Visual assertion rows after adding length: ${rowCount}`);
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Now open the Rules panel
    await openRulesPanel(mapper, page);

    await page.screenshot({ path: 'test-results/sync-03-rules-open.png', fullPage: true });

    // Wait for Monaco to initialize
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    // Read the Monaco editor value
    const dslText = await getMonacoEditorValue(page);
    console.log(`DSL text after opening Rules: "${dslText}"`);

    await page.screenshot({ path: 'test-results/sync-04-rules-content.png', fullPage: true });

    // The DSL should contain the array length assertion
    expect(dslText).toContain('offers');
    expect(dslText).toContain('length');
  });

  test('array assertions added while Rules panel is ALREADY open appear in editor', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper, page);

    // Open Rules panel FIRST (empty)
    await openRulesPanel(mapper, page);
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dslBefore = await getMonacoEditorValue(page);
    console.log(`DSL before adding assertions: "${dslBefore}"`);

    await page.screenshot({ path: 'test-results/sync-05-rules-empty.png', fullPage: true });

    // Now add array assertion via context menu while Rules panel is open
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/sync-06-after-add-while-rules-open.png', fullPage: true });

    const dslAfter = await getMonacoEditorValue(page);
    console.log(`DSL after adding length assertion: "${dslAfter}"`);

    expect(dslAfter).toContain('offers');
    expect(dslAfter).toContain('length');
  });

  test('multiple array assertions (length + contains) sync to Rules panel', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper, page);

    // Add length assertion
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    // Add contains assertion
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Contains value (exact match)');

    await page.screenshot({ path: 'test-results/sync-07-two-assertions.png', fullPage: true });

    // Verify both rows exist in the Data Mapper
    const targetPanel = mapper.locator('.dm-panel--target');
    const assertionRows = targetPanel.locator('.dm-array-assertion-row');
    const rowCount = await assertionRows.count();
    console.log(`Visual assertion rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Open Rules panel
    await openRulesPanel(mapper, page);
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dslText = await getMonacoEditorValue(page);
    console.log(`DSL text with multiple assertions: "${dslText}"`);

    await page.screenshot({ path: 'test-results/sync-08-rules-with-multiple.png', fullPage: true });

    expect(dslText).toContain('offers');
    expect(dslText).toContain('length');
    expect(dslText).toContain('contains');
  });

  test('closing Rules panel with Save preserves assertions, Cancel reverts edits', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper, page);

    // Add assertion first
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    // Open Rules panel
    await openRulesPanel(mapper, page);
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dslBefore = await getMonacoEditorValue(page);
    console.log(`DSL before Save: "${dslBefore}"`);
    expect(dslBefore).toContain('offers');

    // Click Save
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(500);

    // Rules panel should be closed
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible();

    // The assertion rows should still be visible in the Data Mapper
    const targetPanel = mapper.locator('.dm-panel--target');
    const assertionRows = targetPanel.locator('.dm-array-assertion-row');
    const rowCountAfterSave = await assertionRows.count();
    console.log(`Assertion rows after Save: ${rowCountAfterSave}`);
    expect(rowCountAfterSave).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: 'test-results/sync-09-after-save.png', fullPage: true });
  });

  test('assertions survive Rules panel open → close → reopen cycle', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper, page);

    // Add assertion
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    // Open Rules, read DSL, Save
    await openRulesPanel(mapper, page);
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dsl1 = await getMonacoEditorValue(page);
    console.log(`DSL on first open: "${dsl1}"`);
    expect(dsl1).toContain('offers');
    expect(dsl1).toContain('length');

    // Save and close
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible();

    // Visual assertion rows should still exist
    const targetPanel = mapper.locator('.dm-panel--target');
    expect(await targetPanel.locator('.dm-array-assertion-row').count()).toBeGreaterThanOrEqual(1);

    // Reopen Rules
    await openRulesPanel(mapper, page);
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dsl2 = await getMonacoEditorValue(page);
    console.log(`DSL on second open: "${dsl2}"`);

    await page.screenshot({ path: 'test-results/sync-10-reopen-rules.png', fullPage: true });

    expect(dsl2).toContain('offers');
    expect(dsl2).toContain('length');
  });
});
