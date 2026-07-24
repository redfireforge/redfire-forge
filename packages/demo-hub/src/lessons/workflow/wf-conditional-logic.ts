/**
 * WF-3 — Conditional Branching
 *
 * 5 steps: add a Condition node → configure it (userId == 1) →
 * wire Yes/No branch paths with Log/Debug nodes → demonstrate the Switch node →
 * run Quick Test and see which branch is taken.
 *
 * Prerequisite: seeded workflow with Start → HTTP GET /posts/1 → extraction of userId.
 * JSONPlaceholder /posts/1 returns { userId: 1 }, so condition evaluates to true → Yes path.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  saveAndCloseWfConfigModal,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
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

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Conditional Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';
const SAVE_BTN = '.wf-toolbar-save-wrap button';

// Fixed IDs for nodes added during the lesson (so preAction guards can find them)
const COND_NODE_ID = 'wf3-cond';
const LOG_YES_ID = 'wf3-log-yes';
const LOG_NO_ID = 'wf3-log-no';
const SWITCH_NODE_ID = 'wf3-switch';

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
          extractions: [{ id: 'ext-userId', source: 'body', variable: 'userId', expression: '$.userId' }],
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

async function ensureSeededWorkflow(ctx: DemoActionContext): Promise<void> {
  await waitForWorkflowBridge(ctx);
  if (document.querySelector(WF.CANVAS)) {
    const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
    if (fitBtn) { fitBtn.click(); await ctx.delay(400); }
    return;
  }
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (fitBtn) { fitBtn.click(); await ctx.delay(600); }
  else { fitWorkflowCanvasView({ duration: 300 }); await ctx.delay(500); }
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
  patchWorkflowNodeDataById(LOG_YES_ID, { label: 'Author!', message: 'User is the author! userId={{userId}}', logLevel: 'info', snapshotVariables: false });
  if (condId) connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
  await ctx.delay(300);
  // No path
  addWorkflowNodeWithPreset('logDebug', LOG_NO_ID, 'Different User', { x: 760, y: 300 });
  await ctx.delay(300);
  patchWorkflowNodeDataById(LOG_NO_ID, { label: 'Different User', message: 'Different user — userId={{userId}}', logLevel: 'warn', snapshotVariables: false });
  if (condId) connectWorkflowNodes(condId, LOG_NO_ID, 'false', null);
  await ctx.delay(300);
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
      'and routes to different Log nodes based on the result.',
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
    await ctx.delay(200);
    resetWfPaletteToBlocks();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(300);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
    await ctx.delay(600);
    const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
    if (fitBtn) { fitBtn.click(); await ctx.delay(600); }
    else { fitWorkflowCanvasView({ duration: 300 }); await ctx.delay(500); }
    await collapseWfDemoAppSidebar(ctx);
  },

  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Add a Condition Node ────────────────────────────────────
    {
      id: 'wf3-condition-node',
      title: 'Add a Condition Node',
      description:
        'Find **Condition** in the palette under the **Logic** category. ' +
        'This node evaluates an expression and routes execution to **Yes** or **No** — ' +
        'like an if/else in code. Place it after the HTTP node to branch based on the response.',
      highlight: WF.PAL_CONDITION,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Condition block in the palette
        const condBlock = document.querySelector<HTMLElement>(WF.PAL_CONDITION);
        if (condBlock) {
          condBlock.scrollIntoView({ block: 'center' });
          await ctx.delay(400);
          await spotlight(condBlock, 1400, ctx);
        }

        // Add Condition node to the canvas
        addWorkflowNodeWithPreset('condition', COND_NODE_ID, 'Check User', { x: 520, y: 200 });
        await ctx.delay(1500);

        // Connect HTTP → Condition
        const httpId = getNodeId(WF.NODE_HTTP);
        const condNodeId = getNodeId(WF.NODE_CONDITION);
        if (httpId && condNodeId) {
          connectWorkflowNodes(httpId, condNodeId);
        }
        await ctx.delay(1200);

        // Fit view and save
        const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
        if (fitBtn) fitBtn.click();
        await ctx.delay(800);

        const saveBtn = document.querySelector<HTMLElement>(SAVE_BTN);
        if (saveBtn) saveBtn.click();
        await ctx.delay(600);

        // Spotlight the Condition node showing Yes/No handles
        await spotlightSel(ctx, WF.NODE_CONDITION, 1500);
      },

      verify: WF.NODE_CONDITION,
    },

    // ── Step 2: Configure the Condition ─────────────────────────────────
    {
      id: 'wf3-configure-condition',
      title: 'Configure the Condition',
      description:
        'Double-click the Condition node to open its config. Set the **left operand** to ' +
        '`{{userId}}` (the extracted variable), **operator** to `==`, and **right value** to `1`. ' +
        'This evaluates whether the post author is user #1.',
      highlight: WF.NODE_CONDITION,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
      },

      action: async (ctx) => {
        // Open the Condition node config
        const condNodeId = getNodeId(WF.NODE_CONDITION);
        if (condNodeId) {
          openWorkflowNodeConfig(condNodeId);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);
        }

        // Switch to Expression mode for left operand (radio button)
        const exprRadio = document.querySelector<HTMLInputElement>(
          '.wf-config-modal .wf-config-inline-radio:last-child input[type="radio"]',
        );
        if (exprRadio && !exprRadio.checked) {
          exprRadio.click();
          await ctx.delay(600);
        }

        // Fill the left operand expression with {{userId}}
        const leftTextarea = document.querySelector<HTMLTextAreaElement>(
          '.wf-config-modal .wf-config-textarea',
        );
        if (leftTextarea) {
          leftTextarea.focus();
          leftTextarea.value = '{{userId}}';
          leftTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          leftTextarea.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(600);
          await spotlight(leftTextarea, 1200, ctx);
        }

        // Spotlight the Operator selector (already defaults to ==)
        const operatorSelect = document.querySelector<HTMLElement>(
          '.wf-config-modal .wf-config-field .cs-wrapper',
        );
        if (operatorSelect) {
          await spotlight(operatorSelect, 1000, ctx);
        }

        // Fill the right value
        const rightInput = document.querySelector<HTMLInputElement>(
          '.wf-config-modal .expr-input-wrapper input',
        );
        if (rightInput) {
          rightInput.focus();
          rightInput.value = '1';
          rightInput.dispatchEvent(new Event('input', { bubbles: true }));
          rightInput.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(600);
          await spotlight(rightInput, 1000, ctx);
        }

        // Save and close
        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(1000);

        // Spotlight the configured condition node
        await spotlightSel(ctx, WF.NODE_CONDITION, 1200);
      },

      verify: WF.NODE_CONDITION,
    },

    // ── Step 3: Wire the Branch Paths ───────────────────────────────────
    {
      id: 'wf3-branch-paths',
      title: 'Wire the Branch Paths',
      description:
        'Add two **Log/Debug** nodes — one for each branch. Connect the Condition\'s ' +
        '**Yes** handle to a log saying "User is the author!" and the **No** handle to ' +
        '"Different user". Each branch runs independently based on the condition result.',
      highlight: WF.PAL_LOG_DEBUG,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Log/Debug block in palette
        const logBlock = document.querySelector<HTMLElement>(WF.PAL_LOG_DEBUG);
        if (logBlock) {
          logBlock.scrollIntoView({ block: 'center' });
          await ctx.delay(300);
          await spotlight(logBlock, 1200, ctx);
        }

        // Add YES-path Log/Debug node
        addWorkflowNodeWithPreset('logDebug', LOG_YES_ID, 'Author!', { x: 760, y: 120 });
        await ctx.delay(1000);

        // Configure the Yes log node data
        patchWorkflowNodeDataById(LOG_YES_ID, {
          label: 'Author!',
          message: 'User is the author! userId={{userId}}',
          logLevel: 'info',
          snapshotVariables: false,
        });

        // Connect Condition Yes → Log (sourceHandle 'true')
        const condId = getNodeId(WF.NODE_CONDITION);
        if (condId) {
          connectWorkflowNodes(condId, LOG_YES_ID, 'true', null);
        }
        await ctx.delay(1000);

        // Spotlight the Yes log node
        const yesLog = document.querySelectorAll<HTMLElement>(WF.NODE_LOG_DEBUG)[0];
        if (yesLog) await spotlight(yesLog, 1000, ctx);

        // Add NO-path Log/Debug node
        addWorkflowNodeWithPreset('logDebug', LOG_NO_ID, 'Different User', { x: 760, y: 300 });
        await ctx.delay(1000);

        // Configure the No log node data
        patchWorkflowNodeDataById(LOG_NO_ID, {
          label: 'Different User',
          message: 'Different user — userId={{userId}}',
          logLevel: 'warn',
          snapshotVariables: false,
        });

        // Connect Condition No → Log (sourceHandle 'false')
        if (condId) {
          connectWorkflowNodes(condId, LOG_NO_ID, 'false', null);
        }
        await ctx.delay(1200);

        // Spotlight the No log node
        const noLog = document.querySelectorAll<HTMLElement>(WF.NODE_LOG_DEBUG)[1];
        if (noLog) await spotlight(noLog, 1000, ctx);

        // Fit view to show the full branching shape
        const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
        if (fitBtn) fitBtn.click();
        await ctx.delay(800);

        // Save
        const saveBtn = document.querySelector<HTMLElement>(SAVE_BTN);
        if (saveBtn) saveBtn.click();
        await ctx.delay(600);

        // Spotlight the diamond branch layout — condition node at center
        await spotlightSel(ctx, WF.NODE_CONDITION, 1500);
      },

      verify: WF.NODE_LOG_DEBUG,
    },

    // ── Step 4: The Switch Node (Multi-Way) ─────────────────────────────
    {
      id: 'wf3-switch-node',
      title: 'The Switch Node (Multi-Way)',
      description:
        'The **Switch** node handles multiple cases — like a switch/case statement. ' +
        'It matches an expression against a list of values, each with its own output handle. ' +
        'Add one to the canvas and configure three cases to see how multi-way branching works.',
      highlight: WF.PAL_SWITCH,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Switch block in palette
        const switchBlock = document.querySelector<HTMLElement>(WF.PAL_SWITCH);
        if (switchBlock) {
          switchBlock.scrollIntoView({ block: 'center' });
          await ctx.delay(400);
          await spotlight(switchBlock, 1400, ctx);
        }

        // Add Switch node below the existing graph (for demonstration)
        addWorkflowNodeWithPreset('switch', SWITCH_NODE_ID, 'Route by Role', { x: 520, y: 420 });
        await ctx.delay(1500);

        // Open its config
        openWorkflowNodeConfig(SWITCH_NODE_ID);
        await ctx.waitFor(WF.NODE_CONFIG, 5000);
        await ctx.delay(1000);

        // Fill expression field
        const exprInput = document.querySelector<HTMLInputElement>(
          '.wf-config-modal .expr-input-wrapper input',
        );
        if (exprInput) {
          exprInput.focus();
          exprInput.value = '{{role}}';
          exprInput.dispatchEvent(new Event('input', { bubbles: true }));
          exprInput.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(600);
          await spotlight(exprInput, 1200, ctx);
        }

        // Add 3 cases
        const addCaseBtn = document.querySelector<HTMLElement>('.wf-config-modal .wf-switch-add-case');
        if (addCaseBtn) {
          for (let i = 0; i < 3; i++) {
            addCaseBtn.click();
            await ctx.delay(500);
          }
        }

        // Fill case values
        const caseInputs = document.querySelectorAll<HTMLInputElement>(
          '.wf-config-modal .wf-switch-case-value',
        );
        const caseValues = ['admin', 'editor', 'viewer'];
        for (let i = 0; i < Math.min(caseInputs.length, 3); i++) {
          caseInputs[i].focus();
          caseInputs[i].value = caseValues[i];
          caseInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
          caseInputs[i].dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(400);
        }

        // Spotlight the cases list
        const casesList = document.querySelector<HTMLElement>('.wf-config-modal .wf-switch-cases-list');
        if (casesList) await spotlight(casesList, 1500, ctx);

        // Close without saving (demonstration only)
        const cancelBtn = document.querySelector<HTMLElement>(WF.CFG_CANCEL);
        if (cancelBtn) cancelBtn.click();
        await ctx.delay(800);

        // Connect Start → Switch so it's part of the graph (parallel demo branch)
        connectWorkflowNodes('start-1', SWITCH_NODE_ID);
        await ctx.delay(600);

        // Fit view and spotlight the Switch node on canvas
        fitWorkflowCanvasView({ duration: 300 });
        await ctx.delay(800);

        await spotlightSel(ctx, WF.NODE_SWITCH, 1200);
      },

      verify: WF.NODE_SWITCH,
    },

    // ── Step 5: Run and See the Branch Taken ────────────────────────────
    {
      id: 'wf3-run-condition',
      title: 'Run and See the Branch Taken',
      description:
        'Click **Quick Test** to run the workflow. The HTTP node fetches `userId: 1`, ' +
        'the Condition evaluates `1 == 1` → **true**, so the **Yes** path executes and ' +
        'the **No** path is skipped. Watch the green/gray badges show which branch was taken.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureConditionNode(ctx);
        // Patch condition data to ensure it's configured
        patchWorkflowNodeDataById(COND_NODE_ID, { left: '{{userId}}', operator: '==', right: '1' });
        await ensureBranchNodes(ctx);
      },

      action: async (ctx) => {
        // Spotlight Quick Test button
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1200);

        // Run
        triggerWorkflowQuickTest();
        await ctx.delay(3500);

        // Spotlight the Yes-path log node (should be green/passed)
        const logNodes = document.querySelectorAll<HTMLElement>(WF.NODE_LOG_DEBUG);
        if (logNodes.length > 0) {
          const yesNode = logNodes[0];
          const passBadge = yesNode.querySelector<HTMLElement>('.wf-node-badge-pass, .wf-node-status-pass');
          if (passBadge) {
            await spotlight(passBadge, 1500, ctx);
          } else {
            await spotlight(yesNode, 1500, ctx);
          }
        }

        // Spotlight the No-path node (should be gray/skipped)
        if (logNodes.length > 1) {
          const noNode = logNodes[1];
          await spotlight(noNode, 1200, ctx);
        }

        // Open Console to show the log message
        await ctx.click(WF.CONSOLE_BADGE);
        await ctx.delay(1200);

        // Spotlight the Console panel showing the branch result
        await spotlightSel(ctx, WF.CONSOLE, 1500);
      },

      verify: WF.CONSOLE,
    },
  ],
};
