import { test, expect } from './monacoCdnFixture';
import type { Page, Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  status: 'active',
  offers: [
    { associatedOfferingCode: 'ONZF', rank: 1, offerName: 'OnStar One - Trial', productCode: 'Connected Access', isActive: true, duration: { unit: 'Years', value: 8 } },
    { associatedOfferingCode: 'IHUT', rank: 3, offerName: 'IHU Connectivity', productCode: 'IHU', isActive: false, duration: { unit: 'Months', value: 6 } },
  ],
};

/** Monaco can exceed 10s to render under heavy parallel E2E load (40 workers). */
const MONACO_READY_MS = 30_000;

/** Visual → DSL sync, parse debounce (300ms), and decoration paint can lag DOM. */
const DSL_SYNC_POLL_MS = 20_000;

function endOfDocumentShortcut(): 'Meta+End' | 'Control+End' {
  return process.platform === 'darwin' ? 'Meta+End' : 'Control+End';
}

/** ValidationCodeEditor binds triggerSuggest to CtrlCmd+I (Cmd+I on macOS, Ctrl+I elsewhere). */
function triggerSuggestShortcut(): 'Meta+i' | 'Control+i' {
  return process.platform === 'darwin' ? 'Meta+i' : 'Control+i';
}

async function openMapper(page: Page): Promise<Locator> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
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

function validationMonacoEditor(page: Page): Locator {
  return page.locator('.vr-modal-panel .dm-validation-editor .monaco-editor').first();
}

/**
 * Wait until the Rules panel Monaco editor is visible, has a textarea, and exposes
 * a wired model (not merely painted DOM).
 */
async function waitForValidationMonacoReady(page: Page): Promise<Locator> {
  const rulesPanel = page.locator('.vr-modal-panel');
  await expect(rulesPanel).toBeVisible({ timeout: MONACO_READY_MS });

  const editor = validationMonacoEditor(page);
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
        return !!dn && (dn === holder || dn.contains(holder));
      });
      return !!ed?.getModel() && typeof ed.hasTextFocus === 'function';
    },
    { timeout: MONACO_READY_MS },
  );

  return editor;
}

async function openRulesAndWait(mapper: Locator, page: Page): Promise<Locator> {
  await mapper.locator('button:has-text("Rules")').click();
  return waitForValidationMonacoReady(page);
}

/**
 * Read the Rules panel Monaco model by resolving the editor that owns
 * `.vr-modal-panel .dm-validation-editor` — avoids fragile getEditors().at(-1).
 */
async function getValidationMonacoValue(page: Page): Promise<string> {
  const editor = validationMonacoEditor(page);
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
      return !!dn && (dn === el || dn.contains(el));
    });
    return ed?.getModel()?.getValue() ?? 'NO_MODEL';
  });
}

async function setValidationMonacoValue(page: Page, text: string): Promise<void> {
  const editor = await waitForValidationMonacoReady(page);
  await editor.evaluate((el, val) => {
    type Ed = {
      getDomNode: () => HTMLElement | null;
      getModel: () => { setValue: (v: string) => void } | null;
    };
    const editors = (
      window as unknown as { monaco?: { editor: { getEditors: () => Ed[] } } }
    ).monaco?.editor?.getEditors?.() ?? [];
    const ed = editors.find((e) => {
      const dn = e.getDomNode();
      return !!dn && (dn === el || dn.contains(el));
    });
    ed?.getModel()?.setValue(val);
  }, text);

  await expect
    .poll(async () => await getValidationMonacoValue(page), {
      timeout: DSL_SYNC_POLL_MS,
      intervals: [50, 100, 200, 300, 500],
    })
    .toBe(text);
}

async function expectHeaderStatsContains(page: Page, token: string): Promise<void> {
  await expect
    .poll(async () => (await page.locator('.vr-modal-header-stats').textContent()) ?? '', {
      timeout: DSL_SYNC_POLL_MS,
      intervals: [100, 200, 300, 500, 1000],
    })
    .toContain(token);
}

/**
 * Focus the validation Monaco editor before keyboard input. Under parallel load,
 * textarea.focus() can run before Monaco's key handlers are wired.
 */
async function focusValidationEditor(page: Page): Promise<void> {
  await waitForValidationMonacoReady(page);
  const editorArea = page.locator(
    '.vr-modal-panel .dm-validation-editor .monaco-editor .overflow-guard',
  );
  await editorArea.click({ position: { x: 50, y: 30 } });
  await page
    .waitForFunction(
      () => {
        const holder = document.querySelector('.vr-modal-panel .dm-validation-editor .monaco-editor');
        type Ed = { getDomNode: () => HTMLElement | null; hasTextFocus?: () => boolean };
        const editors = (
          window as unknown as { monaco?: { editor?: { getEditors?: () => Ed[] } } }
        ).monaco?.editor?.getEditors?.();
        const ed = editors?.find((e) => {
          const dn = e.getDomNode();
          return !!dn && (dn === holder || dn.contains(holder));
        });
        return !!ed?.hasTextFocus?.();
      },
      { timeout: 5000 },
    )
    .catch(() => {
      // hasTextFocus may stay false in headless; keyboard input still works after click.
    });
}

async function pollSuggestLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const widget = document.querySelector(
      '.vr-modal-panel .dm-validation-editor .editor-widget.suggest-widget',
    ) as HTMLElement | null;
    if (!widget) return [] as string[];
    const style = getComputedStyle(widget);
    const visible =
      widget.classList.contains('visible') &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      widget.clientHeight > 0;
    if (!visible) return [] as string[];
    return Array.from(widget.querySelectorAll('.monaco-list-row .label-name'))
      .map((el) => (el.textContent ?? '').trim())
      .filter(Boolean);
  });
}

async function expectPathSuggestOffers(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const labels = await pollSuggestLabels(page);
        console.log(`Suggestion labels: ${labels.join(', ')}`);
        return labels.length > 0 && labels.some((l) => l.toLowerCase().includes('offer'));
      },
      { timeout: 10_000, intervals: [100, 200, 300, 500, 1000] },
    )
    .toBe(true);
}

test.describe('DSL collection assertions round-trip', () => {
  test.setTimeout(60_000);

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

    const dslBefore = await getValidationMonacoValue(page);
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

    await setValidationMonacoValue(page, dslInput);

    // Verify Monaco has the content
    const afterType = await getValidationMonacoValue(page);
    console.log(`DSL after typing:\n${afterType}\n`);

    // Click Save
    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible({ timeout: 10_000 });

    // Reopen Rules
    await openRulesAndWait(mapper, page);

    const dslAfterReopen = await getValidationMonacoValue(page);
    console.log(`DSL after Save+reopen:\n${dslAfterReopen}\n`);

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
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible({ timeout: 10_000 });
    await openRulesAndWait(mapper, page);

    const dsl3 = await getValidationMonacoValue(page);
    console.log(`DSL after SECOND Save+reopen:\n${dsl3}\n`);

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

    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(300);

    await openRulesAndWait(mapper, page);

    const dslInput = [
      '# Field assertions',
      'offers[0].offerName  exists',
      '',
      '# Collection assertions',
      'offers  length >=  1',
      'offers  length >=  5',
    ].join('\n');

    await setValidationMonacoValue(page, dslInput);

    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible({ timeout: 5000 });

    await mapper.locator('button:has-text("Verify All")').click();

    await openRulesAndWait(mapper, page);
    await expectHeaderStatsContains(page, 'failed');

    await page.screenshot({ path: 'test-results/dsl-rt-05-verify-highlight.png', fullPage: true });

    await expect
      .poll(async () => page.locator('.dm-verify-line--fail').count(), {
        timeout: DSL_SYNC_POLL_MS,
        intervals: [200, 300, 500, 1000],
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => page.locator('.dm-verify-line--pass').count(), {
        timeout: DSL_SYNC_POLL_MS,
        intervals: [200, 300, 500, 1000],
      })
      .toBeGreaterThan(0);
  });

  test('Ctrl+Space at path position shows path suggestions', async ({ page }) => {
    const mapper = await openMapper(page);

    // Auto-map to populate the model (and samplePaths)
    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await expect
      .poll(async () => mapper.locator('.dm-connection-line').count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    await openRulesAndWait(mapper, page);
    await focusValidationEditor(page);

    await page.keyboard.press(endOfDocumentShortcut());
    await page.keyboard.press('Enter');
    await page.keyboard.type('of', { delay: 50 });

    await expect
      .poll(async () => await getValidationMonacoValue(page), { timeout: 5000 })
      .toContain('of');

    await page.keyboard.press(triggerSuggestShortcut());

    await page.screenshot({ path: 'test-results/dsl-rt-07-autocomplete.png', fullPage: true });

    await expectPathSuggestOffers(page);
  });

  test('parse error line gets red squiggle marker', async ({ page }) => {
    const mapper = await openMapper(page);

    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    await openRulesAndWait(mapper, page);

    const dslInput = [
      'offers[0].offerName  exists',
      'offers  contains_any  offerName = "bad syntax"',
    ].join('\n');

    await setValidationMonacoValue(page, dslInput);

    await page.screenshot({ path: 'test-results/dsl-rt-06-parse-error.png', fullPage: true });

    const headerStats = await page.locator('.vr-modal-header-stats').textContent();
    console.log(`Header stats with error: ${headerStats}`);
    await expectHeaderStatsContains(page, 'error');

    await expect
      .poll(async () => page.locator('.squiggly-error').count(), {
        timeout: DSL_SYNC_POLL_MS,
        intervals: [100, 200, 300, 500, 1000],
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => page.locator('.dm-verify-line--fail').count(), {
        timeout: DSL_SYNC_POLL_MS,
        intervals: [100, 200, 300, 500, 1000],
      })
      .toBeGreaterThan(0);
  });

  test('error lines survive Save → close → reopen cycle', async ({ page }) => {
    const mapper = await openMapper(page);

    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(500);

    await openRulesAndWait(mapper, page);

    const dslInput = [
      'offers[0].offerName  exists',
      'name  unknownOp  "bar"',
    ].join('\n');

    await setValidationMonacoValue(page, dslInput);

    const headerBefore = await page.locator('.vr-modal-header-stats').textContent();
    console.log(`Before Save: ${headerBefore}`);
    await expectHeaderStatsContains(page, 'error');

    await page.locator('.vr-modal-panel .vr-modal-btn--primary', { hasText: 'Save' }).click();
    await expect(page.locator('.vr-modal-panel')).not.toBeVisible({ timeout: 10_000 });

    await openRulesAndWait(mapper, page);

    await expect
      .poll(async () => await getValidationMonacoValue(page), {
        timeout: DSL_SYNC_POLL_MS,
        intervals: [100, 200, 300, 500, 1000],
      })
      .toContain('unknownOp');

    const dslAfterReopen = await getValidationMonacoValue(page);
    console.log(`DSL after Save+reopen:\n${dslAfterReopen}`);

    await page.screenshot({ path: 'test-results/dsl-rt-08-error-preserved.png', fullPage: true });

    expect(dslAfterReopen).toContain('unknownOp');
    expect(dslAfterReopen).toContain('offers[0].offerName');

    const headerAfter = await page.locator('.vr-modal-header-stats').textContent();
    console.log(`After reopen: ${headerAfter}`);
    await expectHeaderStatsContains(page, 'error');
  });
});
