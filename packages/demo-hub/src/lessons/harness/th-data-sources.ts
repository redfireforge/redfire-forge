/**
 * TH-5 — Data Source Authoring
 *
 * 6 steps: create FG + Parameterized Scenario → create a Param Test with
 * URL template → fill the data source grid (5 rows) → understand column
 * types → tag rows → save & review.
 *
 * Teaches the core data-driven testing workflow — creation through
 * data configuration.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  deleteTh5DemoFg,
  ensureTh5FgExists,
  expandFirstFg,
  expandFirstScenario,
  openTh5TestEditor,
  navigateToDataSourceTab,
  closeTestEditorQuiet,
  closeInlineNameFormQuiet,
  isTestEditorOpen,
  fillDsRowLabel,
  fillDsDataCell,
  scrollDsGridIntoView,
  scrollDsFooterIntoView,
  tourDsColumnTypeDropdown,
  seedDemoEnvAndService,
  TH5_FG_NAME,
  TH5_SCENARIO_NAME,
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thDataSourcesLesson: DemoLesson = {
  id: 'th-data-sources',
  domainId: 'harness',
  category: 'data-driven',
  name: 'Data Source Authoring',
  description:
    'Create a Feature Group, add a Parameterized Scenario, configure a URL template ' +
    'with {{placeholders}}, build the data source grid with rows and tags, then save.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  contentVersion: 10,

  concept: {
    title: 'Data-Driven Testing',
    body:
      'Data-driven testing runs the **same test** with **multiple sets of input data**. ' +
      'Each row in the data source becomes a separate HTTP request with substituted values.\n\n' +
      '**What you\'ll do:**\n' +
      '1. Create a **Feature Group** and add a **Parameterized Scenario**\n' +
      '2. Create a test with a URL template: `/users/{{userId}}`\n' +
      '3. Open the Data Source grid and **fill 5 rows** (Row Name + userId)\n' +
      '4. Understand **column types** — Path, Param, Body, Header, Validate\n' +
      '5. **Tag** rows for filtered execution\n' +
      '6. Save and see the complete parameterized setup\n\n' +
      '**Key insight:** The `{{placeholder}}` in your URL tells RedfireForge which data column ' +
      'maps to which part of the request. One column = one variable = one substitution per row.',
    keyTerms: [
      { term: 'Parameterized Scenario', definition: 'A scenario whose tests have data sources — each row generates a unique request.' },
      { term: 'Data Source', definition: 'A table of columns and rows attached to a test — defines the input data for each execution.' },
      { term: 'Row Name', definition: 'A human-readable label for each data row (e.g. "Admin User") so results are easy to identify.' },
      { term: 'URL Template', definition: 'A URL with {{placeholders}} that get replaced by data source column values per row.' },
      { term: 'Column Type', definition: 'Determines where data is injected: Path, Param, Body, Header, or Validate.' },
      { term: 'Row Tags', definition: 'Labels on data rows used to filter which rows execute during a run.' },
      { term: 'Run Preview', definition: 'Footer showing how many requests will be generated from enabled rows.' },
    ],
    diagram: `<svg viewBox="0 0 380 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="80" height="80" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="45" y="20" text-anchor="middle" fill="#a855f7" font-size="6" font-weight="700">+ Feature Group</text>
      <text x="45" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">+ Scenario</text>
      <text x="45" y="44" text-anchor="middle" fill="#c4b5fd" font-size="5">(Parameterized)</text>
      <text x="45" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">+ Param Test</text>
      <text x="45" y="72" text-anchor="middle" fill="#94a3b8" font-size="4.5">/users/{{userId}}</text>
      <path d="M90 45 L108 45" stroke="#64748b" stroke-width="1" marker-end="url(#th5arr)"/>
      <rect x="113" y="5" width="105" height="80" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="165" y="18" text-anchor="middle" fill="#3b82f6" font-size="6.5" font-weight="700">Fill Row Values</text>
      <text x="165" y="32" text-anchor="middle" fill="#94a3b8" font-size="5">userId (Path)</text>
      <text x="165" y="44" text-anchor="middle" fill="#a6e3a1" font-size="4.5">Admin User → 1</text>
      <text x="165" y="56" text-anchor="middle" fill="#a6e3a1" font-size="4.5">Regular User → 2</text>
      <text x="165" y="70" text-anchor="middle" fill="#94a3b8" font-size="4.5">+ Row → more users</text>
      <path d="M223 45 L241 45" stroke="#64748b" stroke-width="1" marker-end="url(#th5arr)"/>
      <rect x="246" y="5" width="128" height="80" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="310" y="18" text-anchor="middle" fill="#f59e0b" font-size="6.5" font-weight="700">Generated Requests</text>
      <text x="310" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">GET /users/1</text>
      <text x="310" y="46" text-anchor="middle" fill="#94a3b8" font-size="5">GET /users/2</text>
      <text x="310" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">GET /users/3</text>
      <text x="310" y="74" text-anchor="middle" fill="#a6e3a1" font-size="5">N requests from N rows</text>
      <defs><marker id="th5arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    deleteTh5DemoFg();
    closeInlineNameFormQuiet();
    await closeTestEditorQuiet(ctx);
    await ctx.delay(200);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    deleteTh5DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh5Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Create Feature Group + Parameterized Scenario ────
    {
      id: 'th5-create-fg-and-scenario',
      title: 'Create Feature & Parameterized Scenario',
      description:
        'Let\'s build a data-driven test from scratch. First click **+ Add Feature Group** ' +
        'and name it "Data-Driven Demo".\n\n' +
        'Then inside the group, click **+ Scenario**. Notice the kind selector:\n\n' +
        '- **Standard** — each test runs once per iteration\n' +
        '- **Parameterized** — each test runs once per data row from a data source\n\n' +
        'Select **Parameterized** and name it "User Tests" — this enables data-driven testing.',
      // Reading: ring + Add Feature Group. Done: no lingering ring (action ends on PARAM badge).
      highlight: HAR.ADD_FG_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(150);
        closeInlineNameFormQuiet();
        await closeTestEditorQuiet(ctx);
        const ids = await seedDemoEnvAndService(ctx);
        if (ids) {
          (window as unknown as Record<string, unknown>).__demoTh5Ids = ids;
        }
      },

      action: async (ctx) => {
        let ids = (window as unknown as Record<string, unknown>).__demoTh5Ids as { envId: string; svcId: string } | undefined;
        if (!ids) {
          ids = (await seedDemoEnvAndService(ctx)) ?? undefined;
          if (ids) (window as unknown as Record<string, unknown>).__demoTh5Ids = ids;
        }

        // ── Create Feature Group ──
        const addBtn = document.querySelector<HTMLElement>(HAR.ADD_FG_BTN);
        if (addBtn) {
          await spotlight(addBtn, 600, ctx);
          addBtn.click();
        }
        await ctx.waitFor(HAR.FG_NAME_INPUT, 3000);
        await ctx.delay(200);

        await ctx.fill(HAR.FG_NAME_INPUT, TH5_FG_NAME);
        await ctx.delay(250);

        const confirmFgBtn = document.querySelector<HTMLElement>('.inline-name-form .btn.btn-primary');
        if (confirmFgBtn) confirmFgBtn.click();
        await ctx.delay(250);

        // ── Add Parameterized Scenario ──
        await expandFirstFg(ctx);
        await ctx.delay(150);

        const addScenarioBtn = document.querySelector<HTMLElement>(HAR.ADD_SCENARIO_BTN);
        if (addScenarioBtn) {
          await spotlight(addScenarioBtn, 600, ctx);
          addScenarioBtn.click();
        }
        await ctx.waitFor(HAR.SCENARIO_NAME_INPUT, 3000);
        await ctx.delay(200);

        // Select "Parameterized" — brief spotlight on the kind option, then click
        const paramRadio = document.querySelector<HTMLInputElement>(
          'input[name="scenario-kind"][value="parameterized"]',
        );
        if (paramRadio) {
          const label = paramRadio.closest('label');
          if (label) await spotlight(label, 700, ctx);
          paramRadio.click();
          paramRadio.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(250);
        }

        await ctx.fill(HAR.SCENARIO_NAME_INPUT, TH5_SCENARIO_NAME);
        await ctx.delay(250);

        const confirmScBtn = document.querySelector<HTMLElement>('.inline-name-form.nested .btn.btn-primary');
        if (confirmScBtn) confirmScBtn.click();
        await ctx.delay(300);

        // Payoff: PARAM badge
        const badge = document.querySelector<HTMLElement>(HAR.DS_PARAM_BADGE);
        if (badge) await spotlight(badge, 900, ctx);
      },

      verify: HAR.DS_PARAM_BADGE,
    },

    // ── Step 2: Create a Param Test with URL Template ────────────
    {
      id: 'th5-create-param-test',
      title: 'Create a Param Test',
      description:
        'In a Parameterized Scenario, you see **+ Param Test** instead of the normal "+ Test" — ' +
        'this creates a test pre-configured for data-driven execution.\n\n' +
        'Click **+ Param Test** to open the Test Editor. Configure the URL with a ' +
        '`{{placeholder}}` — we\'ll use `https://jsonplaceholder.typicode.com/users/{{userId}}`.\n\n' +
        'The `{{userId}}` tells RedfireForge: "replace this part with each row\'s value from the ' +
        'data source." Save the test — RedfireForge will auto-detect the placeholder and create ' +
        'a matching data column.',
      highlight: HAR.ADD_PARAM_TEST_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        await closeTestEditorQuiet(ctx);
        await ensureTh5FgExists(ctx);
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
      },

      action: async (ctx) => {
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(400);

        // Find and spotlight + Param Test button
        const paramTestBtn =
          document.querySelector<HTMLElement>(HAR.ADD_PARAM_TEST_BTN)
          ?? Array.from(document.querySelectorAll<HTMLElement>('.btn.btn-sm'))
            .find(btn => btn.textContent?.trim() === '+ Param Test')
          ?? null;
        if (paramTestBtn) {
          await spotlight(paramTestBtn, 1800, ctx);
          await ctx.delay(300);
          paramTestBtn.click();
        }
        await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
        await ctx.delay(400);

        // Fill test name
        const nameInput = document.querySelector<HTMLInputElement>(HAR.TE_NAME_INPUT);
        if (nameInput) {
          await spotlight(nameInput, 1200, ctx);
          await ctx.delay(250);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(nameInput, 'Get User by ID');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(400);
        }

        // Fill URL with template placeholder
        const urlInput = document.querySelector<HTMLInputElement>(HAR.TE_URL_INPUT);
        if (urlInput) {
          await spotlight(urlInput, 1500, ctx);
          await ctx.delay(300);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(urlInput, 'https://jsonplaceholder.typicode.com/users/{{userId}}');
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(600);

          // Extra spotlight on URL to emphasize the {{userId}} placeholder
          await spotlight(urlInput, 1400, ctx);
          await ctx.delay(300);
        }

        // Save the test (product closes the editor on Save)
        const saveBtn = document.querySelector<HTMLElement>(HAR.TE_SAVE_BTN);
        if (saveBtn) {
          await spotlight(saveBtn, 1000, ctx);
          await ctx.delay(250);
          saveBtn.click();
          await ctx.delay(500);
        }

        // Leave editor closed — next step opens it on the Data Source tab
        const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
        if (editBtn) await spotlight(editBtn, 1000, ctx);
      },

      verify: HAR.TEST_EDIT_BTN,
    },

    // ── Step 3: Fill data rows (was steps 3 + 5) ─────────────────
    {
      id: 'th5-data-source-intro',
      title: 'Fill Data Rows',
      description:
        'Open the **Data Source** tab — RedfireForge detected `{{userId}}` in your URL and ' +
        'automatically created a matching **userId** column with type **Path**.\n\n' +
        'Each row is one test execution. Fill the first row, then use **+ Row** to add more:\n' +
        '- **Admin User** → `1`\n' +
        '- **Regular User** → `2`\n' +
        '- **Power User** → `3`\n' +
        '- **Guest User** → `4`\n' +
        '- **Test Account** → `5`\n\n' +
        'Watch **Run Preview** update to "5 enabled rows → 5 requests". ' +
        'The enable/disable checkbox lets you skip rows without deleting them.',
      highlight: HAR.DS_ADD_ROW_BTN,

      preAction: async (ctx) => {
        await closeTestEditorQuiet(ctx);
        await ctx.delay(200);
        deleteTh5DemoFg();
        await ctx.delay(200);
        await ensureTh5FgExists(ctx, { rowMode: 'empty', force: true });
        await ctx.delay(300);
        await openTh5TestEditor(ctx);
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        if (!isTestEditorOpen()) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx, { rowMode: 'empty', force: true });
          await openTh5TestEditor(ctx);
          await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
          await ctx.delay(300);
        }
        await navigateToDataSourceTab(ctx);
        await ctx.delay(400);

        // Start from a single blank row
        const existing = document.querySelectorAll<HTMLElement>('.data-source-row');
        for (let i = existing.length - 1; i >= 1; i--) {
          existing[i].querySelector<HTMLElement>('button[title="Delete row"]')?.click();
        }
        await ctx.delay(200);

        // Auto-created userId (Path) column
        const colHeader = document.querySelector<HTMLElement>(HAR.DS_COL_HEADER);
        if (colHeader) {
          await spotlight(colHeader, 1100, ctx);
          await ctx.delay(250);
        }

        const allRows: Array<{ name: string; userId: string }> = [
          { name: 'Admin User', userId: '1' },
          { name: 'Regular User', userId: '2' },
          { name: 'Power User', userId: '3' },
          { name: 'Guest User', userId: '4' },
          { name: 'Test Account', userId: '5' },
        ];

        const addRowBtn = document.querySelector<HTMLElement>(HAR.DS_ADD_ROW_BTN);

        // Row 0 already exists — fill it with a brief spotlight
        const label0 = document.querySelectorAll<HTMLElement>('.data-source-label-input')[0];
        if (label0) await spotlight(label0, 900, ctx);
        fillDsRowLabel(0, allRows[0].name);
        await ctx.delay(350);
        const cell0 = document.querySelector<HTMLElement>(
          'input.data-source-cell-input[data-row="0"][data-col="0"]',
        );
        if (cell0) await spotlight(cell0, 900, ctx);
        fillDsDataCell(0, 0, allRows[0].userId);
        await ctx.delay(350);

        // + Row once (spotlight), then add remaining rows
        if (addRowBtn) {
          addRowBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(addRowBtn, 1400, ctx);
        }

        for (let i = 1; i < allRows.length; i++) {
          if (i > 1 && addRowBtn) {
            addRowBtn.click();
            await ctx.delay(400);
          } else if (i === 1 && addRowBtn) {
            addRowBtn.click();
            await ctx.delay(500);
          }
          fillDsRowLabel(i, allRows[i].name);
          await ctx.delay(200);
          fillDsDataCell(i, 0, allRows[i].userId);
          await ctx.delay(200);
          if (i >= 2) {
            scrollDsGridIntoView({ vertical: true });
            await ctx.delay(250);
          }
        }

        // Payoff: Run Preview → 5 requests
        scrollDsFooterIntoView();
        await ctx.delay(500);
        const preview = document.querySelector<HTMLElement>(HAR.DS_PREVIEW);
        const footer = document.querySelector<HTMLElement>(HAR.DS_FOOTER) ?? preview;
        if (footer) await spotlight(footer, 2200, ctx);
      },

      verify: HAR.DS_PREVIEW,
    },

    // ── Step 4: Understanding Column Types ──────────────────────
    {
      id: 'th5-column-types',
      title: 'Understanding Column Types',
      description:
        'The **userId** column is type **Path** because it substitutes into a URL path segment ' +
        '(`/users/{{userId}}`). Click the type dropdown to see all five options:\n\n' +
        '- **Path** — URL path segments: `/users/{{userId}}`\n' +
        '- **Param** — query parameters: `?_fields={{fields}}`\n' +
        '- **Body** — JSON body fields: `{ "name": "{{name}}" }`\n' +
        '- **Header** — HTTP headers: `Authorization: {{token}}`\n' +
        '- **Validate** — per-row expected values for assertions\n\n' +
        'We open the dropdown and highlight the full type list — then leave **Path** selected for this column.',
      highlight: HAR.DS_COL_TYPE_SELECT,
      pauseAfter: 2500,

      preAction: async (ctx) => {
        if (!isTestEditorOpen() || !document.querySelector(HAR.DS_GRID)) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
        const openMenu = document.querySelector<HTMLElement>(
          `${HAR.DS_COL_TYPE_SELECT} .cs-menu`,
        );
        if (openMenu) {
          const trigger = document.querySelector<HTMLElement>(
            `${HAR.DS_COL_TYPE_SELECT} .cs-trigger`,
          );
          trigger?.click();
          await ctx.delay(200);
        }
      },

      action: async (ctx) => {
        await tourDsColumnTypeDropdown(ctx, { holdMs: 2800 });
      },

      verify: HAR.DS_COL_TYPE_SELECT,
    },

    // ── Step 5: Tag & Filter Rows ───────────────────────────────
    {
      id: 'th5-tags',
      title: 'Tag & Filter Rows',
      description:
        'Tags let you label rows for filtered execution. In the **Parameterized Runner**, ' +
        'you can run only rows matching specific tags — for example, run just `smoke` rows ' +
        'for a quick sanity check.\n\n' +
        '1. Tag the first two rows as **smoke**\n' +
        '2. Watch the **Filter** bar appear\n' +
        '3. Click **smoke** — the grid shrinks to those 2 rows (`2 of 5 rows`)\n' +
        '4. Click **All** to show every row again',
      // Reading: first "+" only (not every row's add button / not the whole filter bar)
      highlight: HAR.DS_TAG_ADD_BTN,
      pauseAfter: 2000,

      preAction: async (ctx) => {
        if (!isTestEditorOpen() || !document.querySelector(HAR.DS_GRID)) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
        document.querySelectorAll<HTMLInputElement>(HAR.DS_TAG_INPUT).forEach((input) => {
          input.blur();
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
      },

      action: async (ctx) => {
        const closeOpenTagInputs = () => {
          document.querySelectorAll<HTMLInputElement>(HAR.DS_TAG_INPUT).forEach((input) => {
            input.blur();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          });
        };

        // Tag first 2 rows — spotlight the first "+" once, then add both quietly
        for (let i = 0; i < 2; i++) {
          const btn = document.querySelectorAll<HTMLElement>(HAR.DS_TAG_ADD_BTN)[i]
            ?? document.querySelector<HTMLElement>(HAR.DS_TAG_ADD_BTN);
          if (!btn) break;
          if (i === 0) await spotlight(btn, 900, ctx);
          btn.click();
          await ctx.delay(300);
          const tagInput = document.querySelector<HTMLInputElement>(HAR.DS_TAG_INPUT);
          if (tagInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(tagInput, 'smoke');
            tagInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(250);
            tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await ctx.delay(350);
            tagInput.blur();
            closeOpenTagInputs();
          }
        }
        closeOpenTagInputs();

        // One smoke pill as proof tags landed (not every pill)
        const firstPill = document.querySelector<HTMLElement>(HAR.DS_TAG_PILL);
        if (firstPill) await spotlight(firstPill, 1000, ctx);

        // Single filter beat: spotlight smoke → click → pause → reset All (no extra rings)
        const filterBar = document.querySelector<HTMLElement>(HAR.DS_TAG_FILTER_BAR);
        if (!filterBar) return;

        filterBar.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        await ctx.delay(200);

        const smokeBtn = Array.from(filterBar.querySelectorAll<HTMLElement>(HAR.DS_TAG_FILTER_BTN))
          .find(btn => /smoke/i.test(btn.textContent ?? ''));
        if (smokeBtn) {
          await spotlight(smokeBtn, 1600, ctx);
          smokeBtn.click();
          await ctx.delay(1000);
        }

        const allBtn = Array.from(filterBar.querySelectorAll<HTMLElement>(HAR.DS_TAG_FILTER_BTN))
          .find(btn => /^All/i.test((btn.textContent ?? '').trim()))
          ?? filterBar.querySelector<HTMLElement>(HAR.DS_TAG_FILTER_BTN);
        allBtn?.click();
        await ctx.delay(500);
        closeOpenTagInputs();
      },

      verify: HAR.DS_TAG_FILTER_BAR,
    },

    // ── Step 6: Save & Review ───────────────────────────────────
    {
      id: 'th5-save',
      title: 'Save & Review',
      description:
        'Click **Save** to persist your complete data-driven setup.\n\n' +
        'Back in the tree, the scenario shows the **PARAM** badge and the test has data rows. ' +
        'In the **Parameterized Runner** lesson (next), you\'ll execute each row as a separate ' +
        'request and see per-row results.\n\n' +
        '**Next steps:**\n' +
        '- **Import** CSV/JSON/Excel for larger data sets\n' +
        '- **Shared Data Sources** — reuse rows across multiple tests\n' +
        '- **+ Column** — add query params, headers, body fields as variables',
      highlight: HAR.TE_SAVE_BTN,

      preAction: async (ctx) => {
        await ensureTh5FgExists(ctx);
        if (!isTestEditorOpen()) {
          await openTh5TestEditor(ctx);
          await navigateToDataSourceTab(ctx);
        }
      },

      action: async (ctx) => {
        const saveBtn = document.querySelector<HTMLElement>(HAR.TE_SAVE_BTN);
        if (saveBtn) {
          await spotlight(saveBtn, 1800, ctx);
          await ctx.delay(500);
          saveBtn.click();
        }
        await ctx.delay(1000);

        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(600);

        // Scenario PARAM badge, then the Param badge on the test card (not the whole row)
        const scenarioBadge = document.querySelector<HTMLElement>(HAR.DS_PARAM_BADGE);
        if (scenarioBadge) await spotlight(scenarioBadge, 1200, ctx);
        await ctx.delay(300);

        const testParamBadge = document.querySelector<HTMLElement>(HAR.TEST_PARAM_BADGE);
        if (testParamBadge) await spotlight(testParamBadge, 2200, ctx);
      },

      verify: HAR.TEST_PARAM_BADGE,
    },
  ],
};
