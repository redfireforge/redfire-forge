/**
 * TH-5 — Data Source Authoring
 *
 * 6 steps: see the parameterized scenario → open the Data Source tab →
 * understand the grid and column types → add data rows → tag and filter
 * rows → save.
 *
 * Teaches how data-driven testing works at the data source level.
 * The setup wizard (how data sources are created from scratch) is
 * mentioned in descriptions; advanced topics (CSV import, Shared DS)
 * are covered in later lessons.
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
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thDataSourcesLesson: DemoLesson = {
  id: 'th-data-sources',
  domainId: 'harness',
  category: 'data-driven',
  name: 'Data Source Authoring',
  description:
    'Understand data-driven testing — see parameterized scenarios, the data source grid, ' +
    'column types, add rows with tags, and preview execution.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Data-Driven Testing',
    body:
      'Data-driven testing runs the **same test** with **multiple sets of input data**. ' +
      'Each row in the data source becomes a separate HTTP request with substituted values.\n\n' +
      '**Key concepts:**\n' +
      '- **Parameterized Scenario** — a scenario whose tests use `{{variable}}` placeholders in URLs, bodies, or headers\n' +
      '- **Data Source** — a table of columns (variables) and rows (test data) attached to each test\n' +
      '- **Column Types** — Path (URL segments), Param (query strings), Body (JSON fields), Header (HTTP headers), Validate (per-row expected values)\n' +
      '- **Tags** — labels on rows for filtered execution (e.g., run only `smoke`-tagged rows)\n\n' +
      '**In this lesson:** You will explore a pre-configured data source, add rows, tag them, ' +
      'and see how they translate into requests.',
    keyTerms: [
      { term: 'Parameterized Scenario', definition: 'A scenario whose tests have data sources — each row generates a unique request.' },
      { term: 'Data Source', definition: 'A table of columns and rows attached to a test — defines the input data for each execution.' },
      { term: 'Column Type', definition: 'Determines where data is injected: Path, Param, Body, Header, or Validate.' },
      { term: 'Row Tags', definition: 'Labels on data rows used to filter which rows execute during a run.' },
    ],
    diagram: `<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="100" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="20" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Data Source</text>
      <text x="55" y="34" text-anchor="middle" fill="#94a3b8" font-size="6">userId | _fields</text>
      <text x="55" y="46" text-anchor="middle" fill="#94a3b8" font-size="6">1 | name,email</text>
      <text x="55" y="58" text-anchor="middle" fill="#94a3b8" font-size="6">2 | name,email</text>
      <text x="55" y="70" text-anchor="middle" fill="#94a3b8" font-size="6">3 | name,email</text>
      <path d="M110 40 L140 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th5arr)"/>
      <rect x="145" y="10" width="100" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="195" y="26" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">URL Template</text>
      <text x="195" y="42" text-anchor="middle" fill="#94a3b8" font-size="5">/users/{{userId}}</text>
      <text x="195" y="56" text-anchor="middle" fill="#94a3b8" font-size="5">?_fields={{_fields}}</text>
      <path d="M250 40 L280 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th5arr)"/>
      <rect x="285" y="10" width="70" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="320" y="26" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Requests</text>
      <text x="320" y="40" text-anchor="middle" fill="#94a3b8" font-size="6">/users/1?...</text>
      <text x="320" y="52" text-anchor="middle" fill="#94a3b8" font-size="6">/users/2?...</text>
      <text x="320" y="64" text-anchor="middle" fill="#94a3b8" font-size="6">/users/3?...</text>
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
    // ── Step 1: Parameterized Scenarios ──────────────────────────
    {
      id: 'th5-param-scenario',
      title: 'Parameterized Scenarios',
      description:
        'In the Feature Groups tree, notice the **PARAM** badge next to the scenario name — ' +
        'this marks it as a **parameterized scenario**.\n\n' +
        'Parameterized scenarios support data-driven testing: each test has a **data source** ' +
        '(a table of variables and values), and each row generates a separate HTTP request ' +
        'with substituted values.\n\n' +
        'The test card shows the URL template with `{{userId}}` — this placeholder will be ' +
        'replaced by values from the data source.',
      highlight: HAR.DS_PARAM_BADGE,

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
        await ensureTh5FgExists(ctx);
        await ctx.delay(400);
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(400);

        const badge = document.querySelector<HTMLElement>(HAR.DS_PARAM_BADGE);
        if (badge) await spotlight(badge, 1800, ctx);

        const testCard = document.querySelector<HTMLElement>(HAR.TEST_CARD);
        if (testCard) await spotlight(testCard, 1200, ctx);
      },

      verify: HAR.DS_PARAM_BADGE,
    },

    // ── Step 2: The Data Source Tab ──────────────────────────────
    {
      id: 'th5-data-tab',
      title: 'The Data Source Tab',
      description:
        'Open the test editor and look at the **Data Source** tab — it appears only for tests ' +
        'inside parameterized scenarios.\n\n' +
        'The tab badge shows how many data rows are enabled. Click it to see the data grid ' +
        'where you define the input data for each test execution.',
      highlight: HAR.TE_TABS,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        await ensureTh5FgExists(ctx);
        if (!isTestEditorOpen()) {
          await openTh5TestEditor(ctx);
        }
      },

      action: async (ctx) => {
        if (!isTestEditorOpen()) {
          await openTh5TestEditor(ctx);
          await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
          await ctx.delay(600);
        }

        const dsTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('Data Source') || t.textContent?.includes('Parameterize'));
        if (dsTab) {
          await spotlight(dsTab, 1500, ctx);
          if (!dsTab.classList.contains('active')) {
            dsTab.click();
            await ctx.delay(800);
          }
        }

        const grid = document.querySelector<HTMLElement>(HAR.DS_GRID);
        if (grid) await spotlight(grid, 1500, ctx);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 3: Grid Overview & Column Types ─────────────────────
    {
      id: 'th5-grid-overview',
      title: 'The Data Source Grid',
      description:
        'The grid shows your data columns and rows. Each column has a **type** that determines ' +
        'where data is injected into the request:\n\n' +
        '- **Path** — replaces URL path segments (`/users/{{userId}}`)\n' +
        '- **Param** — adds query parameters (`?_fields=name`)\n' +
        '- **Body** — fills JSON body fields\n' +
        '- **Header** — sets HTTP header values\n' +
        '- **Validate** — defines per-row expected values for assertions\n\n' +
        'The **Run Preview** at the bottom shows how many requests will be generated.',
      highlight: HAR.DS_COL_HEADER,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        const colHeader = document.querySelector<HTMLElement>(HAR.DS_COL_HEADER);
        if (colHeader) await spotlight(colHeader, 1500, ctx);

        const typeSelect = document.querySelector<HTMLElement>(HAR.DS_COL_TYPE_SELECT);
        if (typeSelect) await spotlight(typeSelect, 1200, ctx);

        const footer = document.querySelector<HTMLElement>(HAR.DS_PREVIEW);
        if (footer) await spotlight(footer, 1200, ctx);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 4: Add Data Rows ────────────────────────────────────
    {
      id: 'th5-add-rows',
      title: 'Add Data Rows',
      description:
        'Click **+ Row** to add more data. Each row represents one test execution ' +
        'with its own substituted values.\n\n' +
        'The **enable/disable** checkbox on each row lets you skip specific rows ' +
        'without deleting them — useful for temporarily excluding problematic inputs.\n\n' +
        'Watch the **Run Preview** update as rows are added: more rows = more requests.',
      highlight: HAR.DS_TOOLBAR,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
        const addRowBtn = document.querySelector<HTMLElement>(HAR.DS_ADD_ROW_BTN);
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
        await ctx.delay(400);

        const grid = document.querySelector<HTMLElement>(HAR.DS_GRID);
        if (grid) await spotlight(grid, 1500, ctx);

        const checkboxes = document.querySelectorAll<HTMLElement>(HAR.DS_ROW_CHECKBOX);
        if (checkboxes.length > 0) await spotlight(checkboxes[0], 1000, ctx);

        const preview = document.querySelector<HTMLElement>(HAR.DS_PREVIEW);
        if (preview) await spotlight(preview, 1200, ctx);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 5: Tag & Filter Rows ────────────────────────────────
    {
      id: 'th5-tags',
      title: 'Tag & Filter Rows',
      description:
        'Tags let you label rows for filtered execution. In the **Parameterized Runner**, ' +
        'you can run only rows matching specific tags — for example, run just `smoke` rows ' +
        'for a quick check.\n\n' +
        'Click **+** next to a row to add a tag. The **tag filter bar** appears once tags exist, ' +
        'letting you view subsets of rows in the grid.',
      highlight: HAR.DS_TAG_ADD_BTN,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh5FgExists(ctx);
          await openTh5TestEditor(ctx);
        }
        await navigateToDataSourceTab(ctx);
      },

      action: async (ctx) => {
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
            await ctx.delay(500);
          }
        }

        const pills = document.querySelectorAll<HTMLElement>(HAR.DS_TAG_PILL);
        if (pills.length > 0) await spotlight(pills[0], 1200, ctx);

        const filterBar = document.querySelector<HTMLElement>(HAR.DS_TAG_FILTER_BAR);
        if (filterBar) {
          await spotlight(filterBar, 1500, ctx);

          const smokeBtn = Array.from(filterBar.querySelectorAll<HTMLElement>(HAR.DS_TAG_FILTER_BTN))
            .find(btn => btn.textContent?.includes('smoke'));
          if (smokeBtn) {
            smokeBtn.click();
            await ctx.delay(800);
          }

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

    // ── Step 6: Save & Review ────────────────────────────────────
    {
      id: 'th5-save',
      title: 'Save & Review',
      description:
        'Click **Save** to persist your data source configuration.\n\n' +
        'Back in the tree, the test now has 5 data rows. In the **Parameterized Runner** ' +
        '(TH-6), each row generates a separate request with its own substituted URL.\n\n' +
        'For larger data sets, use **Import** in the editor header to load CSV/JSON/Excel files, ' +
        'or link to **Shared Data Sources** for reusable row sets across multiple tests.',
      highlight: HAR.TE_SAVE_BTN,

      preAction: async (ctx) => {
        await ensureTh5FgExists(ctx);
        if (!isTestEditorOpen()) {
          await openTh5TestEditor(ctx);
          await navigateToDataSourceTab(ctx);
        }
      },

      action: async (ctx) => {
        await ctx.click(HAR.TE_SAVE_BTN);
        await ctx.delay(1000);

        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(600);

        const testCard = document.querySelector<HTMLElement>(HAR.TEST_CARD);
        if (testCard) await spotlight(testCard, 1500, ctx);
      },

      verify: HAR.TEST_CARD,
    },
  ],
};
