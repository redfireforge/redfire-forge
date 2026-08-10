/**
 * WF-4 — Loops & Parallel Execution
 *
 * 7 steps: show loop source data (Variables + Extract) → add & configure Loop →
 * build loop body → add Fork → add parallel HTTP branches → add Join →
 * run Quick Test.
 *
 * Prerequisite: seeded workflow with Start → HTTP GET /posts (returns array,
 * extraction of `postIds` variable from response body).
 * JSONPlaceholder GET /posts returns a 100-element array; loop limited to max=3.
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
  closeWfConsoleIfOpen,
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

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Loops & Parallel';
const BASE_URL = 'https://jsonplaceholder.typicode.com';

const LOOP_NODE_ID = 'wf4-loop';
const LOOP_BODY_HTTP_ID = 'wf4-loop-body-http';
const FORK_NODE_ID = 'wf4-fork';
const JOIN_NODE_ID = 'wf4-join';
const PAR_HTTP_1_ID = 'wf4-par-http-1';
const PAR_HTTP_2_ID = 'wf4-par-http-2';

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
    {
      id: 'http-get-posts',
      type: 'http',
      position: { x: 280, y: 200 },
      data: {
        label: 'Get Posts',
        scenario: {
          id: 'wf4-get-posts',
          name: 'Get Posts',
          url: '{{baseUrl}}/posts',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [{ name: 'postIds', source: 'body', expression: '$[*].id' }],
        },
        timeoutSec: 0,
      },
    },
  ],
  edges: [{ id: 'e-start-get', source: 'start-1', target: 'http-get-posts' }],
  variables: { baseUrl: BASE_URL },
};

// ─── Helpers ────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

/** Trim spotlight holds ~30% — lesson felt slow with stacked 1.2–2s rings. */
const SPOTLIGHT_HOLD_SCALE = 0.7;
const SPOTLIGHT_HOLD_MIN_MS = 450;

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
  const hold = Math.max(SPOTLIGHT_HOLD_MIN_MS, Math.round(holdMs * SPOTLIGHT_HOLD_SCALE));
  return ctx.delay(hold).then(() => { remove(); if (activeCleanup === remove) activeCleanup = null; });
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

  // Switch away from any previous lesson's workflow still on the canvas before
  // this lesson starts adding its own nodes (avoids piling onto the wrong graph).
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
  await ctx.delay(400);
  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  fitCanvasCentered();
  await ctx.delay(500);
}

async function ensureLoopNode(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.NODE_LOOP)) return;
  addWorkflowNodeWithPreset('loop', LOOP_NODE_ID, 'Loop Posts', { x: 520, y: 200 });
  await ctx.delay(400);
  const httpId = getNodeId(WF.NODE_HTTP);
  const loopId = getNodeId(WF.NODE_LOOP);
  if (httpId && loopId) connectWorkflowNodes(httpId, loopId);
  patchWorkflowNodeDataById(LOOP_NODE_ID, {
    label: 'Loop Posts',
    mode: 'forEach',
    sourceExpression: '{{postIds}}',
    itemVariable: 'postId',
    indexVariable: 'i',
    maxIterations: 3,
  });
  await ctx.delay(300);
}

async function ensureLoopBody(ctx: DemoActionContext): Promise<void> {
  const existing = document.querySelectorAll(WF.NODE_HTTP);
  if (existing.length >= 2) return;
  addWorkflowNodeWithPreset('http', LOOP_BODY_HTTP_ID, 'Get Comments', { x: 760, y: 200 });
  await ctx.delay(300);
  patchWorkflowNodeDataById(LOOP_BODY_HTTP_ID, {
    label: 'Get Comments',
    scenario: {
      id: 'wf4-comments',
      name: 'Get Comments',
      url: '{{baseUrl}}/comments?postId={{postId}}',
      method: 'GET',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
    },
    timeoutSec: 0,
  });
  const loopId = getNodeId(WF.NODE_LOOP);
  if (loopId) connectWorkflowNodes(loopId, LOOP_BODY_HTTP_ID, 'body', null);
  await ctx.delay(300);
}

/** Ensure Fork + parallel HTTP branches exist (quiet recovery for rapid Next). */
async function ensureForkAndBranches(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.NODE_FORK)) {
    addWorkflowNodeWithPreset('fork', FORK_NODE_ID, 'Parallel Fork', { x: 520, y: 420 });
    await ctx.delay(200);
    const loopId = getNodeId(WF.NODE_LOOP);
    if (loopId) connectWorkflowNodes(loopId, FORK_NODE_ID, 'done', null);
  }
  const parNodes = document.querySelectorAll(WF.NODE_HTTP);
  if (parNodes.length < 3) {
    addWorkflowNodeWithPreset('http', PAR_HTTP_1_ID, 'Get User 1', { x: 760, y: 370 });
    await ctx.delay(200);
    patchWorkflowNodeDataById(PAR_HTTP_1_ID, {
      label: 'Get User 1',
      scenario: {
        id: 'wf4-user1',
        name: 'Get User 1',
        url: '{{baseUrl}}/users/1',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      timeoutSec: 0,
    });
    addWorkflowNodeWithPreset('http', PAR_HTTP_2_ID, 'Get User 2', { x: 760, y: 480 });
    await ctx.delay(200);
    patchWorkflowNodeDataById(PAR_HTTP_2_ID, {
      label: 'Get User 2',
      scenario: {
        id: 'wf4-user2',
        name: 'Get User 2',
        url: '{{baseUrl}}/users/2',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      timeoutSec: 0,
    });
    connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_1_ID);
    connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_2_ID);
    await ctx.delay(300);
  }
}

/** Ensure Join + edges from both parallel HTTP branches (quiet recovery). */
async function ensureJoinNode(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.NODE_JOIN)) {
    addWorkflowNodeWithPreset('join', JOIN_NODE_ID, 'Join', { x: 1000, y: 420 });
    await ctx.delay(200);
  }
  connectWorkflowNodes(PAR_HTTP_1_ID, JOIN_NODE_ID);
  connectWorkflowNodes(PAR_HTTP_2_ID, JOIN_NODE_ID);
  await ctx.delay(200);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfLoopsParallelLesson: DemoLesson = {
  id: 'wf-loops-parallel',
  domainId: 'workflow',
  category: 'logic',
  name: 'Loops & Parallel Execution',
  description:
    'Process collections with loops and run multiple API calls simultaneously with fork/join.',
  estimatedMinutes: 7,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Iteration & Parallelism',
    body:
      'APIs often return arrays — a list of posts, users, or orders. The **Loop** node lets you ' +
      'iterate over each item and run nodes per element.\n\n' +
      '**Key concepts:**\n' +
      '- **Loop (forEach)** — iterates over a JSON array, exposing each item as a variable\n' +
      '- **Loop (count)** — repeats a fixed number of times (useful for retries or pagination)\n' +
      '- **Max Iterations** — safety cap to prevent runaway loops\n' +
      '- **Fork** — splits execution into parallel branches (all run simultaneously)\n' +
      '- **Join** — waits for all parallel branches to complete before continuing\n\n' +
      '**In this lesson:** GET /posts extracts post IDs into `{{postIds}}`. The Loop iterates ' +
      'over 3 IDs, fetching comments for each. Then Fork/Join demonstrates parallel API calls.',
    keyTerms: [
      { term: 'Loop Node', definition: 'Iterates over an array (forEach) or repeats N times (count). Exposes item and index variables to the body.' },
      { term: 'Body Handle', definition: 'The output of a Loop that connects to nodes executed per iteration.' },
      { term: 'Done Handle', definition: 'Fires after all iterations complete — connects to nodes that run once at the end.' },
      { term: 'Fork Node', definition: 'Splits execution into concurrent branches — all connected nodes start simultaneously.' },
      { term: 'Join Node', definition: 'Waits for all incoming branches to finish before continuing downstream.' },
    ],
    diagram: `<svg viewBox="0 0 420 130" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="50" width="60" height="28" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="35" y="68" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="600">GET /posts</text>
      <path d="M70 64 L105 64" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf4arr)"/>
      <rect x="110" y="45" width="60" height="38" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="140" y="60" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="600">Loop</text>
      <text x="140" y="72" text-anchor="middle" fill="#f59e0b" font-size="6">forEach</text>
      <path d="M170 55 L210 55" stroke="#10b981" stroke-width="1.2" stroke-dasharray="4,2" marker-end="url(#wf4arr)"/>
      <text x="190" y="49" fill="#10b981" font-size="5">body</text>
      <rect x="215" y="40" width="70" height="28" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="250" y="58" text-anchor="middle" fill="#10b981" font-size="6">Get Comments</text>
      <text x="250" y="84" fill="#64748b" font-size="5" text-anchor="middle">x3 iterations</text>
      <path d="M170 74 L210 98" stroke="#64748b" stroke-width="1.2" marker-end="url(#wf4arr)"/>
      <text x="182" y="93" fill="#64748b" font-size="5">done</text>
      <rect x="215" y="88" width="50" height="22" rx="5" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
      <text x="240" y="103" text-anchor="middle" fill="#64748b" font-size="6">Next...</text>
      <line x1="310" y1="10" x2="310" y2="125" stroke="#3b4a60" stroke-width="0.5" stroke-dasharray="3,3"/>
      <polygon points="330,64 350,45 370,64 350,83" fill="#1e293b" stroke="#8b5cf6" stroke-width="1.5"/>
      <text x="350" y="67" text-anchor="middle" fill="#8b5cf6" font-size="6" font-weight="600">Fork</text>
      <path d="M370 52 L395 35" stroke="#8b5cf6" stroke-width="1" marker-end="url(#wf4arr)"/>
      <path d="M370 76 L395 93" stroke="#8b5cf6" stroke-width="1" marker-end="url(#wf4arr)"/>
      <circle cx="400" cy="32" r="4" fill="#3b82f6"/>
      <circle cx="400" cy="96" r="4" fill="#3b82f6"/>
      <text x="350" y="120" text-anchor="middle" fill="#64748b" font-size="5">parallel</text>
      <defs><marker id="wf4arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
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
    fitCanvasCentered();
    await ctx.delay(500);
    await collapseWfDemoAppSidebar(ctx);
  },

  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    // Close Workflow Variables modal if open
    const dm = document.querySelector<HTMLElement>(WF.DEFAULTS_MODAL);
    if (dm) { const c = dm.querySelector<HTMLElement>('.btn-ghost'); if (c) c.click(); }
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Where Loop Data Comes From ────────────────────────────
    {
      id: 'wf4-loop-source',
      title: 'Where Loop Data Comes From',
      description:
        'This workflow already has **Start → Get Posts**. Before we add a Loop, see the ' +
        'two pieces of data it will use:\n\n' +
        '1. **Variables** — `baseUrl` is the shared host for every HTTP step\n' +
        '2. **Extract** on Get Posts — JSONPath `$[*].id` stores the post ID array as ' +
        '`{{postIds}}`\n\n' +
        'The Loop will iterate that array in the next step.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        const strayDefaults = document.querySelector<HTMLElement>(WF.DEFAULTS_MODAL);
        if (strayDefaults) {
          const cancel = strayDefaults.querySelector<HTMLElement>('.btn-ghost');
          if (cancel) cancel.click();
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        // Show the Variables panel — viewer sees baseUrl
        const varsBtn = document.querySelector<HTMLElement>('.wf-toolbar-variables-btn');
        if (varsBtn) {
          await spotlight(varsBtn, 1000, ctx);
          varsBtn.click();
          await ctx.delay(1200);
        }
        const defaultsModal = document.querySelector<HTMLElement>(WF.DEFAULTS_MODAL);
        if (defaultsModal) {
          const varRow = defaultsModal.querySelector<HTMLElement>('.wf-config-kv-row-vars:not(.wf-config-kv-header)');
          if (varRow) await spotlight(varRow, 1800, ctx);
          const cancelBtn = defaultsModal.querySelector<HTMLElement>('.btn-ghost');
          if (cancelBtn) cancelBtn.click();
          await ctx.delay(600);
        } else {
          const closeBtn = document.querySelector<HTMLElement>('.insert-variable-modal .btn, .ram-modal-footer .btn');
          if (closeBtn) { closeBtn.click(); await ctx.delay(400); }
        }

        // Open Get Posts → Extract — viewer sees where {{postIds}} comes from
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
        await ctx.delay(400);

        const extractTab = Array.from(
          document.querySelectorAll<HTMLElement>('.wf-config-tab'),
        ).find((t) => t.textContent?.includes('Extract'));
        if (extractTab) await spotlight(extractTab, 1000, ctx);
        await clickWfConfigTab(ctx, WF.NODE_CONFIG, 'Extract');
        await ctx.delay(600);

        const extRow = document.querySelector<HTMLElement>(WF.CFG_EXT_ROW);
        if (extRow) {
          extRow.scrollIntoView({ block: 'nearest' });
          await spotlight(extRow, 2000, ctx);
        }

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        fitCanvasCentered();
        await ctx.delay(600);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 2: Add & Configure the Loop ──────────────────────────────
    {
      id: 'wf4-loop-node',
      title: 'Add & Configure the Loop',
      description:
        'Find **Loop** in the palette under **Logic**. Add it after **Get Posts**, click ' +
        '**Fit View**, then open its config:\n\n' +
        '- Mode → **For Each**\n' +
        '- Source array → `{{postIds}}`\n' +
        '- Item variable → `postId`\n' +
        '- **Max Iterations** → `3` (demo speed — production would use the full array)',
      highlight: WF.PAL_LOOP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        const strayDefaults = document.querySelector<HTMLElement>(WF.DEFAULTS_MODAL);
        if (strayDefaults) {
          const cancel = strayDefaults.querySelector<HTMLElement>('.btn-ghost');
          if (cancel) cancel.click();
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        const loopBlock = await revealPaletteBlock(ctx, WF.PAL_LOOP);
        if (loopBlock) {
          await spotlight(loopBlock, 1400, ctx);
        }

        if (!document.querySelector(WF.NODE_LOOP)) {
          addWorkflowNodeWithPreset('loop', LOOP_NODE_ID, 'Loop Posts', { x: 520, y: 200 });
          await ctx.delay(1200);
          const httpId = getNodeId(WF.NODE_HTTP);
          const loopId = getNodeId(WF.NODE_LOOP);
          if (httpId && loopId) {
            connectWorkflowNodes(httpId, loopId);
          }
          await ctx.delay(1000);
        }

        fitCanvasCentered();
        await ctx.delay(800);

        await spotlightSel(ctx, WF.NODE_LOOP, 1200);

        patchWorkflowNodeDataById(LOOP_NODE_ID, {
          label: 'Loop Posts',
          mode: 'forEach',
          sourceExpression: '{{postIds}}',
          itemVariable: 'postId',
          indexVariable: 'i',
          maxIterations: 3,
        });
        await ctx.delay(400);

        const loopId = getNodeId(WF.NODE_LOOP);
        if (loopId) {
          openWorkflowNodeConfig(loopId);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);
        }

        const modeSelect = document.querySelector<HTMLElement>(
          '.wf-config-modal .wf-config-field .cs-wrapper',
        );
        if (modeSelect) {
          await spotlight(modeSelect, 1200, ctx);
        }

        const exprInputs = document.querySelectorAll<HTMLElement>(
          '.wf-config-modal .expr-input-wrapper',
        );
        if (exprInputs.length > 0) {
          await spotlight(exprInputs[0], 1200, ctx);
        }

        // Max iterations field if present
        const maxInput = document.querySelector<HTMLElement>(
          '.wf-config-modal input[type="number"], .wf-config-modal .wf-config-field input',
        );
        if (maxInput) {
          await spotlight(maxInput, 1000, ctx);
        }

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);
      },

      verify: WF.NODE_LOOP,
    },

    // ── Step 3: Build the Loop Body ───────────────────────────────────
    {
      id: 'wf4-loop-body',
      title: 'Build the Loop Body',
      description:
        'Add an **HTTP Request** node connected to the Loop\'s **body** handle. ' +
        'Configure it to fetch comments for the current post: ' +
        '`GET {{baseUrl}}/comments?postId={{postId}}`. The `{{postId}}` variable is the current ' +
        'item from the Loop — it runs **once per iteration**, 3 times total.',
      highlight: WF.PAL_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
      },

      action: async (ctx) => {
        const httpBlock = await revealPaletteBlock(ctx, WF.PAL_HTTP);
        if (httpBlock) {
          await spotlight(httpBlock, 1000, ctx);
        }

        // Add → connect → fit view → configure
        addWorkflowNodeWithPreset('http', LOOP_BODY_HTTP_ID, 'Get Comments', { x: 760, y: 200 });
        await ctx.delay(800);

        const loopId = getNodeId(WF.NODE_LOOP);
        if (loopId) {
          connectWorkflowNodes(loopId, LOOP_BODY_HTTP_ID, 'body', null);
        }
        await ctx.delay(600);

        fitCanvasCentered();
        await ctx.delay(800);

        patchWorkflowNodeDataById(LOOP_BODY_HTTP_ID, {
          label: 'Get Comments',
          scenario: {
            id: 'wf4-comments',
            name: 'Get Comments',
            url: '{{baseUrl}}/comments?postId={{postId}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          timeoutSec: 0,
        });
        await ctx.delay(400);

        openWorkflowNodeConfig(LOOP_BODY_HTTP_ID);
        await ctx.waitFor(WF.NODE_CONFIG, 5000);
        await ctx.delay(800);

        // Spotlight the URL showing {{baseUrl}}/comments?postId={{postId}}
        const urlInput = document.querySelector<HTMLElement>(WF.CFG_HTTP_URL);
        if (urlInput) await spotlight(urlInput, 1500, ctx);

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 4: Add the Fork Node ─────────────────────────────────────
    {
      id: 'wf4-add-fork',
      title: 'Add the Fork Node',
      description:
        'The **Fork** node splits execution into concurrent branches — all connected nodes ' +
        'start simultaneously. Add a Fork from the palette and connect it to the Loop\'s **done** handle ' +
        '(after all iterations complete, we branch into parallel work).',
      highlight: WF.PAL_FORK,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
        await ensureLoopBody(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Fork block in palette
        const forkBlock = await revealPaletteBlock(ctx, WF.PAL_FORK);
        if (forkBlock) {
          await spotlight(forkBlock, 1200, ctx);
        }

        // Add Fork node and connect to Loop's done handle
        addWorkflowNodeWithPreset('fork', FORK_NODE_ID, 'Parallel Fork', { x: 520, y: 420 });
        await ctx.delay(800);

        const loopId = getNodeId(WF.NODE_LOOP);
        if (loopId) {
          connectWorkflowNodes(loopId, FORK_NODE_ID, 'done', null);
        }
        await ctx.delay(600);

        fitCanvasCentered();
        await ctx.delay(1000);

        // Open Fork config to show its label
        openWorkflowNodeConfig(FORK_NODE_ID);
        await ctx.waitFor(WF.NODE_CONFIG, 5000);
        await ctx.delay(1000);

        // Spotlight the label field
        const labelInput = document.querySelector<HTMLElement>('.wf-config-modal .wf-config-field input[type="text"]');
        if (labelInput) await spotlight(labelInput, 1200, ctx);

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);
      },

      verify: WF.NODE_FORK,
    },

    // ── Step 5: Add Parallel HTTP Branches ──────────────────────────────
    {
      id: 'wf4-parallel-branches',
      title: 'Add Parallel HTTP Branches',
      description:
        'Add two **HTTP Request** nodes and connect them both from the Fork. Each branch ' +
        'fetches a different user (`/users/1` and `/users/2`) — they will execute simultaneously. ' +
        'This is the power of Fork: instead of sequential waits, both requests run at once.',
      highlight: WF.PAL_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
        await ensureLoopBody(ctx);
        // Ensure Fork exists
        if (!document.querySelector(WF.NODE_FORK)) {
          addWorkflowNodeWithPreset('fork', FORK_NODE_ID, 'Parallel Fork', { x: 520, y: 420 });
          await ctx.delay(300);
          const loopId = getNodeId(WF.NODE_LOOP);
          if (loopId) connectWorkflowNodes(loopId, FORK_NODE_ID, 'done', null);
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        // ── First HTTP: add → connect → fit → configure ──
        addWorkflowNodeWithPreset('http', PAR_HTTP_1_ID, 'Get User 1', { x: 760, y: 370 });
        await ctx.delay(600);
        connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_1_ID);
        await ctx.delay(600);

        fitCanvasCentered();
        await ctx.delay(800);

        patchWorkflowNodeDataById(PAR_HTTP_1_ID, {
          label: 'Get User 1',
          scenario: {
            id: 'wf4-user1',
            name: 'Get User 1',
            url: '{{baseUrl}}/users/1',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          timeoutSec: 0,
        });
        await ctx.delay(300);

        // Spotlight the Get User 1 node on canvas
        const node1 = document.querySelector<HTMLElement>(`[data-id="${PAR_HTTP_1_ID}"]`);
        if (node1) {
          const flowNode1 = node1.closest<HTMLElement>('.react-flow__node') ?? node1;
          await spotlight(flowNode1, 1000, ctx);
        }

        openWorkflowNodeConfig(PAR_HTTP_1_ID);
        await ctx.waitFor(WF.NODE_CONFIG, 5000);
        await ctx.delay(800);
        const urlInput1 = document.querySelector<HTMLElement>(WF.CFG_HTTP_URL);
        if (urlInput1) await spotlight(urlInput1, 1200, ctx);
        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(600);

        // ── Second HTTP: add → connect → fit → configure ──
        addWorkflowNodeWithPreset('http', PAR_HTTP_2_ID, 'Get User 2', { x: 760, y: 480 });
        await ctx.delay(600);
        connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_2_ID);
        await ctx.delay(600);

        fitCanvasCentered();
        await ctx.delay(800);

        patchWorkflowNodeDataById(PAR_HTTP_2_ID, {
          label: 'Get User 2',
          scenario: {
            id: 'wf4-user2',
            name: 'Get User 2',
            url: '{{baseUrl}}/users/2',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          timeoutSec: 0,
        });
        await ctx.delay(300);

        // Spotlight the Get User 2 node on canvas
        const node2 = document.querySelector<HTMLElement>(`[data-id="${PAR_HTTP_2_ID}"]`);
        if (node2) {
          const flowNode2 = node2.closest<HTMLElement>('.react-flow__node') ?? node2;
          await spotlight(flowNode2, 1000, ctx);
        }

        openWorkflowNodeConfig(PAR_HTTP_2_ID);
        await ctx.waitFor(WF.NODE_CONFIG, 5000);
        await ctx.delay(800);
        const urlInput2 = document.querySelector<HTMLElement>(WF.CFG_HTTP_URL);
        if (urlInput2) await spotlight(urlInput2, 1200, ctx);
        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(600);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 6: Add Join and Complete the Pattern ────────────────────────
    {
      id: 'wf4-add-join',
      title: 'Add Join and Complete the Pattern',
      description:
        'The **Join** node waits for all branches to complete before continuing. Connect both ' +
        'HTTP nodes into the Join — this creates the classic Fork → parallel work → Join pattern. ' +
        'Execution only continues past Join once **both** user lookups have responded.',
      highlight: WF.PAL_JOIN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
        await ensureLoopBody(ctx);
        await ensureForkAndBranches(ctx);
        // Stray console / config from a prior Quick Test or skipped step blocks
        // the canvas and can leave Acting stuck behind an un-savable Join modal.
        await closeWfConsoleIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        await closeWfConsoleIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);

        const joinAlreadyPresent = !!document.querySelector(WF.NODE_JOIN);

        if (!joinAlreadyPresent) {
          // Spotlight the Join block in palette
          const joinBlock = await revealPaletteBlock(ctx, WF.PAL_JOIN);
          if (joinBlock) {
            await spotlight(joinBlock, 1000, ctx);
          }

          addWorkflowNodeWithPreset('join', JOIN_NODE_ID, 'Join', { x: 1000, y: 420 });
          await ctx.delay(600);

          connectWorkflowNodes(PAR_HTTP_1_ID, JOIN_NODE_ID);
          await ctx.delay(500);
          connectWorkflowNodes(PAR_HTTP_2_ID, JOIN_NODE_ID);
          await ctx.delay(600);

          fitCanvasCentered();
          await ctx.delay(1000);

          // Open Join config to show its settings (Save is often disabled — no dirty
          // fields — so always dismiss via saveAndClose / close helper).
          openWorkflowNodeConfig(JOIN_NODE_ID);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);

          const labelInput = document.querySelector<HTMLElement>('.wf-config-modal .wf-config-field input[type="text"]');
          if (labelInput) await spotlight(labelInput, 1200, ctx);

          await saveAndCloseWfConfigModal(ctx);
          await ctx.delay(800);
        } else {
          // Recovery / rapid-Next: Join is already on the canvas — don't re-open
          // config (Save-disabled path used to leave the modal open and stall Next).
          connectWorkflowNodes(PAR_HTTP_1_ID, JOIN_NODE_ID);
          connectWorkflowNodes(PAR_HTTP_2_ID, JOIN_NODE_ID);
          fitCanvasCentered();
          await ctx.delay(800);
        }

        // Spotlight the complete Fork → branches → Join pattern
        await spotlightSel(ctx, WF.NODE_FORK, 1200);
        await spotlightSel(ctx, WF.NODE_JOIN, 1200);
        await closeWfConfigModalIfOpen(ctx);
      },

      verify: WF.NODE_JOIN,
    },

    // ── Step 7: Run Quick Test ────────────────────────────────────────
    {
      id: 'wf4-run-parallel',
      title: 'Run and Watch It All Execute',
      description:
        'Open the **Console** first, then click **▶ Quick Test** so you watch the logs stream in ' +
        'live: the Loop executes 3 iterations (fetching comments for each post), then the Fork ' +
        'splits into 2 parallel user lookups that run simultaneously. The Console fills with ' +
        'iteration logs and parallel timing as it runs.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
        await ensureLoopBody(ctx);
        await ensureForkAndBranches(ctx);
        await ensureJoinNode(ctx);
        await closeWfConfigModalIfOpen(ctx);
        fitCanvasCentered();
        await ctx.delay(400);
      },

      action: async (ctx) => {
        // Open the Console so the viewer watches logs stream in live
        const consoleBadge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
        if (consoleBadge) await spotlight(consoleBadge, 700, ctx);

        if (!document.querySelector(WF.CONSOLE)) {
          consoleBadge?.click();
          await ctx.waitFor(WF.CONSOLE, 4000).catch(() => {});
          await ctx.delay(600);
        }

        // Spotlight Quick Test button, then trigger execution via bridge
        const qtBtn = document.querySelector<HTMLElement>(WF.QUICK_TEST_BTN);
        if (qtBtn) await spotlight(qtBtn, 800, ctx);
        triggerWorkflowQuickTest();
        await ctx.delay(4500);

        // Spotlight the console filling with iteration logs + parallel timing
        const consolePanel = document.querySelector<HTMLElement>(WF.CONSOLE);
        if (consolePanel) {
          await spotlight(consolePanel, 1500, ctx);
        }

        // Spotlight the canvas nodes showing pass/fail status
        fitCanvasCentered();
        await ctx.delay(600);

        await spotlightSel(ctx, WF.NODE_LOOP, 800);
        await spotlightSel(ctx, WF.NODE_FORK, 800);
      },

      verify: WF.CONSOLE,
    },
  ],
};
