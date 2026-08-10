/**
 * WF-5 — Error Handling & Recovery
 *
 * 4 steps:
 *   1. Show variable config + the 404 endpoint (why we need error handling)
 *   2. Add & configure the API Guard (Error Handler node with retry)
 *   3. Add & configure the Catch: Fallback node (error variables)
 *   4. Run Quick Test and watch graceful recovery in the Console
 *
 * Prerequisite: seeded workflow with Start → HTTP GET /posts/9999 (will 404).
 * The Error Handler wraps the failing HTTP node via its **body** handle, retries
 * twice, then falls through to the **catch** path where a Log/Debug shows the
 * error details using {{error.statusCode}} and {{error.retryCount}}.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  openWfNodeConfigModal,
  saveAndCloseWfConfigModal,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  ensureLessonWorkflowShown,
  openWfConsoleIfClosed,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  removeWorkflowEdge,
  triggerWorkflowQuickTest,
  fitWorkflowCanvasView,
  patchWorkflowNodeDataById,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Error Handling Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';

const ERR_HANDLER_ID = 'wf5-err-handler';
const HTTP_404_ID = 'wf5-http-404';
const LOG_CATCH_ID = 'wf5-log-catch';
const CATCH_MSG = 'Failed after {{error.retryCount}} retries: {{error.statusCode}}';

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 100, y: 80 }, data: { label: 'Start' } },
    {
      id: HTTP_404_ID,
      type: 'http',
      position: { x: 380, y: 250 },
      data: {
        label: 'Get Post (404)',
        scenario: {
          id: 'wf5-get-scenario',
          name: 'Get Invalid Post',
          url: '{{baseUrl}}/posts/9999',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [],
        },
        timeoutSec: 0,
      },
    },
  ],
  edges: [{ id: 'e-start-http', source: 'start-1', target: HTTP_404_ID }],
  variables: { baseUrl: BASE_URL },
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
    // the previous step left it — re-fitting every step causes visible jumping.
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
  const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (fitBtn) { fitBtn.click(); await ctx.delay(600); }
  else { fitWorkflowCanvasView({ duration: 300 }); await ctx.delay(500); }
}

/** Ensure Error Handler node is placed and connected to Start. */
async function ensureErrorHandlerNode(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.NODE_ERROR_HANDLER)) return;

  // Remove the seeded Start → HTTP edge before inserting Error Handler between them
  removeWorkflowEdge('start-1', HTTP_404_ID);
  await ctx.delay(200);

  addWorkflowNodeWithPreset('errorHandler', ERR_HANDLER_ID, 'API Guard', { x: 380, y: 80 });
  await ctx.delay(500);

  // Patch the Error Handler config to match the demo's target values
  patchWorkflowNodeDataById(ERR_HANDLER_ID, {
    label: 'API Guard',
    errorFilter: 'all',
    retryCount: 2,
    retryDelayMs: 500,
    retryBackoff: 'fixed',
    retryTimeoutMs: 0,
    continueOnError: true,
  });

  // Wire: Start → ErrorHandler, ErrorHandler body → HTTP (404)
  connectWorkflowNodes('start-1', ERR_HANDLER_ID);
  await ctx.delay(300);
  connectWorkflowNodes(ERR_HANDLER_ID, HTTP_404_ID, 'body', null);
  await ctx.delay(300);
}

/** Ensure the catch Log/Debug node exists and is wired to Error Handler catch. */
async function ensureCatchLogNode(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(`[data-id="${LOG_CATCH_ID}"]`)) return;

  addWorkflowNodeWithPreset('logDebug', LOG_CATCH_ID, 'Catch: Fallback', { x: 650, y: 250 });
  await ctx.delay(400);
  patchWorkflowNodeDataById(LOG_CATCH_ID, {
    label: 'Catch: Fallback',
    message: CATCH_MSG,
    logLevel: 'warn',
    snapshotVariables: false,
  });
  connectWorkflowNodes(ERR_HANDLER_ID, LOG_CATCH_ID, 'catch', null);
  await ctx.delay(300);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfErrorHandlingLesson: DemoLesson = {
  id: 'wf-error-handling',
  domainId: 'workflow',
  category: 'tooling',
  name: 'Error Handling & Recovery',
  description:
    'Handle API failures gracefully — retry, catch, and recover without crashing the workflow.',
  estimatedMinutes: 4,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Error Handling in Workflows',
    body:
      'Real-world APIs fail — servers go down, endpoints return 404, timeouts happen. The ' +
      '**Error Handler** node wraps other nodes and provides automatic **retry** and a **catch** ' +
      'path for graceful recovery.\n\n' +
      '**Key concepts:**\n' +
      '- **Error Handler node** — wraps nodes via its Body handle; retries on failure\n' +
      '- **Retry Settings** — count, delay, backoff strategy (fixed/exponential)\n' +
      '- **Catch path** — executes when all retries are exhausted; receives error variables\n' +
      '- **Error variables** — `{{error.message}}`, `{{error.statusCode}}`, `{{error.retryCount}}`\n' +
      '- **Continue on error** — workflow stays green even when the catch path fires\n\n' +
      '**In this lesson:** An HTTP GET targets a non-existent endpoint (`/posts/9999` → 404). ' +
      'The Error Handler retries twice, then the catch path logs the failure details. The ' +
      'workflow completes successfully — no crash.',
    keyTerms: [
      { term: 'Error Handler', definition: 'A flow-control node that wraps other nodes, providing automatic retry and a catch path when failures occur.' },
      { term: 'Body Handle', definition: 'The output handle where you connect the nodes to be protected — these are the "try" path.' },
      { term: 'Catch Handle', definition: 'The fallback output handle — nodes connected here execute when all retries fail.' },
      { term: 'Done Handle', definition: 'Runs after either the body (success) or catch (failure) path completes.' },
      { term: 'Error Variables', definition: 'Variables injected on the catch path: error.message, error.statusCode, error.retryCount, error.type.' },
    ],
    diagram: `<svg viewBox="0 0 420 130" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="50" width="60" height="26" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="35" y="67" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="600">Start</text>
      <path d="M70 63 L100 63" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf5arr)"/>
      <rect x="105" y="35" width="100" height="55" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="4 2"/>
      <text x="155" y="50" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="600">Error Handler</text>
      <text x="155" y="62" text-anchor="middle" fill="#94a3b8" font-size="5.5">retry: 2 × 500ms</text>
      <text x="120" y="82" fill="#94a3b8" font-size="5">Body</text>
      <text x="170" y="82" fill="#ef4444" font-size="5">Catch</text>
      <path d="M130 90 L130 110 L170 110" stroke="#94a3b8" stroke-width="1" marker-end="url(#wf5arr)"/>
      <rect x="175" y="100" width="75" height="22" rx="4" fill="#1e293b" stroke="#ef4444" stroke-width="1.2"/>
      <text x="212" y="115" text-anchor="middle" fill="#ef4444" font-size="6">GET /posts/9999</text>
      <path d="M175 75 L240 75" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 2" marker-end="url(#wf5arr)"/>
      <rect x="245" y="62" width="85" height="24" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="287" y="78" text-anchor="middle" fill="#10b981" font-size="6">Log: Fallback</text>
      <path d="M210 63 L350 63" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 2"/>
      <text x="360" y="67" fill="#94a3b8" font-size="5">Done →</text>
      <defs><marker id="wf5arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
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
    // Close Workflow Variables modal if open
    const dm = document.querySelector<HTMLElement>(WF.DEFAULTS_MODAL);
    if (dm) { const c = dm.querySelector<HTMLElement>('.btn-ghost'); if (c) c.click(); }
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Show Variable & Get Post ─────────────────────────────
    {
      id: 'wf5-show-context',
      title: 'The Problem: A 404 Endpoint',
      description:
        'This workflow has a single HTTP node targeting **`{{baseUrl}}/posts/9999`** — a ' +
        'non-existent resource that will always return **404 Not Found**.\n\n' +
        'Without any protection, this failure would **crash the entire workflow**. ' +
        'In the next steps we\'ll add an Error Handler to retry and gracefully recover.',

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
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
        await ctx.waitFor(WF.CFG_HTTP_URL, 4000);
        await ctx.delay(400);

        // Spotlight the URL field showing {{baseUrl}}/posts/9999 (once, during action)
        const urlField = document.querySelector<HTMLElement>(WF.CFG_HTTP_URL);
        if (urlField) {
          urlField.scrollIntoView({ block: 'center', inline: 'nearest' });
          await spotlight(urlField, 2800, ctx);
        }

        // Resolved preview confirms the 404 path after {{baseUrl}} expands
        const preview = document.querySelector<HTMLElement>(WF.CFG_HTTP_URL_PREVIEW);
        if (preview) await spotlight(preview, 1400, ctx);

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(400);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 2: Add & Configure API Guard ────────────────────────────
    {
      id: 'wf5-api-guard',
      title: 'Add & Configure API Guard',
      description:
        'Find **Error Handler** in the palette under **Flow**. Add it to the canvas, ' +
        'wire **Start → API Guard** and **API Guard body → Get Post (404)**, then click **Fit View**.\n\n' +
        'Open its config to set up retry behavior:\n' +
        '- **Error Filter** — which errors to catch (All, HTTP, Assertion, Network)\n' +
        '- **Retry Count** — 2 retries before giving up\n' +
        '- **Retry Delay** — 500ms between attempts (fixed backoff)\n' +
        '- **Continue after catch** — workflow stays green even on failure\n\n' +
        'Watch the three output handles: **Body** (try path), **Catch** (fallback), **Done** (after either).',
      highlight: WF.PAL_ERROR_HANDLER,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Error Handler palette block
        const errBlock = await revealPaletteBlock(ctx, WF.PAL_ERROR_HANDLER);
        if (errBlock) await spotlight(errBlock, 1200, ctx);

        // Remove seeded Start → HTTP edge before inserting Error Handler between them
        removeWorkflowEdge('start-1', HTTP_404_ID);
        await ctx.delay(200);

        // Add Error Handler node
        addWorkflowNodeWithPreset('errorHandler', ERR_HANDLER_ID, 'API Guard', { x: 380, y: 80 });
        await ctx.delay(1200);

        // Connect: Start → ErrorHandler, ErrorHandler body → HTTP (404)
        connectWorkflowNodes('start-1', ERR_HANDLER_ID);
        await ctx.delay(600);
        connectWorkflowNodes(ERR_HANDLER_ID, HTTP_404_ID, 'body', null);
        await ctx.delay(600);

        // Fit View
        fitCanvasCentered();
        await ctx.delay(800);

        // Patch with retry config
        patchWorkflowNodeDataById(ERR_HANDLER_ID, {
          label: 'API Guard',
          errorFilter: 'all',
          retryCount: 2,
          retryDelayMs: 500,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: true,
        });
        await ctx.delay(400);

        // Open config modal to SHOW the viewer the settings
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_ERROR_HANDLER });
        await ctx.delay(800);

        // Spotlight Error Handling section
        const errorSection = Array.from(
          document.querySelectorAll<HTMLElement>('.wf-config-group-title'),
        ).find((el) => el.textContent?.includes('Error Handling'));
        if (errorSection) {
          const group = errorSection.closest<HTMLElement>('.wf-config-group');
          if (group) await spotlight(group, 1200, ctx);
        }

        // Spotlight Retry Settings section (with visual preview)
        const retrySection = Array.from(
          document.querySelectorAll<HTMLElement>('.wf-config-group-title'),
        ).find((el) => el.textContent?.includes('Retry'));
        if (retrySection) {
          const group = retrySection.closest<HTMLElement>('.wf-config-group');
          if (group) await spotlight(group, 1800, ctx);
        }

        // Spotlight Behavior section (Continue checkbox)
        const behaviorSection = Array.from(
          document.querySelectorAll<HTMLElement>('.wf-config-group-title'),
        ).find((el) => el.textContent?.includes('Behavior'));
        if (behaviorSection) {
          const group = behaviorSection.closest<HTMLElement>('.wf-config-group');
          if (group) await spotlight(group, 1200, ctx);
        }

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(600);
      },

      verify: WF.NODE_ERROR_HANDLER,
    },

    // ── Step 3: Add & Configure Catch: Fallback ──────────────────────
    {
      id: 'wf5-catch-fallback',
      title: 'Add & Configure Catch: Fallback',
      description:
        'Wire a **Log/Debug** node to the **Catch** handle — this is the fallback ' +
        'that executes when the HTTP 404 exhausts all retries.\n\n' +
        'The catch path receives special **error variables**:\n' +
        '- `{{error.message}}` — the error description\n' +
        '- `{{error.statusCode}}` — HTTP status code (e.g. 404)\n' +
        '- `{{error.retryCount}}` — how many retries were attempted\n' +
        '- `{{error.type}}` — error classification\n\n' +
        'The message template uses these to log: "Failed after 2 retries: 404".',
      highlight: WF.NODE_LOG_DEBUG,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureErrorHandlerNode(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },

      action: async (ctx) => {
        // Add Catch: Fallback node → Connect to catch handle → Fit View
        addWorkflowNodeWithPreset('logDebug', LOG_CATCH_ID, 'Catch: Fallback', { x: 650, y: 250 });
        await ctx.delay(1000);

        connectWorkflowNodes(ERR_HANDLER_ID, LOG_CATCH_ID, 'catch', null);
        await ctx.delay(600);

        fitCanvasCentered();
        await ctx.delay(800);

        // Patch the node config with error variable template
        patchWorkflowNodeDataById(LOG_CATCH_ID, {
          label: 'Catch: Fallback',
          message: CATCH_MSG,
          logLevel: 'warn',
          snapshotVariables: false,
        });
        await ctx.delay(400);

        // Open config modal to show the error variable template
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_LOG_DEBUG });
        await ctx.delay(800);

        // Spotlight the message template showing {{error.retryCount}} and {{error.statusCode}}
        const msgField = document.querySelector<HTMLElement>(
          `${WF.NODE_CONFIG} .mte-textarea, ${WF.NODE_CONFIG} textarea.wf-config-textarea`,
        );
        if (msgField) await spotlight(msgField, 2000, ctx);

        // Spotlight the variable chips (error.message, error.statusCode, etc.)
        const chipBar = document.querySelector<HTMLElement>(`${WF.NODE_CONFIG} .mte-chip-bar`);
        if (chipBar) await spotlight(chipBar, 1500, ctx);

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(600);
      },

      verify: WF.NODE_LOG_DEBUG,
    },

    // ── Step 4: Run and Watch Recovery ───────────────────────────────
    {
      id: 'wf5-run-error',
      title: 'Run and Watch Recovery',
      description:
        'Click **Quick Test** and watch the workflow handle the 404 gracefully:\n\n' +
        '1. HTTP node fires → fails with **404**\n' +
        '2. Error Handler **retries** (attempt 2) → fails again\n' +
        '3. **Catch path fires** → Log/Debug shows "Failed after 2 retries: 404"\n' +
        '4. Workflow completes **green** — the error was caught, not crashed\n\n' +
        'Check the **Console** for retry attempts and the final catch message. ' +
        'Without the Error Handler, this 404 would have stopped the entire workflow.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await ensureErrorHandlerNode(ctx);
        await ensureCatchLogNode(ctx);
        patchWorkflowNodeDataById(LOG_CATCH_ID, { message: CATCH_MSG });
        await closeWfConfigModalIfOpen(ctx);
        await openWfConsoleIfClosed(ctx);
      },

      action: async (ctx) => {
        // Spotlight Quick Test button then trigger execution
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1200);
        triggerWorkflowQuickTest();

        // Wait for execution: initial request + 2 retries × 500ms delay + network time
        await ctx.delay(6000);

        // --- Highlight the 3 assertion failure lines in the console ---
        const consoleEl = document.querySelector<HTMLElement>(WF.CONSOLE);
        if (!consoleEl) return;

        const allLines = consoleEl.querySelectorAll<HTMLElement>('.wf-cl-line');

        // Find all 3 "[Get Post (404)] assertion (http): expected 2xx, got HTTP 404" lines
        // (1 initial attempt + 2 retries = 3 total failures)
        const failureLines: HTMLElement[] = [];
        for (const line of allLines) {
          const text = line.querySelector('.wf-cl-text')?.textContent ?? line.textContent ?? '';
          if (text.includes('assertion') && text.includes('got HTTP 404')) {
            failureLines.push(line);
          }
        }

        // Spotlight each failure line — viewer sees all 3 failed attempts
        for (const failLine of failureLines) {
          failLine.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          await ctx.delay(300);
          await spotlight(failLine, 1500, ctx);
        }

        // Find "[API Guard] Body failed — executing catch path"
        let bodyFailedLine: HTMLElement | null = null;
        for (const line of allLines) {
          const text = line.querySelector('.wf-cl-text')?.textContent ?? line.textContent ?? '';
          if (text.includes('Body failed') && text.includes('executing catch path')) {
            bodyFailedLine = line;
          }
        }

        // Spotlight the body-failed line — shows retries exhausted, catch path fires
        if (bodyFailedLine) {
          bodyFailedLine.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          await ctx.delay(300);
          await spotlight(bodyFailedLine, 2500, ctx);
        }
      },

      verify: WF.CONSOLE,
    },
  ],
};
