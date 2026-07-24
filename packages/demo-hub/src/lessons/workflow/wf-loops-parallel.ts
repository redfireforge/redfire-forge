/**
 * WF-4 — Loops & Parallel Execution
 *
 * 5 steps: add Loop node → configure forEach → build loop body →
 * add Fork/Join parallel pattern → run Quick Test to see both in action.
 *
 * Prerequisite: seeded workflow with Start → HTTP GET /posts (returns array,
 * extraction of `posts` variable from response body).
 * JSONPlaceholder GET /posts returns a 100-element array; loop limited to max=3.
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
          url: `${BASE_URL}/posts`,
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [{ id: 'ext-posts', source: 'body', variable: 'posts', expression: '$' }],
        },
        timeoutSec: 0,
      },
    },
  ],
  edges: [{ id: 'e-start-get', source: 'start-1', target: 'http-get-posts' }],
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
  fitWorkflowCanvasView({ duration: 300 });
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
    sourceExpression: '{{posts}}',
    itemVariable: 'post',
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
      url: `${BASE_URL}/comments?postId={{post.id}}`,
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

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfLoopsParallelLesson: DemoLesson = {
  id: 'wf-loops-parallel',
  domainId: 'workflow',
  category: 'logic',
  name: 'Loops & Parallel Execution',
  description:
    'Process collections with loops and run multiple API calls simultaneously with fork/join.',
  estimatedMinutes: 5,
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
      '**In this lesson:** GET /posts extracts the array. The Loop iterates over 3 posts, ' +
      'fetching comments for each. Then Fork/Join demonstrates parallel API calls.',
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
    fitWorkflowCanvasView({ duration: 300 });
    await ctx.delay(500);
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
    // ── Step 1: Add a Loop Node ───────────────────────────────────────
    {
      id: 'wf4-loop-node',
      title: 'Add a Loop Node',
      description:
        'Find **Loop** in the palette under the **Logic** category. ' +
        'The Loop node iterates over arrays or repeats a fixed number of times. ' +
        'It has two output handles: **body** (runs per iteration) and **done** (fires after all iterations).',
      highlight: WF.PAL_LOOP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        const loopBlock = document.querySelector<HTMLElement>(WF.PAL_LOOP);
        if (loopBlock) {
          loopBlock.scrollIntoView({ block: 'center' });
          await ctx.delay(400);
          await spotlight(loopBlock, 1400, ctx);
        }

        addWorkflowNodeWithPreset('loop', LOOP_NODE_ID, 'Loop Posts', { x: 520, y: 200 });
        await ctx.delay(1200);

        const httpId = getNodeId(WF.NODE_HTTP);
        const loopId = getNodeId(WF.NODE_LOOP);
        if (httpId && loopId) {
          connectWorkflowNodes(httpId, loopId);
        }
        await ctx.delay(1000);

        fitWorkflowCanvasView({ duration: 300 });
        await ctx.delay(800);

        await spotlightSel(ctx, WF.NODE_LOOP, 1500);
      },

      verify: WF.NODE_LOOP,
    },

    // ── Step 2: Configure the Loop ────────────────────────────────────
    {
      id: 'wf4-configure-loop',
      title: 'Configure the Loop',
      description:
        'Double-click the Loop node to open its config. Set the mode to **For Each**, ' +
        'the source array to `{{posts}}` (extracted from the GET response), and the item variable to `post`. ' +
        'Set **Max Iterations** to 3 for demo speed — in production you\'d iterate the full array.',
      highlight: WF.NODE_LOOP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
      },

      action: async (ctx) => {
        const loopNodeId = getNodeId(WF.NODE_LOOP);
        if (loopNodeId) {
          openWorkflowNodeConfig(loopNodeId);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);
        }

        // Spotlight the Mode selector
        const modeSelect = document.querySelector<HTMLElement>(
          '.wf-config-modal .wf-config-field .cs-wrapper',
        );
        if (modeSelect) {
          await spotlight(modeSelect, 1200, ctx);
        }

        // Patch the node data directly (more reliable than DOM manipulation)
        patchWorkflowNodeDataById(LOOP_NODE_ID, {
          label: 'Loop Posts',
          mode: 'forEach',
          sourceExpression: '{{posts}}',
          itemVariable: 'post',
          indexVariable: 'i',
          maxIterations: 3,
        });
        await ctx.delay(800);

        // Spotlight the source expression field area
        const exprInputs = document.querySelectorAll<HTMLElement>(
          '.wf-config-modal .expr-input-wrapper',
        );
        if (exprInputs.length > 0) {
          await spotlight(exprInputs[0], 1200, ctx);
        }

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        fitWorkflowCanvasView({ duration: 300 });
        await ctx.delay(800);

        await spotlightSel(ctx, WF.NODE_LOOP, 1200);
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
        '`GET /comments?postId={{post.id}}`. This runs **once per iteration** — ' +
        '3 times total (one for each post in the array).',
      highlight: WF.PAL_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
      },

      action: async (ctx) => {
        const httpBlock = document.querySelector<HTMLElement>(WF.PAL_HTTP);
        if (httpBlock) {
          httpBlock.scrollIntoView({ block: 'center' });
          await ctx.delay(300);
          await spotlight(httpBlock, 1000, ctx);
        }

        addWorkflowNodeWithPreset('http', LOOP_BODY_HTTP_ID, 'Get Comments', { x: 760, y: 200 });
        await ctx.delay(1000);

        patchWorkflowNodeDataById(LOOP_BODY_HTTP_ID, {
          label: 'Get Comments',
          scenario: {
            id: 'wf4-comments',
            name: 'Get Comments',
            url: `${BASE_URL}/comments?postId={{post.id}}`,
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          timeoutSec: 0,
        });
        await ctx.delay(600);

        // Connect Loop body → HTTP
        const loopId = getNodeId(WF.NODE_LOOP);
        if (loopId) {
          connectWorkflowNodes(loopId, LOOP_BODY_HTTP_ID, 'body', null);
        }
        await ctx.delay(1000);

        fitWorkflowCanvasView({ duration: 300 });
        await ctx.delay(800);

        // Spotlight the loop body HTTP node
        const httpNodes = document.querySelectorAll<HTMLElement>(WF.NODE_HTTP);
        const bodyNode = httpNodes.length > 1 ? httpNodes[1] : httpNodes[0];
        if (bodyNode) await spotlight(bodyNode, 1400, ctx);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 4: Parallel Fork & Join ──────────────────────────────────
    {
      id: 'wf4-fork-join',
      title: 'Parallel Fork & Join',
      description:
        'The **Fork** node splits execution into concurrent branches — all connected nodes ' +
        'start simultaneously. The **Join** node waits for all branches to complete.\n\n' +
        'Here we fork into 2 parallel HTTP calls (fetching different users) and join the results. ' +
        'In production, parallel execution dramatically reduces total workflow time.',
      highlight: WF.PAL_FORK,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
        await ensureLoopBody(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Fork block in palette
        const forkBlock = document.querySelector<HTMLElement>(WF.PAL_FORK);
        if (forkBlock) {
          forkBlock.scrollIntoView({ block: 'center' });
          await ctx.delay(300);
          await spotlight(forkBlock, 1200, ctx);
        }

        // Add Fork node connected to Loop's done handle
        addWorkflowNodeWithPreset('fork', FORK_NODE_ID, 'Parallel Fork', { x: 520, y: 420 });
        await ctx.delay(800);

        const loopId = getNodeId(WF.NODE_LOOP);
        if (loopId) {
          connectWorkflowNodes(loopId, FORK_NODE_ID, 'done', null);
        }
        await ctx.delay(600);

        // Add 2 parallel HTTP nodes
        addWorkflowNodeWithPreset('http', PAR_HTTP_1_ID, 'Get User 1', { x: 760, y: 370 });
        await ctx.delay(500);
        patchWorkflowNodeDataById(PAR_HTTP_1_ID, {
          label: 'Get User 1',
          scenario: {
            id: 'wf4-user1',
            name: 'Get User 1',
            url: `${BASE_URL}/users/1`,
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          timeoutSec: 0,
        });

        addWorkflowNodeWithPreset('http', PAR_HTTP_2_ID, 'Get User 2', { x: 760, y: 480 });
        await ctx.delay(500);
        patchWorkflowNodeDataById(PAR_HTTP_2_ID, {
          label: 'Get User 2',
          scenario: {
            id: 'wf4-user2',
            name: 'Get User 2',
            url: `${BASE_URL}/users/2`,
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          timeoutSec: 0,
        });
        await ctx.delay(500);

        // Connect Fork → both HTTP nodes
        connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_1_ID);
        await ctx.delay(400);
        connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_2_ID);
        await ctx.delay(400);

        // Add Join node
        addWorkflowNodeWithPreset('join', JOIN_NODE_ID, 'Join', { x: 1000, y: 420 });
        await ctx.delay(500);

        // Connect both HTTP nodes → Join
        connectWorkflowNodes(PAR_HTTP_1_ID, JOIN_NODE_ID);
        await ctx.delay(400);
        connectWorkflowNodes(PAR_HTTP_2_ID, JOIN_NODE_ID);
        await ctx.delay(600);

        fitWorkflowCanvasView({ duration: 300 });
        await ctx.delay(1200);

        // Spotlight Fork → parallel branches → Join
        await spotlightSel(ctx, WF.NODE_FORK, 1200);
        await spotlightSel(ctx, WF.NODE_JOIN, 1200);
      },

      verify: WF.NODE_FORK,
    },

    // ── Step 5: Run Quick Test ────────────────────────────────────────
    {
      id: 'wf4-run-parallel',
      title: 'Run and Watch It All Execute',
      description:
        'Click **Quick Test** and watch: the Loop executes 3 iterations (fetching comments for ' +
        'each post), then the Fork splits into 2 parallel user lookups that run simultaneously. ' +
        'Check the **Console** — you\'ll see iteration logs and parallel timing.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureLoopNode(ctx);
        await ensureLoopBody(ctx);
        // Ensure fork/join exist
        if (!document.querySelector(WF.NODE_FORK)) {
          addWorkflowNodeWithPreset('fork', FORK_NODE_ID, 'Parallel Fork', { x: 520, y: 420 });
          await ctx.delay(300);
          const loopId = getNodeId(WF.NODE_LOOP);
          if (loopId) connectWorkflowNodes(loopId, FORK_NODE_ID, 'done', null);
          addWorkflowNodeWithPreset('http', PAR_HTTP_1_ID, 'Get User 1', { x: 760, y: 370 });
          await ctx.delay(200);
          patchWorkflowNodeDataById(PAR_HTTP_1_ID, {
            label: 'Get User 1',
            scenario: { id: 'wf4-user1', name: 'Get User 1', url: `${BASE_URL}/users/1`, method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } },
            timeoutSec: 0,
          });
          addWorkflowNodeWithPreset('http', PAR_HTTP_2_ID, 'Get User 2', { x: 760, y: 480 });
          await ctx.delay(200);
          patchWorkflowNodeDataById(PAR_HTTP_2_ID, {
            label: 'Get User 2',
            scenario: { id: 'wf4-user2', name: 'Get User 2', url: `${BASE_URL}/users/2`, method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } },
            timeoutSec: 0,
          });
          connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_1_ID);
          connectWorkflowNodes(FORK_NODE_ID, PAR_HTTP_2_ID);
          addWorkflowNodeWithPreset('join', JOIN_NODE_ID, 'Join', { x: 1000, y: 420 });
          await ctx.delay(200);
          connectWorkflowNodes(PAR_HTTP_1_ID, JOIN_NODE_ID);
          connectWorkflowNodes(PAR_HTTP_2_ID, JOIN_NODE_ID);
          await ctx.delay(400);
          fitWorkflowCanvasView({ duration: 300 });
          await ctx.delay(500);
        }
      },

      action: async (ctx) => {
        // Spotlight Quick Test button
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1200);

        // Trigger Quick Test
        triggerWorkflowQuickTest();
        await ctx.delay(6000);

        // Spotlight the console to show iteration logs
        const consoleBadge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
        if (consoleBadge) {
          consoleBadge.click();
          await ctx.delay(800);
        }

        const consolePanel = document.querySelector<HTMLElement>(WF.CONSOLE);
        if (consolePanel) {
          await spotlight(consolePanel, 2000, ctx);
        }

        // Spotlight the canvas nodes showing pass/fail status
        fitWorkflowCanvasView({ duration: 300 });
        await ctx.delay(800);

        await spotlightSel(ctx, WF.NODE_LOOP, 1000);
        await spotlightSel(ctx, WF.NODE_FORK, 1000);
      },

      verify: WF.CONSOLE_BADGE,
    },
  ],
};
