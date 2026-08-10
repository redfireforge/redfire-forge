/**
 * TH-21 — The Workflow Runner
 *
 * 7 paced steps for human viewers:
 * 1) Designer node tour (stay on canvas)
 * 2) Run in Harness → land on Workflow Runner
 * 3) Workflow picker (select only — leave variables empty)
 * 4) Fill Initial Variables live → Save preset → browse Presets
 * 5) Trace Level clicks + execution config glance
 * 6) CorrelationWait mode tour → leave Auto-Resume
 * 7) Run Workflow → completion banner
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR, WF } from '@shared/selectors';
import { spotlight, spotlightSel } from './th-demo-helpers';
import {
  clearWorkflowSamplePreview,
  collapseAppSidebar,
  deleteWorkflowByName,
  expandAppSidebar,
  fitWorkflowCanvasView,
  getSelectedWorkflowName,
  seedNamedWorkflow,
  selectRunnerWorkflowByName,
  selectWorkflowByName,
  triggerRunnerWorkflowRun,
  waitForWorkflowBridge,
} from '../../adapters';
import { closeWfSamplePreviewIfOpen, collapseWfDemoAppSidebar } from '../wf-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

// ─── Local helpers ─────────────────────────────────────────────────

const TH21_WORKFLOW_NAME = 'Workflow Runner Demo';

const TH21_VAR_VALUES: Record<string, string> = {
  baseUrl: 'https://jsonplaceholder.typicode.com',
  correlationId: 'demo-001',
};

/** Visible action pacing (Acting phase — viewers watch these). */
const TH21_PAUSE = {
  settle: 900,
  short: 700,
  beat: 1100,
  focus: 1400,
  outcome: 1800,
  nodeTour: 1600,
  modeTour: 1500,
} as const;

/** Quiet Preparing / preAction pacing — keep the hourglass short. */
const TH21_QUIET = {
  tick: 40,
  settle: 80,
  select: 120,
  fill: 50,
} as const;

function ensureOnWorkflowTab(ctx: DemoActionContext): void {
  ctx.navigateToTab('workflow');
}

/** True when the app left sidebar is already open (Environments / Workflows list). */
function isAppSidebarExpanded(): boolean {
  const toggle = document.querySelector('.usb-toggle-btn');
  if (!toggle) return false;
  return !toggle.classList.contains('collapsed');
}

/**
 * Land on Workflow Runner. Expand Environments sidebar only when collapsed.
 *
 * Do NOT use expandWfDemoAppSidebar here — that waits up to 3s for Workflows
 * `+ New`, which never mounts on the Harness Environments panel and makes
 * every Preparing phase feel stuck.
 */
async function ensureOnWfRunnerTab(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow-runner');
  if (!isAppSidebarExpanded()) {
    expandAppSidebar();
    await ctx.delay(TH21_QUIET.select);
  }
}

const TH21_PRESET_NAME = 'Demo Staging';

/** Find Reset / Save / Presets in the Initial Variables actions bar. */
function findVarsActionBtn(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(HAR.WF_VARS_ACTION_BTN))
    .find((btn) => (btn.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase()));
}

/** Click a Trace Level radio by visible label (Minimal / Standard / Full / Debug). */
async function selectTraceLevel(ctx: DemoActionContext, level: string): Promise<void> {
  const want = level.toLowerCase();
  const labels = Array.from(
    document.querySelectorAll<HTMLElement>(`${HAR.WF_TRACE_OPTIONS} label.radio-label`),
  );
  const label = labels.find((el) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    return text === want || text.startsWith(want);
  });
  if (!label) return;
  const radio = label.querySelector<HTMLInputElement>('input[type="radio"]');
  if (radio?.checked) {
    await spotlight(label, TH21_PAUSE.short, ctx);
    return;
  }
  await spotlight(label, TH21_PAUSE.focus, ctx);
  label.click();
  await ctx.delay(TH21_PAUSE.beat);
}

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
    // Designer defaults — Runner step still shows Initial Variables (editable)
    // and demos Save preset. Empty values broke Send Test Webhook / Designer Variables.
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      correlationId: 'demo-001',
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
          // Long enough to Close → Quick Test → re-open → Send Test Webhook
          timeoutMs: 120_000,
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
    await ctx.delay(opts?.quiet ? TH21_QUIET.fill : TH21_PAUSE.beat);
  }
}

/**
 * True when the runner picker already shows this lesson's workflow.
 * Must check the trigger label — `.workflow-picker-summary` is only
 * "N HTTP step(s): …" and never includes the workflow name (that bug made
 * every Preparing re-select + open the dropdown).
 */
function isRunnerWorkflowSelected(): boolean {
  const trigger = document.querySelector(HAR.WF_PICKER_TRIGGER);
  return !!trigger?.textContent?.includes(TH21_WORKFLOW_NAME);
}

/**
 * Quiet Preparing guard — select workflow + optional var fill with short delays.
 * @param fillVars — quiet-fill Initial Variables (default true for later-step guards).
 *   Step 3 sets false so viewers still see typing.
 */
async function ensureWorkflowSelected(
  ctx: DemoActionContext,
  opts?: { fillVars?: boolean },
): Promise<void> {
  await ensureOnWfRunnerTab(ctx);

  if (!isRunnerWorkflowSelected()) {
    // Bridge-first selection — no viewer pacing during Preparing.
    if (selectRunnerWorkflowByName(TH21_WORKFLOW_NAME)) {
      await ctx.delay(TH21_QUIET.select);
    }
  }

  if (!isRunnerWorkflowSelected()) {
    const trigger = document.querySelector<HTMLElement>(HAR.WF_PICKER_TRIGGER);
    if (trigger) {
      trigger.click();
      await ctx.delay(TH21_QUIET.settle);
      const item = findWorkflowPickerItemByName(TH21_WORKFLOW_NAME)
        ?? document.querySelector<HTMLElement>(HAR.WF_PICKER_ITEM);
      if (item) {
        item.click();
        await ctx.delay(TH21_QUIET.select);
      } else {
        document.body.click();
        await ctx.delay(TH21_QUIET.tick);
      }
    }
  }

  if (opts?.fillVars !== false) {
    await fillTh21Variables(ctx, { quiet: true });
  }
}

async function setCorrelationMode(
  ctx: DemoActionContext,
  index: number,
  opts?: { visible?: boolean },
): Promise<void> {
  const section = document.querySelector<HTMLElement>(HAR.WF_CORR_SECTION);
  if (!section) return;
  const cards = Array.from(section.querySelectorAll<HTMLElement>(HAR.WF_CORR_MODE));
  const target = cards[index];
  if (!target) return;
  const isAlreadySelected = !!target.querySelector<HTMLInputElement>('input[type="radio"]:checked');
  if (opts?.visible) {
    await spotlight(target, TH21_PAUSE.modeTour, ctx);
    if (!isAlreadySelected) {
      target.click();
      await ctx.delay(TH21_PAUSE.beat);
    }
    return;
  }
  if (isAlreadySelected) return;
  target.click();
  await ctx.delay(TH21_QUIET.select);
}

/** Save → name preset → confirm; close Presets panel afterward. */
async function demoSaveVariablePreset(ctx: DemoActionContext): Promise<void> {
  const saveBtn = findVarsActionBtn('save');
  if (!saveBtn) return;
  await spotlight(saveBtn, TH21_PAUSE.focus, ctx);
  saveBtn.click();
  await ctx.waitFor(HAR.WF_HISTORY_SAVE_INPUT, 2500);
  await ctx.delay(TH21_PAUSE.short);

  const input = document.querySelector<HTMLInputElement>(HAR.WF_HISTORY_SAVE_INPUT);
  if (input) {
    await spotlight(input, TH21_PAUSE.short, ctx);
    fillControlledInput(input, TH21_PRESET_NAME);
    await ctx.delay(TH21_PAUSE.beat);
  }

  const form = document.querySelector<HTMLElement>(HAR.WF_HISTORY_SAVE_FORM);
  const confirm = form
    ? Array.from(form.querySelectorAll<HTMLElement>('button'))
      .find((b) => (b.textContent ?? '').trim() === 'Save')
    : undefined;
  if (confirm) {
    await spotlight(confirm, TH21_PAUSE.short, ctx);
    confirm.click();
    await ctx.delay(TH21_PAUSE.outcome);
  }

  const item = document.querySelector<HTMLElement>(HAR.WF_HISTORY_ITEM);
  if (item) {
    await spotlight(item, TH21_PAUSE.outcome, ctx);
    await ctx.delay(TH21_PAUSE.beat);
  }

  // Close Presets so the next step’s spotlight is not buried under the panel.
  const presetsBtn = findVarsActionBtn('presets');
  if (presetsBtn && document.querySelector(HAR.WF_HISTORY_PANEL)) {
    presetsBtn.click();
    await ctx.delay(TH21_PAUSE.short);
  }
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
  estimatedMinutes: 9,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],
  // Avoid hub expand→collapse during Preparing (that reflows Fit View left↔right).
  collapseAppSidebarOnStart: true,

  // Seed + select BEFORE Workflow mounts so Start Demo never paints a stale
  // Gallery Sample Preview or empty-template flash, then hops to this graph.
  prepareBeforeNavigate: async (ctx) => {
    clearWorkflowSamplePreview();
    await waitForWorkflowBridge(ctx);
    await seedNamedWorkflow(ctx, TH21_WORKFLOW_NAME, createTh21WorkflowRunnerDemo(), {
      deleteDelayMs: 0,
      insertPreDelayMs: 40,
      insertDelayMs: 120,
      selectAfterSeed: true,
    });
    clearWorkflowSamplePreview();
    await ctx.delay(40);
  },

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
    // Tab already shows Workflow Runner Demo from prepareBeforeNavigate — do not
    // delete/reseed here (that flashes another canvas under Preparing).
    await closeWfSamplePreviewIfOpen(ctx);
    await waitForWorkflowBridge(ctx);
    // Collapse BEFORE any fit — expand→collapse during boot otherwise reflows
    // the canvas and slides nodes left↔right several times.
    await collapseWfDemoAppSidebar(ctx);
    if (getSelectedWorkflowName() !== TH21_WORKFLOW_NAME) {
      selectWorkflowByName(TH21_WORKFLOW_NAME);
      await ctx.delay(80);
    }
    // One silent fit after final canvas width is settled (viewport still veiled).
    fitWorkflowCanvasView({ duration: 0, maxZoom: 1, minZoom: 0.4, padding: 0.15 });
    await ctx.delay(120);
  },

  // ── Cleanup ────────────────────────────────────────────────────
  cleanup: async () => {
    closeHistoryPanel();
    closePickerDropdown();
    deleteWorkflowByName(TH21_WORKFLOW_NAME);
  },

  steps: [
    // ── Step 1: Designer canvas tour (stay on Designer) ──────────
    {
      id: 'th21-designer-tour',
      title: 'The Designer Canvas',
      description:
        'Walk the **Designer** canvas node by node — ' +
        '**Start → Create Post (HTTP) → Wait for Callback (CorrelationWait) → End**.\n\n' +
        'This is the workflow we will promote into the **Workflow Runner** next.',
      highlight: WF.NODE_START,

      preAction: async (ctx) => {
        // Quiet only — never expand the Workflows sidebar here (visible flash).
        ensureOnWorkflowTab(ctx);
        collapseAppSidebar();
        if (getSelectedWorkflowName() !== TH21_WORKFLOW_NAME) {
          selectWorkflowByName(TH21_WORKFLOW_NAME);
          await ctx.delay(TH21_QUIET.select);
        }
        if (document.body.getAttribute('data-demo-bootstrapping') === '1') {
          fitWorkflowCanvasView({ duration: 0, maxZoom: 1, minZoom: 0.4, padding: 0.15 });
        }
      },

      action: async (ctx) => {
        ensureOnWorkflowTab(ctx);
        await collapseWfDemoAppSidebar(ctx);
        await ctx.delay(TH21_PAUSE.short);

        // Node tour — one spotlight per node so viewers can follow the graph.
        for (const sel of [WF.NODE_START, WF.NODE_HTTP, WF.NODE_CORRELATION_WAIT, WF.NODE_END]) {
          await spotlightSel(ctx, sel, TH21_PAUSE.nodeTour);
          await ctx.delay(TH21_PAUSE.short);
        }

        // Pause on End so the graph finish is the last beat (Run in Harness is step 2).
        await spotlightSel(ctx, WF.NODE_END, TH21_PAUSE.outcome);
      },

      verify: WF.NODE_END,
    },

    // ── Step 2: Run in Harness → Workflow Runner ─────────────────
    {
      id: 'th21-run-in-harness',
      title: 'Run in Harness',
      description:
        'Promote this workflow with **Run in Harness** in the Designer toolbar.\n\n' +
        'That opens the **Workflow Runner** with this workflow already selected — ready for ' +
        'variables, load config, and performance runs (saved to Results).',
      highlight: WF.RUN_IN_HARNESS_BTN,

      preAction: async (ctx) => {
        // Stay on Designer — this step’s action is the toolbar promote click.
        ensureOnWorkflowTab(ctx);
        collapseAppSidebar();
        if (getSelectedWorkflowName() !== TH21_WORKFLOW_NAME) {
          selectWorkflowByName(TH21_WORKFLOW_NAME);
          await ctx.delay(TH21_QUIET.select);
        }
      },

      action: async (ctx) => {
        ensureOnWorkflowTab(ctx);
        await collapseWfDemoAppSidebar(ctx);
        await ctx.delay(TH21_PAUSE.short);

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

    // ── Step 3: Workflow Picker (select only — variables next) ───
    {
      id: 'th21-picker',
      title: 'Workflow Picker',
      description:
        'You can also start from an empty runner — click **Select a workflow…** to open the searchable picker.\n\n' +
        'It shows your workflow library organized by **folders** with drill-down navigation. ' +
        'When no workflow is selected, **gallery samples** (Simple, Branching, Parallel) offer ' +
        'quick-start options.\n\n' +
        'After selecting, a **summary** appears and **Initial Variables** list `baseUrl` / ' +
        '`correlationId` from the Designer defaults — next we manage presets.',
      highlight: HAR.WF_PICKER_TRIGGER,

      preAction: async (ctx) => {
        await ensureOnWfRunnerTab(ctx);
        closePickerDropdown();
        closeHistoryPanel();
        // Always start from the empty "Select a workflow…" screen
        const clearBtn = document.querySelector<HTMLElement>('.wfp-clear-btn');
        if (clearBtn) {
          clearBtn.click();
          await ctx.delay(TH21_QUIET.select);
        }
      },

      action: async (ctx) => {
        const trigger = document.querySelector<HTMLElement>(HAR.WF_PICKER_TRIGGER);
        if (!trigger) return;

        await spotlight(trigger, TH21_PAUSE.focus, ctx);
        trigger.click();
        await ctx.waitFor(HAR.WF_PICKER_PANEL, 2500);
        await ctx.delay(TH21_PAUSE.settle);

        const item = findWorkflowPickerItemByName(TH21_WORKFLOW_NAME)
          ?? document.querySelector<HTMLElement>(HAR.WF_PICKER_ITEM);
        if (item) {
          await spotlight(item, TH21_PAUSE.focus, ctx);
          item.click();
          await ctx.delay(TH21_PAUSE.beat);
        }

        const summary = document.querySelector<HTMLElement>(HAR.WF_PICKER_SUMMARY);
        if (summary) {
          await spotlight(summary, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.beat);
        }

        // Tease empty Initial Variables — filling happens in the next step.
        const varsSection = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
        if (varsSection) {
          await spotlight(varsSection, TH21_PAUSE.focus, ctx);
          await ctx.delay(TH21_PAUSE.outcome);
        }
      },

      verify: HAR.WF_PICKER,
    },

    // ── Step 4: Fill variables + Save preset ─────────────────────
    {
      id: 'th21-variables',
      title: 'Initial Variables & Presets',
      description:
        '**Initial Variables** come from the Designer defaults (`baseUrl`, `correlationId`) and ' +
        'resolve `{{name}}` placeholders at runtime.\n\n' +
        'Use the actions bar: **Save** creates a named preset, and **Presets** browses saved ' +
        'configurations (restore, rename, delete). **Reset** reverts to workflow defaults.\n\n' +
        'Presets are ideal when you switch between staging and production variable sets often.',
      highlight: HAR.WF_VARS_SECTION,

      preAction: async (ctx) => {
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx, { fillVars: true });
      },

      action: async (ctx) => {
        // Ensure values are present (Designer seed) then spotlight the rows.
        await fillTh21Variables(ctx);
        const section = document.querySelector<HTMLElement>(HAR.WF_VARS_SECTION);
        if (section) {
          await spotlight(section, TH21_PAUSE.focus, ctx);
          await ctx.delay(TH21_PAUSE.short);
        }

        const actions = document.querySelector<HTMLElement>(HAR.WF_VARS_ACTIONS);
        if (actions) {
          await spotlight(actions, TH21_PAUSE.focus, ctx);
          await ctx.delay(TH21_PAUSE.short);
        }

        const resetBtn = findVarsActionBtn('reset');
        if (resetBtn) {
          await spotlight(resetBtn, TH21_PAUSE.beat, ctx);
          await ctx.delay(TH21_PAUSE.short);
        }

        await demoSaveVariablePreset(ctx);
      },

      verify: HAR.WF_VARS_SECTION,
    },

    // ── Step 5: Trace Level & Execution Config ──────────────────
    {
      id: 'th21-trace-config',
      title: 'Trace Level & Execution Config',
      description:
        'Watch the **Trace Level** radios change capture depth:\n\n' +
        '- **Minimal** \u2014 timing and pass/fail only (fastest for load tests)\n' +
        '- **Standard** \u2014 timing + basic request/response metadata\n' +
        '- **Full** \u2014 complete request, response, and variables (shows **Sampling**)\n' +
        '- **Debug** \u2014 everything including internal engine state\n\n' +
        'Below that, **Run configuration** covers iterations, concurrency, execution mode, ' +
        'think time, and resilience — shared with the standard Test Runner. We leave ' +
        '**Standard** for the demo run.',
      highlight: HAR.WF_TRACE_OPTIONS,

      preAction: async (ctx) => {
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        const trace = document.querySelector<HTMLElement>(HAR.WF_TRACE_OPTIONS);
        if (trace) {
          trace.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
          await ctx.delay(TH21_PAUSE.short);
        }

        await selectTraceLevel(ctx, 'Minimal');
        await selectTraceLevel(ctx, 'Full');
        // Full reveals Sampling — pause so viewers can read it.
        const sampling = document.querySelector<HTMLElement>('.wf-inline-trace-extras');
        if (sampling) {
          await spotlight(sampling, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.beat);
        }
        await selectTraceLevel(ctx, 'Standard');

        const exec = document.querySelector<HTMLElement>(HAR.WF_CONFIG_SECTION);
        if (exec) {
          exec.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'nearest' });
          await spotlight(exec, TH21_PAUSE.outcome, ctx);
          await ctx.delay(TH21_PAUSE.beat);
        }
      },

      verify: HAR.WF_TRACE_OPTIONS,
    },

    // ── Step 6: CorrelationWait Support ─────────────────────────
    {
      id: 'th21-correlation',
      title: 'CorrelationWait Support',
      description:
        'Because this workflow includes a **CorrelationWait** node, a dedicated panel offers ' +
        'three runner modes — watch each one:\n\n' +
        '- **Auto-Resume** \u2014 skips the wait for fast load testing\n' +
        '- **Synthetic Inject (Delayed)** \u2014 fires a mock payload after a delay\n' +
        '- **Wait for Real Webhook** \u2014 pauses until an external callback arrives\n\n' +
        'We finish on **Auto-Resume** so the next run is not blocked waiting for a webhook.',
      highlight: HAR.WF_CORR_SECTION,

      preAction: async (ctx) => {
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
      },

      action: async (ctx) => {
        const corrSection = document.querySelector<HTMLElement>(HAR.WF_CORR_SECTION);
        if (corrSection) {
          corrSection.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
          await ctx.delay(TH21_PAUSE.short);
        }

        // Tour all three modes; end on Auto-Resume (index 0) for the run step.
        await setCorrelationMode(ctx, 0, { visible: true });
        await setCorrelationMode(ctx, 1, { visible: true });
        await setCorrelationMode(ctx, 2, { visible: true });
        await ctx.delay(TH21_PAUSE.beat);
        await setCorrelationMode(ctx, 0, { visible: true });
        await ctx.delay(TH21_PAUSE.outcome);
      },

      verify: HAR.WF_CORR_SECTION,
    },

    // ── Step 7: Run Button & Completion Flow ────────────────────
    {
      id: 'th21-run-button',
      title: 'Run & Completion Flow',
      description:
        'Click **\u25b6 Run Workflow** to execute with the configured variables, trace level, ' +
        'and Auto-Resume CorrelationWait mode.\n\n' +
        'Watch the **live progress panel** for iteration count, timing metrics, and errors. ' +
        'The button becomes **\u25a0 Stop** if you need to abort.\n\n' +
        'When finished, the **completion banner** summarizes the run with a ' +
        '**View Full Results \u2192** link into the Results Dashboard.',
      highlight: HAR.WF_RUN_BTN,

      preAction: async (ctx) => {
        closePickerDropdown();
        closeHistoryPanel();
        await ensureWorkflowSelected(ctx);
        await setCorrelationMode(ctx, 0);
      },

      action: async (ctx) => {
        const runBtn = document.querySelector<HTMLElement>(HAR.WF_RUN_BTN);
        if (runBtn) {
          runBtn.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
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
        } else {
          // Run may still be in progress — pause on the stop/run control so viewers see activity.
          await spotlightSel(ctx, HAR.WF_STOP_BTN, TH21_PAUSE.outcome);
          await ctx.delay(TH21_PAUSE.beat);
        }
      },

      verify: HAR.WF_RUN_BTN,
    },
  ],
};
