import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  offers: [
    { associatedOfferingCode: 'ONZF', rank: 1, offerName: 'OnStar One - Trial' },
    { associatedOfferingCode: 'IHUT', rank: 3, offerName: 'IHU Connectivity' },
  ],
  status: 'active',
};

async function openMapperWithRulesTab(page: Page): Promise<Locator> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('RulesEditor-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('RulesEditor-Scenario');
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

  await mapper.locator('button:has-text("Rules")').click();
  await expect(mapper.locator('.dm-validation-editor')).toBeVisible();
  await mapper.locator('.dm-validation-editor .monaco-editor').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1500);

  return mapper;
}

async function focusAndClear(page: Page, mapper: Locator) {
  const editorArea = mapper.locator('.dm-validation-editor .monaco-editor .overflow-guard');
  await editorArea.click({ position: { x: 50, y: 30 } });
  await page.waitForTimeout(200);
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
}

test.describe('Validation Rules Editor — typing & autocomplete', () => {
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

  test('typing a simple path + operator populates the editor and does not close the modal', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    // Type "status exists" character by character
    await page.keyboard.type('status exists', { delay: 50 });
    await page.waitForTimeout(500);

    // The mapper modal should still be open
    await expect(mapper).toBeVisible();

    // The editor should contain visible text (view-lines rendered)
    const editorBody = mapper.locator('.dm-validation-editor-body');
    await expect(editorBody).toBeVisible();

    // Check that the editor header shows "1 rule" (meaning the DSL was parsed)
    await expect(mapper.locator('.vr-modal-stat').first()).toContainText('1 rule');
  });

  test('typing a path with dots and brackets does not interfere with typing', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.keyboard.type('offers[0].rank equals 1', { delay: 50 });
    await page.waitForTimeout(500);

    await expect(mapper).toBeVisible();
    await expect(mapper.locator('.vr-modal-stat').first()).toContainText('1 rule');
  });

  test('pressing space after a path does not block further typing', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    // Type the path
    await page.keyboard.type('offers', { delay: 50 });
    await page.waitForTimeout(300);

    // Press space
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Type the operator
    await page.keyboard.type('length', { delay: 50 });
    await page.waitForTimeout(200);

    await page.keyboard.press('Space');
    await page.keyboard.type('>', { delay: 0 });
    await page.keyboard.press('Space');
    await page.keyboard.type('1', { delay: 0 });
    await page.waitForTimeout(500);

    await expect(mapper).toBeVisible();
    await expect(mapper.locator('.vr-modal-stat').first()).toContainText('1 rule');
  });

  test('Escape dismisses autocomplete but does not close the mapper', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    // Type a partial path to trigger autocomplete
    await page.keyboard.type('stat', { delay: 50 });
    await page.waitForTimeout(600);

    // Check if suggest widget appeared
    const suggestVisible = mapper.locator('.editor-widget.suggest-widget.visible');
    const hadAutocomplete = await suggestVisible.count() > 0;

    // Press Escape — should dismiss autocomplete without closing the mapper overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // The mapper overlay should still be visible
    await expect(mapper).toBeVisible();

    // If autocomplete was visible, it should now be dismissed
    if (hadAutocomplete) {
      await expect(suggestVisible).toHaveCount(0);
    }
  });

  test('typing offers + Escape + space + length works correctly via model API', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.keyboard.type('offers', { delay: 80 });
    await page.waitForTimeout(500);

    // Dismiss autocomplete if present
    const suggestAfterOffers = mapper.locator('.suggest-widget.visible');
    if (await suggestAfterOffers.count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Dismiss operator autocomplete if present
    const suggestAfterSpace = mapper.locator('.suggest-widget.visible');
    if (await suggestAfterSpace.count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    await page.keyboard.type('length', { delay: 80 });
    await page.waitForTimeout(500);

    const modelValue = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return 'NO_EDITORS';
      const model = editors[editors.length - 1].getModel();
      return model ? model.getValue() : 'NO_MODEL';
    });

    expect(modelValue.trim()).toBe('offers length');
  });

  test('exact path "offers" shows NO path suggestions and allows space', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.keyboard.type('offers', { delay: 80 });
    await page.waitForTimeout(700);

    // Path suggestions should NOT auto-appear (no `offers.*` listed). Even if
    // Monaco's widget DOM is present, it must contain no path items.
    const pathListItems = await page.evaluate(() => {
      const widget = document.querySelector(
        '.dm-validation-editor .editor-widget.suggest-widget',
      ) as HTMLElement | null;
      if (!widget) return [];
      const style = getComputedStyle(widget);
      if (style.display === 'none' || style.visibility === 'hidden' || widget.clientHeight === 0) {
        return [];
      }
      return Array.from(widget.querySelectorAll('.monaco-list-row .label-name'))
        .map((el) => (el.textContent ?? '').trim());
    });
    // No path suggestions like 'offers[0]', 'offers[0].rank', etc. should appear.
    const pathHits = pathListItems.filter((l) => l.startsWith('offers'));
    expect(pathHits).toEqual([]);

    await page.keyboard.press('Space');
    await page.keyboard.type('length', { delay: 80 });
    await page.waitForTimeout(500);

    const modelValue = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return 'NO_EDITORS';
      const model = editors[editors.length - 1].getModel();
      return model ? model.getValue() : 'NO_MODEL';
    });
    expect(modelValue.trim()).toBe('offers length');
  });

  test('typing offers then space then length WITHOUT Escape — no suggest interference', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    // Type "offers" — suggest widget may appear
    await page.keyboard.type('offers', { delay: 80 });
    await page.waitForTimeout(500);

    // Press space WITHOUT dismissing suggest first — this is the user's exact workflow
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Type "length" immediately
    await page.keyboard.type('length', { delay: 80 });
    await page.waitForTimeout(500);

    const modelValue = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return 'NO_EDITORS';
      const model = editors[editors.length - 1].getModel();
      return model ? model.getValue() : 'NO_MODEL';
    });

    // The key assertion: model should contain "offers length", NOT
    // "offers[0].associatedOfferingCode" or "offers." or anything else
    expect(modelValue.trim()).toBe('offers length');
  });

  test('no `beforeinput` listener is installed on the Monaco textarea', async ({ page }) => {
    // We removed the `beforeinput` handler entirely: across HMR cycles, stale
    // listeners can accumulate and swallow legitimate keystrokes (the Space-
    // eating bug). Substitution defense lives solely at the model layer.
    // This test confirms NO `beforeinput` event is prevented by our code.
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.waitForFunction(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      return ta?.getAttribute('autocorrect') === 'off';
    }, { timeout: 5000 });

    const results = await page.evaluate(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      if (!ta) return null;
      const fire = (inputType: string, data: string) => {
        const ev = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType, data });
        ta.dispatchEvent(ev);
        return ev.defaultPrevented;
      };
      return {
        plainSpace: fire('insertText', ' '),
        plainLetter: fire('insertText', 'a'),
        wordCommit: fire('insertReplacementText', 'offers '),
        smartPeriodData: fire('insertReplacementText', '. '),
      };
    });
    expect(results).not.toBeNull();
    // None of these should be prevented anymore. Defense is at the model layer.
    expect(results?.plainSpace).toBe(false);
    expect(results?.plainLetter).toBe(false);
    expect(results?.wordCommit).toBe(false);
    expect(results?.smartPeriodData).toBe(false);
  });

  test('macOS smart-period at the model layer is REVERTED to a single space', async ({ page }) => {
    // This simulates the case where macOS substitutes ` ` + ` ` → `. ` via the
    // IME / composition pipeline, bypassing `beforeinput`. We directly invoke
    // a Monaco edit that inserts `. ` (the exact signature) and verify the
    // model-layer guard reverts it back to a single space.
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.waitForFunction(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      return ta?.getAttribute('autocorrect') === 'off';
    }, { timeout: 5000 });

    // Step 1: type "offers" then a single space — both are literal
    await page.keyboard.type('offers', { delay: 40 });
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);

    // Step 2: simulate macOS substitution. On real macOS, the OS replaces the
    // prior trailing space + the new Space keystroke with `. ` — i.e., a
    // 1-char delete + 2-char insert in a single model edit.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return;
      const ed = editors[editors.length - 1];
      const pos = ed.getPosition();
      if (!pos) return;
      // Replace the char to the LEFT of the cursor (the trailing space) with `. `
      ed.executeEdits('simulate-macos-substitution', [
        {
          range: {
            startLineNumber: pos.lineNumber,
            startColumn: pos.column - 1,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column,
          },
          text: '. ',
          forceMoveMarkers: true,
        },
      ]);
    });
    await page.waitForTimeout(200);

    // Continue typing "length" — should produce `offers length`, NOT `offers. length`
    await page.keyboard.type('length', { delay: 40 });
    await page.waitForTimeout(200);

    const modelValue = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return 'NO_EDITORS';
      const model = editors[editors.length - 1].getModel();
      return model ? model.getValue() : 'NO_MODEL';
    });
    expect(modelValue.trim()).toBe('offers length');
  });

  test('Monaco uses the legacy textarea path, NOT the EditContext API', async ({ page }) => {
    // Hard requirement: `editContext: false` is set so Monaco uses a <textarea>
    // for input. The EditContext path (a <div class="native-edit-context">)
    // swallows Space keystrokes on some macOS Chromium builds. We must NOT use
    // it. This test fails if Monaco starts up on the EditContext path.
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    const inputState = await page.evaluate(() => {
      const editorEl = document.querySelector('.dm-validation-editor .monaco-editor');
      const textarea = editorEl?.querySelector('textarea');
      const editContextDiv = editorEl?.querySelector('.native-edit-context');
      return {
        textareaPresent: !!textarea,
        textareaClass: textarea?.className ?? null,
        editContextPresent: !!editContextDiv,
      };
    });
    expect(inputState.textareaPresent).toBe(true);
    expect(inputState.editContextPresent).toBe(false);
  });

  test('Monaco textarea has autocorrect and smart-punctuation disabled', async ({ page }) => {
    // Guard rail: ensure the textarea attributes are actually set so the OS
    // does not even attempt to apply text replacements in the first place.
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    // Wait for the textarea to be ready and our hardening to apply.
    // @monaco-editor/react renders the input as `textarea.ime-text-area`.
    await page.waitForFunction(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      return ta?.getAttribute('autocorrect') === 'off';
    }, { timeout: 5000 });

    const attrs = await page.evaluate(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      if (!ta) return null;
      return {
        autocorrect: ta.getAttribute('autocorrect'),
        autocomplete: ta.getAttribute('autocomplete'),
        autocapitalize: ta.getAttribute('autocapitalize'),
        spellcheck: ta.getAttribute('spellcheck'),
      };
    });
    expect(attrs).not.toBeNull();
    expect(attrs?.autocorrect).toBe('off');
    expect(attrs?.autocomplete).toBe('off');
    expect(attrs?.autocapitalize).toBe('off');
    expect(attrs?.spellcheck).toBe('false');
  });

  test('operator helper auto-appears after a space (function helper)', async ({ page }) => {
    // After typing `offers ` (path + space), the operator suggestion widget
    // SHOULD auto-appear so the user can pick `length`, `equals`, etc.
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.keyboard.type('offers', { delay: 60 });
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    // Type one char of operator so quickSuggestions definitely kicks in
    await page.keyboard.type('l', { delay: 60 });
    await page.waitForTimeout(600);

    const operatorLabels = await page.evaluate(() => {
      const widget = document.querySelector(
        '.dm-validation-editor .editor-widget.suggest-widget',
      ) as HTMLElement | null;
      if (!widget) return [];
      return Array.from(widget.querySelectorAll('.monaco-list-row .label-name'))
        .map((el) => (el.textContent ?? '').trim());
    });
    expect(operatorLabels).toContain('length');
  });

  test('typing one Space inserts exactly one space (no eaten keystrokes)', async ({ page }) => {
    // Regression guard for the report "I should push space several times to add a space".
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.keyboard.type('offers', { delay: 60 });
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);

    const modelValue = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return 'NO_EDITORS';
      const model = editors[editors.length - 1].getModel();
      return model ? model.getValue() : 'NO_MODEL';
    });
    expect(modelValue).toBe('offers ');
  });

  test('macOS autocorrect "commit word + Space" event is NOT eaten', async ({ page }) => {
    // On macOS, pressing Space after a recognized word can fire a
    // `beforeinput` event with inputType: "insertReplacementText" carrying the
    // autocorrected word + trailing space (e.g. data: "offers "). Our handler
    // must NOT preventDefault on this — otherwise the user's space keystroke
    // is lost and they have to press Space multiple times to register one.
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.waitForFunction(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      return ta?.getAttribute('autocorrect') === 'off';
    }, { timeout: 5000 });

    const wasPrevented = await page.evaluate(() => {
      const ta = document.querySelector(
        '.dm-validation-editor textarea',
      ) as HTMLTextAreaElement | null;
      if (!ta) return 'NO_TEXTAREA';
      const ev = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertReplacementText',
        data: 'offers ',
      });
      ta.dispatchEvent(ev);
      return ev.defaultPrevented ? 'PREVENTED' : 'ALLOWED';
    });
    expect(wasPrevented).toBe('ALLOWED');
  });

  test('multiline rules are counted correctly', async ({ page }) => {
    const mapper = await openMapperWithRulesTab(page);
    await focusAndClear(page, mapper);

    await page.keyboard.type('status exists', { delay: 30 });
    await page.waitForTimeout(300);
    // Dismiss autocomplete if visible, otherwise skip
    if (await mapper.locator('.suggest-widget.visible').count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.type('offers length > 1', { delay: 30 });
    await page.waitForTimeout(300);
    // Dismiss autocomplete if visible, otherwise skip
    if (await mapper.locator('.suggest-widget.visible').count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    await expect(mapper).toBeVisible();
    await expect(mapper.locator('.vr-modal-stat').first()).toContainText('2 rules');
  });
});
