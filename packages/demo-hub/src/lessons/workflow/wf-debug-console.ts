/**
 * WF-6 — Quick Test & Debug Mode
 *
 * 5 steps: run Quick Test (full run) → explore Console panel (search logs) →
 * start step-through Debug → inspect variables mid-run → reset and re-run.
 *
 * Prerequisite: seeded 5-node workflow:
 *   Start → HTTP POST /posts (creates post, extracts postId)
 *       → HTTP GET /posts/{{postId}} (fetches the created post)
 *       → Condition (check title exists)
 *       → Log "Verified!"
 *
 * JSONPlaceholder POST /posts returns { userId: 1, ... }, so postId = 1.
 * GET /posts/1 always returns 200 (unlike /posts/101 which 404s since the POST is fake).
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  ensureLessonWorkflowShown,
  openWfConsoleIfClosed,
  closeWfConsoleIfOpen,
  startWfDebugRun,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  triggerWorkflowQuickTest,
  fitWorkflowCanvasView,
  resetWorkflowRunState,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Debug Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
    {
      id: 'http-post',
      type: 'http',
      position: { x: 280, y: 200 },
      data: {
        label: 'Create Post',
        scenario: {
          id: 'wf6-post-scenario',
          name: 'Create Post',
          url: `${BASE_URL}/posts`,
          method: 'POST',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
          body: JSON.stringify({ title: 'Debug Demo', body: 'Testing debug mode', userId: 1 }),
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [
            { name: 'postId', source: 'body', expression: '$.userId' },
            { name: 'postTitle', source: 'body', expression: '$.title' },
          ],
        },
        timeoutSec: 0,
      },
    },
    {
      id: 'http-get',
      type: 'http',
      position: { x: 520, y: 200 },
      data: {
        label: 'Get Post',
        scenario: {
          id: 'wf6-get-scenario',
          name: 'Get Post',
          url: `${BASE_URL}/posts/{{postId}}`,
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
    {
      id: 'cond-check',
      type: 'condition',
      position: { x: 760, y: 200 },
      data: {
        label: 'Title Exists?',
        left: '{{postTitle}}',
        operator: '!==',
        right: '',
      },
    },
    {
      id: 'log-verified',
      type: 'logDebug',
      position: { x: 1000, y: 160 },
      data: {
        label: 'Verified!',
        message: 'Post {{postId}} verified — title: {{postTitle}}',
        logLevel: 'info',
        snapshotVariables: false,
      },
    },
  ],
  edges: [
    { id: 'e-start-post', source: 'start-1', target: 'http-post' },
    { id: 'e-post-get', source: 'http-post', target: 'http-get' },
    { id: 'e-get-cond', source: 'http-get', target: 'cond-check' },
    { id: 'e-cond-log', source: 'cond-check', target: 'log-verified', sourceHandle: 'true' },
  ],
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
      fitCanvasCentered();
      await ctx.delay(400);
    }
    return;
  }

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  fitCanvasCentered();
  await ctx.delay(400);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfDebugConsoleLesson: DemoLesson = {
  id: 'wf-debug-console',
  domainId: 'workflow',
  category: 'tooling',
  name: 'Quick Test & Debug Mode',
  description:
    'Master the execution tools — run workflows, inspect results in the Console, step through node-by-node in Debug mode.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Execution & Debugging',
    body:
      'The Workflow Designer has two execution modes:\n\n' +
      '**Quick Test** — runs the entire workflow end-to-end. Nodes show pass/fail badges ' +
      'and timing. The **Exec Summary** strip shows total results.\n\n' +
      '**Debug Mode** — pauses before each node so you can step through one at a time. ' +
      'While paused, the **Variable Context** badge lets you inspect every variable\'s ' +
      'live value — essential for understanding data flow.\n\n' +
      '**Key concepts:**\n' +
      '- **Console panel** — structured logs with search, timestamps, and variable snapshots\n' +
      '- **Debug Bar** — Resume, Step All, and Stop controls during debug sessions\n' +
      '- **Per-node Step** — click the Step button on any paused node to execute it\n' +
      '- **Run History** — browse and restore previous test runs for comparison',
    keyTerms: [
      { term: 'Quick Test', definition: 'Runs all nodes end-to-end; shows pass/fail badges and an Exec Summary strip.' },
      { term: 'Debug Mode', definition: 'Step-through execution that pauses before each node, letting you inspect state.' },
      { term: 'Console Panel', definition: 'Structured log view with search, showing HTTP results, variable assignments, and timing.' },
      { term: 'Variable Context', definition: 'Badge + modal showing the live snapshot of all workflow variables after each step.' },
      { term: 'Run History', definition: 'Dropdown listing previous Quick Test/Debug runs with pass/fail, timing, and restore.' },
    ],
    diagram: `<svg viewBox="0 0 440 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="35" width="55" height="24" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="32" y="51" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="600">Start</text>
      <path d="M65 47 L90 47" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf6arr)"/>
      <rect x="95" y="30" width="70" height="30" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="130" y="49" text-anchor="middle" fill="#10b981" font-size="6" font-weight="600">POST /posts</text>
      <path d="M170 47 L195 47" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf6arr)"/>
      <rect x="200" y="30" width="70" height="30" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="235" y="49" text-anchor="middle" fill="#10b981" font-size="6" font-weight="600">GET /posts/id</text>
      <path d="M275 47 L300 47" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf6arr)"/>
      <polygon points="330,47 350,35 370,47 350,59" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="350" y="50" text-anchor="middle" fill="#f59e0b" font-size="5.5">title?</text>
      <path d="M370 42 L395 30" stroke="#10b981" stroke-width="1" marker-end="url(#wf6arr)"/>
      <rect x="398" y="18" width="40" height="22" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1"/>
      <text x="418" y="33" text-anchor="middle" fill="#10b981" font-size="5.5">Log ✓</text>
      <rect x="5" y="75" width="430" height="16" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
      <text x="15" y="86" fill="#94a3b8" font-size="5">Console: POST 201 · extracted postId=1 · GET 200 · title="Debug Demo" · Condition: Yes · Verified!</text>
      <defs><marker id="wf6arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
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
    await ctx.delay(400);
    await collapseWfDemoAppSidebar(ctx);
  },

  cleanup: async (ctx) => {
    // Close Variable Context modal if open
    const varModal = document.querySelector<HTMLElement>(WF.VAR_CONTEXT_MODAL);
    if (varModal) {
      const closeBtn = varModal.querySelector<HTMLElement>('.btn-primary');
      if (closeBtn) closeBtn.click();
    }
    // Stop debug session if still active
    const stopBtn = document.querySelector<HTMLElement>(WF.DEBUG_STOP_BTN);
    if (stopBtn) stopBtn.click();
    await ctx.delay(300);
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Quick Test — Full Run ────────────────────────────────
    {
      id: 'wf6-quick-test',
      title: 'Quick Test — Full Run',
      description:
        'Open the **Console** first so you can watch logs stream in live, then click ' +
        '**Quick Test** to run the entire workflow end-to-end.\n\n' +
        'Watch each node turn **green** as it passes: POST creates a post (extracts `postId`), ' +
        'GET fetches it, the Condition checks the title, and the Log node prints "Verified!".\n\n' +
        'The **Exec Summary** strip appears with total timing and pass/fail results. ' +
        'Node badges show individual response times.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        resetWorkflowRunState();
        await closeWfConsoleIfOpen(ctx);
      },

      action: async (ctx) => {
        // Open Console first so logs stream live during the run
        await openWfConsoleIfClosed(ctx);
        await ctx.delay(800);

        // Spotlight and run Quick Test
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1200);
        triggerWorkflowQuickTest();

        // Wait for execution to complete
        await ctx.delay(5000);

        // Spotlight the Exec Summary strip
        const summary = document.querySelector<HTMLElement>(WF.EXEC_SUMMARY);
        if (summary) await spotlight(summary, 1500, ctx);

        // Fit canvas and spotlight the node badges (green statuses)
        fitCanvasCentered();
        await ctx.delay(600);

        // Spotlight the POST node (should show green + timing badge)
        const postNode = document.querySelector<HTMLElement>('[data-id="http-post"]');
        if (postNode) {
          const flowNode = postNode.closest<HTMLElement>('.react-flow__node') ?? postNode;
          await spotlight(flowNode, 1200, ctx);
        }

        // Spotlight the GET node
        const getNode = document.querySelector<HTMLElement>('[data-id="http-get"]');
        if (getNode) {
          const flowNode = getNode.closest<HTMLElement>('.react-flow__node') ?? getNode;
          await spotlight(flowNode, 1000, ctx);
        }
      },

      verify: WF.EXEC_SUMMARY,
    },

    // ── Step 2: The Console Panel ────────────────────────────────────
    {
      id: 'wf6-console',
      title: 'The Console Panel',
      description:
        'The **Console** shows structured logs from the workflow run — timestamps, ' +
        'node names, HTTP status codes, and variable assignments.\n\n' +
        'Use the **search bar** to find specific entries. Type `postId` to filter ' +
        'logs to just the extraction where `postId = 1` was captured from the POST response.\n\n' +
        'Cmd+F also opens the search. Enter/Shift+Enter navigate between matches.',
      highlight: WF.CONSOLE,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        const hasRun = document.querySelector(WF.EXEC_SUMMARY)
          || document.querySelector(WF.RESET_RUN_BTN)
          || document.querySelector(WF.DEBUG_BAR);
        if (!hasRun) {
          await openWfConsoleIfClosed(ctx);
          await ctx.delay(400);
          triggerWorkflowQuickTest();
          await ctx.delay(5000);
        }
        await openWfConsoleIfClosed(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Console panel
        await spotlightSel(ctx, WF.CONSOLE, 1500);

        // Spotlight the search button, then open search
        const searchBtn = document.querySelector<HTMLElement>(WF.CONSOLE_SEARCH_BTN);
        if (searchBtn) {
          await spotlight(searchBtn, 800, ctx);
          searchBtn.click();
          await ctx.delay(600);
        }

        // Type "postId" — use ctx.fill for correct React controlled input sync
        const searchInput = document.querySelector<HTMLInputElement>(WF.CONSOLE_SEARCH_INPUT);
        if (searchInput) {
          await ctx.fill(WF.CONSOLE_SEARCH_INPUT, 'postId');
          await ctx.delay(800);

          // Spotlight the filtered match
          await spotlightSel(ctx, WF.CONSOLE_CURRENT_LINE, 1500);
        }

        // Clear the search
        await ctx.delay(800);
        if (searchInput) {
          await ctx.fill(WF.CONSOLE_SEARCH_INPUT, '');
          await ctx.delay(400);
        }
      },

      verify: WF.CONSOLE,
    },

    // ── Step 3: Step-Through Debug ──────────────────────────────────
    {
      id: 'wf6-debug-mode',
      title: 'Step-Through Debug',
      description:
        'Click the **Debug** button to enter step-through mode. The workflow pauses ' +
        'before each node, showing a **Step** button on the paused node.\n\n' +
        'The **Debug Bar** at the bottom provides:\n' +
        '- **Resume** — run all remaining nodes without pausing\n' +
        '- **Step All** — step all paused nodes simultaneously (for parallel branches)\n' +
        '- **Stop** — abort the debug session\n\n' +
        'Click the per-node **Step** button to advance one node at a time. Watch ' +
        'the Console fill with results as each node executes.',
      highlight: WF.DEBUG_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        // Reset any previous run so we start fresh
        resetWorkflowRunState();
        await ctx.delay(300);
        // Ensure Console is open for live log streaming
        await openWfConsoleIfClosed(ctx);
      },

      action: async (ctx) => {
        // Start debug mode
        await startWfDebugRun(ctx);
        await ctx.delay(800);

        // Spotlight the Debug Bar
        await spotlightSel(ctx, WF.DEBUG_BAR, 1500);

        // Wait for Start node to be paused, then step it
        try {
          await ctx.waitFor(WF.DEBUG_STEP_BTN, 10000);
        } catch { /* continue even if timeout */ }
        await ctx.delay(600);

        // Step: Start node
        const stepBtn1 = document.querySelector<HTMLElement>(WF.DEBUG_STEP_BTN);
        if (stepBtn1) {
          await spotlight(stepBtn1, 800, ctx);
          stepBtn1.click();
          await ctx.delay(1500);
        }

        // Wait for next pause (HTTP POST), then step
        try {
          await ctx.waitFor(WF.DEBUG_STEP_BTN, 10000);
        } catch { /* continue */ }
        await ctx.delay(600);

        const stepBtn2 = document.querySelector<HTMLElement>(WF.DEBUG_STEP_BTN);
        if (stepBtn2) {
          await spotlight(stepBtn2, 800, ctx);
          stepBtn2.click();
          await ctx.delay(2500);
        }

        // Spotlight the Console showing the POST response
        await spotlightSel(ctx, WF.CONSOLE, 1200);
      },

      verify: WF.DEBUG_BAR,
    },

    // ── Step 4: Inspect Variables Mid-Run ────────────────────────────
    {
      id: 'wf6-inspect-variable',
      title: 'Inspect Variables Mid-Run',
      description:
        'While paused in debug mode, the **Variable Context** badge on the canvas ' +
        'shows how many variables are in scope. Click it to open the **Context modal** ' +
        'with live values.\n\n' +
        'After the POST node ran, you should see `postId = 1` and `postTitle = Debug Demo` — ' +
        'values extracted from the response. `postId` is the same value the GET node uses ' +
        'in its URL `/posts/{{postId}}`.\n\n' +
        'Click **Step** to advance — watch the Condition evaluate and take the Yes path.',
      highlight: WF.VAR_CONTEXT_BADGE,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        // We need to be in debug mode, paused after at least the POST node.
        // If the debug bar isn't visible, start a fresh debug session and step
        // through Start + POST so postId is extracted.
        if (!document.querySelector(WF.DEBUG_BAR)) {
          resetWorkflowRunState();
          await ctx.delay(300);
          await openWfConsoleIfClosed(ctx);
          await startWfDebugRun(ctx);
          await ctx.delay(800);
          // Step through Start
          try { await ctx.waitFor(WF.DEBUG_STEP_BTN, 10000); } catch { /* */ }
          const s1 = document.querySelector<HTMLElement>(WF.DEBUG_STEP_BTN);
          if (s1) { s1.click(); await ctx.delay(1500); }
          // Step through POST (so postId gets extracted)
          try { await ctx.waitFor(WF.DEBUG_STEP_BTN, 10000); } catch { /* */ }
          const s2 = document.querySelector<HTMLElement>(WF.DEBUG_STEP_BTN);
          if (s2) { s2.click(); await ctx.delay(2500); }
        }
      },

      action: async (ctx) => {
        // Wait for the next pause (GET node)
        try { await ctx.waitFor(WF.DEBUG_STEP_BTN, 10000); } catch { /* */ }
        await ctx.delay(600);

        // Wait for the Variable Context badge to appear (variables populated after POST)
        try { await ctx.waitFor(WF.VAR_CONTEXT_BADGE, 5000); } catch { /* */ }
        const badge = document.querySelector<HTMLElement>(WF.VAR_CONTEXT_BADGE);
        if (badge) {
          await spotlight(badge, 1200, ctx);

          // Click to open the Context modal
          badge.click();
          await ctx.delay(800);

          // Spotlight the modal showing variable values
          await spotlightSel(ctx, WF.VAR_CONTEXT_MODAL, 1500);

          // Close the modal
          const closeBtn = document.querySelector<HTMLElement>(
            `${WF.VAR_CONTEXT_MODAL} .btn-primary`,
          );
          if (closeBtn) closeBtn.click();
          await ctx.delay(600);
        }

        // Step the GET node
        const stepBtn = document.querySelector<HTMLElement>(WF.DEBUG_STEP_BTN);
        if (stepBtn) {
          await spotlight(stepBtn, 800, ctx);
          stepBtn.click();
          await ctx.delay(2500);
        }

        // Wait for Condition pause, then step it
        try { await ctx.waitFor(WF.DEBUG_STEP_BTN, 10000); } catch { /* */ }
        await ctx.delay(400);
        const condStep = document.querySelector<HTMLElement>(WF.DEBUG_STEP_BTN);
        if (condStep) {
          condStep.click();
          await ctx.delay(1500);
        }

        // Spotlight the Condition node showing Yes path taken
        await spotlightSel(ctx, WF.NODE_CONDITION, 1200);
      },

      verify: WF.NODE_CONDITION,
    },

    // ── Step 5: Reset & Re-run ──────────────────────────────────────
    {
      id: 'wf6-reset-rerun',
      title: 'Reset & Re-run',
      description:
        'Click **Resume** in the Debug Bar to finish the remaining nodes — ' +
        'the Log node executes and everything turns green.\n\n' +
        'Then click **Reset** in the toolbar to clear all badges and start fresh. ' +
        'The **Run History** dropdown in the status bar keeps a record of your ' +
        'previous runs — click it to restore and compare past results.',
      highlight: WF.DEBUG_BAR,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        const hasRun = document.querySelector(WF.DEBUG_BAR)
          || document.querySelector(WF.EXEC_SUMMARY)
          || document.querySelector(WF.RESET_RUN_BTN);
        if (!hasRun) {
          await openWfConsoleIfClosed(ctx);
          triggerWorkflowQuickTest();
          await ctx.delay(5000);
        }
      },

      action: async (ctx) => {
        // If still in debug mode, click Resume to finish the run
        const resumeBtn = document.querySelector<HTMLElement>(WF.DEBUG_RESUME_BTN);
        if (resumeBtn) {
          await spotlight(resumeBtn, 800, ctx);
          resumeBtn.click();
          await ctx.delay(3000);
        }

        // Spotlight the green results
        fitCanvasCentered();
        await ctx.delay(600);
        const summary = document.querySelector<HTMLElement>(WF.EXEC_SUMMARY);
        if (summary) await spotlight(summary, 800, ctx);

        // Click Reset to clear all badges
        const resetBtn = document.querySelector<HTMLElement>(WF.RESET_RUN_BTN);
        if (resetBtn) {
          await spotlight(resetBtn, 800, ctx);
          resetBtn.click();
          await ctx.delay(800);
        }

        // Spotlight the clean canvas
        fitCanvasCentered();
        await ctx.delay(600);
        await spotlightSel(ctx, WF.CANVAS, 1000);

        // Spotlight the Run History dropdown
        const historyTrigger = document.querySelector<HTMLElement>(WF.RUN_HISTORY_TRIGGER);
        if (historyTrigger) {
          await spotlight(historyTrigger, 1500, ctx);
        }
      },

      verify: WF.CANVAS,
    },
  ],
};
