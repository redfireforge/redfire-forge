/**
 * TH-18: Data Source Advanced Features
 *
 * 5 steps: Add Validate Column → Row Detail (Admin User) → Verify & Inspect →
 * Validation Contract Panel → Toolbar Data Mapper integrations.
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
  await highlightPauseClick(cancel, ctx, 900, 300);
  await waitUntilGone(HAR.MAPPER_SHELL, ctx);
  await ctx.delay(350);
}

async function closeVerifyVisibly(ctx: DemoActionContext): Promise<void> {
  console.log('[closeVerifyVisibly] Starting');
  const modal = document.querySelector<HTMLElement>(HAR.VERIFY_MODAL);
  if (!modal) {
    console.log('[closeVerifyVisibly] Modal not found');
    return;
  }
  // Close it
  closeVerifyModal();
  console.log('[closeVerifyVisibly] Called closeVerifyModal()');
  // Wait for it to disappear
  for (let i = 0; i < 15; i++) {
    if (!document.querySelector(HAR.VERIFY_MODAL)) {
      console.log('[closeVerifyVisibly] Modal gone after', i, 'attempts');
      return;
    }
    await ctx.delay(200);
  }
  console.log('[closeVerifyVisibly] Timeout - modal did not close');
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

function findVerifyAllOpenButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.data-source-toolbar-unified .data-source-toolbar-btn.data-source-toolbar-btn-primary[title="Verify all enabled rows against the real API"]',
  )
    ?? findDsToolbarBtn('Verify all enabled rows against the real API')
    ?? document.querySelector<HTMLElement>(HAR.DS_VERIFY_OPEN_BTN)
    ?? findDsToolbarBtn('Verify');
}

/* ── lesson definition ──────────────────────────────────────── */

export const thDataSourceAdvancedLesson: DemoLesson = {
  id: 'th-data-source-advanced',
  domainId: 'harness',
  category: 'data-driven',
  name: 'Data Source Advanced Features',
  description:
    'Explore advanced data source capabilities — per-row detail editing, batch verification, ' +
    'validation contracts, and Data Mapper integrations.',
  estimatedMinutes: 6,
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
      '**Map Columns** — visually connect columns to request template slots',
    keyTerms: [
      { term: 'Validate Column', definition: 'A data-source column typed Validate — stores expected values compared to a JSON path in the response.' },
      { term: 'Row Detail', definition: 'Per-row modal showing all column values, URL preview, and per-row fetch.' },
      { term: 'Verify All', definition: 'Batch verification — sends every enabled row and compares validate columns.' },
      { term: 'Validation Contract', definition: 'Enforces array size and order consistency across data rows.' },
    ],
    diagram: `<svg viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
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
      pauseAfter: true,

      preAction: async (ctx) => {
        // Fresh grid without the name column so + Column is a real beat
        closeAllModals();
        await closeTestEditorQuiet(ctx);
        await ensureTh18Ready(ctx, { forceSeed: true, includeNameColumn: false });
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

        // 1) + Column — reading ring already on it; click without re-spotlight
        addColBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        await ctx.delay(500);
        addColBtn.click();
        await ctx.delay(600);
        scrollDsGridIntoView({ horizontal: true, vertical: false });
        await ctx.delay(300);

        // 1b) The "↕ Column Order" toolbar button only renders once a second
        // column exists (hidden with a single column). Adding this column just
        // revealed it — spotlight the newly-appeared affordance.
        const colOrderBtn = findDsToolbarBtn('Column Order');
        if (colOrderBtn) {
          colOrderBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(colOrderBtn, 2000, ctx);
          await ctx.delay(700);
        }

        // 2) Rename → `name` (no intermediate highlights)
        const nameSpans = document.querySelectorAll<HTMLElement>('.data-source-col-name');
        const newColName = nameSpans[nameSpans.length - 1];
        if (newColName) {
          newColName.click();
          await ctx.delay(350);
          const input = document.querySelector<HTMLInputElement>('.data-source-col-name-input');
          if (input) {
            fillNativeInput('.data-source-col-name-input', 'name');
            await ctx.delay(500);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            input.blur();
            await ctx.delay(400);
          }
        }

        // 3) Type → Validate (no menu/option spotlights)
        await selectLastDsColumnType(ctx, 'Validate', { quiet: true });
        await ctx.delay(700);

        // 4) Payoff: column header shows name + Validate + $.name
        const mappingEl = document.querySelector<HTMLElement>(HAR.DS_COL_MAPPING);
        if (mappingEl) {
          const header = mappingEl.closest<HTMLElement>('.data-source-col-header') ?? mappingEl;
          await spotlight(header, 2000, ctx);
          await ctx.delay(700);
        }

        // 5) Fill expected names quietly
        const expectedNames = ['Leanne Graham', 'Ervin Howell', 'Clementine Bauch'];
        for (let i = 0; i < expectedNames.length; i++) {
          fillDsDataCell(i, 1, expectedNames[i]);
          await ctx.delay(450);
        }

        // 6) One spotlight covering all filled name values
        const nameCells = Array.from(
          document.querySelectorAll<HTMLElement>('input.data-source-cell-input[data-col="1"]'),
        ).filter(el => expectedNames.some(n => (el as HTMLInputElement).value === n));
        if (nameCells.length > 0) {
          nameCells[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const rects = nameCells.map(el => el.getBoundingClientRect());
          const top = Math.min(...rects.map(r => r.top));
          const left = Math.min(...rects.map(r => r.left));
          const right = Math.max(...rects.map(r => r.right));
          const bottom = Math.max(...rects.map(r => r.bottom));
          const ghost = document.createElement('div');
          ghost.setAttribute('data-demo-spotlight-union', '1');
          ghost.style.cssText = [
            'position:fixed',
            `top:${top}px`,
            `left:${left}px`,
            `width:${Math.max(1, right - left)}px`,
            `height:${Math.max(1, bottom - top)}px`,
            'pointer-events:none',
            'z-index:0',
          ].join(';');
          document.body.appendChild(ghost);
          await spotlight(ghost, 2200, ctx);
          ghost.remove();
          await ctx.delay(600);
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
      pauseAfter: true,

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
          await ctx.delay(250);
        }

        // Reading ring is already on ✎ — pause briefly, then click (no second highlight)
        const editBtn = findFirstRowEditBtn();
        if (!editBtn) return;
        editBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        await ctx.delay(600);
        editBtn.click();
        await ctx.waitFor(HAR.ROW_DETAIL_MODAL, 5000);
        await ctx.delay(900); // let the viewer read the open modal (no ring)

        const modal = document.querySelector<HTMLElement>(HAR.ROW_DETAIL_MODAL);
        if (!modal) return;

        const fetchBtn = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_FETCH);
        if (fetchBtn) {
          await highlightPauseClick(fetchBtn, ctx, 1700, 500);

          // Wait for the purple confirm banner (existing rules → Keep / Clear)
          let confirmBar: HTMLElement | null = null;
          for (let i = 0; i < 50 && !confirmBar; i++) {
            confirmBar = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_FETCH_CONFIRM);
            if (!confirmBar) await ctx.delay(150);
          }

          if (confirmBar) {
            await spotlight(confirmBar, 2200, ctx);
            await ctx.delay(700);

            const keepBtn =
              modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_KEEP_RULES)
              ?? Array.from(modal.querySelectorAll<HTMLElement>('button'))
                .find(b => /Keep Rules/i.test(b.textContent ?? ''))
              ?? null;

            if (keepBtn) {
              await highlightPauseClick(keepBtn, ctx, 1800, 550);
              await waitUntilGone(HAR.ROW_DETAIL_FETCH_CONFIRM, ctx, 20);
              await ctx.delay(600);

              // Outcome: $.name rule still there with refreshed value
              const rulesAfter = modal.querySelector<HTMLElement>(HAR.ROW_DETAIL_VALIDATION_TABLE);
              if (rulesAfter) {
                await spotlight(rulesAfter, 1800, ctx);
                await ctx.delay(700);
              }
            }
          }
        }

        // Save → grid shows Leanne Graham
        const saveBtn = Array.from(modal.querySelectorAll<HTMLElement>('button'))
          .find(b => b.textContent?.trim() === 'Save');
        if (saveBtn) {
          await highlightPauseClick(saveBtn, ctx, 1400, 450);
          await waitUntilGone(HAR.ROW_DETAIL_MODAL, ctx);
          await ctx.delay(500);
          const nameCell = Array.from(
            document.querySelectorAll<HTMLElement>('.data-source-cell-input, .data-source-cell'),
          ).find(el => /Leanne Graham/i.test((el as HTMLInputElement).value || el.textContent || ''));
          if (nameCell) {
            await spotlight(nameCell, 1500, ctx);
            await ctx.delay(550);
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
      highlight: '.data-source-toolbar-unified .data-source-toolbar-btn.data-source-toolbar-btn-primary[title="Verify all enabled rows against the real API"]',
      pauseAfter: true,

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
        const verifyBtn = findVerifyAllOpenButton();
        verifyBtn?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        if (document.querySelector(HAR.VERIFY_MODAL)) {
          closeVerifyModal();
          await ctx.delay(500);
          await waitUntilGone(HAR.VERIFY_MODAL, ctx);
        }

        // 1) Open from toolbar — reading ring already on this button; click without re-spotlight
        const openBtn = findVerifyAllOpenButton();
        if (!openBtn) return;

        openBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        await ctx.delay(500);
        openBtn.click();
        await ctx.waitFor(HAR.VERIFY_MODAL, 5000);
        await ctx.delay(1400); // let the viewer read the open modal (no ring)

        const modal = document.querySelector<HTMLElement>(HAR.VERIFY_MODAL);
        if (!modal) return;

        // 2) Run ▶ Verify All inside the modal (different button — spotlight once)
        const runBtn = Array.from(modal.querySelectorAll<HTMLElement>('.verify-modal-footer button'))
          .find(b => /Verify All|Re-verify/i.test(b.textContent ?? ''));
        if (!runBtn) return;

        runBtn.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
        await highlightPauseClick(runBtn, ctx, 2400, 800);

        // Wait for verification to finish (3 live API calls)
        for (let i = 0; i < 50; i++) {
          const done =
            modal.querySelector(HAR.VERIFY_STATS)
            || modal.querySelector('.verify-stat-fail')
            || modal.querySelector('.verify-stat-error')
            || Array.from(modal.querySelectorAll('.verify-modal-footer button'))
              .some(b => b.textContent?.includes('Re-verify'));
          if (done) break;
          await ctx.delay(400);
        }
        await ctx.delay(1000);

        // 3) Outcome: summary with pass/fail counts (one ring only)
        const summary = modal.querySelector<HTMLElement>(HAR.VERIFY_SUMMARY);
        const passCard = modal.querySelector<HTMLElement>(HAR.VERIFY_CARD_PASS);
        if (summary) {
          await spotlight(summary, 2800, ctx);
          await ctx.delay(1100);
        } else if (passCard) {
          passCard.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
          await spotlight(passCard, 2800, ctx);
          await ctx.delay(1100);
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
      pauseAfter: true,

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
        console.log('[TH-18 Step 4] Starting action');
        try {
          if (document.querySelector(HAR.CONTRACT_PANEL)) {
            console.log('[TH-18 Step 4] Panel already open, closing');
            closeContractPanel();
            await ctx.delay(250);
          }

          console.log('[TH-18 Step 4] Looking for Contract button');
          const contractBtn =
            document.querySelector<HTMLElement>(HAR.CONTRACT_BTN) ?? findDsToolbarBtn('Contract');
          if (!contractBtn) {
            console.log('[TH-18 Step 4] Contract button not found, returning early');
            return;
          }

          console.log('[TH-18 Step 4] Found Contract button, clicking');
          await highlightPauseClick(contractBtn, ctx, 2100, 650);
          console.log('[TH-18 Step 4] Waiting for CONTRACT_PANEL to appear');
          await ctx.waitFor(HAR.CONTRACT_PANEL, 4000);
          await ctx.delay(800);

          const panel = document.querySelector<HTMLElement>(HAR.CONTRACT_PANEL);
          if (!panel) {
            console.log('[TH-18 Step 4] Contract panel did not appear, returning');
            return;
          }
          console.log('[TH-18 Step 4] Panel found, spotlighting');

          await spotlight(panel, 1600, ctx);
          await ctx.delay(500);

          console.log('[TH-18 Step 4] Finding mode buttons');
          const modeBtns = panel.querySelectorAll<HTMLElement>(HAR.CONTRACT_MODE_BTN);
          console.log(`[TH-18 Step 4] Found ${modeBtns.length} mode buttons`);
          
          const sizeRow = Array.from(modeBtns).filter(b => {
            const t = b.textContent?.toLowerCase() ?? '';
            return t.includes('dynamic') || t.includes('fixed');
          });
          if (sizeRow.length > 0) {
            console.log('[TH-18 Step 4] Spotlighting size row');
            const parent = sizeRow[0].parentElement;
            await spotlight(parent ?? sizeRow[0], 1100, ctx);
            await ctx.delay(350);
          }

          const orderRow = Array.from(modeBtns).filter(b => {
            const t = b.textContent?.toLowerCase() ?? '';
            return t.includes('ordered') || t.includes('unordered');
          });
          if (orderRow.length > 0) {
            console.log('[TH-18 Step 4] Spotlighting order row');
            const parent = orderRow[0].parentElement;
            await spotlight(parent ?? orderRow[0], 1000, ctx);
            await ctx.delay(350);
          }

          // Toggle Contract off via the same button so the viewer sees how to dismiss it
          console.log('[TH-18 Step 4] Final cleanup - closing contract panel');
          const stillBtn =
            document.querySelector<HTMLElement>(HAR.CONTRACT_BTN) ?? findDsToolbarBtn('Contract');
          if (stillBtn && document.querySelector(HAR.CONTRACT_PANEL)) {
            console.log('[TH-18 Step 4] Closing via button click');
            await highlightPauseClick(stillBtn, ctx, 1400, 450);
            await waitUntilGone(HAR.CONTRACT_PANEL, ctx);
            await ctx.delay(300);
          }
          console.log('[TH-18 Step 4] Action complete!');
        } catch (err) {
          console.error('[TH-18 Step 4] ERROR:', err);
          throw err;
        }
      },

      verify: HAR.CONTRACT_BTN,
    },

    // ── Step 5: Data Mapper Integrations ──────────────────────────
    {
      id: 'th18-toolbar-mappers',
      title: 'Data Mapper Integrations',
      description:
        'The toolbar offers key data management controls. We open each one so you ' +
        'see exactly where it lives:\n\n' +
        '**⬇ From API** — opens the Data Mapper in populate mode: fetch an API response and ' +
        'map array items into data rows automatically.\n\n' +
        '**🔗 Map Columns** — opens the Data Mapper in column mapping mode: visually connect ' +
        'data columns to path, query, body, or header slots.\n\n' +
        '**Distribution** — controls how rows are assigned to iterations: Sequential, Random, ' +
        'or Round Robin.\n\n' +
        '**Validate** — controls row verification scope: No Rows, Sample Rows Only, or All Rows.',
      highlight: HAR.DS_FROM_API_BTN,
      pauseAfter: true,

      preAction: async (ctx) => {
        await ensureTh18Ready(ctx);
        closeAllModals();
        await ensureOnDataTab(ctx);
        const fromApi =
          document.querySelector<HTMLElement>(HAR.DS_FROM_API_BTN) ?? findDsToolbarBtn('From API');
        fromApi?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        console.log('[TH-18 Step 5] Starting action');
        try {
          // ── From API → Data Mapper → Cancel ──
          console.log('[TH-18 Step 5] Looking for From API button');
          const fromApiBtn =
            document.querySelector<HTMLElement>(HAR.DS_FROM_API_BTN) ?? findDsToolbarBtn('From API');
          if (fromApiBtn) {
            console.log('[TH-18 Step 5] Found From API, clicking');
            await highlightPauseClick(fromApiBtn, ctx, 1200, 400);
            console.log('[TH-18 Step 5] Waiting for mapper shell');
            await ctx.waitFor(HAR.MAPPER_SHELL, 4000);
            await ctx.delay(500);
            console.log('[TH-18 Step 5] Mapper opened, closing');
            const shell = document.querySelector<HTMLElement>(HAR.MAPPER_SHELL);
            if (shell) {
              await spotlight(shell, 800, ctx);
              await ctx.delay(300);
            }
            await closeMapperVisibly(ctx);
            console.log('[TH-18 Step 5] From API complete');
          }

          // ── Map Columns → Data Mapper → Cancel ──
          console.log('[TH-18 Step 5] Looking for Map Columns button');
          const mapColumnsBtn =
            document.querySelector<HTMLElement>(HAR.DS_MAP_COLUMNS_BTN) ?? findDsToolbarBtn('Map Columns');
          if (mapColumnsBtn) {
            console.log('[TH-18 Step 5] Found Map Columns, clicking');
            await highlightPauseClick(mapColumnsBtn, ctx, 1200, 400);
            console.log('[TH-18 Step 5] Waiting for mapper shell');
            await ctx.waitFor(HAR.MAPPER_SHELL, 4000);
            await ctx.delay(500);
            console.log('[TH-18 Step 5] Mapper opened, closing');
            const shell = document.querySelector<HTMLElement>(HAR.MAPPER_SHELL);
            if (shell) {
              await spotlight(shell, 800, ctx);
              await ctx.delay(300);
            }
            await closeMapperVisibly(ctx);
            console.log('[TH-18 Step 5] Map Columns complete');
          }

          // ── Distribution dropdown: open and spotlight all options ──
          console.log('[TH-18 Step 5] Processing distribution dropdown');
          const distSelects = document.querySelectorAll<HTMLElement>('.data-source-toolbar-select');
          for (const sel of distSelects) {
            const trigger = sel.querySelector<HTMLElement>('.cs-trigger');
            const text = trigger?.textContent ?? sel.textContent ?? '';
            if (text.includes('Sequential') || text.includes('Random') || text.includes('Round Robin')) {
              console.log('[TH-18 Step 5] Found distribution select, opening');
              if (trigger) {
                await highlightPauseClick(trigger, ctx, 800, 250);
              } else {
                await highlightPauseClick(sel, ctx, 800, 250);
              }

              const menu = document.querySelector<HTMLElement>('.cs-menu');
              if (menu) {
                console.log('[TH-18 Step 5] Distribution menu opened');
                const options = Array.from(menu.querySelectorAll<HTMLElement>('.cs-item, [role="option"]'))
                  .filter((opt) => {
                    const label = opt.textContent?.trim() ?? '';
                    return label === 'Sequential' || label === 'Random' || label === 'Round Robin';
                  });

                for (const option of options) {
                  await spotlight(option, 500, ctx);
                  await ctx.delay(150);
                }
              }
              break;
            }
          }
          console.log('[TH-18 Step 5] Distribution complete');

          // ── Validate dropdown: open and spotlight all options ──
          console.log('[TH-18 Step 5] Processing validate dropdown');
          for (const sel of distSelects) {
            const trigger = sel.querySelector<HTMLElement>('.cs-trigger');
            const text = trigger?.textContent ?? sel.textContent ?? '';
            if (text.includes('Validate:')) {
              console.log('[TH-18 Step 5] Found validate select, opening');
              if (trigger) {
                await highlightPauseClick(trigger, ctx, 800, 250);
              } else {
                await highlightPauseClick(sel, ctx, 800, 250);
              }

              const menu = document.querySelector<HTMLElement>('.cs-menu');
              if (menu) {
                console.log('[TH-18 Step 5] Validate menu opened');
                const options = Array.from(menu.querySelectorAll<HTMLElement>('.cs-item, [role="option"]'))
                  .filter((opt) => {
                    const label = opt.textContent?.trim() ?? '';
                    return label === 'Validate: No Rows'
                      || label === 'Validate: Sample Rows Only'
                      || label === 'Validate: All Rows';
                  });

                for (const option of options) {
                  await spotlight(option, 500, ctx);
                  await ctx.delay(150);
                }
              }
              break;
            }
          }

          // Let CustomSelect menus close naturally via event handlers
          console.log('[TH-18 Step 5] Delaying for UI to settle');
          await ctx.delay(400);
          console.log('[TH-18 Step 5] Action complete!');
        } catch (err) {
          console.error('[TH-18 Step 5] ERROR:', err);
          throw err;
        }
      },

      verify: HAR.DS_TOOLBAR,
    },
  ],
};
