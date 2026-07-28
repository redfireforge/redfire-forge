/**
 * TH-5 — Data Source Authoring
 *
 * 7 steps: create FG + Parameterized Scenario → create a Param Test with
 * URL template → explore the auto-configured data source grid → understand
 * column types → add rows → tag rows → save.
 *
 * Teaches the full data-driven testing workflow — creation through
 * data configuration. Step 1 shows FG + scenario creation; Steps 2–7
 * explain the data source grid in detail.
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
  fillDsCell,
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
    'with {{placeholders}}, then build the data source grid with rows and tags.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Data-Driven Testing',
    body:
      'Data-driven testing runs the **same test** with **multiple sets of input data**. ' +
      'Each row in the data source becomes a separate HTTP request with substituted values.\n\n' +
      '**What you\'ll do:**\n' +
      '1. Create a **Feature Group** and add a **Parameterized Scenario**\n' +
      '2. Create a test with a URL template: `/users/{{userId}}`\n' +
      '3. See how RedfireForge auto-detects `{{userId}}` and creates a data column\n' +
      '4. Understand **column types** — Path, Param, Body, Header, Validate\n' +
      '5. Add data rows and **tag** them for filtered execution\n' +
      '6. Save and see the complete parameterized setup\n\n' +
      '**Key insight:** The `{{placeholder}}` in your URL tells RedfireForge which data column ' +
      'maps to which part of the request. One column = one variable = one substitution per row.',
    keyTerms: [
      { term: 'Parameterized Scenario', definition: 'A scenario whose tests have data sources — each row generates a unique request.' },
      { term: 'Data Source', definition: 'A table of columns and rows attached to a test — defines the input data for each execution.' },
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
      <text x="165" y="18" text-anchor="middle" fill="#3b82f6" font-size="6.5" font-weight="700">Data Source</text>
      <text x="165" y="32" text-anchor="middle" fill="#94a3b8" font-size="5">userId (Path)</text>
      <text x="165" y="44" text-anchor="middle" fill="#94a3b8" font-size="5">Row 1: 1</text>
      <text x="165" y="56" text-anchor="middle" fill="#94a3b8" font-size="5">Row 2: 2</text>
      <text x="165" y="68" text-anchor="middle" fill="#94a3b8" font-size="5">Row 3: 3</text>
      <text x="165" y="80" text-anchor="middle" fill="#10b981" font-size="4.5">Tags: smoke, regression</text>
      <path d="M223 45 L241 45" stroke="#64748b" stroke-width="1" marker-end="url(#th5arr)"/>
      <rect x="246" y="5" width="128" height="80" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="310" y="18" text-anchor="middle" fill="#f59e0b" font-size="6.5" font-weight="700">Generated Requests</text>
      <text x="310" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">GET /users/1</text>
      <text x="310" y="46" text-anchor="middle" fill="#94a3b8" font-size="5">GET /users/2</text>
      <text x="310" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">GET /users/3</text>
      <text x="310" y="74" text-anchor="middle" fill="#a6e3a1" font-size="5">3 requests from 3 rows</text>
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
      highlight: HAR.ADD_FG_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
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
        await ctx.delay(400);

        // ── Create Feature Group ──
        const addBtn = document.querySelector<HTMLElement>(HAR.ADD_FG_BTN);
        if (addBtn) {
          await spotlight(addBtn, 1500, ctx);
          await ctx.delay(400);
          addBtn.click();
        }
        await ctx.waitFor(HAR.FG_NAME_INPUT, 3000);
        await ctx.delay(600);

        await ctx.fill(HAR.FG_NAME_INPUT, TH5_FG_NAME);
        await ctx.delay(800);

        const confirmFgBtn = document.querySelector<HTMLElement>('.inline-name-form .btn.btn-primary');
        if (confirmFgBtn) confirmFgBtn.click();
        await ctx.delay(800);

        const fgCard = document.querySelector<HTMLElement>(HAR.FG_CARD);
        if (fgCard) await spotlight(fgCard, 1500, ctx);
        await ctx.delay(600);

        // ── Add Parameterized Scenario ──
        await expandFirstFg(ctx);
        await ctx.delay(400);

        const addScenarioBtn = document.querySelector<HTMLElement>(HAR.ADD_SCENARIO_BTN);
        if (addScenarioBtn) {
          await spotlight(addScenarioBtn, 1500, ctx);
          await ctx.delay(400);
          addScenarioBtn.click();
        }
        await ctx.waitFor(HAR.SCENARIO_NAME_INPUT, 3000);
        await ctx.delay(600);

        // Highlight the kind selector radio buttons
        const kindSelector = document.querySelector<HTMLElement>('.scenario-kind-selector');
        if (kindSelector) {
          await spotlight(kindSelector, 2200, ctx);
          await ctx.delay(600);
        }

        // Select "Parameterized" radio
        const paramRadio = document.querySelector<HTMLInputElement>(
          'input[name="scenario-kind"][value="parameterized"]',
        );
        if (paramRadio) {
          const label = paramRadio.closest('label');
          if (label) await spotlight(label, 1500, ctx);
          await ctx.delay(400);
          paramRadio.click();
          paramRadio.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(800);
        }

        // Fill scenario name
        await ctx.fill(HAR.SCENARIO_NAME_INPUT, TH5_SCENARIO_NAME);
        await ctx.delay(800);

        // Confirm
        const confirmScBtn = document.querySelector<HTMLElement>('.inline-name-form.nested .btn.btn-primary');
        if (confirmScBtn) confirmScBtn.click();
        await ctx.delay(1000);

        // Highlight the PARAM badge
        const badge = document.querySelector<HTMLElement>(HAR.DS_PARAM_BADGE);
        if (badge) await spotlight(badge, 2000, ctx);
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
      highlight: HAR.SCENARIO_CARD,

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
        const paramTestBtn = Array.from(document.querySelectorAll<HTMLElement>('.btn.btn-sm'))
          .find(btn => btn.textContent?.trim() === '+ Param Test');
        if (paramTestBtn) {
          await spotlight(paramTestBtn, 1800, ctx);
          await ctx.delay(500);
          paramTestBtn.click();
        }
        await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
        await ctx.delay(800);

        // Fill test name
        const nameInput = document.querySelector<HTMLInputElement>(HAR.TE_NAME_INPUT);
        if (nameInput) {
          await spotlight(nameInput, 1200, ctx);
          await ctx.delay(400);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(nameInput, 'Get User by ID');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(800);
        }

        // Fill URL with template placeholder
        const urlInput = document.querySelector<HTMLInputElement>(HAR.TE_URL_INPUT);
        if (urlInput) {
          await spotlight(urlInput, 1500, ctx);
          await ctx.delay(400);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(urlInput, 'https://jsonplaceholder.typicode.com/users/{{userId}}');
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(1200);

          // Extra spotlight on URL to emphasize the {{userId}} placeholder
          await spotlight(urlInput, 2200, ctx);
          await ctx.delay(600);
        }

        // Save the test
        const saveBtn = document.querySelector<HTMLElement>(HAR.TE_SAVE_BTN);
        if (saveBtn) {
          await spotlight(saveBtn, 1200, ctx);
          await ctx.delay(400);
          saveBtn.click();
          await ctx.delay(800);
        }
      },

      verify: HAR.TEST_CARD,
    },

    // ── Step 4: The Data Source — Auto-configured ────────────────
    {
      id: 'th5-data-source-intro',
      title: 'The Data Source — Auto-configured',
      description:
        'Open the test you just saved. Go to the **Data Source** tab — RedfireForge detected ' +
        '`{{userId}}` in your URL and automatically created a matching **userId** column ' +
        'with type **Path**.\n\n' +
        'This is the **data source grid**: each column is a variable, each row is a test execution. ' +
        'The two pre-filled rows (userId = 1 and userId = 2) mean the test will run twice — ' +
        'once for `/users/1` and once for `/users/2`.\n\n' +
        'The **Run Preview** at the bottom confirms: "2 enabled rows → 2 requests".',
      highlight: HAR.DS_GRID,

      preAction: async (ctx) => {
        // Close editor left open from previous step (it has no data source)
        await closeTestEditorQuiet(ctx);
        await ctx.delay(200);
        // Delete the FG created via UI (test had no data source) and re-seed with full data
        deleteTh5DemoFg();
        await ctx.delay(200);
        await ensureTh5FgExists(ctx);
        await ctx.delay(300);
        // Now open the properly seeded test
        await openTh5TestEditor(ctx);
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        // At this point the editor should be open on the Data Source tab with the grid
        // If somehow not, recover
        if (!isTestEditorOpen()) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
          await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
          await ctx.delay(400);
        }
        await navigateToDataSourceTab(ctx);
        await ctx.delay(600);

        // Spotlight the entire grid
        const grid = document.querySelector<HTMLElement>(HAR.DS_GRID);
        if (grid) {
          await spotlight(grid, 2200, ctx);
          await ctx.delay(800);
        }

        // Spotlight the column header showing "userId"
        const colHeader = document.querySelector<HTMLElement>(HAR.DS_COL_HEADER);
        if (colHeader) {
          await spotlight(colHeader, 1800, ctx);
          await ctx.delay(600);
        }

        // Spotlight the column type showing "Path"
        const typeSelect = document.querySelector<HTMLElement>(HAR.DS_COL_TYPE_SELECT);
        if (typeSelect) {
          await spotlight(typeSelect, 1500, ctx);
          await ctx.delay(500);
        }

        // Spotlight the Run Preview footer
        const preview = document.querySelector<HTMLElement>(HAR.DS_PREVIEW);
        if (preview) await spotlight(preview, 1800, ctx);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 4: Understanding Column Types ──────────────────────
    {
      id: 'th5-column-types',
      title: 'Understanding Column Types',
      description:
        'The **userId** column has type **Path** because it substitutes into a URL path segment. ' +
        'You can change the type by clicking the dropdown.\n\n' +
        'Column types control where data is injected:\n' +
        '- **Path** — URL path segments: `/users/{{userId}}`\n' +
        '- **Param** — query parameters: `?_fields={{fields}}`\n' +
        '- **Body** — JSON body fields: `{ "name": "{{name}}" }`\n' +
        '- **Header** — HTTP headers: `Authorization: {{token}}`\n' +
        '- **Validate** — per-row expected values for assertions\n\n' +
        'Click **+ Column** to add more variables. Each column maps to one `{{placeholder}}`.',
      highlight: HAR.DS_COL_TYPE_SELECT,

      preAction: async (ctx) => {
        // Ensure we have the seeded test with data source open
        if (!isTestEditorOpen() || !document.querySelector(HAR.DS_GRID)) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        // Spotlight the type dropdown
        const typeSelect = document.querySelector<HTMLElement>(HAR.DS_COL_TYPE_SELECT);
        if (typeSelect) {
          await spotlight(typeSelect, 2000, ctx);
          await ctx.delay(600);
        }

        // Spotlight + Column button to show user can add more
        const addColBtn = document.querySelector<HTMLElement>(HAR.DS_ADD_COL_BTN);
        if (addColBtn) {
          await spotlight(addColBtn, 1500, ctx);
          await ctx.delay(500);
        }

        // Spotlight + Row button
        const addRowBtn = document.querySelector<HTMLElement>(HAR.DS_ADD_ROW_BTN);
        if (addRowBtn) {
          await spotlight(addRowBtn, 1200, ctx);
          await ctx.delay(500);
        }

        // Spotlight the Run Preview to reinforce the "rows = requests" concept
        const preview = document.querySelector<HTMLElement>(HAR.DS_PREVIEW);
        if (preview) await spotlight(preview, 1500, ctx);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 5: Add Data Rows ───────────────────────────────────
    {
      id: 'th5-add-rows',
      title: 'Add Data Rows',
      description:
        'Each row represents one test execution with its own substituted value. ' +
        'Click **+ Row** to add more users to test.\n\n' +
        'We\'ll add rows for user IDs 3, 4, and 5 — bringing the total to 5 rows, ' +
        'which means 5 HTTP requests will be generated.\n\n' +
        'The **enable/disable** checkbox on each row lets you skip specific rows ' +
        'without deleting them — useful for temporarily excluding problematic inputs.',
      highlight: HAR.DS_ADD_ROW_BTN,

      preAction: async (ctx) => {
        if (!isTestEditorOpen() || !document.querySelector(HAR.DS_GRID)) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        // Spotlight + Row button first
        const addRowBtn = document.querySelector<HTMLElement>(HAR.DS_ADD_ROW_BTN);
        if (addRowBtn) {
          await spotlight(addRowBtn, 1500, ctx);
          await ctx.delay(500);
        }

        // Add 3 more rows
        for (let i = 0; i < 3; i++) {
          if (addRowBtn) addRowBtn.click();
          await ctx.delay(400);
        }

        await ctx.delay(300);
        fillDsCell(2, 0, '3');
        await ctx.delay(200);
        fillDsCell(3, 0, '4');
        await ctx.delay(200);
        fillDsCell(4, 0, '5');
        await ctx.delay(600);

        // Spotlight the grid showing all rows
        const grid = document.querySelector<HTMLElement>(HAR.DS_GRID);
        if (grid) {
          await spotlight(grid, 2000, ctx);
          await ctx.delay(500);
        }

        // Highlight a checkbox to show enable/disable
        const checkboxes = document.querySelectorAll<HTMLElement>(HAR.DS_ROW_CHECKBOX);
        if (checkboxes.length > 0) {
          await spotlight(checkboxes[0], 1200, ctx);
          await ctx.delay(400);
        }

        // Show updated Run Preview (5 rows → 5 requests)
        const preview = document.querySelector<HTMLElement>(HAR.DS_PREVIEW);
        if (preview) await spotlight(preview, 1800, ctx);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 6: Tag & Filter Rows ───────────────────────────────
    {
      id: 'th5-tags',
      title: 'Tag & Filter Rows',
      description:
        'Tags let you label rows for filtered execution. In the **Parameterized Runner**, ' +
        'you can run only rows matching specific tags — for example, run just `smoke` rows ' +
        'for a quick sanity check, or `regression` for a full sweep.\n\n' +
        'Click the **tag icon** next to a row to add a tag. Once tags exist, a **filter bar** ' +
        'appears above the grid — click a tag name to show only matching rows.',
      highlight: HAR.DS_TAG_ADD_BTN,

      preAction: async (ctx) => {
        if (!isTestEditorOpen() || !document.querySelector(HAR.DS_GRID)) {
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        // Highlight tag add button first
        const tagAddBtn = document.querySelector<HTMLElement>(HAR.DS_TAG_ADD_BTN);
        if (tagAddBtn) {
          await spotlight(tagAddBtn, 1500, ctx);
          await ctx.delay(500);
        }

        // Add "smoke" tags to first 2 rows
        for (let i = 0; i < 2; i++) {
          const btn = document.querySelector<HTMLElement>(HAR.DS_TAG_ADD_BTN);
          if (!btn) break;
          btn.click();
          await ctx.delay(400);
          const tagInput = document.querySelector<HTMLInputElement>(HAR.DS_TAG_INPUT);
          if (tagInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(tagInput, 'smoke');
            tagInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(200);
            tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await ctx.delay(600);
          }
        }

        // Highlight the tag pills
        const pills = document.querySelectorAll<HTMLElement>(HAR.DS_TAG_PILL);
        if (pills.length > 0) {
          await spotlight(pills[0], 1500, ctx);
          await ctx.delay(500);
        }

        // Show the filter bar
        const filterBar = document.querySelector<HTMLElement>(HAR.DS_TAG_FILTER_BAR);
        if (filterBar) {
          await spotlight(filterBar, 2000, ctx);
          await ctx.delay(500);

          // Click "smoke" filter to demonstrate filtering
          const smokeBtn = Array.from(filterBar.querySelectorAll<HTMLElement>(HAR.DS_TAG_FILTER_BTN))
            .find(btn => btn.textContent?.includes('smoke'));
          if (smokeBtn) {
            await spotlight(smokeBtn, 1200, ctx);
            await ctx.delay(300);
            smokeBtn.click();
            await ctx.delay(1000);
          }

          // Reset to All
          await ctx.delay(500);
          const allBtn = filterBar.querySelector<HTMLElement>(HAR.DS_TAG_FILTER_BTN);
          if (allBtn) {
            allBtn.click();
            await ctx.delay(500);
          }
        }
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 7: Save & Review ───────────────────────────────────
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

        // Highlight the PARAM badge
        const badge = document.querySelector<HTMLElement>(HAR.DS_PARAM_BADGE);
        if (badge) await spotlight(badge, 1500, ctx);
        await ctx.delay(400);

        const testCard = document.querySelector<HTMLElement>(HAR.TEST_CARD);
        if (testCard) await spotlight(testCard, 2000, ctx);
      },

      verify: HAR.TEST_CARD,
    },
  ],
};
