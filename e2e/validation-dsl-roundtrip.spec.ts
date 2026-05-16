import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  status: 'active',
  offers: [
    { associatedOfferingCode: 'ONZF', rank: 1, offerName: 'OnStar One - Trial', productCode: 'Connected Access', isActive: true, duration: { unit: 'Years', value: 8 } },
    { associatedOfferingCode: 'IHUT', rank: 3, offerName: 'IHU Connectivity', productCode: 'IHU', isActive: false, duration: { unit: 'Months', value: 6 } },
  ],
};

async function openMapper(page: Page): Promise<Locator> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('DslRT-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();
  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('DslRT-SC');
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

async function openRulesAndWait(mapper: Locator, page: Page): Promise<void> {
  await mapper.locator('button:has-text("Rules")').click();
  await expect(page.locator('.vr-modal-panel')).toBeVisible({ timeout: 5000 });
  await page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea').waitFor({
    state: 'attached', timeout: 10000,
  });
  await page.waitForTimeout(1000);
}

async function getMonacoValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editors = (window as any).monaco?.editor?.getEditors?.();
    if (!editors?.length) return 'NO_EDITORS';
    for (let i = editors.length - 1; i >= 0; i--) {
      const model = editors[i].getModel();
      if (model) return model.getValue();
    }
    return 'NO_MODEL';
  });
}

async function setMonacoValue(page: Page, text: string): Promise<void> {
  await page.evaluate((val) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editors = (window as any).monaco?.editor?.getEditors?.();
    if (!editors?.length) return;
    const ed = editors[editors.length - 1];
    const model = ed.getModel();
    if (model) {
      model.setValue(val);
    }
  }, text);
  await page.waitForTimeout(500);
}

test.describe('DSL collection assertions round-trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/__proxy', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          status: 200, statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleResponse),
        }),
      });
    });
  });

  test('type DSL with all collection assertion types → Save → reopen → verify preserved', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map first to get field assertions
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    // Open Rules panel
    await openRulesAndWait(mapper, page);

    const dslBefore = await getMonacoValue(page);
    console.log(`DSL after auto-map:\n${dslBefore}\n`);

    // Now set the DSL to include collection assertions
    const dslInput = [
      '# Field assertions',
      'offers[0].associatedOfferingCode  exists',
      'offers[0].offerName  exists',
      '',
      '# Collection assertions',
      'offers  contains_any  {"productCode": "Connected Access"}',
      'offers  length >=  1',
      'offers  length >=  3',
      'offers  subset  {"productCode": "Connected Access", "duration": {"unit": "Years"}}',
      'offers[*]  each exists',
      'offers[*].rank  each >=  0',
    ].join('\n');

    await setMonacoValue(page, dslInput);
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/dsl-rt-01-typed.png', fullPage: true });

    // Verify Monaco has the content
    const afterType = await getMonacoValue(page);
    console.log(`DSL after typing:\n${afterType}\n`);

    // Click Save
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible();

    await page.screenshot({ path: 'test-results/dsl-rt-02-after-save.png', fullPage: true });

    // Reopen Rules
    await openRulesAndWait(mapper, page);

    const dslAfterReopen = await getMonacoValue(page);
    console.log(`DSL after Save+reopen:\n${dslAfterReopen}\n`);

    await page.screenshot({ path: 'test-results/dsl-rt-03-reopened.png', fullPage: true });

    // Verify all collection assertions survived
    const lines = dslAfterReopen.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    console.log(`Non-comment lines: ${lines.length}`);
    for (const line of lines) {
      console.log(`  "${line.trim()}"`);
    }

    // Check specific assertions are present
    expect(dslAfterReopen).toContain('contains_any');
    expect(dslAfterReopen).toContain('{"productCode": "Connected Access"}');
    expect(dslAfterReopen).toContain('length >=');
    expect(dslAfterReopen).toContain('subset');
    expect(dslAfterReopen).toContain('each exists');
    expect(dslAfterReopen).toContain('each >=');
    expect(dslAfterReopen).toContain('offers[0].associatedOfferingCode');
    expect(dslAfterReopen).toContain('offers[0].offerName');

    // Count rules - should match original
    const ruleCount = lines.length;
    console.log(`Rule count after round-trip: ${ruleCount}`);
    expect(ruleCount).toBe(8); // 2 field + 6 collection

    // Do a SECOND round-trip to check stability
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(1000);
    await openRulesAndWait(mapper, page);

    const dsl3 = await getMonacoValue(page);
    console.log(`DSL after SECOND Save+reopen:\n${dsl3}\n`);

    await page.screenshot({ path: 'test-results/dsl-rt-04-second-reopen.png', fullPage: true });

    const lines3 = dsl3.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    console.log(`Rule count after 2nd round-trip: ${lines3.length}`);
    expect(lines3.length).toBe(8);
    expect(dsl3).toContain('each exists');
    expect(dsl3).toContain('each >=');
    expect(dsl3).toContain('contains_any');
    expect(dsl3).toContain('subset');
  });

  test('failed verification line is highlighted with fail decoration', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map first
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    // Open Rules
    await openRulesAndWait(mapper, page);

    // Set DSL with a rule that will FAIL (length >= 5 when only 2 items)
    const dslInput = [
      '# Field assertions',
      'offers[0].offerName  exists',
      '',
      '# Collection assertions',
      'offers  length >=  1',
      'offers  length >=  5',
    ].join('\n');

    await setMonacoValue(page, dslInput);
    await page.waitForTimeout(500);

    // Save to push to visual model
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Click "Verify All" in the toolbar to trigger verification
    await mapper.locator('button:has-text("Verify All")').click();
    await page.waitForTimeout(2000);

    // Reopen Rules to see highlighting
    await openRulesAndWait(mapper, page);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/dsl-rt-05-verify-highlight.png', fullPage: true });

    // Check that the header shows failed count
    const statsText = await page.locator('.vr-modal-header-stats').textContent();
    expect(statsText).toContain('failed');

    // Check for fail decoration class
    const failDecorations = await page.locator('.dm-verify-line--fail').count();
    expect(failDecorations).toBeGreaterThan(0);

    // Check for pass decorations
    const passDecorations = await page.locator('.dm-verify-line--pass').count();
    expect(passDecorations).toBeGreaterThan(0);
  });

  test('Ctrl+Space at path position shows path suggestions', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map to populate the model (and samplePaths)
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    // Open Rules
    await openRulesAndWait(mapper, page);
    await page.waitForTimeout(500);

    // Move to a new line and type a partial path
    const editor = page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor textarea');
    await editor.focus();

    // Go to end of document and add a new line
    await page.keyboard.press('Meta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('of');
    await page.waitForTimeout(300);

    // Trigger autocomplete with Cmd+I (Mac-friendly, Ctrl+Space conflicts with macOS)
    await page.keyboard.press('Meta+i');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/dsl-rt-07-autocomplete.png', fullPage: true });

    // Check that suggest widget is visible with suggestions
    const suggestWidget = page.locator('.editor-widget.suggest-widget.visible');
    const isVisible = await suggestWidget.isVisible().catch(() => false);
    console.log(`Suggest widget visible: ${isVisible}`);

    if (isVisible) {
      const items = await suggestWidget.locator('.monaco-list-row').count();
      console.log(`Suggestion count: ${items}`);
      expect(items).toBeGreaterThan(0);

      // Should contain path suggestions matching "of"
      const firstLabel = await suggestWidget.locator('.monaco-list-row').first().textContent();
      console.log(`First suggestion: ${firstLabel}`);
      expect(firstLabel?.toLowerCase()).toContain('offer');
    } else {
      // If not visible via class, check if there are completion items in the DOM
      const completions = await page.locator('.suggest-widget .monaco-list-row').count();
      console.log(`Completion items found: ${completions}`);
      expect(completions).toBeGreaterThan(0);
    }
  });

  test('parse error line gets red squiggle marker', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map first
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    // Open Rules
    await openRulesAndWait(mapper, page);

    // Set DSL with an invalid contains_any value
    const dslInput = [
      'offers[0].offerName  exists',
      'offers  contains_any  offerName = "bad syntax"',
    ].join('\n');

    await setMonacoValue(page, dslInput);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/dsl-rt-06-parse-error.png', fullPage: true });

    // Check that the header shows error count
    const headerStats = await page.locator('.vr-modal-header-stats').textContent();
    console.log(`Header stats with error: ${headerStats}`);
    expect(headerStats).toContain('error');

    // Check for Monaco error markers (squiggly lines)
    const errorSquiggles = await page.locator('.squiggly-error').count();
    console.log(`Error squiggle count: ${errorSquiggles}`);
    expect(errorSquiggles).toBeGreaterThan(0);

    // Check for red background decoration on error line
    const failDecorations = await page.locator('.dm-verify-line--fail').count();
    console.log(`Fail decoration count: ${failDecorations}`);
    expect(failDecorations).toBeGreaterThan(0);
  });

  test('error lines survive Save → close → reopen cycle', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map first
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    // Open Rules
    await openRulesAndWait(mapper, page);

    // Set DSL with a mix of valid and invalid lines
    const dslInput = [
      'offers[0].offerName  exists',
      'name  unknownOp  "bar"',
    ].join('\n');

    await setMonacoValue(page, dslInput);
    await page.waitForTimeout(500);

    // Verify error is shown
    const headerBefore = await page.locator('.vr-modal-header-stats').textContent();
    console.log(`Before Save: ${headerBefore}`);
    expect(headerBefore).toContain('error');

    // Click Save
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible();

    // Reopen
    await openRulesAndWait(mapper, page);
    await page.waitForTimeout(500);

    const dslAfterReopen = await getMonacoValue(page);
    console.log(`DSL after Save+reopen:\n${dslAfterReopen}`);

    await page.screenshot({ path: 'test-results/dsl-rt-08-error-preserved.png', fullPage: true });

    // The error line should still be present
    expect(dslAfterReopen).toContain('unknownOp');
    expect(dslAfterReopen).toContain('offers[0].offerName');

    // Error indicator should still show
    const headerAfter = await page.locator('.vr-modal-header-stats').textContent();
    console.log(`After reopen: ${headerAfter}`);
    expect(headerAfter).toContain('error');
  });
});
