/**
 * WF-3 — Conditional Branching
 *
 * 7 steps (live config; brisk modal pacing so actions stay under DEMO_ACTION_TIMEOUT):
 * 1. Extract {{userId}} from GET /posts/1 (field-by-field)
 * 2. Add Condition and fill left / operator / right live
 * 3. Wire Yes Log/Debug and configure live
 * 4. Wire No Log/Debug and configure live
 * 5. Add Switch, fill expression + cases live
 * 6. Wire Switch → Log/Debug, Fit View, configure Log modal live
 * 7. Quick Test — watch Yes + Switch case light up
 *
 * Seed is Start → HTTP GET only (no extraction / branches pre-filled).
 * JSONPlaceholder /posts/1 returns { userId: 1 } → Condition true → Yes path.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  openWfNodeConfigModal,
  clickWfConfigTab,
  clickWfConfigAddRow,
  fillWfConfigField,
  selectWfConfigOption,
  clickWfConfigControl,
  saveAndCloseWfConfigModal,
  closeWfConfigModalIfOpen,
  holdWfSpotlight,
  closeWfSamplePreviewIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  ensureLessonWorkflowShown,
  pauseWfConfigSection,
  setWfConfigDemoTiming,
  WF_CONFIG_DEMO_TIMING_BRISK,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  triggerWorkflowQuickTest,
  fitWorkflowCanvasView,
  patchWorkflowNodeDataById,
  openWorkflowNodeConfig,
  clearWorkflowSamplePreview,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Conditional Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';
const COND_NODE_ID = 'wf3-cond';
const LOG_YES_ID = 'wf3-log-yes';
const LOG_NO_ID = 'wf3-log-no';
const SWITCH_NODE_ID = 'wf3-switch';
const SWITCH_LOG_ID = 'wf3-switch-log';

/** Known IDs for quiet preAction recovery (live UI uses uuid case ids). */
const SWITCH_CASE_MATCH_ID = 'wf3-case-1';
const SWITCH_CASES = [
  { id: SWITCH_CASE_MATCH_ID, value: '1', label: 'User #1' },
  { id: 'wf3-case-2', value: '2', label: 'User #2' },
  { id: 'wf3-case-3', value: '3', label: 'User #3' },
];

const HTTP_SCENARIO_BASE = {
  id: 'wf3-get-scenario',
  name: 'Get Post',
  url: `${BASE_URL}/posts/1`,
  method: 'GET' as const,
  headers: [] as { key: string; value: string }[],
  body: '',
  auth: { type: 'none' as const },
  validation: { mode: 'none' as const },
};

const HTTP_SCENARIO_WITH_EXT = {
  ...HTTP_SCENARIO_BASE,
  extractions: [{ name: 'userId', source: 'body' as const, expression: '$.userId' }],
};

/** Seed: Start → GET only — extraction & branches are taught live. */
const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
    {
      id: 'http-get',
      type: 'http',
      position: { x: 280, y: 200 },
      data: {
        label: 'Get Post',
        scenario: { ...HTTP_SCENARIO_BASE, extractions: [] },
        timeoutSec: 0,
      },
    },
  ],
  edges: [{ id: 'e-start-get', source: 'start-1', target: 'http-get' }],
  variables: {},
};

// ─── Helpers ────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

function spotlight(el: HTMLElement, holdMs: number, ctx: DemoActionContext): Promise<void> {
  activeCleanup?.();
  activeCleanup = null;
  if (!el.closest('.react-flow')) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const remove = showSpotlightRing(el);
  activeCleanup = remove;
  return ctx.delay(holdMs).then(() => { remove(); if (activeCleanup === remove) activeCleanup = null; });
}

async function spotlightSel(ctx: DemoActionContext, sel: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(sel);
  if (el) await spotlight(el, holdMs, ctx);
}

function getNodeId(selector: string): string | null {
  const el = document.querySelector(selector);
  return el?.getAttribute('data-id') ?? el?.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
}

function fitCanvasCentered(): void {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) { btn.click(); return; }
  fitWorkflowCanvasView();
}

/** Spotlight + click Fit View so the viewer sees the canvas reframe (not a silent bridge call). */
async function clickFitViewVisible(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) {
    await spotlight(btn, 800, ctx);
    btn.click();
    await ctx.delay(1000);
    return;
  }
  fitWorkflowCanvasView();
  await ctx.delay(600);
}

/** Quiet recovery — extraction already taught in step 1. */
function ensureHttpExtractionQuiet(): void {
  patchWorkflowNodeDataById('http-get', {
    label: 'Get Post',
    scenario: HTTP_SCENARIO_WITH_EXT,
    timeoutSec: 0,
  });
}

async function ensureSeededWorkflow(ctx: DemoActionContext): Promise<void> {
  await waitForWorkflowBridge(ctx);
  await closeWfSamplePreviewIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);

  const state = await ensureLessonWorkflowShown(ctx, WF_NAME);
  if (state !== 'missing') {
    if (state === 'selected' && document.body.getAttribute('data-demo-bootstrapping') !== '1') {
      fitCanvasCentered();
      await ctx.delay(400);
    }
    return;
  }

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  if (document.body.getAttribute('data-demo-bootstrapping') === '1') {
    fitWorkflowCanvasView({ duration: 0 });
    await ctx.delay(120);
  } else {
    fitCanvasCentered();
    await ctx.delay(600);
  }
}

async function ensureConditionNode(ctx: DemoActionContext): Promise<void> {
  ensureHttpExtractionQuiet();
  if (!document.querySelector(WF.NODE_CONDITION)) {
    addWorkflowNodeWithPreset('condition', COND_NODE_ID, 'Check User', { x: 520, y: 200 });
    await ctx.delay(400);
    const httpId = getNodeId(WF.NODE_HTTP);
    const condId = getNodeId(WF.NODE_CONDITION);
    if (httpId && condId) connectWorkflowNodes(httpId, condId);
    await ctx.delay(200);
  }
  patchWorkflowNodeDataById(COND_NODE_ID, {
    label: 'Check User',
    left: '{{userId}}',
    operator: '==',
    right: '1',
  });
}

async function ensureBranchNodes(ctx: DemoActionContext): Promise<void> {
  await ensureConditionNode(ctx);
  const condId = getNodeId(WF.NODE_CONDITION);
  if (!document.querySelector(`[data-id="${LOG_YES_ID}"]`)) {
    addWorkflowNodeWithPreset('logDebug', LOG_YES_ID, 'Author!', { x: 760, y: 120 });
    await ctx.delay(200);
    if (condId) connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
  }
  if (!document.querySelector(`[data-id="${LOG_NO_ID}"]`)) {
    addWorkflowNodeWithPreset('logDebug', LOG_NO_ID, 'Different User', { x: 760, y: 300 });
    await ctx.delay(200);
    if (condId) connectWorkflowNodes(condId, LOG_NO_ID, 'false', null);
  }
  // Always re-patch — live Save+Close used to roll back labels/messages to defaults.
  patchWorkflowNodeDataById(LOG_YES_ID, {
    label: 'Author!',
    message: 'User is the author! userId={{userId}}',
    logLevel: 'info',
    snapshotVariables: true,
  });
  patchWorkflowNodeDataById(LOG_NO_ID, {
    label: 'Different User',
    message: 'Different user — userId={{userId}}',
    logLevel: 'warn',
    snapshotVariables: false,
  });
  await ctx.delay(200);
}

/** First case-* handle on the Switch node (after live + Add Case). */
function firstSwitchCaseHandleId(): string | null {
  const node = document.querySelector(WF.NODE_SWITCH);
  const handle = node?.querySelector<HTMLElement>('[data-handleid^="case-"]');
  return handle?.getAttribute('data-handleid') ?? null;
}

/** Quiet recovery: Switch + cases + HTTP edge (no Log yet). */
async function ensureSwitchConfigured(ctx: DemoActionContext): Promise<void> {
  ensureHttpExtractionQuiet();
  if (!document.querySelector(WF.NODE_SWITCH)) {
    addWorkflowNodeWithPreset('switch', SWITCH_NODE_ID, 'Route by User ID', { x: 520, y: 440 });
    await ctx.delay(300);
  }
  patchWorkflowNodeDataById(SWITCH_NODE_ID, {
    label: 'Route by User ID',
    expression: '{{userId}}',
    cases: SWITCH_CASES,
  });
  const handleSel = `[data-handleid="case-${SWITCH_CASE_MATCH_ID}"]`;
  await ctx.waitFor(handleSel, 3000).catch(() => ctx.delay(400));
  const httpId = getNodeId(WF.NODE_HTTP);
  if (httpId) connectWorkflowNodes(httpId, SWITCH_NODE_ID);
  await ctx.delay(200);
}

/** Quiet recovery: Switch Log wired to case 1 (for Quick Test / rapid Next). */
async function ensureSwitchNode(ctx: DemoActionContext): Promise<void> {
  await ensureSwitchConfigured(ctx);
  if (!document.querySelector(`[data-id="${SWITCH_LOG_ID}"]`)) {
    addWorkflowNodeWithPreset('logDebug', SWITCH_LOG_ID, 'Matched User #1', { x: 760, y: 460 });
    await ctx.delay(200);
  }
  patchWorkflowNodeDataById(SWITCH_LOG_ID, {
    label: 'Matched User #1',
    message: 'Switch matched case → userId={{userId}}',
    logLevel: 'info',
    snapshotVariables: false,
  });
  connectWorkflowNodes(SWITCH_NODE_ID, SWITCH_LOG_ID, `case-${SWITCH_CASE_MATCH_ID}`, null);
  await ctx.delay(200);
}

/** Live-fill a Log/Debug modal — paced for brisk timing (must finish well under 45s). */
async function configureLogNodeLive(
  ctx: DemoActionContext,
  nodeId: string,
  opts: { label: string; message: string; logLevel: string; snapshot?: boolean },
): Promise<void> {
  openWorkflowNodeConfig(nodeId);
  await ctx.waitFor(WF.NODE_CONFIG, 5000);
  await ctx.delay(500);

  await fillWfConfigField(ctx, WF.CFG_LOG_LABEL, opts.label);
  await holdWfSpotlight(ctx, WF.CFG_LOG_LABEL, 700);

  await selectWfConfigOption(ctx, WF.CFG_LOG_LEVEL, opts.logLevel);
  await holdWfSpotlight(ctx, WF.CFG_LOG_LEVEL, 700);

  await fillWfConfigField(ctx, WF.CFG_LOG_MESSAGE, opts.message);
  await holdWfSpotlight(ctx, WF.CFG_LOG_MESSAGE, 1100);

  if (opts.snapshot) {
    const cb = document.querySelector<HTMLInputElement>(WF.CFG_LOG_SNAPSHOT);
    if (cb && !cb.checked) {
      await holdWfSpotlight(ctx, WF.CFG_LOG_SNAPSHOT, 600);
      cb.click();
      await ctx.delay(500);
      await holdWfSpotlight(ctx, WF.CFG_LOG_SNAPSHOT, 700);
    }
  }

  await saveAndCloseWfConfigModal(ctx);
  // Belt: live Save must stick even if a stale Close handler raced.
  patchWorkflowNodeDataById(nodeId, {
    label: opts.label,
    message: opts.message,
    logLevel: opts.logLevel,
    snapshotVariables: !!opts.snapshot,
  });
  await ctx.delay(400);
}

/** Live-add one Switch case row and fill match value + label. */
async function addAndFillSwitchCase(
  ctx: DemoActionContext,
  value: string,
  label: string,
  opts?: { emphasize?: boolean },
): Promise<void> {
  const emphasize = opts?.emphasize !== false;
  const before = document.querySelectorAll(WF.CFG_SWITCH_CASE_ROW).length;
  await clickWfConfigControl(ctx, WF.CFG_SWITCH_ADD_CASE);
  try {
    await ctx.waitFor(`${WF.CFG_SWITCH_CASE_ROW}:nth-child(${before + 1})`, 2500);
  } catch {
    await ctx.delay(300);
  }
  const rows = document.querySelectorAll<HTMLElement>(WF.CFG_SWITCH_CASE_ROW);
  const row = rows[rows.length - 1];
  if (!row) return;

  const valueInput = row.querySelector<HTMLInputElement>('.wf-switch-col-value input');
  const labelInput = row.querySelector<HTMLInputElement>('.wf-switch-col-label input');
  if (valueInput) {
    if (emphasize) {
      await holdWfSpotlight(ctx, '.wf-switch-case-row:last-child .wf-switch-col-value input', 500);
    }
    valueInput.focus();
    valueInput.value = '';
    valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    await fillWfConfigField(ctx, '.wf-switch-case-row:last-child .wf-switch-col-value input', value);
  }
  if (labelInput) {
    await fillWfConfigField(ctx, '.wf-switch-case-row:last-child .wf-switch-col-label input', label);
  }
  await holdWfSpotlight(ctx, '.wf-switch-case-row:last-child', emphasize ? 900 : 500);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfConditionalLogicLesson: DemoLesson = {
  id: 'wf-conditional-logic',
  domainId: 'workflow',
  category: 'logic',
  name: 'Conditional Branching',
  description:
    'See why workflows need decisions: extract a value, build an if/else Condition live, ' +
    'wire Yes/No logs, then a multi-way Switch — all configured field-by-field.',
  estimatedMinutes: 11,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],
  collapseAppSidebarOnStart: true,

  prepareBeforeNavigate: async (ctx) => {
    clearWorkflowSamplePreview();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(80);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>, {
      deleteDelayMs: 50,
      insertDelayMs: 120,
      bridgeTimeoutMs: 4000,
      storeTimeoutMs: 2500,
      selectAfterSeed: true,
    });
    clearWorkflowSamplePreview();
    await ctx.delay(40);
  },

  concept: {
    title: 'Why this lesson exists',
    body:
      'Linear workflows are not enough. APIs return data that should choose the next path — ' +
      'author vs guest, 200 vs 404, tier A vs B.\n\n' +
      '**What you will build (nothing is pre-filled in the modals):**\n' +
      '1. **Extract** `userId` from a live GET response into `{{userId}}`\n' +
      '2. **Condition** — type `{{userId}} == 1` (if/else → Yes / No)\n' +
      '3. **Log** the Yes path (Author!) with a variable snapshot\n' +
      '4. **Log** the No path (Different User)\n' +
      '5. **Switch** — same `{{userId}}` against cases `1` / `2` / `3`\n' +
      '6. **Log/Debug** on the matched case — Fit View, then configure the message live\n' +
      '7. **Quick Test** — watch the Yes path + User #1 case light up\n\n' +
      '**Takeaway:** branch on real extracted data, not hardcoded guesses.',
    keyTerms: [
      { term: 'Extraction', definition: 'Pull a response field (JSONPath) into a named variable like userId for later steps.' },
      { term: 'Condition Node', definition: 'If/else: evaluates left operator right and routes to Yes or No handles.' },
      { term: 'Yes/No Handles', definition: 'Condition outputs — connect different Log (or action) nodes to each branch.' },
      { term: 'Switch Node', definition: 'Multi-way match of one expression against case values, each with its own handle.' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="45" width="70" height="30" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="40" y="64" text-anchor="middle" fill="#3b82f6" font-size="8" font-weight="600">GET /posts/1</text>
      <path d="M80 60 L120 60" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf3arr)"/>
      <polygon points="155,60 185,40 215,60 185,80" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="185" y="57" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="600">userId</text>
      <text x="185" y="67" text-anchor="middle" fill="#f59e0b" font-size="6">== 1?</text>
      <path d="M215 50 L260 30" stroke="#10b981" stroke-width="1.5" marker-end="url(#wf3arr)"/>
      <text x="235" y="35" fill="#10b981" font-size="6" font-weight="600">Yes</text>
      <rect x="265" y="15" width="90" height="28" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="310" y="33" text-anchor="middle" fill="#10b981" font-size="7">Author!</text>
      <path d="M215 70 L260 90" stroke="#ef4444" stroke-width="1.5" marker-end="url(#wf3arr)"/>
      <text x="235" y="87" fill="#ef4444" font-size="6" font-weight="600">No</text>
      <rect x="265" y="77" width="90" height="28" rx="5" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <text x="310" y="95" text-anchor="middle" fill="#64748b" font-size="7">Different user</text>
      <defs><marker id="wf3arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
        <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    // Dense live config (two Logs + Switch cases) exceeds default modal pacing
    // under DEMO_ACTION_TIMEOUT_MS (45s) — use brisk timing for this lesson only.
    setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
    await closeWfSamplePreviewIfOpen(ctx);
    resetWfPaletteToBlocks();
    await waitForWorkflowBridge(ctx);
    await collapseWfDemoAppSidebar(ctx);
    if ((await ensureLessonWorkflowShown(ctx, WF_NAME)) === 'missing') {
      await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>, {
        deleteDelayMs: 50,
        insertDelayMs: 200,
      });
    }
    fitWorkflowCanvasView({ duration: 0 });
    await ctx.delay(120);
  },

  cleanup: async (ctx) => {
    setWfConfigDemoTiming(null);
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    if (document.body.getAttribute('data-demo-bootstrapping') !== '1') {
      await ctx.delay(100);
    }
  },

  steps: [
    // ── Step 1: Extract userId (LIVE) ─────────────────────────────────
    {
      id: 'wf3-extract-userid',
      title: 'Extract userId from the Response',
      description:
        '**Purpose:** branching needs a value. We pull `userId` from the GET response into `{{userId}}`.\n\n' +
        'Open **Get Post** → **Extract** → **+ Add**. Watch each field fill:\n' +
        '- Variable name → `userId`\n' +
        '- Expression → `$.userId`\n\n' +
        'Save. Later steps read this exact variable — nothing was pre-filled here.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
        await ctx.delay(800);

        const extractTab = Array.from(
          document.querySelectorAll<HTMLElement>(`${WF.NODE_CONFIG} .wf-config-tab`),
        ).find((b) => b.textContent?.trim().startsWith('Extract'));
        if (extractTab) await spotlight(extractTab, 1400, ctx);

        await clickWfConfigTab(ctx, WF.NODE_CONFIG, 'Extract');
        await ctx.delay(800);

        await clickWfConfigAddRow(ctx, WF.CFG_EXT_ADD, WF.CFG_EXT_VAR);
        await fillWfConfigField(ctx, WF.CFG_EXT_VAR, 'userId');
        await fillWfConfigField(ctx, WF.CFG_EXT_EXPR, '$.userId');
        await holdWfSpotlight(ctx, `${WF.CFG_EXT_ROW}:last-child`, 1800);
        await holdWfSpotlight(ctx, `${WF.CFG_EXT_ROW}:last-child .ext-cell-var`, 1400);

        await saveAndCloseWfConfigModal(ctx);
        // Quiet re-assert — protects against Save being rolled back by Close race.
        ensureHttpExtractionQuiet();
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(800);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 2: Condition — fill LIVE ─────────────────────────────────
    {
      id: 'wf3-condition-node',
      title: 'Build the Condition (live)',
      description:
        '**Purpose:** if/else on the extracted value.\n\n' +
        'Add **Condition** from the palette, connect it after Get Post, then open its config. ' +
        'We fill fields one by one — not a pre-filled form:\n' +
        '1. Switch to **Expression** and type `{{userId}}`\n' +
        '2. Operator → `==`\n' +
        '3. Compare to → `1`\n\n' +
        'Watch the preview show `{{userId}} == 1` with Yes / No branches.',
      highlight: WF.PAL_CONDITION,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        ensureHttpExtractionQuiet();
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        const condBlock = await revealPaletteBlock(ctx, WF.PAL_CONDITION);
        if (condBlock) await spotlight(condBlock, 1400, ctx);

        addWorkflowNodeWithPreset('condition', COND_NODE_ID, 'Check User', { x: 520, y: 200 });
        await ctx.delay(1500);

        const httpId = getNodeId(WF.NODE_HTTP);
        const condNodeId = getNodeId(WF.NODE_CONDITION);
        if (httpId && condNodeId) connectWorkflowNodes(httpId, condNodeId);
        await ctx.delay(1000);

        fitCanvasCentered();
        await ctx.delay(800);
        await spotlightSel(ctx, WF.NODE_CONDITION, 1500);

        // Open EMPTY condition (defaults only) — fill live below
        if (condNodeId) {
          openWorkflowNodeConfig(condNodeId);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);
        }

        // Expression mode so viewers see {{userId}} typed (not a silent patch)
        await clickWfConfigControl(ctx, WF.CFG_CONDITION_EXPR_MODE);
        await ctx.delay(700);
        await fillWfConfigField(ctx, WF.CFG_CONDITION_LEFT, '{{userId}}');
        await holdWfSpotlight(ctx, WF.CFG_CONDITION_LEFT, 1400);
        await pauseWfConfigSection(ctx);

        await selectWfConfigOption(ctx, WF.CFG_CONDITION_OP, '==');
        await holdWfSpotlight(ctx, WF.CFG_CONDITION_OP, 1200);
        await pauseWfConfigSection(ctx);

        await fillWfConfigField(ctx, WF.CFG_CONDITION_RIGHT, '1');
        await holdWfSpotlight(ctx, WF.CFG_CONDITION_RIGHT, 1400);

        await holdWfSpotlight(ctx, WF.CFG_CONDITION_PREVIEW, 2000);

        await saveAndCloseWfConfigModal(ctx);
        patchWorkflowNodeDataById(COND_NODE_ID, {
          label: 'Check User',
          left: '{{userId}}',
          operator: '==',
          right: '1',
        });
        await ctx.delay(900);
        await spotlightSel(ctx, WF.NODE_CONDITION, 1400);
      },

      verify: WF.NODE_CONDITION,
    },

    // ── Step 3: Yes Log — configure LIVE ──────────────────────────────
    {
      id: 'wf3-branch-yes',
      title: 'Configure the Yes Log (live)',
      description:
        '**Purpose:** make the **true** branch visible when it runs.\n\n' +
        'Add a **Log/Debug** on the Condition **Yes** handle, then fill:\n' +
        '- **Label** → Author!\n' +
        '- **Log Level** → Info\n' +
        '- **Message Template** with `{{userId}}`\n' +
        '- Enable **Snapshot all variables**\n\n' +
        'Then **Fit View**.',
      highlight: WF.PAL_LOG_DEBUG,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        const logBlock = await revealPaletteBlock(ctx, WF.PAL_LOG_DEBUG);
        if (logBlock) await spotlight(logBlock, 900, ctx);

        const condId = getNodeId(WF.NODE_CONDITION);
        addWorkflowNodeWithPreset('logDebug', LOG_YES_ID, 'Log', { x: 760, y: 120 });
        await ctx.delay(600);
        if (condId) connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
        await ctx.delay(500);
        await clickFitViewVisible(ctx);

        await configureLogNodeLive(ctx, LOG_YES_ID, {
          label: 'Author!',
          message: 'User is the author! userId={{userId}}',
          logLevel: 'info',
          snapshot: true,
        });

        await spotlightSel(ctx, `[data-id="${LOG_YES_ID}"]`, 900);
      },

      verify: `[data-id="${LOG_YES_ID}"]`,
    },

    // ── Step 4: No Log — configure LIVE ───────────────────────────────
    {
      id: 'wf3-branch-no',
      title: 'Configure the No Log (live)',
      description:
        '**Purpose:** make the **false** branch visible when it is taken.\n\n' +
        'Add a second **Log/Debug** on the Condition **No** handle:\n' +
        '- **Label** → Different User\n' +
        '- **Log Level** → Warning\n' +
        '- **Message Template** with `{{userId}}`\n\n' +
        'Connect No → Different User, then **Fit View**.',
      highlight: WF.PAL_LOG_DEBUG,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        // Yes log must exist if the viewer skipped the prior action.
        if (!document.querySelector(`[data-id="${LOG_YES_ID}"]`)) {
          const condId = getNodeId(WF.NODE_CONDITION);
          addWorkflowNodeWithPreset('logDebug', LOG_YES_ID, 'Author!', { x: 760, y: 120 });
          await ctx.delay(150);
          if (condId) connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
          patchWorkflowNodeDataById(LOG_YES_ID, {
            label: 'Author!',
            message: 'User is the author! userId={{userId}}',
            logLevel: 'info',
            snapshotVariables: true,
          });
        }
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        const logBlock = await revealPaletteBlock(ctx, WF.PAL_LOG_DEBUG);
        if (logBlock) await spotlight(logBlock, 800, ctx);

        const condId = getNodeId(WF.NODE_CONDITION);
        addWorkflowNodeWithPreset('logDebug', LOG_NO_ID, 'Log', { x: 760, y: 300 });
        await ctx.delay(600);
        if (condId) connectWorkflowNodes(condId, LOG_NO_ID, 'false', null);
        await ctx.delay(500);
        await clickFitViewVisible(ctx);

        await configureLogNodeLive(ctx, LOG_NO_ID, {
          label: 'Different User',
          message: 'Different user — userId={{userId}}',
          logLevel: 'warn',
        });

        await spotlightSel(ctx, WF.NODE_CONDITION, 900);
      },

      verify: `[data-id="${LOG_NO_ID}"]`,
    },

    // ── Step 5: Switch — fill LIVE ────────────────────────────────────
    {
      id: 'wf3-switch-node',
      title: 'Build a Switch (live)',
      description:
        '**Purpose:** multi-way routing (not just Yes/No).\n\n' +
        'Add **Switch**, connect Get Post → Switch, then configure live:\n' +
        '- Expression → `{{userId}}`\n' +
        '- **+ Add Case** three times: `1` / User #1, `2` / User #2, `3` / User #3\n\n' +
        'Save, then **Fit View**. Next we wire a Log to case **1**.',
      highlight: WF.PAL_SWITCH,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        await ensureBranchNodes(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        const switchBlock = await revealPaletteBlock(ctx, WF.PAL_SWITCH);
        if (switchBlock) await spotlight(switchBlock, 900, ctx);

        if (!document.querySelector(WF.NODE_SWITCH)) {
          addWorkflowNodeWithPreset('switch', SWITCH_NODE_ID, 'Switch', { x: 520, y: 440 });
          await ctx.delay(700);
        }

        const httpId = getNodeId(WF.NODE_HTTP);
        if (httpId) connectWorkflowNodes(httpId, SWITCH_NODE_ID);
        await ctx.delay(500);
        fitCanvasCentered();
        await ctx.delay(500);

        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_SWITCH });
        await ctx.delay(600);

        await fillWfConfigField(ctx, WF.CFG_SWITCH_EXPR, '{{userId}}');
        await holdWfSpotlight(ctx, WF.CFG_SWITCH_EXPR, 1000);

        // Case 1 gets the full spotlight tour; cases 2–3 are quicker fills.
        await addAndFillSwitchCase(ctx, '1', 'User #1', { emphasize: true });
        await addAndFillSwitchCase(ctx, '2', 'User #2', { emphasize: false });
        await addAndFillSwitchCase(ctx, '3', 'User #3', { emphasize: false });

        const casesList = document.querySelector<HTMLElement>('.wf-switch-cases-list');
        if (casesList) await spotlight(casesList, 1100, ctx);

        await saveAndCloseWfConfigModal(ctx);
        // Prefer stable case ids for Quick Test recovery; live uuid handles still work for the wire below.
        patchWorkflowNodeDataById(SWITCH_NODE_ID, {
          label: 'Route by User ID',
          expression: '{{userId}}',
          cases: SWITCH_CASES,
        });
        await ctx.delay(400);
        await clickFitViewVisible(ctx);
        await spotlightSel(ctx, WF.NODE_SWITCH, 900);
      },

      verify: WF.NODE_SWITCH,
    },

    // ── Step 6: Switch Log — Fit View + configure LIVE ────────────────
    {
      id: 'wf3-switch-log',
      title: 'Wire Switch Log & Fit View',
      description:
        '**Purpose:** make the matched Switch case visible when it runs.\n\n' +
        '1. Add a **Log/Debug** node and connect Switch case **User #1** → Log\n' +
        '2. Click **Fit View** so the full graph is visible\n' +
        '3. Open the Log modal and fill **Label**, **Log Level**, and **Message Template** ' +
        'with `{{userId}}`\n\n' +
        'At runtime `userId` is `1`, so this case (and this Log) is taken.',
      highlight: WF.PAL_LOG_DEBUG,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        await ensureBranchNodes(ctx);
        await ensureSwitchConfigured(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        const logBlock = await revealPaletteBlock(ctx, WF.PAL_LOG_DEBUG);
        if (logBlock) await spotlight(logBlock, 800, ctx);

        if (!document.querySelector(`[data-id="${SWITCH_LOG_ID}"]`)) {
          addWorkflowNodeWithPreset('logDebug', SWITCH_LOG_ID, 'Log', { x: 760, y: 460 });
          await ctx.delay(600);
        }

        const caseHandle = firstSwitchCaseHandleId() ?? `case-${SWITCH_CASE_MATCH_ID}`;
        connectWorkflowNodes(SWITCH_NODE_ID, SWITCH_LOG_ID, caseHandle, null);
        await ctx.delay(500);

        // Viewer must see Fit View after the new edge lands.
        await clickFitViewVisible(ctx);

        await configureLogNodeLive(ctx, SWITCH_LOG_ID, {
          label: 'Matched User #1',
          message: 'Switch matched case → userId={{userId}}',
          logLevel: 'info',
        });

        await spotlightSel(ctx, WF.NODE_SWITCH, 700);
        await spotlightSel(ctx, `[data-id="${SWITCH_LOG_ID}"]`, 900);
      },

      verify: `[data-id="${SWITCH_LOG_ID}"]`,
    },

    // ── Step 7: Run ───────────────────────────────────────────────────
    {
      id: 'wf3-run-condition',
      title: 'Run and See Which Branch Wins',
      description:
        '**Purpose:** prove the live config works.\n\n' +
        'Open **Console**, then **▶ Quick Test**. GET returns `userId: 1`, so:\n' +
        '- Condition `1 == 1` → **Yes** (Author! runs; No is skipped)\n' +
        '- Switch matches case **1** → Matched User #1\n\n' +
        'Watch green/gray badges and the variable snapshot in the console.',
      highlight: WF.CONSOLE_BADGE,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        await ensureBranchNodes(ctx);
        await ensureSwitchNode(ctx);
        ensureHttpExtractionQuiet();
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        ensureHttpExtractionQuiet();
        await spotlightSel(ctx, WF.CONSOLE_BADGE, 800);
        if (!document.querySelector(WF.CONSOLE)) {
          await ctx.click(WF.CONSOLE_BADGE);
          await ctx.waitFor(WF.CONSOLE, 4000);
        }
        await ctx.delay(700);

        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1000);
        triggerWorkflowQuickTest();
        // Wait for GET — external JSONPlaceholder via /__proxy can take >3s on a cold path.
        await ctx.delay(4500);
        const httpFailed = document.querySelector(
          `${WF.NODE_HTTP} .wf-node-badge-fail, ${WF.NODE_HTTP} .wf-node-status-fail, ${WF.NODE_HTTP} [class*="badge-fail"]`,
        ) || Array.from(document.querySelectorAll(`${WF.NODE_HTTP} .wf-node-status-badge, ${WF.NODE_HTTP} .wf-node-badge`))
          .some((el) => (el.textContent ?? '').includes('ERR'));
        if (httpFailed) {
          ensureHttpExtractionQuiet();
          await ctx.delay(300);
          triggerWorkflowQuickTest();
          await ctx.delay(4500);
        }

        const allLines = document.querySelectorAll<HTMLElement>(`${WF.CONSOLE} .wf-cl-line`);
        const snapshotLines: HTMLElement[] = [];
        let capturing = false;
        for (const line of allLines) {
          const text = line.textContent ?? '';
          if (text.includes('Variable snapshot')) { capturing = true; snapshotLines.push(line); continue; }
          if (capturing && text.match(/^\s+\S+\s*=/)) { snapshotLines.push(line); }
          else if (capturing) { capturing = false; }
        }
        if (snapshotLines.length > 0) {
          snapshotLines[0].scrollIntoView({ block: 'start', behavior: 'smooth' });
          await ctx.delay(400);
          const wrapper = document.createElement('div');
          const parent = snapshotLines[0].parentElement!;
          parent.insertBefore(wrapper, snapshotLines[0]);
          for (const line of snapshotLines) wrapper.appendChild(line);
          await spotlight(wrapper, 3000, ctx);
          const nextSibling = wrapper.nextSibling;
          while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, nextSibling);
          wrapper.remove();
        }

        await spotlightSel(ctx, WF.NODE_CONDITION, 1600);
      },

      verify: WF.CONSOLE,
    },
  ],
};
