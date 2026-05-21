import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  status: 'active',
  offers: [
    { associatedOfferingCode: 'ONZF', rank: 1, offerName: 'OnStar One - Trial' },
    { associatedOfferingCode: 'IHUT', rank: 3, offerName: 'IHU Connectivity' },
  ],
};

async function openMapper(page: Page): Promise<Locator> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('OpRound-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('OpRound-SC');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/offers');
  await page.locator('.builder-tab:has-text("Validation")').click();

  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();
  return mapper;
}

async function getMonacoValue(page: Page): Promise<string> {
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

test.describe('Operator round-trip: equals must NOT become exists', () => {
  test.setTimeout(60_000);

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

  test('auto-map → open Rules → DSL shows "equals" not "exists"', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    // Check operator pills on mapped nodes — should be "equals" not "exists"
    const targetPanel = mapper.locator('.dm-panel--target');
    const opPills = targetPanel.locator('.dm-operator-pill');
    const pillCount = await opPills.count();
    console.log(`Operator pills found: ${pillCount}`);

    const pillTexts: string[] = [];
    for (let i = 0; i < pillCount; i++) {
      const text = await opPills.nth(i).innerText();
      pillTexts.push(text.trim());
    }
    console.log(`Pill texts: ${JSON.stringify(pillTexts)}`);

    await page.screenshot({ path: 'test-results/op-roundtrip-01-after-automap.png', fullPage: true });

    // Open Rules panel
    await mapper.locator('button:has-text("Rules")').click();
    const rulesPanel = page.locator('.vr-modal-panel');
    await expect(rulesPanel).toBeVisible({ timeout: 10000 });
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dsl1 = await getMonacoValue(page);
    console.log(`DSL after auto-map + open Rules:\n${dsl1}`);

    await page.screenshot({ path: 'test-results/op-roundtrip-02-rules-first-open.png', fullPage: true });

    // Check that DSL contains "equals" not "exists" for the auto-mapped fields
    // (existence operators like "exists" should NOT appear for value-matched fields)
    const lines = dsl1.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    for (const line of lines) {
      console.log(`  Rule line: "${line.trim()}"`);
      // Each auto-mapped field should be "equals" (with value), not "exists" (no value)
      if (line.includes('offers[') || line.includes('status')) {
        expect(line).not.toContain('exists');
        expect(line).toContain('equals');
      }
    }

    // Save and close Rules
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(500);
    await expect(rulesPanel).not.toBeVisible();

    // Reopen Rules
    await mapper.locator('button:has-text("Rules")').click();
    await expect(page.locator('.vr-modal-panel')).toBeVisible({ timeout: 10000 });
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dsl2 = await getMonacoValue(page);
    console.log(`DSL after Save + reopen:\n${dsl2}`);

    await page.screenshot({ path: 'test-results/op-roundtrip-03-rules-second-open.png', fullPage: true });

    // After round-trip, should still be "equals" not "exists"
    const lines2 = dsl2.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    for (const line of lines2) {
      if (line.includes('offers[') || line.includes('status')) {
        expect(line).not.toContain('exists');
        expect(line).toContain('equals');
      }
    }

    // Do one more round trip
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(500);

    await mapper.locator('button:has-text("Rules")').click();
    await expect(page.locator('.vr-modal-panel')).toBeVisible({ timeout: 10000 });
    await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
      state: 'attached',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dsl3 = await getMonacoValue(page);
    console.log(`DSL after second Save + reopen:\n${dsl3}`);

    await page.screenshot({ path: 'test-results/op-roundtrip-04-rules-third-open.png', fullPage: true });

    const lines3 = dsl3.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    for (const line of lines3) {
      if (line.includes('offers[') || line.includes('status')) {
        expect(line).not.toContain('exists');
        expect(line).toContain('equals');
      }
    }
  });
});
