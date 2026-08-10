/**
 * WF-1 — Build Your First Workflow
 *
 * 6 steps: create a blank workflow → add an HTTP Request node from palette →
 * connect Start → HTTP → configure URL + method → run Quick Test →
 * open Console panel to see execution logs.
 *
 * Uses JSONPlaceholder (CORS-friendly, no auth) so the demo works without setup.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  expandWfDemoAppSidebar,
  openWfNodeConfigModal,
  fillWfConfigField,
  saveAndCloseWfConfigModal,
  closeWfConfigModalIfOpen,
  closeWfSamplePreviewIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  ensureLessonBlankWorkflow,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  triggerWorkflowQuickTest,
  fitWorkflowCanvasView,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'My First Workflow';
const DEMO_URL = 'https://jsonplaceholder.typicode.com/posts/1';
const SAVE_BTN = '.wf-pill-btn[title="Save current node layout"]';

// ─── Helpers ────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

function spotlight(el: HTMLElement, holdMs: number, ctx: DemoActionContext): Promise<void> {
  activeCleanup?.();
  activeCleanup = null;
  // Never scrollIntoView a React Flow canvas node/edge — it scrolls an ancestor
  // container and undoes the fitted viewport (nodes drift off-center). Fit View
  // already guarantees canvas elements are visible; the ring alone is enough.
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

async function dismissOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) { skipBtn.click(); await ctx.delay(300); }
}

/** Ensure canvas is showing (create workflow if needed — for preAction guards). */
async function ensureWorkflowCanvas(ctx: DemoActionContext): Promise<void> {
  await ensureLessonBlankWorkflow(ctx, WF_NAME, { dismissOnboarding: dismissOnboarding });
}

/** Get node id from a CSS selector targeting a React Flow node. */
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

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfFirstWorkflowLesson: DemoLesson = {
  id: 'wf-first-workflow',
  domainId: 'workflow',
  category: 'fundamentals',
  name: 'Build Your First Workflow',
  description:
    'Create a workflow from scratch — learn the canvas, palette, node configuration, ' +
    'connections, and Quick Test execution.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Automate Multi-Step API Sequences',
    body:
      'The Workflow Designer lets you build automated multi-step API sequences visually — ' +
      'no code required.\n\n' +
      '**How it works:**\n' +
      '- **Palette** on the left — drag nodes (HTTP requests, logic, data) onto the canvas\n' +
      '- **Canvas** in the center — connect nodes with edges to define execution order\n' +
      '- **Config modal** — double-click any node to set its URL, method, body, and variables\n' +
      '- **Quick Test** — one click runs the entire workflow and shows pass/fail per node\n\n' +
      '**In this lesson:** You will create a blank workflow, add an HTTP Request node, ' +
      'configure it to call a public API, connect it to Start, and execute it with Quick Test.',
    keyTerms: [
      { term: 'Node', definition: 'A single step in a workflow — each node performs one action (HTTP call, condition, extraction, etc.).' },
      { term: 'Edge', definition: 'A connection between two nodes that defines execution order — data flows left to right.' },
      { term: 'Palette', definition: 'The block menu on the left side — drag any block onto the canvas to add a node.' },
      { term: 'Quick Test', definition: 'One-click execution of the entire workflow against real endpoints — shows timing and pass/fail badges.' },
    ],
    diagram: `<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="65" height="40" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="42" y="44" text-anchor="middle" fill="#10b981" font-size="9" font-weight="600">Start</text>
      <path d="M80 40 L130 40" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf1arr)"/>
      <rect x="135" y="15" width="100" height="50" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="185" y="37" text-anchor="middle" fill="#3b82f6" font-size="9" font-weight="600">HTTP Request</text>
      <text x="185" y="52" text-anchor="middle" fill="#94a3b8" font-size="7">GET /posts/1</text>
      <path d="M240 40 L275 40" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf1arr)"/>
      <rect x="280" y="25" width="60" height="30" rx="12" fill="#10b981" stroke="none"/>
      <text x="310" y="44" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">200 OK</text>
      <defs><marker id="wf1arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('workflow');
    await ctx.delay(200);
    // Persisted Gallery preview paints over any blank workflow — clear before
    // step 1 so the viewer never sees Sample: Parallel API Calls.
    await closeWfSamplePreviewIfOpen(ctx);
    resetWfPaletteToBlocks();
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(300);
    await dismissOnboarding(ctx);
  },

  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Create a New Workflow ──────────────────────────────────
    {
      id: 'wf1-create',
      title: 'Create a New Workflow',
      description:
        'Click **+ New** in the sidebar to create a blank workflow. ' +
        'The canvas appears with a single **Start** node — every workflow begins here. ' +
        'The palette on the left shows all available node types organized by category.',
      highlight: WF.SIDEBAR_NEW_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        await closeWfSamplePreviewIfOpen(ctx);
        await dismissOnboarding(ctx);
      },

      action: async (ctx) => {
        await closeWfSamplePreviewIfOpen(ctx);
        await expandWfDemoAppSidebar(ctx);
        await ctx.waitFor(WF.SIDEBAR_NEW_BTN, 5000);
        await ctx.delay(600);

        await spotlightSel(ctx, WF.SIDEBAR_NEW_BTN, 1200);

        await ctx.click(WF.SIDEBAR_NEW_BTN);
        await ctx.waitFor('.wf-new-dropdown');
        await ctx.delay(600);

        await spotlightSel(ctx, WF.NEW_BLANK_ITEM, 800);

        await ctx.click(WF.NEW_BLANK_ITEM);
        await ctx.waitFor(WF.CREATE_INPUT);
        await ctx.delay(500);

        await ctx.fill(WF.CREATE_INPUT, WF_NAME);
        await ctx.delay(600);

        await ctx.click(WF.CREATE_OK);
        // Sample Preview's canvas already has a Start node — dismiss the banner
        // first, then wait for the real blank workflow Start.
        for (let i = 0; i < 30 && document.querySelector(WF.SAMPLE_PREVIEW_BANNER); i++) {
          await closeWfSamplePreviewIfOpen(ctx);
          await ctx.delay(100);
        }
        await ctx.waitFor(WF.NODE_START, 8000);
        await ctx.delay(800);

        await collapseWfDemoAppSidebar(ctx);
        await ctx.delay(600);

        await spotlightSel(ctx, WF.NODE_START, 1200);
      },

      verify: WF.NODE_START,
    },

    // ── Step 2: Add an HTTP Request Node ──────────────────────────────
    {
      id: 'wf1-add-http',
      title: 'Add an HTTP Request Node',
      description:
        'Find **HTTP Request** in the palette under the **Actions** category. ' +
        'Click it to place it on the canvas. This node will make a real API call ' +
        'when the workflow runs.',
      highlight: WF.PAL_HTTP,

      preAction: async (ctx) => {
        await ensureWorkflowCanvas(ctx);
      },

      action: async (ctx) => {
        const httpBlock = await revealPaletteBlock(ctx, WF.PAL_HTTP);
        if (httpBlock) {
          await spotlight(httpBlock, 1400, ctx);
        }

        addWorkflowNodeWithPreset('http', `http-${Date.now()}`, 'HTTP Request', { x: 320, y: 180 });
        await ctx.delay(1500);

        await spotlightSel(ctx, WF.NODE_HTTP, 1200);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 3: Connect the Nodes ─────────────────────────────────────
    {
      id: 'wf1-connect',
      title: 'Connect the Nodes',
      description:
        'Connect the **Start** node output to the **HTTP Request** node input. ' +
        'Edges define execution order — data flows left to right. ' +
        'Then click **Fit View** to center the graph and **Save** to persist the layout.',
      highlight: WF.NODE_START,

      preAction: async (ctx) => {
        await ensureWorkflowCanvas(ctx);
        if (!document.querySelector(WF.NODE_HTTP)) {
          addWorkflowNodeWithPreset('http', `http-${Date.now()}`, 'HTTP Request', { x: 320, y: 180 });
          await ctx.delay(800);
        }
      },

      action: async (ctx) => {
        await spotlightSel(ctx, WF.NODE_START, 1200);

        const startId = getNodeId(WF.NODE_START);
        const httpId = getNodeId(WF.NODE_HTTP);
        if (startId && httpId) {
          connectWorkflowNodes(startId, httpId);
        }
        await ctx.delay(1500);

        const edgePath = document.querySelector<HTMLElement>('.react-flow__edge path.react-flow__edge-path');
        const edgeFallback = edgePath ?? document.querySelector<HTMLElement>('.react-flow__edge');
        if (edgeFallback) {
          await spotlight(edgeFallback, 1200, ctx);
        }

        // Click Fit View to center the graph nicely
        await spotlightSel(ctx, WF.FIT_VIEW_BTN, 800);
        const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
        if (fitBtn) fitBtn.click();
        await ctx.delay(1200);

        // Click Save to persist the layout
        await spotlightSel(ctx, SAVE_BTN, 800);
        const saveBtn = document.querySelector<HTMLElement>(SAVE_BTN);
        if (saveBtn) saveBtn.click();
        await ctx.delay(1000);
      },

      verify: '.react-flow__edge',
    },

    // ── Step 4: Configure the HTTP Node ───────────────────────────────
    {
      id: 'wf1-configure',
      title: 'Configure the HTTP Node',
      description:
        'Double-click the HTTP node to open its config modal. Set the **URL** to ' +
        '`https://jsonplaceholder.typicode.com/posts/1` and verify the method is **GET**. ' +
        'The Config tab shows the request settings — URL, method, headers, and body.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureWorkflowCanvas(ctx);
        if (!document.querySelector(WF.NODE_HTTP)) {
          addWorkflowNodeWithPreset('http', `http-${Date.now()}`, 'HTTP Request', { x: 320, y: 180 });
          await ctx.delay(800);
        }
        const startId = getNodeId(WF.NODE_START);
        const httpId = getNodeId(WF.NODE_HTTP);
        if (startId && httpId && !document.querySelector('.react-flow__edge')) {
          connectWorkflowNodes(startId, httpId);
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
        await ctx.delay(1000);

        await spotlightSel(ctx, WF.CFG_HTTP_METHOD, 1000);

        await fillWfConfigField(ctx, WF.CFG_HTTP_URL, DEMO_URL);
        await ctx.delay(800);

        await spotlightSel(ctx, WF.CFG_HTTP_URL, 1400);

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        // Spotlight the configured HTTP node — spotlight() no longer scrolls
        // canvas nodes, so this won't disturb the viewport.
        await spotlightSel(ctx, WF.NODE_HTTP, 1200);

        // Fit the canvas LAST by clicking the real Fit View button (centered,
        // symmetric padding) — matches step 3 and the manual control. Nothing runs
        // after this that could shift the viewport.
        await spotlightSel(ctx, WF.FIT_VIEW_BTN, 700);
        fitCanvasCentered();
        await ctx.delay(1200);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 5: Quick Test — Run It! ──────────────────────────────────
    {
      id: 'wf1-run',
      title: 'Quick Test — Run It!',
      description:
        'Click **▶ Quick Test** in the toolbar to execute the workflow. The HTTP node ' +
        'calls the real API — watch it turn **green** with a timing badge when it passes. ' +
        'The Exec Summary shows response status (200 OK) and total execution time.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureWorkflowCanvas(ctx);
        if (!document.querySelector(WF.NODE_HTTP)) {
          addWorkflowNodeWithPreset('http', `http-${Date.now()}`, 'HTTP Request', { x: 320, y: 180 });
          await ctx.delay(500);
        }
        const startId = getNodeId(WF.NODE_START);
        const httpId = getNodeId(WF.NODE_HTTP);
        if (startId && httpId && !document.querySelector('.react-flow__edge')) {
          connectWorkflowNodes(startId, httpId);
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1200);

        triggerWorkflowQuickTest();
        await ctx.delay(3000);

        const passBadge = document.querySelector<HTMLElement>('.wf-node-badge-pass, .wf-node-status-pass');
        if (passBadge) {
          await spotlight(passBadge, 1500, ctx);
        } else {
          await spotlightSel(ctx, WF.NODE_HTTP, 1500);
        }

        const summary = document.querySelector<HTMLElement>(WF.EXEC_SUMMARY);
        if (summary) {
          await spotlight(summary, 1200, ctx);
        }
      },

      verify: WF.EXEC_SUMMARY,
    },

    // ── Step 6: The Console Panel ─────────────────────────────────────
    {
      id: 'wf1-console',
      title: 'The Console Panel',
      description:
        'Click the **Console** badge in the status bar to open the execution log. ' +
        'It shows structured entries — timestamps, node names, HTTP status codes, ' +
        'headers, and response bodies. This is your go-to tool for debugging workflows.',
      highlight: WF.CONSOLE_BADGE,

      preAction: async (ctx) => {
        await ensureWorkflowCanvas(ctx);
      },

      action: async (ctx) => {
        await spotlightSel(ctx, WF.CONSOLE_BADGE, 1200);
        await ctx.click(WF.CONSOLE_BADGE);
        await ctx.delay(1200);

        // Run Quick Test so console has log entries to show
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 800);
        triggerWorkflowQuickTest();
        await ctx.delay(3000);

        // Spotlight the Console panel with logs
        await spotlightSel(ctx, WF.CONSOLE, 2000);

        const searchInput = document.querySelector<HTMLElement>('.wf-console-search input');
        if (searchInput) {
          await spotlight(searchInput, 1000, ctx);
        }

        await ctx.delay(800);
      },

      verify: WF.CONSOLE,
    },
  ],
};
