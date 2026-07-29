/**
 * TH-18: Data Source Advanced Features
 *
 * 6 steps: Add Validate Column → Row Detail (Admin User) → Verify & Inspect →
 * Validation Contract Panel → Toolbar Data Mapper integrations →
 * Shared Data Sources.
 *
 * Transition rule: never open/close a modal or panel silently.
 * Always spotlight the control → pause → click → pause on the outcome.
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
  fillDsDataCell,
  selectLastDsColumnType,
  scrollDsGridIntoView,
  fillNativeInput,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh18Ready(
  ctx: DemoActionContext,
  opts?: { forceSeed?: boolean; includeNameColumn?: boolean },
): Promise<void> {
  if (opts?.forceSeed) {
    await ensureTh18FgExists(ctx, {
      force: true,
      includeNameColumn: opts.includeNameColumn,
    });
  } else {
    await ensureTh18FgExists(ctx);
  }
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
  const mapperCancel = document.querySelector<HTMLElement>(HAR.MAPPER_CANCEL_BTN);
  mapperCancel?.click();
}

/** First-row ✎ Edit button in the data source grid. */
function findFirstRowEditBtn(): HTMLElement | null {
  return document.querySelector<HTMLElement>(HAR.ROW_EDIT_BTN);
}

/** Spotlight a control, pause, then click — the canonical open/close path. */
async function highlightPauseClick(
  el: HTMLElement,
  ctx: DemoActionContext,
  highlightMs = 2800,
  afterPauseMs = 900,
): Promise<void> {
  el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  await ctx.delay(200);
  await spotlight(el, highlightMs, ctx);
  await ctx.delay(afterPauseMs);
  el.click();
}

async function waitUntilGone(selector: string, ctx: DemoActionContext, attempts = 12): Promise<void> {
  for (let i = 0; i < attempts && document.querySelector(selector); i++) {
    await ctx.delay(120);
  }
}

async function closeMapperVisibly(ctx: DemoActionContext): Promise<void> {
  const cancel = document.querySelector<HTMLElement>(HAR.MAPPER_CANCEL_BTN);
  if (!cancel) return;
  await highlightPauseClick(cancel, ctx, 1600, 500);
  await waitUntilGone(HAR.MAPPER_SHELL, ctx);
  await ctx.delay(600);
}

async function closeVerifyVisibly(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>(HAR.VERIFY_MODAL);
  if (!modal) return;
  const closeBtn = Array.from(modal.querySelectorAll<HTMLElement>('.verify-modal-footer button'))
    .find(b => b.textContent?.trim() === 'Close');
  if (closeBtn) {
    await highlightPauseClick(closeBtn, ctx, 1600, 500);
  } else {
    closeVerifyModal();
  }
  await waitUntilGone(HAR.VERIFY_MODAL, ctx);
  await ctx.delay(500);
}

async function closeRowDetailVisibly(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>(HAR.ROW_DETAIL_MODAL);
  if (!modal) return;
  const footerBtns = modal.querySelectorAll<HTMLElement>('.modal-footer button, .wf-config-modal-footer button');
  const closeBtn = Array.from(footerBtns).find(b => {
    const t = b.textContent?.trim();
    return t === 'Close' || t === 'Cancel';
  });
  if (closeBtn) {
    await highlightPauseClick(closeBtn, ctx, 1600, 500);
  } else {
    closeRowDetailModal();
  }
  await waitUntilGone(HAR.ROW_DETAIL_MODAL, ctx);
  await ctx.delay(500);
}

async function closeSharedDsVisibly(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>(HAR.SHARED_DS_MODAL);
  if (!modal) return;
  const closeBtn = Array.from(modal.querySelectorAll<HTMLElement>('.shared-ds-footer button, .modal-footer button'))
    .find(b => {
      const t = b.textContent?.trim();
      return t === 'Close' || t === 'Cancel';
    });
  if (closeBtn) {
    await highlightPauseClick(closeBtn, ctx, 1600, 500);
  } else {
    closeSharedDsModal();
  }
  await waitUntilGone(HAR.SHARED_DS_MODAL, ctx);
  await ctx.delay(500);
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
  estimatedMinutes: 8,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Advanced Data Source Tools',
    body:
      'Beyond basic column/row editing, RedfireForge offers powerful data source features:\n\n' +
      '**Validate columns** — add a column typed Validate with a JSON path (e.g. `$.name`) to store expected values\n' +
      '**Row Detail Modal** — inspect, label, and fetch individual rows with URL preview\n' +
      '**Verify & Inspect** — batch-verify all rows against live API responses\n' +
      '**Validation Contract** — enforce array consistency across data rows (Dynamic vs Fixed, Ordered vs Unordered)\n' +
      '**From API** — populate rows from a live API response via Data Mapper\n' +
      '**Map Columns** — visually connect columns to request template slots\n' +
      '**Shared Data Sources** — maintain one dataset used by multiple tests, with fetch config and cURL import',
    keyTerms: [
      { term: 'Validate Column', definition: 'A data-source column typed Validate — stores expected values compared to a JSON path in the response.' },
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
    // Start without the Validate `name` column — step 1 demos + Column live
    await seedTh18FeatureGroup(ctx, { includeNameColumn: false });
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
    // ── Step 1: Add Validate `name` column ────────────────────────
    {
      id: 'th18-add-name-column',
      title: 'Add Validate Column',
      description:
        'Start with only a **userId** path column. Click **+ Column**, rename it to `name`, ' +
        'and set the type to **Validate**.\n\n' +
        'The JSON path **`$.name`** appears under the header — that is the field in the API ' +
        'response this column will compare against. Then fill expected names for each row ' +
        '(Admin User → `Leanne Graham`, and so on).',
      highlight: HAR.DS_ADD_COL_BTN,
      pauseAfter: 4000,

      preAction: async (ctx) => {
        // Fresh grid without the name column so + Column is a real beat
        await ensureTh18Ready(ctx, { forceSeed: true, includeNameColumn: false });
        closeAllModals();
        await ensureOnDataTab(ctx);
        closeRowDetailModal();
        await ctx.delay(300);
      },

      action: async (ctx) => {
        const addColBtn =
          document.querySelector<HTMLElement>(HAR.DS_ADD_COL_BTN)
          ?? findDsToolbarBtn('Add a new column')
          ?? findDsToolbarBtn('+ Column');
        if (!addColBtn) return;

        await highlightPauseClick(addColBtn, ctx, 2800, 900);
        await ctx.delay(700);
        scrollDsGridIntoView({ horizontal: true, vertical: false });
        await ctx.delay(400);

        // Rename the new column to "name"
        const nameSpans = document.querySelectorAll<HTMLElement>('.data-source-col-name');
        const newColName = nameSpans[nameSpans.length - 1];
        if (newColName) {
          await spotlight(newColName, 1600, ctx);
          await ctx.delay(400);
          newColName.click();
          await ctx.delay(400);
          const input = document.querySelector<HTMLInputElement>('.data-source-col-name-input');
          if (input) {
            fillNativeInput('.data-source-col-name-input', 'name');
            await ctx.delay(500);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            input.blur();
            await ctx.delay(500);
          }
        }

        // Set type → Validate (last column's type select)
        const typeWraps = document.querySelectorAll<HTMLElement>(HAR.DS_COL_TYPE_SELECT);
        const lastType = typeWraps[typeWraps.length - 1];
        if (lastType) {
          await spotlight(lastType, 1600, ctx);
          await ctx.delay(500);
        }
        await selectLastDsColumnType(ctx, 'Validate');
        await ctx.delay(800);

        // Outcome: name + $.name under Validate header
        const mappingEl = document.querySelector<HTMLElement>(HAR.DS_COL_MAPPING);
        if (mappingEl) {
          const header = mappingEl.closest<HTMLElement>('.data-source-col-header') ?? mappingEl;
          await spotlight(header, 3000, ctx);
          await ctx.delay(1000);
        }

        // Fill expected values (data col index 1 = name, after userId)
        const expectedNames = ['Leanne Graham', 'Ervin Howell', 'Clementine Bauch'];
        for (let i = 0; i < expectedNames.length; i++) {
          fillDsDataCell(i, 1, expectedNames[i]);
          await ctx.delay(350);
        }
        await ctx.delay(400);

        const firstNameCell = document.querySelector<HTMLElement>(
          'input.data-source-cell-input[data-row="0"][data-col="1"]',
        );
        if (firstNameCell) {
          await spotlight(firstNameCell, 2000, ctx);
          await ctx.delay(700);
        }
      },

      verify: HAR.DS_COL_MAPPING,
    },

    // ── Step 2: Row Detail — Admin User ───────────────────────────
    {
      id: 'th18-row-detail',
      title: 'Row Detail — Admin User',
      description:
        'Focus on **Row 1 — Admin User**. Open **✎ edit** → **Fetch Response**. ' +
        'When the purple banner appears, choose **Keep Rules & Update Values** (not Clear Rules).\n\n' +
        'Watch what happens: the banner closes, `$.name` stays selected, and the expected value ' +
        'refreshes from the live response. Then **Save** to write it back to the grid.',
      highlight: HAR.ROW_EDIT_BTN,
      pauseAfter: 4500,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeAllModals();
        await ensureOnDataTab(ctx);
        // Rapid-Next / skip path: ensure Validate name column exists
        if (!document.querySelector(HAR.DS_COL_MAPPING)) {
          await ensureTh18Ready(ctx, { forceSeed: true, includeNameColumn: true });
          await ensureOnDataTab(ctx);
        }
        closeRowDetailModal();
        await ctx.delay(300);
        await waitUntilGone(HAR.ROW_DETAIL_MODAL, ctx);
      },

      action: async (ctx) => {
        if (document.querySelector(HAR.ROW_DETAIL_MODAL)) {
          closeRowDetailModal();
          await ctx.delay(400);
        }

        // Spotlight Admin User row label so the viewer knows which row
        const adminLabel = Array.from(
          document.querySelectorAll<HTMLElement>('.data-source-label-input, .data-source-row'),
        ).find(el => /Admin User/i.test((el as HTMLInputElement).value || el.textContent || ''));
        if (adminLabel) {
          const row = adminLabel.closest<HTMLElement>('.data-source-row') ?? adminLabel;
          await spotlight(row, 2200, ctx);
          await ctx.delay(700);
        }

        const editBtn = findFirstRowEditBtn();
        if (!editBtn) return;
        await highlightPauseClick(editBtn, ctx, 2800, 900);
        await ctx.waitFor(HAR.ROW_DETAIL_MODAL, 5000);
        await ctx.delay(1200);

        const modal = document.querySelector<HTMLElement>(HAR.ROW_DETAIL_MODAL);
        if (!modal) return;

        // Show existing $.name rule before fetch
        const rulesBefore = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_VALIDATION_TABLE);
        if (rulesBefore) {
          await spotlight(rulesBefore, 2000, ctx);
          await ctx.delay(600);
        }

        const urlPreview = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_URL);
        if (urlPreview) {
          await spotlight(urlPreview, 1600, ctx);
          await ctx.delay(500);
        }

        const fetchBtn = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_FETCH);
        if (fetchBtn) {
          await highlightPauseClick(fetchBtn, ctx, 2600, 800);

          // Wait for 200 OK / error, then the confirm banner
          await ctx.delay(1500);
          const statusEl =
            modal.querySelector<HTMLElement>('.row-detail-fetch-status')
            ?? modal.querySelector<HTMLElement>('.row-detail-fetch-error');
          if (statusEl) {
            await spotlight(statusEl, 1600, ctx);
            await ctx.delay(500);
          }

          // Wait for the purple confirm banner (existing rules → Keep / Clear choice)
          let confirmBar: HTMLElement | null = null;
          for (let i = 0; i < 40 && !confirmBar; i++) {
            confirmBar = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_FETCH_CONFIRM);
            if (!confirmBar) await ctx.delay(200);
          }

          if (confirmBar) {
            // Let the viewer read the banner + three choices
            await spotlight(confirmBar, 3200, ctx);
            await ctx.delay(1000);

            const keepBtn =
              modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_KEEP_RULES)
              ?? Array.from(modal.querySelectorAll<HTMLElement>('button'))
                .find(b => /Keep Rules/i.test(b.textContent ?? ''))
              ?? null;

            if (keepBtn) {
              // Climax: click Keep Rules & Update Values and show the outcome
              await highlightPauseClick(keepBtn, ctx, 3000, 1000);
              await waitUntilGone(HAR.ROW_DETAIL_FETCH_CONFIRM, ctx, 20);
              await ctx.delay(800);

              // Outcome: banner gone; $.name rule still present with refreshed value
              const rulesAfter = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_VALIDATION_TABLE);
              if (rulesAfter) {
                await spotlight(rulesAfter, 3000, ctx);
                await ctx.delay(1000);
              }
              const pathCell = Array.from(modal.querySelectorAll<HTMLElement>('code'))
                .find(c => (c.textContent ?? '').includes('$.name') || c.textContent === 'name');
              if (pathCell) {
                const row = pathCell.closest('tr') ?? pathCell;
                await spotlight(row as HTMLElement, 2800, ctx);
                await ctx.delay(900);
              }
            }
          }
        }

        // Save so the grid picks up refreshed values
        const saveBtn = Array.from(modal.querySelectorAll<HTMLElement>('button'))
          .find(b => b.textContent?.trim() === 'Save');
        if (saveBtn) {
          await highlightPauseClick(saveBtn, ctx, 2200, 700);
          await waitUntilGone(HAR.ROW_DETAIL_MODAL, ctx);
          await ctx.delay(700);
          // Outcome on the grid: validate cell still shows Leanne Graham
          const nameCell = Array.from(
            document.querySelectorAll<HTMLElement>('.data-source-cell-input, .data-source-cell'),
          ).find(el => /Leanne Graham/i.test((el as HTMLInputElement).value || el.textContent || ''));
          if (nameCell) {
            await spotlight(nameCell, 2200, ctx);
            await ctx.delay(800);
          }
        } else {
          await closeRowDetailVisibly(ctx);
        }
      },

      verify: HAR.DS_GRID,
    },

    // ── Step 3: Verify & Inspect Modal ────────────────────────────
    {
      id: 'th18-verify-modal',
      title: 'Verify & Inspect Modal',
      description:
        'Look at **▶ Verify All** in the Data Source toolbar — click it to open the ' +
        '**Data Source — Verify & Inspect** modal.\n\n' +
        'The **Validate** column stores expected values (e.g. `Leanne Graham`). Its mapping is ' +
        '`$.name` — that is the field in the live API response ' +
        '(`https://jsonplaceholder.typicode.com/users/1` returns `"name": "Leanne Graham"`).\n\n' +
        'Inside the modal we click **▶ Verify All** to fetch each row and compare:\n' +
        '- green **✓** when expected matches `$.name` from the response\n' +
        '- red **✗** when values differ\n\n' +
        '**⬇ Run & Capture** can also populate validate columns from live responses.',
      highlight: HAR.DS_VERIFY_OPEN_BTN,
      pauseAfter: 4500,

      preAction: async (ctx) => {
        // Force re-seed so validate column maps to $.name (live jsonplaceholder names)
        await ensureTh18Ready(ctx, { forceSeed: true, includeNameColumn: true });
        closeRowDetailModal();
        closeContractPanel();
        closeSharedDsModal();
        closeVerifyModal();
        await ensureOnDataTab(ctx);
        closeVerifyModal();
        await ctx.delay(300);
        for (let i = 0; i < 12 && document.querySelector(HAR.VERIFY_MODAL); i++) {
          closeVerifyModal();
          await ctx.delay(120);
        }
        const verifyBtn =
          document.querySelector<HTMLElement>(HAR.DS_VERIFY_OPEN_BTN) ?? findDsToolbarBtn('Verify');
        verifyBtn?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        if (document.querySelector(HAR.VERIFY_MODAL)) {
          closeVerifyModal();
          await ctx.delay(500);
          await waitUntilGone(HAR.VERIFY_MODAL, ctx);
        }

        // Show the Validate column — mapping is $.name (API field), not a fake response key
        const validateHeader = Array.from(
          document.querySelectorAll<HTMLElement>('.data-source-col-header'),
        ).find(h => {
          const name = h.querySelector('.data-source-col-name')?.textContent ?? '';
          return name.includes('name') || name.includes('expected');
        });
        if (validateHeader) {
          await spotlight(validateHeader, 2800, ctx);
          await ctx.delay(900);
        }

        // 1) Open modal from toolbar
        const openBtn =
          document.querySelector<HTMLElement>(HAR.DS_VERIFY_OPEN_BTN) ?? findDsToolbarBtn('Verify');
        if (!openBtn) return;

        await highlightPauseClick(openBtn, ctx, 3000, 1000);
        await ctx.waitFor(HAR.VERIFY_MODAL, 5000);
        await ctx.delay(1200);

        const modal = document.querySelector<HTMLElement>(HAR.VERIFY_MODAL);
        if (!modal) return;

        // Brief look at pending cards (Actual still —)
        const rowCards = modal.querySelector<HTMLElement>(HAR.VERIFY_ROW_CARDS);
        if (rowCards) {
          await spotlight(rowCards, 1600, ctx);
          await ctx.delay(600);
        }

        // 2) Click ▶ Verify All inside the modal to run live validation
        const runBtn = Array.from(modal.querySelectorAll<HTMLElement>('.verify-modal-footer button'))
          .find(b => /Verify All|Re-verify/i.test(b.textContent ?? ''));
        if (!runBtn) return;

        runBtn.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
        await highlightPauseClick(runBtn, ctx, 2800, 900);

        // Wait for verification to finish (3 live API calls)
        for (let i = 0; i < 50; i++) {
          const done =
            document.querySelector(HAR.VERIFY_STATS)
            || document.querySelector('.verify-stat-fail')
            || document.querySelector('.verify-stat-error')
            || Array.from(document.querySelectorAll('.verify-modal-footer button'))
              .some(b => b.textContent?.includes('Re-verify'));
          if (done) break;
          await ctx.delay(400);
        }
        await ctx.delay(1000);

        // 3) Highlight live results — summary + passed cards + actual values
        const summary = document.querySelector<HTMLElement>(HAR.VERIFY_SUMMARY);
        if (summary) {
          await spotlight(summary, 2500, ctx);
          await ctx.delay(800);
        }

        const passCard = document.querySelector<HTMLElement>(HAR.VERIFY_CARD_PASS);
        if (passCard) {
          passCard.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
          await spotlight(passCard, 2500, ctx);
          await ctx.delay(800);
        }

        const actualPass = document.querySelector<HTMLElement>(HAR.VERIFY_ACTUAL_PASS);
        if (actualPass) {
          await spotlight(actualPass, 2200, ctx);
          await ctx.delay(800);
        } else if (rowCards) {
          // Fallback: show cards after run even if status classes differ
          await spotlight(rowCards, 2000, ctx);
          await ctx.delay(700);
        }

        await closeVerifyVisibly(ctx);
      },

      verify: HAR.DS_VERIFY_OPEN_BTN,
    },

    // ── Step 4: Validation Contract Panel ─────────────────────────
    {
      id: 'th18-contract-panel',
      title: 'Validation Contract Panel',
      description:
        'Look at the **Contract** button in the Data Source toolbar. After a pause we click it ' +
        'to toggle the **Validation Contract Panel** below the grid.\n\n' +
        'Two mode pairs control how arrays are validated across data rows:\n' +
        '- **⚡ Dynamic** — array sizes can vary between rows (flexible)\n' +
        '- **📌 Fixed** — all rows must return the same array structure (strict)\n' +
        '- **↕ Ordered** — elements must match in exact order\n' +
        '- **⟳ Unordered** — elements can appear in any order\n\n' +
        'This prevents flaky tests from server-side shuffling — e.g., "every row must return ' +
        'exactly 3 items in any order."',
      highlight: HAR.CONTRACT_BTN,
      pauseAfter: 4000,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeRowDetailModal();
        closeVerifyModal();
        closeSharedDsModal();
        await ensureOnDataTab(ctx);
        closeContractPanel();
        await ctx.delay(300);
        for (let i = 0; i < 10 && document.querySelector(HAR.CONTRACT_PANEL); i++) {
          closeContractPanel();
          await ctx.delay(100);
        }
        const contractBtn =
          document.querySelector<HTMLElement>(HAR.CONTRACT_BTN) ?? findDsToolbarBtn('Contract');
        contractBtn?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        if (document.querySelector(HAR.CONTRACT_PANEL)) {
          closeContractPanel();
          await ctx.delay(400);
        }

        const contractBtn =
          document.querySelector<HTMLElement>(HAR.CONTRACT_BTN) ?? findDsToolbarBtn('Contract');
        if (!contractBtn) return;

        await highlightPauseClick(contractBtn, ctx, 3000, 1000);
        await ctx.waitFor(HAR.CONTRACT_PANEL, 4000);
        await ctx.delay(1200);

        const panel = document.querySelector<HTMLElement>(HAR.CONTRACT_PANEL);
        if (!panel) return;

        await spotlight(panel, 2200, ctx);
        await ctx.delay(800);

        const modeBtns = panel.querySelectorAll<HTMLElement>(HAR.CONTRACT_MODE_BTN);
        const sizeRow = Array.from(modeBtns).filter(b => {
          const t = b.textContent?.toLowerCase() ?? '';
          return t.includes('dynamic') || t.includes('fixed');
        });
        if (sizeRow.length > 0) {
          const parent = sizeRow[0].parentElement;
          await spotlight(parent ?? sizeRow[0], 1500, ctx);
          await ctx.delay(500);
        }

        const orderRow = Array.from(modeBtns).filter(b => {
          const t = b.textContent?.toLowerCase() ?? '';
          return t.includes('ordered') || t.includes('unordered');
        });
        if (orderRow.length > 0) {
          const parent = orderRow[0].parentElement;
          await spotlight(parent ?? orderRow[0], 1400, ctx);
          await ctx.delay(500);
        }

        // Toggle Contract off via the same button so the viewer sees how to dismiss it
        const stillBtn =
          document.querySelector<HTMLElement>(HAR.CONTRACT_BTN) ?? findDsToolbarBtn('Contract');
        if (stillBtn && document.querySelector(HAR.CONTRACT_PANEL)) {
          await highlightPauseClick(stillBtn, ctx, 2000, 700);
          await waitUntilGone(HAR.CONTRACT_PANEL, ctx);
          await ctx.delay(500);
        }
      },

      verify: HAR.CONTRACT_BTN,
    },

    // ── Step 5: Data Mapper Integrations ──────────────────────────
    {
      id: 'th18-toolbar-mappers',
      title: 'Data Mapper Integrations',
      description:
        'The toolbar offers three powerful data management controls. We open each one so you ' +
        'see exactly where it lives:\n\n' +
        '**⬇ From API** — opens the Data Mapper in populate mode: fetch an API response and ' +
        'map array items into data rows automatically.\n\n' +
        '**🔗 Map Columns** — opens the Data Mapper in column mapping mode: visually connect ' +
        'data columns to path, query, body, or header slots.\n\n' +
        '**Distribution** — controls how rows are assigned to iterations: Sequential, Random, ' +
        'or Round Robin.',
      highlight: HAR.DS_FROM_API_BTN,
      pauseAfter: 4000,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeAllModals();
        await ensureOnDataTab(ctx);
        const fromApi =
          document.querySelector<HTMLElement>(HAR.DS_FROM_API_BTN) ?? findDsToolbarBtn('From API');
        fromApi?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        // ── From API → Data Mapper → Cancel ──
        const fromApiBtn =
          document.querySelector<HTMLElement>(HAR.DS_FROM_API_BTN) ?? findDsToolbarBtn('From API');
        if (fromApiBtn) {
          await highlightPauseClick(fromApiBtn, ctx, 2800, 900);
          await ctx.waitFor(HAR.MAPPER_SHELL, 5000);
          await ctx.delay(1400);
          const shell = document.querySelector<HTMLElement>(HAR.MAPPER_SHELL);
          if (shell) {
            await spotlight(shell, 2000, ctx);
            await ctx.delay(700);
          }
          await closeMapperVisibly(ctx);
        }

        // ── Map Columns → Data Mapper → Cancel ──
        const mapColumnsBtn =
          document.querySelector<HTMLElement>(HAR.DS_MAP_COLUMNS_BTN) ?? findDsToolbarBtn('Map Columns');
        if (mapColumnsBtn) {
          await highlightPauseClick(mapColumnsBtn, ctx, 2800, 900);
          await ctx.waitFor(HAR.MAPPER_SHELL, 5000);
          await ctx.delay(1400);
          const shell = document.querySelector<HTMLElement>(HAR.MAPPER_SHELL);
          if (shell) {
            await spotlight(shell, 2000, ctx);
            await ctx.delay(700);
          }
          await closeMapperVisibly(ctx);
        }

        // ── Distribution dropdown (spotlight only — no modal) ──
        const distSelects = document.querySelectorAll<HTMLElement>('.data-source-toolbar-select');
        for (const sel of distSelects) {
          const trigger = sel.querySelector<HTMLElement>('.cs-trigger');
          const text = trigger?.textContent ?? sel.textContent ?? '';
          if (text.includes('Sequential') || text.includes('Random') || text.includes('Round Robin')) {
            await spotlight(sel, 2200, ctx);
            await ctx.delay(800);
            break;
          }
        }
      },

      verify: HAR.DS_TOOLBAR,
    },

    // ── Step 6: Shared Data Sources ───────────────────────────────
    {
      id: 'th18-shared-ds',
      title: 'Shared Data Sources',
      description:
        'Look at **📦 Shared Data Sources** in the page header. After a pause we click it to open ' +
        'the modal for reusable datasets.\n\n' +
        'The **list panel** on the left shows all shared data sources with search and **+ New**. ' +
        'Select one to see the **editor panel** on the right with the full data grid.\n\n' +
        'The **Fetch Panel** shows the configured API endpoint (method, URL, mapping chips), ' +
        'with tabs for Params, Auth, Headers, and Body. Use **cURL Import** to paste a cURL ' +
        'command, or **Populate Rows from API** to fetch and map via Data Mapper.\n\n' +
        'The **Used by** section shows which tests are linked — when you re-fetch, all ' +
        'linked tests get updated data automatically.',
      highlight: HAR.SHARED_DS_BTN,
      pauseAfter: 4500,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeRowDetailModal();
        closeVerifyModal();
        closeContractPanel();
        // Close test editor so the page header Shared DS button is visible
        await closeTestEditorQuiet(ctx);
        closeSharedDsModal();
        await ctx.delay(400);
        for (let i = 0; i < 12 && document.querySelector(HAR.SHARED_DS_MODAL); i++) {
          closeSharedDsModal();
          await ctx.delay(120);
        }
        const sharedBtn =
          document.querySelector<HTMLElement>(HAR.SHARED_DS_BTN)
          ?? Array.from(document.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Shared Data Sources'));
        sharedBtn?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        if (document.querySelector(HAR.SHARED_DS_MODAL)) {
          closeSharedDsModal();
          await ctx.delay(500);
          await waitUntilGone(HAR.SHARED_DS_MODAL, ctx);
        }

        const sharedBtn =
          document.querySelector<HTMLElement>(HAR.SHARED_DS_BTN)
          ?? Array.from(document.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Shared Data Sources'));
        if (!sharedBtn) return;

        await highlightPauseClick(sharedBtn, ctx, 3200, 1100);
        await ctx.waitFor(HAR.SHARED_DS_MODAL, 5000);
        await ctx.delay(1500);

        const modal = document.querySelector<HTMLElement>(HAR.SHARED_DS_MODAL);
        if (!modal) return;

        const listPanel = modal.querySelector<HTMLElement>(HAR.SHARED_DS_LIST);
        if (listPanel) {
          await spotlight(listPanel, 1800, ctx);
          await ctx.delay(700);
        }

        const editorPanel = modal.querySelector<HTMLElement>(HAR.SHARED_DS_EDITOR);
        if (editorPanel) {
          await spotlight(editorPanel, 1800, ctx);
          await ctx.delay(700);
        }

        const fetchPanel = modal.querySelector<HTMLElement>(HAR.SHARED_DS_FETCH);
        if (fetchPanel) {
          await spotlight(fetchPanel, 1800, ctx);
          await ctx.delay(700);
        }

        const usedBy = modal.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY);
        if (usedBy) {
          await spotlight(usedBy, 1500, ctx);
          await ctx.delay(600);
        }

        await closeSharedDsVisibly(ctx);
      },

      verify: HAR.SHARED_DS_BTN,
    },
  ],
};
