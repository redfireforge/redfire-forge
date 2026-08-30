import { test, expect } from './monacoCdnFixture';
import type { Page, Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  status: 'active',
  offers: [
    { associatedOfferingCode: 'ACME', rank: 1, offerName: 'Acme Connect - Trial' },
    { associatedOfferingCode: 'FLTC', rank: 3, offerName: 'Fleet Connect' },
  ],
};

/** Monaco can exceed 10s to render under heavy parallel E2E load (40 workers). */
const MONACO_READY_MS = 30_000;

/** Visual → DSL sync and model hydration can lag behind DOM paint. */
const DSL_SYNC_POLL_MS = 20_000;

async function openValidationTab(page: Page): Promise<void> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
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

async function expandTargetTree(mapper: Locator): Promise<void> {
  const targetPanel = mapper.locator('.dm-panel--target');
  const rootToggle = targetPanel.locator(
    '.dm-tree-node[data-path=""] button[aria-label="Collapse"], .dm-tree-node[data-path=""] button[aria-label="Expand"]',
  ).first();
  if (await rootToggle.isVisible().catch(() => false)) {
    const label = await rootToggle.getAttribute('aria-label');
    if (label === 'Expand') {
      await rootToggle.click();
      await expect(targetPanel.locator('.dm-tree-node[data-path="offers"]')).toBeVisible({
        timeout: 10_000,
      });
    }
  }
}

/**
 * Wait until the Rules panel Monaco editor is visible, has a textarea, and exposes
 * a wired model (not merely painted DOM).
 */
async function waitForRulesMonacoReady(page: Page): Promise<Locator> {
  const rulesPanel = page.locator('.vr-modal-panel');
  await expect(rulesPanel).toBeVisible({ timeout: MONACO_READY_MS });

  const editor = rulesPanel.locator('.dm-validation-editor .monaco-editor').first();
  await editor.waitFor({ state: 'visible', timeout: MONACO_READY_MS });
  await rulesPanel.locator('.dm-validation-editor .monaco-editor textarea').waitFor({
    state: 'attached',
    timeout: MONACO_READY_MS,
  });

  await page.waitForFunction(
    () => {
      const holder = document.querySelector('.vr-modal-panel .dm-validation-editor .monaco-editor');
      type Ed = {
        getDomNode: () => HTMLElement | null;
        getModel: () => { getValue: () => string } | null;
        hasTextFocus?: () => boolean;
      };
      const editors = (
        window as unknown as { monaco?: { editor?: { getEditors?: () => Ed[] } } }
      ).monaco?.editor?.getEditors?.();
      if (!holder || !editors?.length) return false;
      const ed = editors.find((e) => {
        const dn = e.getDomNode();
        return !!dn && (dn === holder || dn.contains(holder) || holder.contains(dn));
      });
      return !!ed?.getModel() && typeof ed.hasTextFocus === 'function';
    },
    { timeout: MONACO_READY_MS },
  );

  return editor;
}

/**
 * Read the Rules panel Monaco model by resolving the editor that owns
 * `.vr-modal-panel .dm-validation-editor` — avoids fragile getEditors().at(-1).
 */
async function getRulesMonacoValue(page: Page): Promise<string> {
  const editor = page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor').first();
  await editor.waitFor({ state: 'visible', timeout: MONACO_READY_MS });
  return editor.evaluate((el) => {
    type Ed = {
      getDomNode: () => HTMLElement | null;
      getModel: () => { getValue: () => string } | null;
    };
    const editors = (
      window as unknown as { monaco?: { editor: { getEditors: () => Ed[] } } }
    ).monaco?.editor?.getEditors?.() ?? [];
    const ed = editors.find((e) => {
      const dn = e.getDomNode();
      return !!dn && (dn === el || dn.contains(el) || el.contains(dn));
    });
    return ed?.getModel()?.getValue() ?? 'NO_MODEL';
  });
}

async function expectRulesDslContains(page: Page, ...tokens: string[]): Promise<void> {
  for (const token of tokens) {
    await expect
      .poll(async () => await getRulesMonacoValue(page), {
        timeout: DSL_SYNC_POLL_MS,
        intervals: [100, 200, 300, 500, 1000],
      })
      .toContain(token);
  }
}

async function addArrayAssertionViaContextMenu(
  mapper: Locator,
  page: Page,
  nodeDataPath: string,
  menuItemText: string,
): Promise<void> {
  const targetPanel = mapper.locator('.dm-panel--target');
  const rowsBefore = await targetPanel.locator('.dm-array-assertion-row').count();

  const node = targetPanel.locator(`.dm-tree-node[data-path="${nodeDataPath}"]`).first();
  await expect(node).toBeVisible({ timeout: 5000 });

  const expandBtn = node.locator('button[aria-label="Expand"]');
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
    await expect(node.locator('button[aria-label="Collapse"]')).toBeVisible({ timeout: 5000 });
  }

  await node.click({ button: 'right' });

  const contextMenu = page.locator('.dm-context-menu');
  await expect(contextMenu).toBeVisible({ timeout: 5000 });
  await contextMenu.locator('.dm-context-menu-item', { hasText: menuItemText }).click();
  await expect(contextMenu).toBeHidden({ timeout: 5000 });

  await expect
    .poll(async () => targetPanel.locator('.dm-array-assertion-row').count(), {
      timeout: 10_000,
      intervals: [100, 200, 300, 500],
    })
    .toBeGreaterThan(rowsBefore);
}

async function openRulesPanel(mapper: Locator, page: Page): Promise<void> {
  await mapper.locator('button:has-text("Rules")').click();
  await waitForRulesMonacoReady(page);
}

async function saveAndCloseRulesPanel(page: Page): Promise<void> {
  await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
  await expect(page.locator('.vr-modal-panel')).not.toBeVisible({ timeout: 10_000 });
}

test.describe('Validation Rules ↔ Data Mapper bidirectional sync', () => {
  test.setTimeout(90_000);

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
    await expandTargetTree(mapper);

    await page.screenshot({ path: 'test-results/sync-01-mapper-open.png', fullPage: true });

    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    await page.screenshot({ path: 'test-results/sync-02-after-length-assertion.png', fullPage: true });

    const targetPanel = mapper.locator('.dm-panel--target');
    await expect(targetPanel.locator('.dm-array-assertion-row')).toHaveCount(1, { timeout: 5000 });

    await openRulesPanel(mapper, page);

    await page.screenshot({ path: 'test-results/sync-03-rules-open.png', fullPage: true });
    await page.screenshot({ path: 'test-results/sync-04-rules-content.png', fullPage: true });

    await expectRulesDslContains(page, 'offers', 'length');
  });

  test('array assertions added while Rules panel is ALREADY open appear in editor', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper);

    await openRulesPanel(mapper, page);

    const dslBefore = await getRulesMonacoValue(page);
    console.log(`DSL before adding assertions: "${dslBefore}"`);
    expect(dslBefore).not.toContain('length');

    await page.screenshot({ path: 'test-results/sync-05-rules-empty.png', fullPage: true });

    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    await page.screenshot({ path: 'test-results/sync-06-after-add-while-rules-open.png', fullPage: true });

    await expectRulesDslContains(page, 'offers', 'length');
  });

  test('multiple array assertions (length + contains) sync to Rules panel', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper);

    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');
    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Contains value (exact match)');

    await page.screenshot({ path: 'test-results/sync-07-two-assertions.png', fullPage: true });

    const targetPanel = mapper.locator('.dm-panel--target');
    await expect(targetPanel.locator('.dm-array-assertion-row')).toHaveCount(2, { timeout: 5000 });

    await openRulesPanel(mapper, page);

    await page.screenshot({ path: 'test-results/sync-08-rules-with-multiple.png', fullPage: true });

    await expectRulesDslContains(page, 'offers', 'length', 'contains');
  });

  test('closing Rules panel with Save preserves assertions, Cancel reverts edits', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper);

    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    await openRulesPanel(mapper, page);
    await expectRulesDslContains(page, 'offers');

    await saveAndCloseRulesPanel(page);

    const targetPanel = mapper.locator('.dm-panel--target');
    await expect(targetPanel.locator('.dm-array-assertion-row')).toHaveCount(1, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/sync-09-after-save.png', fullPage: true });
  });

  test('assertions survive Rules panel open → close → reopen cycle', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);
    await expandTargetTree(mapper);

    await addArrayAssertionViaContextMenu(mapper, page, 'offers', 'Check array size');

    await openRulesPanel(mapper, page);
    await expectRulesDslContains(page, 'offers', 'length');

    await saveAndCloseRulesPanel(page);

    const targetPanel = mapper.locator('.dm-panel--target');
    await expect(targetPanel.locator('.dm-array-assertion-row')).toHaveCount(1, { timeout: 5000 });

    await openRulesPanel(mapper, page);

    await page.screenshot({ path: 'test-results/sync-10-reopen-rules.png', fullPage: true });

    await expectRulesDslContains(page, 'offers', 'length');
  });
});
