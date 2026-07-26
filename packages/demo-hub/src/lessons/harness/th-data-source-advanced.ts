/**
 * TH-18: Data Source Advanced Features
 *
 * 5 steps: Row Detail Modal → Verify & Inspect Modal →
 * Validation Contract Panel → Toolbar Data Mapper integrations →
 * Shared Data Sources.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  seedDemoEnvAndService,
  deleteTh18DemoFg,
  seedTh18FeatureGroup,
  ensureTh18FgExists,
  expandFirstFg,
  expandFirstScenario,
  navigateToDataSourceTab,
  isTestEditorOpen,
  closeTestEditorQuiet,
  closeInlineNameFormQuiet,
  closeRowDetailModal,
  closeVerifyModal,
  closeContractPanel,
  closeSharedDsModal,
  findDsToolbarBtn,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh18Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh18FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
}

async function openTh18TestEditor(ctx: DemoActionContext): Promise<void> {
  if (isTestEditorOpen()) return;
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
  await ctx.delay(300);
  const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
  if (editBtn) {
    editBtn.click();
    await ctx.delay(600);
  }
}

async function ensureOnDataTab(ctx: DemoActionContext): Promise<void> {
  if (!isTestEditorOpen()) {
    await openTh18TestEditor(ctx);
    await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
    await ctx.delay(400);
  }
  await navigateToDataSourceTab(ctx);
}

function closeAllModals(): void {
  closeRowDetailModal();
  closeVerifyModal();
  closeContractPanel();
  closeSharedDsModal();
}

/* ── lesson definition ──────────────────────────────────────── */

export const thDataSourceAdvancedLesson: DemoLesson = {
  id: 'th-data-source-advanced',
  domainId: 'harness',
  category: 'data-driven',
  name: 'Data Source Advanced Features',
  description:
    'Explore advanced data source capabilities — per-row detail editing, batch verification, ' +
    'validation contracts, Data Mapper integrations, and shared data sources.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Advanced Data Source Tools',
    body:
      'Beyond basic column/row editing, RedfireForge offers powerful data source features:\n\n' +
      '**Row Detail Modal** — inspect, label, and fetch individual rows with URL preview\n' +
      '**Verify & Inspect** — batch-verify all rows against live API responses\n' +
      '**Validation Contract** — enforce array consistency across data rows (Dynamic vs Fixed, Ordered vs Unordered)\n' +
      '**From API** — populate rows from a live API response via Data Mapper\n' +
      '**Map Columns** — visually connect columns to request template slots\n' +
      '**Shared Data Sources** — maintain one dataset used by multiple tests, with fetch config and cURL import',
    keyTerms: [
      { term: 'Row Detail', definition: 'Per-row modal showing all column values, URL preview, and per-row fetch.' },
      { term: 'Verify All', definition: 'Batch verification — sends every enabled row and compares validate columns.' },
      { term: 'Validation Contract', definition: 'Enforces array size and order consistency across data rows.' },
      { term: 'Shared Data Source', definition: 'A reusable dataset linked to multiple tests — re-fetch updates all.' },
    ],
    diagram: `<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="80" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="45" y="22" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Data Grid</text>
      <text x="45" y="36" text-anchor="middle" fill="#94a3b8" font-size="5">3 rows • 2 cols</text>
      <text x="45" y="50" text-anchor="middle" fill="#94a3b8" font-size="5">✎ Row Detail</text>
      <text x="45" y="64" text-anchor="middle" fill="#94a3b8" font-size="5">▶ Verify All</text>
      <path d="M90 40 L115 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th18arr)"/>
      <rect x="120" y="5" width="90" height="70" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="165" y="22" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Toolbar</text>
      <text x="165" y="36" text-anchor="middle" fill="#94a3b8" font-size="5">⬇ From API</text>
      <text x="165" y="50" text-anchor="middle" fill="#94a3b8" font-size="5">🔗 Map Columns</text>
      <text x="165" y="64" text-anchor="middle" fill="#94a3b8" font-size="5">Contract • Dist</text>
      <path d="M215 40 L240 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th18arr)"/>
      <rect x="245" y="5" width="110" height="70" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="300" y="22" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Shared DS</text>
      <text x="300" y="36" text-anchor="middle" fill="#94a3b8" font-size="5">📋 Fetch Config</text>
      <text x="300" y="50" text-anchor="middle" fill="#94a3b8" font-size="5">cURL Import</text>
      <text x="300" y="64" text-anchor="middle" fill="#94a3b8" font-size="5">Used by N tests</text>
      <defs><marker id="th18arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    deleteTh18DemoFg();
    closeInlineNameFormQuiet();
    await closeTestEditorQuiet(ctx);
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh18FeatureGroup(ctx);
    await ctx.delay(300);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    closeAllModals();
    await ctx.delay(200);
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    deleteTh18DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh18Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Row Detail Modal ──────────────────────────────────
    {
      id: 'th18-row-detail',
      title: 'Row Detail Modal',
      description:
        'Click the **✎ edit** button on any data row to open the **Row Detail Modal** — ' +
        'a per-row view showing all column values grouped by type (path, validate) with ' +
        'colored type badges.\n\n' +
        'The modal includes a **Row Name** field for labeling rows (e.g., "Admin User"), ' +
        'a **URL Preview** showing the resolved method + URL with substituted values, ' +
        'and a **Fetch Response** button to send the request for just this one row.\n\n' +
        'Row detail is useful for debugging why a specific data row fails — inspect its ' +
        'substituted URL, fetch its response, and verify its validate columns.',
      highlight: HAR.ROW_DETAIL_MODAL,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeAllModals();
        await ensureOnDataTab(ctx);
        if (!document.querySelector(HAR.ROW_DETAIL_MODAL)) {
          const editBtns = document.querySelectorAll<HTMLElement>(HAR.ROW_EDIT_BTN);
          for (const btn of editBtns) {
            if (btn.title?.includes('Edit row') || btn.title?.includes('edit')) {
              btn.click();
              await ctx.delay(600);
              break;
            }
          }
        }
      },

      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>(HAR.ROW_DETAIL_MODAL);
        if (!modal) return;

        const fields = modal.querySelectorAll<HTMLElement>(HAR.ROW_DETAIL_FIELD);
        if (fields.length > 0) {
          await spotlight(fields[0], 1200, ctx);
        }

        const urlPreview = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_URL);
        if (urlPreview) {
          await spotlight(urlPreview, 1200, ctx);
        }

        const fetchBtn = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_FETCH);
        if (fetchBtn) {
          await spotlight(fetchBtn, 1000, ctx);
        }

        closeRowDetailModal();
        await ctx.delay(600);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 2: Verify & Inspect Modal ────────────────────────────
    {
      id: 'th18-verify-modal',
      title: 'Verify & Inspect Modal',
      description:
        'Click **▶ Verify All** in the toolbar to open the **Data Source — Verify & Inspect** ' +
        'modal. It shows a summary of enabled rows and columns.\n\n' +
        'Two primary actions:\n' +
        '- **▶ Verify All** — sends each row\'s request and compares validate columns against ' +
        'actual responses (green ✓ for match, red ✗ for mismatch)\n' +
        '- **⬇ Run & Capture** — fetches all rows and populates validate columns from live responses\n\n' +
        'The progress bar tracks batch execution, and per-row cards show individual results. ' +
        'This catches stale test data when the API changes.',
      highlight: HAR.VERIFY_MODAL,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeRowDetailModal();
        closeContractPanel();
        closeSharedDsModal();
        await ensureOnDataTab(ctx);
        if (!document.querySelector(HAR.VERIFY_MODAL)) {
          const verifyBtn = findDsToolbarBtn('Verify');
          if (verifyBtn) {
            verifyBtn.click();
            await ctx.delay(600);
          }
        }
      },

      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>(HAR.VERIFY_MODAL);
        if (!modal) return;

        const header = modal.querySelector<HTMLElement>('.verify-modal-header');
        if (header) {
          await spotlight(header, 1200, ctx);
        }

        const footer = modal.querySelector<HTMLElement>('.verify-modal-footer');
        if (footer) {
          await spotlight(footer, 1200, ctx);
        }

        const rowCards = modal.querySelector<HTMLElement>(HAR.VERIFY_ROW_CARDS);
        if (rowCards) {
          await spotlight(rowCards, 1200, ctx);
        }

        closeVerifyModal();
        await ctx.delay(600);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 3: Validation Contract Panel ─────────────────────────
    {
      id: 'th18-contract-panel',
      title: 'Validation Contract Panel',
      description:
        'Click the **Contract** button in the toolbar to toggle the **Validation Contract Panel** ' +
        'below the grid.\n\n' +
        'Two mode pairs control how arrays are validated across data rows:\n' +
        '- **⚡ Dynamic** — array sizes can vary between rows (flexible)\n' +
        '- **📌 Fixed** — all rows must return the same array structure (strict)\n' +
        '- **↕ Ordered** — elements must match in exact order\n' +
        '- **⟳ Unordered** — elements can appear in any order\n\n' +
        'This prevents flaky tests from server-side shuffling — e.g., "every row must return ' +
        'exactly 3 items in any order."',
      highlight: HAR.CONTRACT_PANEL,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeRowDetailModal();
        closeVerifyModal();
        closeSharedDsModal();
        await ensureOnDataTab(ctx);
        if (!document.querySelector(HAR.CONTRACT_PANEL)) {
          const contractBtn = findDsToolbarBtn('Contract');
          if (contractBtn) {
            contractBtn.click();
            await ctx.delay(500);
          }
        }
      },

      action: async (ctx) => {
        const panel = document.querySelector<HTMLElement>(HAR.CONTRACT_PANEL);
        if (!panel) return;

        const modeBtns = panel.querySelectorAll<HTMLElement>(HAR.CONTRACT_MODE_BTN);
        const sizeRow = Array.from(modeBtns).filter(b => {
          const t = b.textContent?.toLowerCase() ?? '';
          return t.includes('dynamic') || t.includes('fixed');
        });
        if (sizeRow.length > 0) {
          const parent = sizeRow[0].parentElement;
          if (parent) await spotlight(parent, 1200, ctx);
          else await spotlight(sizeRow[0], 1200, ctx);
        }

        const orderRow = Array.from(modeBtns).filter(b => {
          const t = b.textContent?.toLowerCase() ?? '';
          return t.includes('ordered') || t.includes('unordered');
        });
        if (orderRow.length > 0) {
          const parent = orderRow[0].parentElement;
          if (parent) await spotlight(parent, 1000, ctx);
          else await spotlight(orderRow[0], 1000, ctx);
        }

        closeContractPanel();
        await ctx.delay(600);
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 4: Data Mapper Integrations ──────────────────────────
    {
      id: 'th18-toolbar-mappers',
      title: 'Data Mapper Integrations',
      description:
        'The toolbar offers three powerful data management controls:\n\n' +
        '**⬇ From API** — opens the Data Mapper in populate mode: fetch an API response and ' +
        'map array items into data rows automatically. No manual data entry needed for ' +
        'API-driven parameterized tests.\n\n' +
        '**🔗 Map Columns** — opens the Data Mapper in column mapping mode: visually connect ' +
        'data columns to where they\'re used in the request template (path params, query params, ' +
        'body fields, headers).\n\n' +
        '**Distribution** — controls how rows are assigned to iterations: Sequential (in order), ' +
        'Random (shuffled), or Round Robin (even cycling).',
      highlight: HAR.DS_TOOLBAR,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeAllModals();
        await ensureOnDataTab(ctx);
      },

      action: async (ctx) => {
        const fromApiBtn = findDsToolbarBtn('From API');
        if (fromApiBtn) {
          await spotlight(fromApiBtn, 1200, ctx);
        }

        const mapColumnsBtn = findDsToolbarBtn('Map Columns');
        if (mapColumnsBtn) {
          await spotlight(mapColumnsBtn, 1200, ctx);
        }

        const distSelects = document.querySelectorAll<HTMLElement>('.data-source-toolbar-select');
        for (const sel of distSelects) {
          const trigger = sel.querySelector<HTMLElement>('.cs-trigger');
          const text = trigger?.textContent ?? sel.textContent ?? '';
          if (text.includes('Sequential') || text.includes('Random') || text.includes('Round Robin')) {
            await spotlight(sel, 1200, ctx);
            break;
          }
        }
      },

      verify: HAR.DS_TOOLBAR,
    },

    // ── Step 5: Shared Data Sources ───────────────────────────────
    {
      id: 'th18-shared-ds',
      title: 'Shared Data Sources',
      description:
        'Open the **📦 Shared Data Sources** modal from the header to manage reusable datasets.\n\n' +
        'The **list panel** on the left shows all shared data sources with search and **+ New**. ' +
        'Select one to see the **editor panel** on the right with the full data grid.\n\n' +
        'The **Fetch Panel** shows the configured API endpoint (method, URL, mapping chips), ' +
        'with tabs for Params, Auth, Headers, and Body. Use **cURL Import** to paste a cURL ' +
        'command, or **Populate Rows from API** to fetch and map via Data Mapper.\n\n' +
        'The **Used by** section shows which tests are linked — when you re-fetch, all ' +
        'linked tests get updated data automatically.',
      highlight: HAR.SHARED_DS_MODAL,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeRowDetailModal();
        closeVerifyModal();
        closeContractPanel();
        await closeTestEditorQuiet(ctx);
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          const sharedBtn = document.querySelector<HTMLElement>(HAR.SHARED_DS_BTN) ??
            Array.from(document.querySelectorAll<HTMLElement>('button'))
              .find(b => b.textContent?.includes('Shared Data Sources'));
          if (sharedBtn) {
            sharedBtn.click();
            await ctx.delay(600);
          }
        }
      },

      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>(HAR.SHARED_DS_MODAL);
        if (!modal) return;

        const listPanel = modal.querySelector<HTMLElement>(HAR.SHARED_DS_LIST);
        if (listPanel) {
          await spotlight(listPanel, 1200, ctx);
        }

        const editorPanel = modal.querySelector<HTMLElement>(HAR.SHARED_DS_EDITOR);
        if (editorPanel) {
          await spotlight(editorPanel, 1200, ctx);
        }

        const fetchPanel = modal.querySelector<HTMLElement>(HAR.SHARED_DS_FETCH);
        if (fetchPanel) {
          await spotlight(fetchPanel, 1500, ctx);

          const usedBy = modal.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY);
          if (usedBy) {
            await spotlight(usedBy, 1000, ctx);
          }
        }

        closeSharedDsModal();
        await ctx.delay(600);
      },

      verify: HAR.FG_CARD,
    },
  ],
};
