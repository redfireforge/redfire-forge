/**
 * WF-3 — Conditional Branching
 *
 * 5 steps: review where {{userId}} comes from (HTTP Extract tab) → add & configure a
 * Condition node (userId == 1) → wire Yes/No branch paths with Log/Debug nodes →
 * demonstrate the Switch node → run Quick Test and see which branch is taken.
 *
 * Prerequisite: seeded workflow with Start → HTTP GET /posts/1 → extraction of userId.
 * JSONPlaceholder /posts/1 returns { userId: 1 }, so condition evaluates to true → Yes path.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  openWfNodeConfigModal,
  clickWfConfigTab,
  saveAndCloseWfConfigModal,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  ensureLessonWorkflowShown,
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
} from '../../adapters';
import { collapseAppSidebar } from '../../adapters/appShellAdapter';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Conditional Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';
// Fixed IDs for nodes added during the lesson (so preAction guards can find them)
const COND_NODE_ID = 'wf3-cond';
const LOG_YES_ID = 'wf3-log-yes';
const LOG_NO_ID = 'wf3-log-no';
const SWITCH_NODE_ID = 'wf3-switch';
const SWITCH_LOG_ID = 'wf3-switch-log';

// Switch keys off the REAL extracted {{userId}} (= 1 for /posts/1). Cases match the
// resolved string, so the "1" case is taken at runtime and routes to a Log node.
const SWITCH_CASE_MATCH_ID = 'wf3-case-1';
const SWITCH_CASES = [
  { id: SWITCH_CASE_MATCH_ID, value: '1', label: 'User #1' },
  { id: 'wf3-case-2', value: '2', label: 'User #2' },
  { id: 'wf3-case-3', value: '3', label: 'User #3' },
];

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
        scenario: {
          id: 'wf3-get-scenario',
          name: 'Get Post',
          url: `${BASE_URL}/posts/1`,
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [{ name: 'userId', source: 'body', expression: '$.userId' }],
        },
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
  // Skip scrollIntoView for React Flow canvas nodes/edges — it scrolls an ancestor
  // and undoes the fitted viewport. Fit View already keeps them visible.
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

/**
 * Fit the canvas using the REAL Fit View button (symmetric padding: 0.15 → nodes
 * centered), matching the manual control. The demo bridge fitWorkflowCanvasView()
 * uses asymmetric right:0.34 padding that shoves nodes to the left and looks
 * unfitted — never use it for a viewer-facing end state. Falls back to the bridge
 * only if the button isn't mounted yet.
 */
function fitCanvasCentered(): void {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) { btn.click(); return; }
  fitWorkflowCanvasView();
}

async function ensureSeededWorkflow(ctx: DemoActionContext): Promise<void> {
  await waitForWorkflowBridge(ctx);

  const state = await ensureLessonWorkflowShown(ctx, WF_NAME);
  if (state !== 'missing') {
    // Only re-fit when we actually SWITCHED to this lesson's workflow from a
    // different one. When it's already shown ('ready'), the canvas is exactly where
    // the previous step left it — re-fitting on every single step start is what made
    // the nodes visibly jump around between steps.
    if (state === 'selected') {
      const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
      if (fitBtn) { fitBtn.click(); await ctx.delay(400); }
    }
    return;
  }

  ctx.navigateToTab('workflow');
  await ctx.delay(200);
  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(300);
  fitCanvasCentered();
  await ctx.delay(100);
}

/** Ensure condition node is present and connected to HTTP. */
async function ensureConditionNode(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.NODE_CONDITION)) return;
  addWorkflowNodeWithPreset('condition', COND_NODE_ID, 'Check User', { x: 520, y: 200 });
  await ctx.delay(500);
  const httpId = getNodeId(WF.NODE_HTTP);
  const condId = getNodeId(WF.NODE_CONDITION);
  if (httpId && condId) connectWorkflowNodes(httpId, condId);
  await ctx.delay(300);
}

/** Ensure Log/Debug nodes are wired to condition branches. */
async function ensureBranchNodes(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.NODE_LOG_DEBUG)) return;
  const condId = getNodeId(WF.NODE_CONDITION);
  // Yes path
  addWorkflowNodeWithPreset('logDebug', LOG_YES_ID, 'Author!', { x: 760, y: 120 });
  await ctx.delay(300);
  patchWorkflowNodeDataById(LOG_YES_ID, { label: 'Author!', message: 'User is the author! userId={{userId}}', logLevel: 'info', snapshotVariables: true });
  if (condId) connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
  await ctx.delay(300);
  // No path
  addWorkflowNodeWithPreset('logDebug', LOG_NO_ID, 'Different User', { x: 760, y: 300 });
  await ctx.delay(300);
  patchWorkflowNodeDataById(LOG_NO_ID, { label: 'Different User', message: 'Different user — userId={{userId}}', logLevel: 'warn', snapshotVariables: false });
  if (condId) connectWorkflowNodes(condId, LOG_NO_ID, 'false', null);
  await ctx.delay(300);
}

/**
 * Open a Log/Debug node's config modal, spotlight its Log Level + Message Template so
 * the viewer actually SEES how the branch message is configured, then save & close.
 * Node data must already be patched — openWorkflowNodeConfig snapshots data at open time.
 */
async function showLogNodeConfig(ctx: DemoActionContext, nodeId: string, highlightSnapshot = false): Promise<void> {
  openWorkflowNodeConfig(nodeId);
  await ctx.waitFor(WF.NODE_CONFIG, 5000);
  await ctx.delay(900);
  // Log Level (Info for Yes, Warning for No) — viewer sees the severity choice.
  const level = document.querySelector<HTMLElement>(WF.CFG_LOG_LEVEL);
  if (level) await spotlight(level, 1100, ctx);
  // Message Template — the {{userId}} template that gets logged when this branch runs.
  const msg = document.querySelector<HTMLElement>(WF.CFG_LOG_MESSAGE);
  if (msg) await spotlight(msg, 2000, ctx);
  // Snapshot checkbox — highlights the "Snapshot all variables" toggle for the Author! node.
  if (highlightSnapshot) {
    const snapshotLabel = document.querySelector<HTMLElement>('.wf-config-modal label:has(input[type="checkbox"])');
    if (snapshotLabel) await spotlight(snapshotLabel, 1400, ctx);
  }
  // Close before returning to the canvas so the branch layout is visible (section 5).
  await saveAndCloseWfConfigModal(ctx);
  await ctx.delay(700);
}

/**
 * Ensure the Switch node exists, is configured to route on {{userId}}, is fed by the
 * HTTP node (so userId is extracted before it evaluates), and has its matched-case
 * Log wired up. Idempotent — recreates state quietly when a viewer skipped step 4.
 */
async function ensureSwitchNode(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.NODE_SWITCH)) {
    addWorkflowNodeWithPreset('switch', SWITCH_NODE_ID, 'Route by User ID', { x: 520, y: 440 });
    await ctx.delay(400);
  }
  patchWorkflowNodeDataById(SWITCH_NODE_ID, {
    label: 'Route by User ID',
    expression: '{{userId}}',
    cases: SWITCH_CASES,
  });
  // Wait for React to re-render the Switch node with its case handles before connecting
  const handleSel = `[data-handleid="case-${SWITCH_CASE_MATCH_ID}"]`;
  await ctx.waitFor(handleSel, 3000).catch(() => ctx.delay(500));
  const httpId = getNodeId(WF.NODE_HTTP);
  if (httpId) connectWorkflowNodes(httpId, SWITCH_NODE_ID);
  if (!document.querySelector(`[data-id="${SWITCH_LOG_ID}"]`)) {
    addWorkflowNodeWithPreset('logDebug', SWITCH_LOG_ID, 'Matched User #1', { x: 760, y: 460 });
    await ctx.delay(300);
  }
  patchWorkflowNodeDataById(SWITCH_LOG_ID, {
    label: 'Matched User #1',
    message: 'Switch matched case → userId={{userId}}',
    logLevel: 'info',
    snapshotVariables: false,
  });
  await ctx.delay(200);
  connectWorkflowNodes(SWITCH_NODE_ID, SWITCH_LOG_ID, `case-${SWITCH_CASE_MATCH_ID}`, null);
  await ctx.delay(200);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfConditionalLogicLesson: DemoLesson = {
  id: 'wf-conditional-logic',
  domainId: 'workflow',
  category: 'logic',
  name: 'Conditional Branching',
  description:
    'Route execution based on response data — learn the Condition (if/else) and Switch (multi-way) nodes.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Branching Logic in Workflows',
    body:
      'Real workflows need decisions. The **Condition** node evaluates an expression and routes ' +
      'execution to **Yes** or **No** paths — like an if/else in code.\n\n' +
      '**Key concepts:**\n' +
      '- **Condition node** — evaluates `left operator right` (e.g. `{{userId}} == 1`)\n' +
      '- **Yes path** — taken when the expression is true\n' +
      '- **No path** — taken when the expression is false\n' +
      '- **Switch node** — multi-way branching: matches a value against multiple cases\n\n' +
      '**In this lesson:** An HTTP GET extracts `userId`. The Condition checks if `userId == 1` ' +
      'and routes to different Log nodes based on the result. A **Switch** then keys off the ' +
      'same `{{userId}}` value with cases `1`/`2`/`3` — showing multi-way routing on real data.',
    keyTerms: [
      { term: 'Condition Node', definition: 'Evaluates a left/operator/right expression and routes to Yes (true) or No (false) output handles.' },
      { term: 'Yes/No Handles', definition: 'The two outputs of a Condition node — connect different downstream nodes to each for branching logic.' },
      { term: 'Switch Node', definition: 'Multi-way branching — matches an expression against a list of case values, each with its own output handle.' },
      { term: 'Branch Path', definition: 'A chain of nodes connected to one output handle — only executes when that branch is taken.' },
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
    ctx.navigateToTab('workflow');
    resetWfPaletteToBlocks();
    collapseAppSidebar();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(100);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
    await ctx.delay(300);
    fitCanvasCentered();
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Where userId Comes From ─────────────────────────────────
    // Show the SOURCE of {{userId}} (the HTTP node's Extract tab) before we build
    // any branching on it — so the viewer understands what the Condition/Switch read.
    {
      id: 'wf3-review-extraction',
      title: 'Where userId Comes From',
      description:
        'Before we branch on it, see where the `{{userId}}` variable comes from. ' +
        'Double-click the **Get Post** node and open the **Extract** tab — the response\'s ' +
        '`$.userId` field is pulled into a variable named `userId`. The Condition and Switch ' +
        'you build in the next steps both read this exact value.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        // Setup already seeded the workflow — just ensure it's visible and clean
        if (!document.querySelector(WF.CANVAS)) {
          await ensureSeededWorkflow(ctx);
        }
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
        await ctx.delay(600);

        // Spotlight the Extract tab itself before switching to it
        const panel = document.querySelector(WF.NODE_CONFIG);
        const extractTab = panel
          ? Array.from(panel.querySelectorAll<HTMLElement>('.wf-config-tab'))
              .find((b) => b.textContent?.trim().startsWith('Extract'))
          : null;
        if (extractTab) await spotlight(extractTab, 1200, ctx);

        // Switch to Extract tab and spotlight the extraction row
        await clickWfConfigTab(ctx, WF.NODE_CONFIG, 'Extract');
        await ctx.delay(600);

        await spotlightSel(ctx, WF.CFG_EXT_ROW, 1800);

        await closeWfConfigModalIfOpen(ctx);
        await ctx.delay(400);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 2: Add & Configure a Condition Node ───────────────────────
    {
      id: 'wf3-condition-node',
      title: 'Add & Configure a Condition Node',
      description:
        'Find **Condition** in the palette under **Logic**. Click it onto the canvas, connect it ' +
        'after the HTTP node, and click **Fit View**. Then open its config and set the **left operand** ' +
        'to `{{userId}}` (the extracted variable), **operator** to `==`, and **right value** to `1`. ' +
        'This evaluates whether the post author is user #1.',
      highlight: WF.PAL_CONDITION,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Condition block in the palette
        const condBlock = await revealPaletteBlock(ctx, WF.PAL_CONDITION);
        if (condBlock) {
          await spotlight(condBlock, 1400, ctx);
        }

        // 1. Add Condition node to the canvas
        addWorkflowNodeWithPreset('condition', COND_NODE_ID, 'Check User', { x: 520, y: 200 });
        await ctx.delay(1500);

        // 2. Connect HTTP → Condition
        const httpId = getNodeId(WF.NODE_HTTP);
        const condNodeId = getNodeId(WF.NODE_CONDITION);
        if (httpId && condNodeId) {
          connectWorkflowNodes(httpId, condNodeId);
        }
        await ctx.delay(1200);

        // 3. Fit View
        const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
        if (fitBtn) fitBtn.click();
        await ctx.delay(800);

        // Spotlight the Condition node showing Yes/No handles
        await spotlightSel(ctx, WF.NODE_CONDITION, 1500);

        // 4. Configure — patch data then open modal to show the viewer
        if (condNodeId) {
          patchWorkflowNodeDataById(condNodeId, {
            label: 'Check User',
            left: '{{userId}}',
            operator: '==',
            right: '1',
          });
          await ctx.delay(400);
        }

        if (condNodeId) {
          openWorkflowNodeConfig(condNodeId);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);
        }

        // Spotlight userId variable dropdown
        const varSelect = document.querySelector<HTMLElement>(
          '.wf-condition-config .wf-condition-left-select',
        );
        if (varSelect) await spotlight(varSelect, 1400, ctx);

        // Spotlight the == operator
        const rows = document.querySelectorAll<HTMLElement>('.wf-condition-config .wf-config-field--row');
        const operatorRow = rows[2];
        const operatorSelect = operatorRow?.querySelector<HTMLElement>('.cs-wrapper');
        if (operatorSelect) await spotlight(operatorSelect, 1200, ctx);

        // Spotlight the compare value "1"
        const compareRow = rows[3];
        const compareInput = compareRow?.querySelector<HTMLElement>('.expr-input-wrapper');
        if (compareInput) await spotlight(compareInput, 1200, ctx);

        // Save and close the config modal
        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(1000);

        // Spotlight the configured condition node on canvas
        await spotlightSel(ctx, WF.NODE_CONDITION, 1200);
      },

      verify: WF.NODE_CONDITION,
    },

    // ── Step 3: Wire the Branch Paths ───────────────────────────────────
    {
      id: 'wf3-branch-paths',
      title: 'Wire the Branch Paths',
      description:
        'Add two **Log/Debug** nodes — one per branch. For each: click the node onto the canvas, ' +
        'connect it to the Condition\'s **Yes** or **No** handle, click **Fit View**, then open ' +
        'its config to set a **Message Template** that logs `{{userId}}` and a **Log Level** ' +
        '(Info for the "author" branch, Warning for "different user"). Each branch runs ' +
        'independently based on the condition result.',
      highlight: WF.PAL_LOG_DEBUG,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        // A prior replay may have left a log config modal open — start clean.
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Log/Debug block in palette
        const logBlock = await revealPaletteBlock(ctx, WF.PAL_LOG_DEBUG);
        if (logBlock) {
          await spotlight(logBlock, 1200, ctx);
        }

        const condId = getNodeId(WF.NODE_CONDITION);

        // ── YES path: add → connect → fit view → configure ──
        addWorkflowNodeWithPreset('logDebug', LOG_YES_ID, 'Author!', { x: 760, y: 120 });
        await ctx.delay(800);
        if (condId) connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(600);

        patchWorkflowNodeDataById(LOG_YES_ID, {
          label: 'Author!',
          message: 'User is the author! userId={{userId}}',
          logLevel: 'info',
          snapshotVariables: true,
        });
        await ctx.delay(300);
        await showLogNodeConfig(ctx, LOG_YES_ID, true);

        // ── NO path: add → connect → fit view → configure ──
        addWorkflowNodeWithPreset('logDebug', LOG_NO_ID, 'Different User', { x: 760, y: 300 });
        await ctx.delay(800);
        if (condId) connectWorkflowNodes(condId, LOG_NO_ID, 'false', null);
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(600);

        patchWorkflowNodeDataById(LOG_NO_ID, {
          label: 'Different User',
          message: 'Different user — userId={{userId}}',
          logLevel: 'warn',
          snapshotVariables: false,
        });
        await ctx.delay(300);
        await showLogNodeConfig(ctx, LOG_NO_ID);

        // Spotlight the diamond branch layout
        await spotlightSel(ctx, WF.NODE_CONDITION, 1500);
      },

      verify: WF.NODE_LOG_DEBUG,
    },

    // ── Step 4: The Switch Node (Multi-Way) ─────────────────────────────
    {
      id: 'wf3-switch-node',
      title: 'The Switch Node (Multi-Way)',
      description:
        'The **Switch** node handles multiple cases — like a switch/case statement. Where ' +
        'the Condition is binary (Yes/No), a Switch matches one value against many. We point ' +
        'it at the **same extracted `{{userId}}`** and give it cases `1`, `2`, `3`. We feed it ' +
        'from the HTTP node so `userId` exists when it runs — at runtime `userId` is `1`, so the ' +
        '**User #1** case is taken and routes to its own Log node, whose **Message Template** ' +
        'we configure to log the matched `{{userId}}`.',
      highlight: WF.PAL_SWITCH,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Switch block in palette
        const switchBlock = await revealPaletteBlock(ctx, WF.PAL_SWITCH);
        if (switchBlock) {
          await spotlight(switchBlock, 1400, ctx);
        }

        // ── Switch node: add → connect → fit view → configure ──
        // 1. Add
        addWorkflowNodeWithPreset('switch', SWITCH_NODE_ID, 'Route by User ID', { x: 520, y: 440 });
        await ctx.delay(800);

        // 2. Connect (HTTP → Switch so userId is available at runtime)
        const httpId = getNodeId(WF.NODE_HTTP);
        if (httpId) connectWorkflowNodes(httpId, SWITCH_NODE_ID);
        await ctx.delay(600);

        // 3. Fit View
        fitCanvasCentered();
        await ctx.delay(800);

        // 4. Configure — patch data with known case IDs first so handles render correctly
        patchWorkflowNodeDataById(SWITCH_NODE_ID, {
          label: 'Route by User ID',
          expression: '{{userId}}',
          cases: SWITCH_CASES,
        });
        await ctx.delay(600);

        // Wait for the case handles to render before opening modal
        const caseHandleSel = `[data-handleid="case-${SWITCH_CASE_MATCH_ID}"]`;
        await ctx.waitFor(caseHandleSel, 3000).catch(() => ctx.delay(500));
        await ctx.delay(400);

        // Open config modal to SHOW the viewer the expression + cases
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_SWITCH });
        await ctx.delay(1000);

        // Spotlight the Expression field
        await spotlightSel(ctx, '.wf-config-modal .expr-input-wrapper', 1400);

        // Spotlight the cases list
        const casesList = document.querySelector<HTMLElement>('.wf-config-modal .wf-switch-cases-list');
        if (casesList) await spotlight(casesList, 1800, ctx);

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        // ── Matched-case Log node: add → connect → fit view → configure ──
        // 1. Add
        addWorkflowNodeWithPreset('logDebug', SWITCH_LOG_ID, 'Matched User #1', { x: 760, y: 460 });
        await ctx.delay(800);

        // 2. Connect (Switch User #1 case → Log)
        connectWorkflowNodes(SWITCH_NODE_ID, SWITCH_LOG_ID, `case-${SWITCH_CASE_MATCH_ID}`, null);
        await ctx.delay(800);

        // 3. Fit View
        fitCanvasCentered();
        await ctx.delay(600);

        // 4. Configure
        patchWorkflowNodeDataById(SWITCH_LOG_ID, {
          label: 'Matched User #1',
          message: 'Switch matched case → userId={{userId}}',
          logLevel: 'info',
          snapshotVariables: false,
        });
        await ctx.delay(300);
        await showLogNodeConfig(ctx, SWITCH_LOG_ID);

        await spotlightSel(ctx, WF.NODE_SWITCH, 1200);
      },

      verify: WF.NODE_SWITCH,
    },

    // ── Step 5: Run and See the Branch Taken ────────────────────────────
    {
      id: 'wf3-run-condition',
      title: 'Run and See the Branch Taken',
      description:
        'Open the **Console** first, then click **▶ Quick Test** so you watch the branch logs ' +
        'stream in live. The HTTP node fetches `userId: 1`, the Condition evaluates `1 == 1` → ' +
        '**true**, so the **Yes** path executes and the **No** path is skipped. In parallel, the ' +
        '**Switch** matches `userId` `1` → the **User #1** case, lighting up its Log node. Watch ' +
        'the green/gray badges show which branches were taken.',
      highlight: WF.CONSOLE_BADGE,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        // Patch condition data to ensure it's configured
        patchWorkflowNodeDataById(COND_NODE_ID, { left: '{{userId}}', operator: '==', right: '1' });
        await ensureBranchNodes(ctx);
        await ensureSwitchNode(ctx);
      },

      action: async (ctx) => {
        // Open the Console so the viewer watches the branch logs stream in live
        await spotlightSel(ctx, WF.CONSOLE_BADGE, 700);
        if (!document.querySelector(WF.CONSOLE)) {
          await ctx.click(WF.CONSOLE_BADGE);
          await ctx.waitFor(WF.CONSOLE, 4000);
        }
        await ctx.delay(600);

        // Spotlight Quick Test and run
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 900);
        triggerWorkflowQuickTest();
        await ctx.delay(3500);

        // Spotlight the entire variable snapshot block in the console
        const allLines = document.querySelectorAll<HTMLElement>(`${WF.CONSOLE} .wf-cl-line`);
        const snapshotLines: HTMLElement[] = [];
        let capturing = false;
        for (const line of allLines) {
          const text = line.textContent ?? '';
          if (text.includes('Variable snapshot')) { capturing = true; snapshotLines.push(line); continue; }
          if (capturing && text.match(/^\s+\S+\s*=/)) { snapshotLines.push(line); } else if (capturing) { capturing = false; }
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
      },

      verify: WF.CONSOLE,
    },
  ],
};
