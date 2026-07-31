/**
 * TH-21 — The Workflow Runner
 *
 * 6 steps: Designer canvas + Run in Harness, workflow picker, variables &
 * presets, trace/execution config, CorrelationWait support, then run button
 * & completion flow.
 *
 * This lesson includes a real runner click so viewers can see progress and
 * completion flow on-screen after configuration.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR, WF } from '@shared/selectors';
import { spotlight, spotlightSel } from './th-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  selectRunnerWorkflowByName,
  selectWorkflowByName,
  triggerRunnerWorkflowRun,
} from '../../adapters';
import { collapseWfDemoAppSidebar, expandWfDemoAppSidebar, selectWorkflowFromAppSidebar } from '../wf-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

// ─── Local helpers ─────────────────────────────────────────────────

function ensureOnWorkflowTab(ctx: DemoActionContext): void {
  ctx.navigateToTab('workflow');
}

async function ensureOnWfRunnerTab(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow-runner');
  // Keep the Environments left panel visible on the runner (Designer tours may collapse it)
  await expandWfDemoAppSidebar(ctx);
}

const TH21_WORKFLOW_NAME = 'Workflow Runner Demo';

const TH21_VAR_VALUES: Record<string, string> = {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  correlationId: 'demo-001',
};

const TH21_PAUSE = {
  settle: 800,
  short: 600,
  beat: 1000,
  focus: 1300,
  outcome: 1600,
} as const;

function createTh21WorkflowRunnerDemo(): Record<string, unknown> {
  const startId = crypto.randomUUID();
  const httpId = crypto.randomUUID();
  const corrId = crypto.randomUUID();
  const endId = crypto.randomUUID();
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    name: TH21_WORKFLOW_NAME,
    schemaVersion: 6,
    createdAt: now,
    updatedAt: now,
    // Empty defaults — step 1 fills these live so viewers see the typing
    variables: {
      baseUrl: '',
      correlationId: '',
    },
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 260, y: 40 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: httpId,
        type: 'http',
        position: { x: 260, y: 160 },
        data: {
          label: 'Create Post',
          scenario: {
            id: 'th21-http-scenario',
            name: 'Create Post',
            method: 'POST',
            url: '{{baseUrl}}/posts',
            headers: [],
            body: '{"title":"TH21 Demo","body":"workflow runner","userId":1}',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: corrId,
        type: 'correlationWait',
        position: { x: 260, y: 290 },
        data: {
          label: 'Wait for Callback',
          correlationIdExpression: '{{correlationId}}',
          webhookPath: '/th21/callback',
          correlationSource: 'body',
          correlationJsonPath: '$.id',
          extractVariables: [],
          timeoutMs: 5000,
        },
      },
      {
        id: endId,
        type: 'end',
        position: { x: 260, y: 420 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: startId, target: httpId },
      { id: crypto.randomUUID(), source: httpId, target: corrId },
      { id: crypto.randomUUID(), source: corrId, target: endId },
    ],
  };
}

function findWorkflowPickerItemByName(name: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(HAR.WF_PICKER_ITEM))
    .find((item) => item.textContent?.trim() === name)
    ?? Array.from(document.querySelectorAll<HTMLElement>(HAR.WF_PICKER_ITEM))
      .find((item) => item.textContent?.includes(name));
}

/** Close the variable presets (history) panel if it was left open. */
function closeHistoryPanel(): void {
  const panel = document.querySelector<HTMLElement>(HAR.WF_HISTORY_PANEL);
  if (panel) {
    const btn = document.querySelector<HTMLElement>(
      '.workflow-vars-actions .wfp-action-btn.active',
    );
    if (btn) btn.click();
  }
}

/** Close the workflow picker dropdown if open. */
function closePickerDropdown(): void {
  const panel = document.querySelector<HTMLElement>(HAR.WF_PICKER_PANEL);
  if (panel) document.body.click();
}

/** Fill Initial Variables rows (live spotlight + type, or quiet for preAction guards). */
async function fillTh21Variables(
  ctx: DemoActionContext,
  opts?: { quiet?: boolean },
): Promise<void> {
  const section = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
  if (!section) return;

  const rows = Array.from(section.querySelectorAll<HTMLElement>(HAR.WF_VAR_ROW));
  for (const row of rows) {
    const key = row.querySelector('code')?.textContent?.trim() ?? '';
    const input = row.querySelector<HTMLInputElement>('.wfp-var-input');
    const value = TH21_VAR_VALUES[key];
    if (!input || value === undefined) continue;
    if (input.value === value) continue;

    if (!opts?.quiet) {
      await spotlight(row, TH21_PAUSE.focus, ctx);
      await ctx.delay(TH21_PAUSE.short);
    }
    fillControlledInput(input, value);
    await ctx.delay(opts?.quiet ? 180 : TH21_PAUSE.beat);
  }
}

/** Ensure a workflow is selected in the picker via dropdown click. */
async function ensureWorkflowSelected(ctx: DemoActionContext): Promise<void> {
  await ensureOnWfRunnerTab(ctx);
  await ctx.delay(TH21_PAUSE.settle);

  // Bridge-first selection keeps the runner on this lesson's deterministic seed.
  if (selectRunnerWorkflowByName(TH21_WORKFLOW_NAME)) {
    await ctx.delay(TH21_PAUSE.short);
  }

  const summary = document.querySelector(HAR.WF_PICKER_SUMMARY);
  if (!summary?.textContent?.includes(TH21_WORKFLOW_NAME)) {
    const trigger = document.querySelector<HTMLElement>(HAR.WF_PICKER_TRIGGER);
    if (trigger) {
      trigger.click();
      await ctx.delay(TH21_PAUSE.settle);
      const item = findWorkflowPickerItemByName(TH21_WORKFLOW_NAME)
        ?? document.querySelector<HTMLElement>(HAR.WF_PICKER_ITEM);
      if (item) {
        item.click();
        await ctx.delay(TH21_PAUSE.beat);
      } else {
        document.body.click();
        await ctx.delay(TH21_PAUSE.short);
      }
    }
  }

  // Seeded defaults are empty — always ensure demo values are present for later steps.
  await fillTh21Variables(ctx, { quiet: true });
}

async function setCorrelationMode(ctx: DemoActionContext, index: number): Promise<void> {
  const section = document.querySelector<HTMLElement>(HAR.WF_CORR_SECTION);
  if (!section) return;
  const cards = section.querySelectorAll<HTMLElement>(HAR.WF_CORR_MODE);
  const target = cards[index];
  if (!target) return;
  const isAlreadySelected = !!target.querySelector<HTMLInputElement>('input[type="radio"]:checked');
  if (isAlreadySelected) return;
  target.click();
  await ctx.delay(TH21_PAUSE.beat);
}

async function clickRunAndWaitForCompletion(ctx: DemoActionContext): Promise<void> {
  const runBtn = document.querySelector<HTMLElement>(HAR.WF_RUN_BTN);
  if (!runBtn) return;

  if (!triggerRunnerWorkflowRun()) {
    runBtn.click();
  }
  await ctx.delay(TH21_PAUSE.beat);

  // Wait up to ~20s for completion banner while allowing live progress to render.
  for (let i = 0; i < 40; i += 1) {
    if (document.querySelector(HAR.WF_COMPLETION)) return;
    await ctx.delay(500);
  }
}

// ─── Lesson ────────────────────────────────────────────────────────

export const thWorkflowRunnerLesson: DemoLesson = {
  id: 'th-workflow-runner',
  domainId: 'harness',
  category: 'runner',
  name: 'The Workflow Runner',
  description:
    'See a workflow on the Designer canvas, promote it with Run in Harness, ' +
    'then configure variables, trace level, presets, and CorrelationWait support.',
  estimatedMinutes: 6,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],

  concept: {
    title: 'Workflow Runner',
    body:
      'The **Workflow Runner** tab lets you execute Designer workflows as ' +
      'performance test runs.\n\n' +
      '- **Designer → Run in Harness** — open a workflow on the canvas, then promote ' +
      'it into the runner with one toolbar click\n' +
      '- **Workflow Picker** — searchable dropdown with folder navigation and ' +
      'gallery samples\n' +
      '- **Initial Variables** — editable inputs for `{{variableName}}` placeholders ' +
      'used in HTTP node URLs, headers, and bodies\n' +
      '- **Variable Presets** — save and restore named variable configurations\n' +
      '- **Trace Level** — Minimal, Standard, Full, Debug with optional sampling\n' +
      '- **Execution Config** — iterations, concurrency, execution mode, think time, ' +
      'resilience settings\n' +
      '- **CorrelationWait** — three modes for handling webhook-paused workflows\n\n' +
      'After execution, the completion banner links to the Results Dashboard ' +
      'filtered to workflow runs.',
    keyTerms: [
      { term: 'Run in Harness', definition: 'Designer toolbar action that opens Workflow Runner with the current workflow pre-selected for load/performance runs.' },
      { term: 'Workflow Picker', definition: 'Searchable dropdown with folder drill-down for selecting which workflow to run.' },
      { term: 'Trace Level', definition: 'Controls data capture depth: Minimal (timing only) → Debug (everything). Sampling captures every Nth iteration.' },
      { term: 'Variable Presets', definition: 'Named snapshots of variable values — save, label, restore, and delete.' },
      { term: 'CorrelationWait', definition: 'A node that pauses execution until an external webhook callback arrives. Three runner modes: Auto-Resume, Synthetic Inject, Wait for Real.' },
    ],
    diagram: `<svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="42" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Picker</text>
      <text x="42" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Select workflow</text>
      <text x="42" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">+ Variables</text>
      <path d="M85 40 L110 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th21arr)"/>
      <rect x="115" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="152" y="28" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Config</text>
      <text x="152" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Trace · Iters</text>
      <text x="152" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Concurrency</text>
      <path d="M195 40 L220 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th21arr)"/>
      <rect x="225" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="262" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">▶ Run</text>
      <text x="262" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Progress bar</text>
      <text x="262" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Live metrics</text>
      <path d="M305 40 L330 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th21arr)"/>
      <rect x="335" y="10" width="60" height="60" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="365" y="28" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="700">Results</text>
      <text x="365" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Dashboard</text>
      <text x="365" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">+ Explorer</text>
      <defs><marker id="th21arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ──────────────────────────────────────────────────────
  setup: async (ctx) => {
    await seedNamedWorkflow(ctx, TH21_WORKFLOW_NAME, createTh21WorkflowRunnerDemo(), {
      deleteDelayMs: 0,
      insertPreDelayMs: 100,
      insertDelayMs: 200,
      // Select in Designer so step 1 can tour the canvas immediately
      selectAfterSeed: true,
    });
    ensureOnWorkflowTab(ctx);
    await ctx.delay(TH21_PAUSE.settle);
    selectWorkflowByName(TH21_WORKFLOW_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(TH21_PAUSE.short);
  },

  // ── Cleanup ────────────────────────────────────────────────────
  cleanup: async () => {
    closeHistoryPanel();
    closePickerDropdown();
    deleteWorkflowByName(TH21_WORKFLOW_NAME);
  },

  steps: [
    // ── Step 1: Designer canvas + promote to Workflow Runner ─────
    {
      id: 'th21-designer-promote',
      title: 'From Designer to Workflow Runner',
      description:
        'First, see how the workflow looks on the **Designer** canvas — ' +
        '**Start → Create Post (HTTP) → Wait for Callback (CorrelationWait) → End**.\n\n' +
        'Then promote it to the **Workflow Runner**: click **Run in Harness** in the ' +
        'Designer toolbar. That opens the runner with this workflow already selected — ' +
        'ready for variables, load config, and performance runs (saved to Results).',
      highlight: WF.NODE_START,

      preAction: async (ctx) => {
        ensureOnWorkflowTab(ctx);
        await ctx.delay(TH21_PAUSE.short);
        await selectWorkflowFromAppSidebar(ctx, TH21_WORKFLOW_NAME);
        await collapseWfDemoAppSidebar(ctx);
      },

      action: async (ctx) => {
        ensureOnWorkflowTab(ctx);
        await collapseWfDemoAppSidebar(ctx);
        await ctx.delay(TH21_PAUSE.short);

        // Promote: Run in Harness → Workflow Runner with this workflow selected
        const harnessBtn = document.querySelector<HTMLElement>(WF.RUN_IN_HARNESS_BTN);
        if (harnessBtn) {
          await spotlight(harnessBtn, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.short);
          harnessBtn.click();
          await ctx.delay(TH21_PAUSE.focus);
        }

        if (!document.querySelector(HAR.WF_PICKER)) {
          await ensureOnWfRunnerTab(ctx);
          await ctx.delay(TH21_PAUSE.settle);
          selectRunnerWorkflowByName(TH21_WORKFLOW_NAME);
          await ctx.delay(TH21_PAUSE.short);
        }

        // Designer tour collapsed the env sidebar for canvas space — restore it on the runner
        await expandWfDemoAppSidebar(ctx);

        const summary = document.querySelector<HTMLElement>(HAR.WF_PICKER_SUMMARY);
        if (summary) {
          await spotlight(summary, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.beat);
        } else {
          await spotlightSel(ctx, HAR.WF_PICKER, TH21_PAUSE.focus);
          await ctx.delay(TH21_PAUSE.beat);
        }
      },

      verify: HAR.WF_PICKER,
    },

    // ── Step 2: Workflow Picker ──────────────────────────────────
    {
      id: 'th21-picker',
      title: 'Workflow Picker',
      description:
        'You can also start from an empty runner — click **Select a workflow…** to open the searchable picker.\n\n' +
        'It shows your workflow library organized by **folders** with drill-down navigation. ' +
        'When no workflow is selected, **gallery samples** (Simple, Branching, Parallel) offer ' +
        'quick-start options.\n\n' +
        'After selecting a workflow, a **summary** appears and **Initial Variables** show as ' +
        'empty rows — fill `baseUrl` and `correlationId` so `{{variable}}` placeholders resolve at runtime.',
      highlight: HAR.WF_PICKER_TRIGGER,

      preAction: async (ctx) => {
        await ensureOnWfRunnerTab(ctx);
        await ctx.delay(TH21_PAUSE.short);
        closePickerDropdown();
        closeHistoryPanel();
        // Always start from the empty "Select a workflow…" screen
        const clearBtn = document.querySelector<HTMLElement>('.wfp-clear-btn');
        if (clearBtn) {
          clearBtn.click();
          await ctx.delay(TH21_PAUSE.short);
        }
      },

      action: async (ctx) => {
        const trigger = document.querySelector<HTMLElement>(HAR.WF_PICKER_TRIGGER);
        if (trigger) {
          // Keep this step simple: open picker, select workflow, then pause on summary.
          trigger.click();
          await ctx.delay(TH21_PAUSE.settle);

          const item = findWorkflowPickerItemByName(TH21_WORKFLOW_NAME)
            ?? document.querySelector<HTMLElement>(HAR.WF_PICKER_ITEM);
          if (item) {
            item.click();
            await ctx.delay(TH21_PAUSE.beat);
          }

          const summary = document.querySelector<HTMLElement>(HAR.WF_PICKER_SUMMARY);
          if (summary) {
            await spotlight(summary, TH21_PAUSE.outcome, ctx);
            await ctx.delay(TH21_PAUSE.beat);
          }
        }

        // Fill Initial Variables quietly so the page remains stable.
        const varsSection = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
        if (varsSection) {
          await spotlight(varsSection, TH21_PAUSE.focus, ctx);
          await fillTh21Variables(ctx, { quiet: true });
          await ctx.delay(TH21_PAUSE.outcome);
        }
      },

      verify: HAR.WF_PICKER,
    },

    // ── Step 3: Initial Variables & Presets ──────────────────────
    {
      id: 'th21-variables',
      title: 'Initial Variables & Presets',
      description:
        'With variables filled, use the **actions bar** to manage them: **Reset** reverts to ' +
        'workflow defaults, **Save** creates a named preset, and **Presets** browses, restores, ' +
        'renames, or deletes saved configurations with timestamps.\n\n' +
        'Presets are ideal when you switch between staging and production variable sets often.',
      highlight: HAR.WF_VARS_ACTIONS,

      preAction: async (ctx) => {
        await ensureOnWfRunnerTab(ctx);
        await ctx.delay(TH21_PAUSE.short);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        const section = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
        if (section) {
          // Keep this step static: show actions bar only (no panel toggling).
          const actions = section.querySelector<HTMLElement>(HAR.WF_VARS_ACTIONS);
          if (actions) {
            await spotlight(actions, TH21_PAUSE.focus, ctx);
            await ctx.delay(TH21_PAUSE.outcome);
          }
        }
      },

      verify: HAR.WF_VARS_SECTION,
    },

    // ── Step 4: Trace Level & Execution Config ──────────────────
    {
      id: 'th21-trace-config',
      title: 'Trace Level & Execution Config',
      description:
        'The **Trace Level** controls how much data is captured per workflow node:\n\n' +
        '- **Minimal** \u2014 timing and pass/fail only (fastest for load tests)\n' +
        '- **Standard** \u2014 timing + basic request/response metadata\n' +
        '- **Full** \u2014 complete request, response, and variables per node\n' +
        '- **Debug** \u2014 everything including internal engine state\n\n' +
        'On Full/Debug, enable **Sampling** to capture every Nth iteration and reduce overhead.\n\n' +
        'The **execution config** section covers iterations, concurrency, execution mode, ' +
        'think time, and resilience settings \u2014 shared with the standard Test Runner.',
      highlight: HAR.WF_TRACE_OPTIONS,

      preAction: async (ctx) => {
        await ensureOnWfRunnerTab(ctx);
        await ctx.delay(TH21_PAUSE.short);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        // Keep this step visually stable: no extra spotlight hops.
        // The step's highlight selector already points to the Trace section.
        await ctx.delay(TH21_PAUSE.outcome);
      },

      verify: HAR.WF_TRACE_OPTIONS,
    },

    // ── Step 5: CorrelationWait Support ─────────────────────────
    {
      id: 'th21-correlation',
      title: 'CorrelationWait Support',
      description:
        'When a workflow includes **CorrelationWait** nodes, a dedicated config panel appears ' +
        'with 3 runner modes:\n\n' +
        '- **Auto-Resume** \u2014 skips the wait for fast load testing (selected here)\n' +
        '- **Synthetic Inject (Delayed)** \u2014 fires a mock payload after a configurable delay\n' +
        '- **Wait for Real Webhook** \u2014 pauses until an external callback arrives ' +
        '(enables the Multi-Webhook Testing Panel)\n\n' +
        'Leave **Auto-Resume** on for performance runs so waits never block the load test.',
      highlight: HAR.WF_CORR_SECTION,

      preAction: async (ctx) => {
        await ensureOnWfRunnerTab(ctx);
        await ctx.delay(TH21_PAUSE.short);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        // Keep this step visually stable: ensure mode quietly, then pause on section.
        await setCorrelationMode(ctx, 0);
        const corrSection = document.querySelector<HTMLElement>(HAR.WF_CORR_SECTION);
        if (corrSection) {
          await spotlight(corrSection, TH21_PAUSE.focus, ctx);
        }
        await ctx.delay(TH21_PAUSE.outcome);
      },

      verify: HAR.WF_CORR_SECTION,
    },

    // ── Step 6: Run Button & Completion Flow ────────────────────
    {
      id: 'th21-run-button',
      title: 'Run & Completion Flow',
      description:
        'The **\u25b6 Run Workflow** button executes the selected workflow with the ' +
        'configured variables, trace level, and execution settings.\n\n' +
        'During execution, the **live progress panel** shows iteration count, timing ' +
        'metrics (avg response time, TPS), and error rate in real time. The button ' +
        'changes to **\u25a0 Stop** for mid-run abort.\n\n' +
        'After completion, a **banner** summarizes request count and duration, with a ' +
        '**View Full Results \u2192** link that navigates to the Results Dashboard filtered ' +
        'to workflow runs.',
      highlight: HAR.WF_RUN_BTN,

      preAction: async (ctx) => {
        await ensureOnWfRunnerTab(ctx);
        await ctx.delay(TH21_PAUSE.short);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
        await setCorrelationMode(ctx, 0);
      },

      action: async (ctx) => {
        const runBtn = document.querySelector<HTMLElement>(HAR.WF_RUN_BTN);
        if (runBtn) {
          await spotlight(runBtn, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.short);
        }

        await clickRunAndWaitForCompletion(ctx);

        const completion = document.querySelector<HTMLElement>(HAR.WF_COMPLETION);
        if (completion) {
          completion.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
          await ctx.delay(TH21_PAUSE.short);
          await spotlight(completion, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.outcome);
        }
      },

      verify: HAR.WF_RUN_BTN,
    },
  ],
};
