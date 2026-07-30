/**
 * TH-21 — The Workflow Runner
 *
 * 5 steps: workflow picker, variables & presets, trace/execution config,
 * CorrelationWait support, then run button & completion flow.
 *
 * This lesson includes a real runner click so viewers can see progress and
 * completion flow on-screen after configuration.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import { spotlight, spotlightSel } from './th-demo-helpers';
import { deleteWorkflowByName, seedNamedWorkflow, selectRunnerWorkflowByName, triggerRunnerWorkflowRun } from '../../adapters';
import { fillControlledInput } from '../setup-helpers';

// ─── Local helpers ─────────────────────────────────────────────────

function ensureOnWfRunnerTab(ctx: DemoActionContext): void {
  ctx.navigateToTab('workflow-runner');
}

const TH21_WORKFLOW_NAME = 'TH-21 Workflow Runner Demo';

const TH21_VAR_VALUES: Record<string, string> = {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  correlationId: 'th21-demo-001',
};

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
      await spotlight(row, 900, ctx);
      await ctx.delay(250);
    }
    fillControlledInput(input, value);
    await ctx.delay(opts?.quiet ? 120 : 750);
  }
}

/** Ensure a workflow is selected in the picker via dropdown click. */
async function ensureWorkflowSelected(ctx: DemoActionContext): Promise<void> {
  ensureOnWfRunnerTab(ctx);
  await ctx.delay(400);

  // Bridge-first selection keeps the runner on this lesson's deterministic seed.
  if (selectRunnerWorkflowByName(TH21_WORKFLOW_NAME)) {
    await ctx.delay(250);
  }

  const summary = document.querySelector(HAR.WF_PICKER_SUMMARY);
  if (!summary?.textContent?.includes(TH21_WORKFLOW_NAME)) {
    const trigger = document.querySelector<HTMLElement>(HAR.WF_PICKER_TRIGGER);
    if (trigger) {
      trigger.click();
      await ctx.delay(400);
      const item = findWorkflowPickerItemByName(TH21_WORKFLOW_NAME)
        ?? document.querySelector<HTMLElement>(HAR.WF_PICKER_ITEM);
      if (item) {
        item.click();
        await ctx.delay(500);
      } else {
        document.body.click();
        await ctx.delay(200);
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
  target.click();
  await ctx.delay(300);
}

async function clickRunAndWaitForCompletion(ctx: DemoActionContext): Promise<void> {
  const runBtn = document.querySelector<HTMLElement>(HAR.WF_RUN_BTN);
  if (!runBtn) return;

  if (!triggerRunnerWorkflowRun()) {
    runBtn.click();
  }
  await ctx.delay(500);

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
    'Run workflows as performance tests — select a workflow, configure ' +
    'variables, set trace level, manage variable presets, and learn ' +
    'about CorrelationWait support.',
  estimatedMinutes: 5,
  initialTab: 'workflow-runner',
  allowedTabs: ['workflow-runner'],

  concept: {
    title: 'Workflow Runner',
    body:
      'The **Workflow Runner** tab lets you execute Designer workflows as ' +
      'performance test runs.\n\n' +
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
      insertDelayMs: 0,
    });
    ctx.navigateToTab('workflow-runner');
    await ctx.delay(700);
    // Do not pre-select — step 1 demonstrates picking the workflow and filling variables live
  },

  // ── Cleanup ────────────────────────────────────────────────────
  cleanup: async () => {
    closeHistoryPanel();
    closePickerDropdown();
    deleteWorkflowByName(TH21_WORKFLOW_NAME);
  },

  steps: [
    // ── Step 1: Workflow Picker ──────────────────────────────────
    {
      id: 'th21-picker',
      title: 'Workflow Picker',
      description:
        'The **Workflow Picker** is a searchable dropdown at the top of the Workflow Runner.\n\n' +
        'It shows your workflow library organized by **folders** with drill-down navigation. ' +
        'When no workflow is selected, **gallery samples** (Simple, Branching, Parallel) offer ' +
        'quick-start options.\n\n' +
        'After selecting a workflow, a **summary** appears and **Initial Variables** show as ' +
        'empty rows — fill `baseUrl` and `correlationId` so `{{variable}}` placeholders resolve at runtime.',
      highlight: HAR.WF_PICKER,

      preAction: async (ctx) => {
        ensureOnWfRunnerTab(ctx);
        await ctx.delay(300);
        closePickerDropdown();
        closeHistoryPanel();
      },

      action: async (ctx) => {
        const trigger = document.querySelector<HTMLElement>(HAR.WF_PICKER_TRIGGER);
        if (trigger) {
          await spotlight(trigger, 1000, ctx);

          trigger.click();
          await ctx.delay(600);

          const panel = document.querySelector<HTMLElement>(HAR.WF_PICKER_PANEL);
          if (panel) {
            await spotlight(panel, 1200, ctx);

            const search = document.querySelector<HTMLElement>(HAR.WF_PICKER_SEARCH);
            if (search) await spotlight(search, 800, ctx);
          }

          const item = findWorkflowPickerItemByName(TH21_WORKFLOW_NAME)
            ?? document.querySelector<HTMLElement>(HAR.WF_PICKER_ITEM);
          if (item) {
            await spotlight(item, 900, ctx);
            item.click();
            await ctx.delay(700);
          }

          const summary = document.querySelector<HTMLElement>(HAR.WF_PICKER_SUMMARY);
          if (summary) await spotlight(summary, 1100, ctx);
        }

        // Lively configure Initial Variables (seeded empty on purpose)
        const varsSection = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
        if (varsSection) {
          varsSection.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
          await spotlight(varsSection, 1000, ctx);
          await fillTh21Variables(ctx);
          await ctx.delay(400);
        }
      },

      verify: HAR.WF_PICKER,
    },

    // ── Step 2: Initial Variables & Presets ──────────────────────
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
        ensureOnWfRunnerTab(ctx);
        await ctx.delay(300);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        const section = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
        if (section) {
          // Confirm the values filled in step 1, then focus Save / Presets
          const firstRow = section.querySelector<HTMLElement>(HAR.WF_VAR_ROW);
          if (firstRow) await spotlight(firstRow, 900, ctx);

          const actions = section.querySelector<HTMLElement>(HAR.WF_VARS_ACTIONS);
          if (actions) {
            await spotlight(actions, 1000, ctx);

            const saveBtn = Array.from(actions.querySelectorAll<HTMLElement>('.wfp-action-btn'))
              .find(b => b.textContent?.includes('Save'));
            if (saveBtn) await spotlight(saveBtn, 900, ctx);

            const presetsBtn = Array.from(actions.querySelectorAll<HTMLElement>('.wfp-action-btn'))
              .find(b => b.textContent?.includes('Presets'));
            if (presetsBtn) {
              await spotlight(presetsBtn, 800, ctx);
              presetsBtn.click();
              await ctx.delay(600);

              const histPanel = document.querySelector<HTMLElement>(HAR.WF_HISTORY_PANEL);
              if (histPanel) {
                await spotlight(histPanel, 1400, ctx);
                presetsBtn.click();
                await ctx.delay(400);
              }
            }
          }
        }
      },

      verify: HAR.WF_VARS_SECTION,
    },

    // ── Step 3: Trace Level & Execution Config ──────────────────
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
        ensureOnWfRunnerTab(ctx);
        await ctx.delay(300);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        const traceSection = document.querySelector<HTMLElement>(HAR.WF_TRACE_OPTIONS);
        if (traceSection) {
          await spotlight(traceSection, 1200, ctx);

          const radios = traceSection.querySelectorAll<HTMLElement>('.radio-label');
          if (radios.length > 0) {
            const lastRadio = radios[radios.length - 1];
            if (lastRadio) await spotlight(lastRadio, 800, ctx);
          }
        }

        const configSection = document.querySelector<HTMLElement>(HAR.WF_CONFIG_SECTION);
        if (configSection) {
          await spotlight(configSection, 1200, ctx);
        }
      },

      verify: HAR.WF_TRACE_OPTIONS,
    },

    // ── Step 4: CorrelationWait Support ─────────────────────────
    {
      id: 'th21-correlation',
      title: 'CorrelationWait Support',
      description:
        'When a workflow includes **CorrelationWait** nodes, a dedicated config panel appears ' +
        'with 3 runner modes:\n\n' +
        '- **Auto-Resume** \u2014 skips the wait for fast load testing\n' +
        '- **Synthetic Inject (Delayed)** \u2014 fires a mock payload after a configurable delay\n' +
        '- **Wait for Real Webhook** \u2014 pauses until an external callback arrives ' +
        '(enables the Multi-Webhook Testing Panel)\n\n' +
        'The **Multi-Webhook Testing Panel** (Wait-for-Real mode only) provides per-node ' +
        'state tracking, payload editors, fire buttons, and saved webhook scenarios \u2014 ' +
        'essential for testing async workflows with external integrations.',
      highlight: HAR.WF_CORR_SECTION,

      preAction: async (ctx) => {
        ensureOnWfRunnerTab(ctx);
        await ctx.delay(300);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        const corrSection = document.querySelector<HTMLElement>(HAR.WF_CORR_SECTION);
        if (corrSection) {
          await spotlight(corrSection, 1200, ctx);

          const modeCards = corrSection.querySelectorAll<HTMLElement>(HAR.WF_CORR_MODE);
          if (modeCards.length > 0) {
            await spotlight(modeCards[0], 900, ctx);
            await setCorrelationMode(ctx, 1);
            if (modeCards[1]) await spotlight(modeCards[1], 900, ctx);

            await setCorrelationMode(ctx, 2);
            if (modeCards[2]) await spotlight(modeCards[2], 900, ctx);

            const mwtPanel = document.querySelector<HTMLElement>(HAR.WF_MWT_PANEL);
            if (mwtPanel) {
              await spotlight(mwtPanel, 1200, ctx);
            }

            // Restore Auto-Resume so the next run step does not block.
            await setCorrelationMode(ctx, 0);
            if (modeCards[0]) await spotlight(modeCards[0], 800, ctx);
          }
        } else {
          await spotlightSel(ctx, HAR.WF_RUN_BTN, 1000);
          await ctx.delay(800);
        }
      },

      verify: HAR.WF_CORR_SECTION,
    },

    // ── Step 5: Run Button & Completion Flow ────────────────────
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
        ensureOnWfRunnerTab(ctx);
        await ctx.delay(300);
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
        await setCorrelationMode(ctx, 0);
      },

      action: async (ctx) => {
        const runBtn = document.querySelector<HTMLElement>(HAR.WF_RUN_BTN);
        if (runBtn) {
          await spotlight(runBtn, 1000, ctx);
        }

        await clickRunAndWaitForCompletion(ctx);

        const progress = document.querySelector<HTMLElement>(HAR.LIVE_PROGRESS);
        if (progress) {
          await spotlight(progress, 900, ctx);
        }

        const stopBtn = document.querySelector<HTMLElement>(HAR.WF_STOP_BTN);
        if (stopBtn) {
          await spotlight(stopBtn, 700, ctx);
        }

        const completion = document.querySelector<HTMLElement>(HAR.WF_COMPLETION);
        if (completion) {
          completion.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(300);
          await spotlight(completion, 1200, ctx);
        }
      },

      verify: HAR.WF_RUN_BTN,
    },
  ],
};
