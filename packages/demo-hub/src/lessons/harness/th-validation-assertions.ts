/**
 * TH-3 — Validation & Assertions (Overview)
 *
 * 6 steps: see the three validation modes → add a Status Code assertion →
 * add a Response Time assertion → see the sample response and Data Mapper
 * entry point → verify assertions against the live API → save.
 *
 * Teaches the validation fundamentals. Deep dives in TH-10 (Assertions),
 * TH-11 (Data Mapper), TH-12 (Versioning).
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  deleteTh3DemoFg,
  ensureTh3FgExists,
  openTh3TestEditor,
  navigateToValidationTab,
  closeAssertionMenuQuiet,
  closeTestEditorQuiet,
  closeInlineNameFormQuiet,
  isTestEditorOpen,
  expandFirstFg,
  expandFirstScenario,
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thValidationAssertionsLesson: DemoLesson = {
  id: 'th-validation-assertions',
  domainId: 'harness',
  category: 'validation',
  name: 'Validation & Assertions',
  description:
    'Learn the three validation modes, add status code and response time assertions, ' +
    'see the sample response preview, and verify rules against a live API.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Validation & Assertions',
    body:
      'Every test in RedfireForge can validate more than just "did it respond?" — ' +
      'you can check **HTTP status codes**, **response times**, **header values**, ' +
      '**JSON field contents**, and much more.\n\n' +
      '**Two validation layers:**\n' +
      '1. **Assertions** — HTTP-level checks (status, timing, headers, body size) that run on every request\n' +
      '2. **Body Validation** — field-level rules (equals, contains, regex, type checks) configured via the Data Mapper\n\n' +
      '**Three validation modes:**\n' +
      '- **No Body Validation** — only assertions run (fastest)\n' +
      '- **Full JSON Match** — deep comparison against an expected JSON body\n' +
      '- **Selective Fields** — check specific fields you care about (most common)\n\n' +
      '**In this lesson:** You will add assertions and verify them against a live API. ' +
      'Deep dives into the Data Mapper and field validation come in later lessons.',
    keyTerms: [
      { term: 'Assertion', definition: 'An HTTP-level validation rule — status code, response time, header value, or body size.' },
      { term: 'Validation Mode', definition: 'Controls how the response body is checked: None, Full JSON Match, or Selective Fields.' },
      { term: 'Verify', definition: 'Sends the request once and evaluates all assertions against the live response — quick sanity check without the full Runner.' },
      { term: 'Data Mapper', definition: 'Visual tool for creating field-level validation rules by mapping source JSON paths to operators.' },
    ],
    diagram: `<svg viewBox="0 0 360 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="8" width="85" height="54" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="47" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Assertions</text>
      <text x="47" y="40" text-anchor="middle" fill="#94a3b8" font-size="6">Status · Time</text>
      <text x="47" y="52" text-anchor="middle" fill="#94a3b8" font-size="6">Headers · Size</text>
      <path d="M95 35 L120 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th3arr)"/>
      <rect x="125" y="8" width="85" height="54" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="167" y="24" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Body Validation</text>
      <text x="167" y="36" text-anchor="middle" fill="#94a3b8" font-size="6">None · Full</text>
      <text x="167" y="48" text-anchor="middle" fill="#94a3b8" font-size="6">Selective Fields</text>
      <path d="M215 35 L240 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th3arr)"/>
      <rect x="245" y="8" width="60" height="54" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="275" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Verify</text>
      <text x="275" y="42" text-anchor="middle" fill="#94a3b8" font-size="6">Live check</text>
      <text x="275" y="54" text-anchor="middle" fill="#94a3b8" font-size="6">Pass / Fail</text>
      <path d="M310 35 L335 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th3arr)"/>
      <text x="345" y="38" text-anchor="middle" fill="#a855f7" font-size="9" font-weight="700">✓</text>
      <defs><marker id="th3arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    deleteTh3DemoFg();
    closeInlineNameFormQuiet();
    await closeTestEditorQuiet(ctx);
    await ctx.delay(200);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    closeAssertionMenuQuiet();
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    deleteTh3DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh3Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Three Validation Modes ───────────────────────────
    {
      id: 'th3-modes',
      title: 'Three Validation Modes',
      description:
        'Open the pre-configured test and navigate to the **Validation** tab.\n\n' +
        'At the top you\'ll see the **Assertions** section — HTTP-level checks like status code ' +
        'and response time that run on every request.\n\n' +
        'Below that, the **Body Validation** section offers three modes:\n' +
        '- **No Body Validation** — only assertions run, no body checks\n' +
        '- **Full JSON Match** — deep comparison against an expected JSON body\n' +
        '- **Selective Fields** — check specific JSON fields you care about\n\n' +
        '**Selective Fields** is the most common choice — validate what matters, ignore the rest.',
      highlight: HAR.TE_RADIO_GROUP,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        closeAssertionMenuQuiet();
        await closeTestEditorQuiet(ctx);
        await ensureTh3FgExists(ctx);
      },

      action: async (ctx) => {
        await ensureTh3FgExists(ctx);
        await ctx.delay(400);

        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(400);

        // Highlight the Edit Test button so the viewer sees what we're about to click
        const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
        if (editBtn) {
          await spotlight(editBtn, 2000, ctx);
          editBtn.click();
          await ctx.delay(600);
        }

        await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
        await ctx.delay(800);

        // Highlight the Validation tab before clicking it
        const validationTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('Validation'));
        if (validationTab) {
          await spotlight(validationTab, 2000, ctx);
          validationTab.click();
          await ctx.delay(800);
        }

        // Highlight the radio group showing the three modes
        const radioGroup = document.querySelector<HTMLElement>(HAR.TE_RADIO_GROUP);
        if (radioGroup) await spotlight(radioGroup, 1500, ctx);

        // Switch to "Selective Fields" — the most common and feature-rich mode
        if (radioGroup) {
          const labels = radioGroup.querySelectorAll<HTMLLabelElement>('label.radio-label');
          const selectiveLabel = Array.from(labels).find(l => l.textContent?.includes('Selective Fields'));
          if (selectiveLabel) {
            await spotlight(selectiveLabel, 2000, ctx);
            const radio = selectiveLabel.querySelector<HTMLInputElement>('input[type="radio"]');
            if (radio && !radio.checked) {
              radio.click();
              selectiveLabel.click();
            }
            await ctx.delay(800);
          }
        }
      },

      verify: HAR.TE_RADIO_GROUP,
    },

    // ── Step 2: Add a Status Code Assertion ──────────────────────
    {
      id: 'th3-add-status',
      title: 'Add a Status Code Assertion',
      description:
        'Click **+ Add** in the Assertions section to open the **categorized assertion menu**.\n\n' +
        'Assertions are organized into categories:\n' +
        '- **Response** — Status Code, Response Time SLA, Response Header, Body Size\n' +
        '- **Field Validation** — Regex, Numeric, Date, Type Check, Field Exists\n' +
        '- **Array & Structure** — Array Length, Contains, Each Element, Subset\n' +
        '- **Schema & Advanced** — JSON Schema, Custom Predicate\n\n' +
        'Click **Status Code** — the most fundamental check. The assertion row appears ' +
        'with "200" pre-filled, meaning the test expects a successful response.',
      highlight: HAR.TE_ASSERTIONS_ADD_BTN,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh3FgExists(ctx);
          await openTh3TestEditor(ctx);
        }
        await navigateToValidationTab(ctx);
        closeAssertionMenuQuiet();
      },

      action: async (ctx) => {
        await ctx.click(HAR.TE_ASSERTIONS_ADD_BTN);
        await ctx.waitFor(HAR.TE_ASSERTIONS_ADD_MENU, 3000);
        await ctx.delay(800);

        const menu = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_MENU);
        if (menu) await spotlight(menu, 1500, ctx);

        const statusItem = Array.from(
          document.querySelectorAll<HTMLElement>('.aam-grid-item'),
        ).find(el => el.querySelector('.aam-label')?.textContent?.includes('Status Code'));

        if (statusItem) {
          await spotlight(statusItem, 2000, ctx);
          statusItem.click();
          await ctx.delay(800);
        }

        const firstRow = document.querySelector<HTMLElement>(HAR.TE_ASSERTION_ROW);
        if (firstRow) await spotlight(firstRow, 1500, ctx);
      },

      verify: HAR.TE_ASSERTION_ROW,
    },

    // ── Step 3: Add a Response Time Assertion ────────────────────
    {
      id: 'th3-add-timing',
      title: 'Add a Response Time Assertion',
      description:
        'Click **+ Add** again and select **Response Time SLA** — this ensures the API ' +
        'responds within a maximum threshold.\n\n' +
        'The assertion row appears with a default of **500 ms**. ' +
        'You can adjust this to match your SLA requirements.\n\n' +
        'Both assertions now appear in the list. They run on **every request** ' +
        'regardless of which body validation mode is selected — ' +
        'assertions are always-on HTTP-level guards.',
      highlight: HAR.TE_ASSERTIONS_LIST,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh3FgExists(ctx);
          await openTh3TestEditor(ctx);
        }
        await navigateToValidationTab(ctx);
        closeAssertionMenuQuiet();

        const existingRows = document.querySelectorAll(HAR.TE_ASSERTION_ROW);
        if (existingRows.length === 0) {
          const addBtn = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_BTN);
          if (addBtn) {
            addBtn.click();
            await ctx.delay(300);
            const statusItem = Array.from(
              document.querySelectorAll<HTMLElement>('.aam-grid-item'),
            ).find(el => el.querySelector('.aam-label')?.textContent?.includes('Status Code'));
            statusItem?.click();
            await ctx.delay(300);
          }
        }
      },

      action: async (ctx) => {
        await ctx.click(HAR.TE_ASSERTIONS_ADD_BTN);
        await ctx.waitFor(HAR.TE_ASSERTIONS_ADD_MENU, 3000);
        await ctx.delay(600);

        const timeItem = Array.from(
          document.querySelectorAll<HTMLElement>('.aam-grid-item'),
        ).find(el => el.querySelector('.aam-label')?.textContent?.includes('Response Time'));

        if (timeItem) {
          await spotlight(timeItem, 2000, ctx);
          timeItem.click();
          await ctx.delay(800);
        }

        const assertionsList = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_LIST);
        if (assertionsList) await spotlight(assertionsList, 1800, ctx);
      },

      verify: HAR.TE_ASSERTIONS_LIST,
    },

    // ── Step 4: Sample Response & Data Mapper ────────────────────
    {
      id: 'th3-response-preview',
      title: 'Sample Response & Data Mapper',
      description:
        'Select **Selective Fields** mode — this unlocks the **Fetch Response** button and the ' +
        '**Data Mapper**.\n\n' +
        'Click **Fetch Response** to capture a live JSON response from the API. ' +
        'This captured data is the foundation for building **field-level validation rules**.\n\n' +
        'The **⚡ Data Mapper** button opens a visual editor where you can:\n' +
        '- Browse the response tree (source) and validation rules (target)\n' +
        '- Drag fields from source to target to create rules\n' +
        '- Choose operators (equals, contains, regex, is_not_empty, etc.)\n' +
        '- See live connection lines between mapped fields\n\n' +
        'We\'ll deep-dive into the Data Mapper in the **Data Mapper for Validation** lesson.',

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh3FgExists(ctx);
          await openTh3TestEditor(ctx);
        }
        await navigateToValidationTab(ctx);
        closeAssertionMenuQuiet();
      },

      action: async (ctx) => {
        // 1. Highlight and click "Selective Fields" radio to show the mode switch
        const radioGroup = document.querySelector<HTMLElement>(HAR.TE_RADIO_GROUP);
        if (radioGroup) {
          const labels = radioGroup.querySelectorAll<HTMLLabelElement>('label.radio-label');
          const selectiveLabel = Array.from(labels).find(l => l.textContent?.includes('Selective Fields'));
          if (selectiveLabel) {
            await spotlight(selectiveLabel, 2000, ctx);
            const radio = selectiveLabel.querySelector<HTMLInputElement>('input[type="radio"]');
            if (radio && !radio.checked) {
              radio.click();
              selectiveLabel.click();
              await ctx.delay(800);
            }
          }
        }

        // 2. Highlight the Fetch Response button
        const fetchBtn = document.querySelector<HTMLElement>(HAR.TE_FETCH_BTN);
        if (fetchBtn) {
          await spotlight(fetchBtn, 2000, ctx);
          fetchBtn.click();
          await ctx.delay(600);

          // Wait for the response to arrive
          const start = Date.now();
          while (Date.now() - start < 8000) {
            const preview = document.querySelector<HTMLElement>(HAR.TE_RESPONSE_PREVIEW);
            if (preview && !preview.classList.contains('validation-response-preview--collapsed')) break;
            await ctx.delay(500);
          }
          await ctx.delay(800);
        }

        // 3. Spotlight the response preview showing the fetched JSON
        const preview = document.querySelector<HTMLElement>(HAR.TE_RESPONSE_PREVIEW);
        if (preview) {
          if (preview.classList.contains('validation-response-preview--collapsed')) {
            const header = preview.querySelector<HTMLElement>('.validation-response-preview-header');
            if (header) { header.click(); await ctx.delay(600); }
          }
          await spotlight(preview, 2000, ctx);
        }

        // 4. Spotlight the Data Mapper button
        const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
        if (mapperBtn) await spotlight(mapperBtn, 1500, ctx);
      },

      verify: HAR.TE_RESPONSE_PREVIEW,
    },

    // ── Step 5: Verify Against Live Response ─────────────────────
    {
      id: 'th3-verify',
      title: 'Verify Against Live Response',
      description:
        'Click **Verify** to send the request to the live API and evaluate all configured ' +
        'assertions against the response.\n\n' +
        'The result shows:\n' +
        '- **PASSED** or **FAILED** badge with the HTTP status\n' +
        '- A summary of how many rules passed vs failed\n' +
        '- Expandable response details (headers, body)\n\n' +
        'Verify is a quick sanity check — it runs the request once inside the editor ' +
        'without going through the full Test Runner.',
      highlight: HAR.TE_VERIFY_BTN,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh3FgExists(ctx);
          await openTh3TestEditor(ctx);
        }
        await navigateToValidationTab(ctx);
        closeAssertionMenuQuiet();

        const existingRows = document.querySelectorAll(HAR.TE_ASSERTION_ROW);
        if (existingRows.length < 2) {
          const addBtn = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_BTN);
          if (addBtn && existingRows.length === 0) {
            addBtn.click();
            await ctx.delay(300);
            const statusItem = Array.from(
              document.querySelectorAll<HTMLElement>('.aam-grid-item'),
            ).find(el => el.querySelector('.aam-label')?.textContent?.includes('Status Code'));
            statusItem?.click();
            await ctx.delay(400);
          }
          if (addBtn && document.querySelectorAll(HAR.TE_ASSERTION_ROW).length < 2) {
            addBtn.click();
            await ctx.delay(300);
            const timeItem = Array.from(
              document.querySelectorAll<HTMLElement>('.aam-grid-item'),
            ).find(el => el.querySelector('.aam-label')?.textContent?.includes('Response Time'));
            timeItem?.click();
            await ctx.delay(300);
          }
        }
      },

      action: async (ctx) => {
        const verifyBtn = document.querySelector<HTMLElement>(HAR.TE_VERIFY_BTN);
        if (verifyBtn) {
          await spotlight(verifyBtn, 2000, ctx);

          verifyBtn.click();
          await ctx.delay(500);

          const start = Date.now();
          while (Date.now() - start < 10000) {
            const result = document.querySelector<HTMLElement>(HAR.TE_VERIFY_RESULT);
            if (result) break;
            await ctx.delay(500);
          }
          await ctx.delay(800);
        }

        // Spotlight the PASSED/FAILED result bar
        const result = document.querySelector<HTMLElement>(HAR.TE_VERIFY_RESULT);
        if (result) {
          await spotlight(result, 2000, ctx);

          // Click "▸ Response" to expand and show the response details
          const responseToggle = result.querySelector<HTMLElement>('button[aria-label="Toggle response details"]');
          if (responseToggle) {
            await spotlight(responseToggle, 1500, ctx);
            responseToggle.click();
            await ctx.delay(800);

            // Spotlight the expanded response content
            const responseDetail = result.querySelector<HTMLElement>('.validate-response-detail');
            if (responseDetail) await spotlight(responseDetail, 2500, ctx);
          }
        }
      },

      verify: HAR.TE_VERIFY_BTN,
    },

    // ── Step 6: Save the Validated Test ──────────────────────────
    {
      id: 'th3-save',
      title: 'Save the Validated Test',
      description:
        'Click **Save** to persist your assertion rules and close the editor.\n\n' +
        'Your test now has **two assertions** (status code 200, response time ≤ 500ms) ' +
        'and a captured sample response for building field rules later.\n\n' +
        'In the tree, the test card shows the configured assertions. ' +
        'From here you can add more tests, configure **SLA targets** (in the **SLA Targets & Acceptance Criteria** lesson), ' +
        'or head to the **Test Runner** to execute your suite.',
      highlight: HAR.TE_SAVE_BTN,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh3FgExists(ctx);
        }
        closeAssertionMenuQuiet();
      },

      action: async (ctx) => {
        if (isTestEditorOpen()) {
          await ctx.click(HAR.TE_SAVE_BTN);
          await ctx.delay(1000);
        }

        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(600);

        const testCard = document.querySelector<HTMLElement>(HAR.TEST_CARD);
        if (testCard) {
          await spotlight(testCard, 1500, ctx);

          // Highlight "Validation: selective", "STATUS", and "SLA" badges
          const tags = testCard.querySelectorAll<HTMLElement>('.tag');
          const badgesToHighlight: HTMLElement[] = [];
          tags.forEach(tag => {
            const text = tag.textContent ?? '';
            if (text.includes('Validation:') || text.includes('Status') || text === 'SLA') {
              badgesToHighlight.push(tag);
            }
          });
          if (badgesToHighlight.length > 0) {
            const wrapper = document.createElement('span');
            wrapper.style.display = 'inline-flex';
            wrapper.style.gap = '4px';
            wrapper.style.alignItems = 'center';
            const parent = badgesToHighlight[0].parentElement!;
            parent.insertBefore(wrapper, badgesToHighlight[0]);
            badgesToHighlight.forEach(b => wrapper.appendChild(b));
            await spotlight(wrapper, 2500, ctx);
            // Restore DOM
            badgesToHighlight.forEach(b => parent.insertBefore(b, wrapper));
            wrapper.remove();
          }
        }
      },

      verify: HAR.TEST_CARD,
    },
  ],
};
