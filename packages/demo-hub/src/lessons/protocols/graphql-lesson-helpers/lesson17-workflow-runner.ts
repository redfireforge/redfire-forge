// ── Lesson 17: Workflow Runner & Results ─────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { WFR } from '@shared/selectors/wfr';
import { REX } from '@shared/selectors/rex';
import { GQL_DEMO_HEALTH, GQL_DEMO_HTTP, GQL_DEMO_VAR } from './core';
import { seedNamedWorkflow, applyRunnerBatchConfig, fitResultsExplorerDiagram, selectAndRunRunnerWorkflow, selectRunnerWorkflowByName, waitForRunnerBridge, waitForResultsExplorerBridge } from '../../../adapters';
import { fillControlledInput } from '../../setup-helpers';
import { showClickRipple } from '../../../demoRipple';

/** Workflow name shared with GQL-16 — Runner builds on the Designer lesson. */
export const LESSON17_WF_NAME = 'GraphQL Latency Demo';

/** Workflow variable for GraphQL HTTP endpoint — overridable in Workflow Runner Initial Variables. */
export const LESSON17_GRAPHQL_URL_VAR = 'graphqlUrl';

/** Docker endpoint for prerequisite check (same server as GQL-16). */
export const LESSON17_DOCKER_ENDPOINT = GQL_DEMO_HEALTH;

/** Demo-friendly load — enough rows for metrics without a long wait. */
export const LESSON17_DEMO_ITERATIONS = 3;
export const LESSON17_DEMO_CONCURRENCY = 1;

/** Run button — scoped test id avoids ambiguous .config-form .btn-primary matches. */
export const LESSON17_RUN_BTN = WFR.RUN_BTN;

/** Stop button — visible while a run is in progress. */
export const LESSON17_STOP_BTN = WFR.STOP_BTN;

/** Selector for the workflow picker dropdown trigger. */
export const LESSON17_WORKFLOW_SELECT = '[data-testid="workflow-select"]';

/** Selector for the dropdown item list. */
export const LESSON17_DROPDOWN_ITEM = '.wfp-dropdown-item';

/** Results Explorer diagram panel (canvas with pass/fail overlay). */
export const LESSON17_RESULTS_EXPLORER_DIAGRAM = REX.DIAGRAM;

/** Fit view control in the Results Explorer canvas toolbar. */
export const LESSON17_RESULTS_EXPLORER_FIT_VIEW = REX.FIT_VIEW_BTN;

/** Results Explorer open button in the dashboard header. */
export const LESSON17_RESULTS_EXPLORER_BTN = 'button[title="Explore execution results"]';

/** Request Details sub-tab on the Results Dashboard. */
export const LESSON17_REQUEST_DETAILS_TAB = '[data-testid="results-tab-requests"]';

// ── Session flags ─────────────────────────────────────────────────────────────

let _lesson17WorkflowSelected = false;
let _lesson17ConfigSet = false;
let _lesson17WorkflowRun = false;
let _lesson17ResultsOpen = false;

export function resetGqlLesson17SessionFlags(): void {
  _lesson17WorkflowSelected = false;
  _lesson17ConfigSet = false;
  _lesson17WorkflowRun = false;
  _lesson17ResultsOpen = false;
}

// ── Workflow factory ──────────────────────────────────────────────────────────

/**
 * Creates a minimal "GraphQL Latency Demo" workflow:
 * Start → GraphQL Query (health check, latencyMs bound) → GraphQL Assert (< 2000ms) → End.
 * Used by setup to seed the workflow when the user hasn't completed GQL-16 yet.
 */
export function createGqlLatencyDemoWorkflow(): Record<string, unknown> {
  const startId = crypto.randomUUID();
  const queryId = crypto.randomUUID();
  const assertId = crypto.randomUUID();
  const endId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: LESSON17_WF_NAME,
    schemaVersion: 6,
    variables: { [LESSON17_GRAPHQL_URL_VAR]: GQL_DEMO_HTTP },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 100, y: 150 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: queryId,
        type: 'graphqlQuery',
        position: { x: 300, y: 150 },
        data: {
          label: 'GraphQL Query',
          endpoint: GQL_DEMO_VAR,
          query: 'query { health }',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [{ field: 'latencyMs', variableName: 'gqlLatency', enabled: true }],
        },
      },
      {
        id: assertId,
        type: 'graphqlAssert',
        position: { x: 550, y: 150 },
        data: {
          label: 'GraphQL Assert',
          sourceVariable: 'gqlLatency',
          assertions: [{
            id: 'gql17-latency-assert',
            jsonPath: '$',
            operator: 'less_than',
            expectedValue: '2000',
            description: 'Latency under 2000ms',
          }],
          failBehavior: 'error',
        },
      },
      {
        id: endId,
        type: 'end',
        position: { x: 800, y: 150 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: startId, target: queryId },
      { id: crypto.randomUUID(), source: queryId, target: assertId },
      { id: crypto.randomUUID(), source: assertId, target: endId },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function fillRunnerLabeledNumberInput(labelText: string, value: string): boolean {
  const field = Array.from(document.querySelectorAll('.resilience-field'))
    .find((el) => el.querySelector('label')?.textContent?.trim() === labelText);
  const input = field?.querySelector<HTMLInputElement>('input');
  if (!input) return false;
  fillControlledInput(input, value);
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

/** Demo run uses Standard trace so Results Explorer Console shows per-node output. */
export const LESSON17_DEMO_TRACE_LEVEL = 'standard' as const;

/** Force Batch execution mode so iterations/concurrency controls apply (not load-profile). */
function ensureLesson17BatchExecutionMode(): void {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>(
    '.workflow-runner-config-section label.radio-label',
  ));
  const batchLabel = labels.find((el) => el.textContent?.trim().startsWith('Batch'));
  const radio = batchLabel?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (radio && !radio.checked && !radio.disabled) {
    radio.click();
  }
}

/** Set Trace Level to Standard so Console captures node execution (not Minimal). */
function ensureLesson17StandardTraceLevel(): void {
  const inline = document.querySelector('.wf-runner-inline-options');
  if (!inline) return;
  const labels = Array.from(inline.querySelectorAll<HTMLLabelElement>('label.radio-label'));
  const standardLabel = labels.find((el) => el.textContent?.trim().startsWith('Standard'));
  const radio = standardLabel?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (radio && !radio.checked && !radio.disabled) {
    radio.click();
  }
}

/** Locate the Workflow Runner ▶ Run Workflow button (test id preferred, text fallback). */
function findWorkflowRunnerRunButton(): HTMLElement | null {
  const byTestId = document.querySelector<HTMLElement>(WFR.RUN_BTN);
  if (byTestId) return byTestId;
  return Array.from(document.querySelectorAll<HTMLElement>('.config-form .form-actions .btn-primary'))
    .find((el) => el.textContent?.includes('Run Workflow')) ?? null;
}

/** Scroll the Run button into view and start execution; returns true when run begins. */
async function clickWorkflowRunnerRun(ctx: DemoActionContext): Promise<boolean> {
  for (let i = 0; i < 80; i++) {
    if (findWorkflowRunnerRunButton()) break;
    await ctx.delay(100);
  }
  const runBtn = findWorkflowRunnerRunButton();
  if (runBtn && typeof runBtn.scrollIntoView === 'function') {
    runBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await ctx.delay(500);
  }

  selectRunnerWorkflowByName(LESSON17_WF_NAME);
  await waitForRunnerBridge(ctx);
  applyRunnerBatchConfig(
    LESSON17_DEMO_ITERATIONS,
    LESSON17_DEMO_CONCURRENCY,
    LESSON17_DEMO_TRACE_LEVEL,
  );
  let started = selectAndRunRunnerWorkflow(LESSON17_WF_NAME);
  if (!started) {
    await ctx.delay(400);
    started = selectAndRunRunnerWorkflow(LESSON17_WF_NAME);
  }

  if (runBtn) {
    showClickRipple(runBtn);
    await ctx.delay(400);
  }

  for (let i = 0; i < 50; i++) {
    await ctx.delay(100);
    if (
      document.querySelector(LESSON17_STOP_BTN)
      || document.querySelector('.progress-section')
      || document.querySelector('.completion-section')
    ) {
      return true;
    }
  }
  return false;
}

// ── Interaction helpers ───────────────────────────────────────────────────────

/**
 * Open the workflow picker and select the "GraphQL Latency Demo" workflow.
 * Prefers an exact name match so user copies (e.g. "GraphQL Latency Demo (2)") are skipped.
 */
export async function selectGqlLatencyDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  selectRunnerWorkflowByName(LESSON17_WF_NAME);
  await ctx.click(LESSON17_WORKFLOW_SELECT);
  await ctx.waitFor('.wfp-dropdown-panel');
  await ctx.delay(400);
  const items = Array.from(document.querySelectorAll<HTMLElement>(LESSON17_DROPDOWN_ITEM));
  const target =
    items.find((el) => el.textContent?.trim() === LESSON17_WF_NAME) ??
    items.find((el) => el.textContent?.trim().startsWith(LESSON17_WF_NAME));
  if (target) {
    target.click();
    await ctx.delay(700);
  }
  _lesson17WorkflowSelected = true;
}

/** Set demo iterations/concurrency in the Execution Config panel (visible in step 3). */
export async function ensureLesson17RunnerDemoConfig(ctx: DemoActionContext): Promise<void> {
  await ensureLesson17WorkflowSelected(ctx);
  await waitForRunnerBridge(ctx);
  if (applyRunnerBatchConfig(
    LESSON17_DEMO_ITERATIONS,
    LESSON17_DEMO_CONCURRENCY,
    LESSON17_DEMO_TRACE_LEVEL,
  )) {
    _lesson17ConfigSet = true;
    await ctx.delay(300);
    return;
  }
  if (_lesson17ConfigSet) return;
  ensureLesson17BatchExecutionMode();
  ensureLesson17StandardTraceLevel();
  await ctx.delay(300);
  fillRunnerLabeledNumberInput('Iterations', String(LESSON17_DEMO_ITERATIONS));
  await ctx.delay(500);
  fillRunnerLabeledNumberInput('Concurrency', String(LESSON17_DEMO_CONCURRENCY));
  await ctx.delay(500);
  _lesson17ConfigSet = true;
}

/**
 * Click the Run Workflow button and wait for the completion banner (up to 20 s).
 * Scrolls the completion banner into view so the viewer can read the result.
 */
export async function runGqlLatencyWorkflow(ctx: DemoActionContext): Promise<void> {
  if (_lesson17WorkflowRun) return;
  if (document.querySelector('.completion-section')) {
    _lesson17WorkflowRun = true;
    return;
  }
  let started = await clickWorkflowRunnerRun(ctx);
  if (!started) {
    await ctx.delay(400);
    selectRunnerWorkflowByName(LESSON17_WF_NAME);
    await ctx.delay(300);
    started = await clickWorkflowRunnerRun(ctx);
  }
  if (!started) {
    console.warn('[DemoHub] GQL-17: Run Workflow did not start — is the API proxy running? (npm run server:dev)');
  }
  for (let i = 0; i < 120; i++) {
    await ctx.delay(500);
    if (document.querySelector('.completion-section')) {
      _lesson17WorkflowRun = true;
      break;
    }
  }
  const completionEl = document.querySelector<HTMLElement>('.completion-section');
  if (completionEl && typeof completionEl.scrollIntoView === 'function') {
    completionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  await ctx.delay(1500);
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

/** Ensure the "GraphQL Latency Demo" workflow is selected in the Runner picker. */
export async function ensureLesson17WorkflowSelected(ctx: DemoActionContext): Promise<void> {
  selectRunnerWorkflowByName(LESSON17_WF_NAME);
  if (_lesson17WorkflowSelected && document.querySelector('.workflow-vars-section')) return;
  ctx.navigateToTab('workflow-runner');
  await ctx.delay(400);
  await selectGqlLatencyDemoWorkflow(ctx);
}

/** Ensure the workflow has been run once — never re-runs after the session flag is set. */
export async function ensureLesson17WorkflowRun(ctx: DemoActionContext): Promise<void> {
  if (_lesson17WorkflowRun) return;
  await ensureLesson17RunnerDemoConfig(ctx);
  if (document.querySelector('.completion-section')) {
    _lesson17WorkflowRun = true;
    return;
  }
  await runGqlLatencyWorkflow(ctx);
  if (document.querySelector('.completion-section')) {
    _lesson17WorkflowRun = true;
  }
}

/** Open Results Dashboard for the completed run — does not re-run the workflow. */
export async function ensureLesson17OnResultsTab(ctx: DemoActionContext): Promise<void> {
  if (_lesson17ResultsOpen && document.querySelector('.results-run-filter-tabs')) return;

  if (document.querySelector('.results-run-filter-tabs')) {
    _lesson17WorkflowRun = true;
    _lesson17ResultsOpen = true;
    return;
  }

  if (!_lesson17WorkflowRun) {
    await ensureLesson17WorkflowRun(ctx);
  }

  const viewBtn = document.querySelector<HTMLElement>('.completion-section .btn-primary');
  if (viewBtn) {
    viewBtn.click();
    await ctx.delay(800);
  } else {
    ctx.navigateToTab('results');
    await ctx.delay(800);
  }
  _lesson17ResultsOpen = true;
}

/** @deprecated Use ensureLesson17OnResultsTab — kept for existing imports. */
export async function ensureLesson17ResultsOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson17OnResultsTab(ctx);
}

/** Click View Full Results on the completion banner (step 5 action). */
export async function openLesson17ResultsFromCompletionBanner(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector('.results-run-filter-tabs')) {
    _lesson17ResultsOpen = true;
    return;
  }
  if (!_lesson17WorkflowRun) {
    await ensureLesson17WorkflowRun(ctx);
  }
  const viewBtn = document.querySelector<HTMLElement>('.completion-section .btn-primary');
  if (viewBtn) {
    await ctx.click('.completion-section .btn-primary');
    await ctx.delay(800);
  } else {
    ctx.navigateToTab('results');
    await ctx.delay(800);
  }
  _lesson17ResultsOpen = true;
}

/** Switch to Request Details on the Results Dashboard. */
export async function openLesson17RequestDetailsTab(ctx: DemoActionContext): Promise<void> {
  await ensureLesson17OnResultsTab(ctx);
  const reqTab = document.querySelector<HTMLElement>(LESSON17_REQUEST_DETAILS_TAB)
    ?? Array.from(document.querySelectorAll<HTMLElement>('.results-view-tab'))
      .find((el) => el.textContent?.trim() === 'Request Details');
  if (reqTab && !reqTab.classList.contains('active')) {
    reqTab.click();
    await ctx.delay(600);
  }
}

/** Open the Results Explorer modal from the dashboard header. */
export async function openLesson17ResultsExplorer(ctx: DemoActionContext): Promise<void> {
  await ensureLesson17OnResultsTab(ctx);
  if (document.querySelector(LESSON17_RESULTS_EXPLORER_DIAGRAM)) return;
  const explorerBtn = document.querySelector<HTMLElement>(LESSON17_RESULTS_EXPLORER_BTN);
  if (explorerBtn) {
    explorerBtn.click();
    await ctx.delay(800);
  }
}

/** Collapse the detail panel so the diagram has full width before fit view. */
async function collapseLesson17ResultsExplorerDetailPanel(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector('.results-explorer-detail')) return;
  const toggle = document.querySelector<HTMLElement>(REX.DETAIL_PANEL_TOGGLE);
  if (toggle?.textContent?.trim() === '▶') {
    toggle.click();
    await ctx.delay(500);
  }
}

/** Fit the Results Explorer canvas so all workflow nodes are visible. */
export async function fitLesson17ResultsExplorerDiagram(ctx: DemoActionContext): Promise<void> {
  await collapseLesson17ResultsExplorerDetailPanel(ctx);
  for (let i = 0; i < 60; i++) {
    if (document.querySelector(REX.CANVAS_NODE)) break;
    await ctx.delay(100);
  }
  await waitForResultsExplorerBridge(ctx);
  await ctx.delay(400);

  for (let attempt = 0; attempt < 4; attempt++) {
    if (fitResultsExplorerDiagram()) {
      await ctx.delay(500);
      continue;
    }
    const fitBtn = document.querySelector<HTMLElement>(LESSON17_RESULTS_EXPLORER_FIT_VIEW)
      ?? document.querySelector<HTMLElement>('.results-explorer-diagram button[title="Fit view"]');
    if (fitBtn) {
      if (typeof fitBtn.scrollIntoView === 'function') {
        fitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(300);
      }
      showClickRipple(fitBtn);
      fitBtn.click();
    }
    await ctx.delay(500);
  }
  await ctx.delay(800);
}

/** Open Results Explorer and fit the workflow diagram for the viewer. */
export async function openAndFitLesson17ResultsExplorer(ctx: DemoActionContext): Promise<void> {
  await openLesson17ResultsExplorer(ctx);
  await fitLesson17ResultsExplorerDiagram(ctx);
}

/** Ensure Aggregate iteration view so Console shows the run overview summary. */
async function ensureLesson17ResultsExplorerAggregate(ctx: DemoActionContext): Promise<void> {
  const toggle = document.querySelector<HTMLElement>(REX.ITER_PICKER_TOGGLE);
  if (toggle?.classList.contains('aggregate')) return;
  if (toggle) {
    toggle.click();
    await ctx.delay(300);
  }
  const aggregateItem = document.querySelector<HTMLElement>(REX.ITER_PICKER_AGGREGATE);
  if (aggregateItem) {
    aggregateItem.click();
    await ctx.delay(400);
  }
}

/** Select a single iteration in the Results Explorer iteration picker. */
export async function selectLesson17ResultsExplorerIteration(
  ctx: DemoActionContext,
  iterationIndex = 0,
): Promise<void> {
  const toggle = document.querySelector<HTMLElement>(REX.ITER_PICKER_TOGGLE);
  if (!toggle) return;

  if (toggle.classList.contains('aggregate')) {
    showClickRipple(toggle);
    toggle.click();
    await ctx.delay(400);
  }

  for (let i = 0; i < 30; i++) {
    if (document.querySelector(REX.ITER_PICKER_DROPDOWN)) break;
    await ctx.delay(100);
  }

  const item = document.querySelector<HTMLElement>(REX.iterPickerItem(iterationIndex));
  if (item) {
    showClickRipple(item);
    item.click();
    await ctx.delay(600);
  }
}

function consoleBodyHasIterationDetail(body: Element | null): boolean {
  if (!body) return false;
  const text = body.textContent ?? '';
  return text.includes('Iteration #1 started')
    || text.includes('GraphQL Query')
    || text.includes('GraphQL Assert');
}

/** Open Console: aggregate overview, then iteration #1 for per-node detail. */
export async function showLesson17ResultsExplorerConsole(ctx: DemoActionContext): Promise<void> {
  const diagramBtn = document.querySelector<HTMLElement>(REX.VIEW_DIAGRAM);
  if (diagramBtn && !diagramBtn.classList.contains('view-toggle-active')) {
    diagramBtn.click();
    await ctx.delay(400);
  }
  await ensureLesson17ResultsExplorerAggregate(ctx);
  const consoleBtn = document.querySelector<HTMLElement>(REX.CONSOLE_TOGGLE);
  if (!consoleBtn) return;
  if (!consoleBtn.classList.contains('view-toggle-active')) {
    showClickRipple(consoleBtn);
    consoleBtn.click();
    await ctx.delay(600);
  }
  for (let i = 0; i < 30; i++) {
    const body = document.querySelector(REX.CONSOLE_BODY);
    const lines = body?.querySelectorAll('.re-console-line');
    if (lines && lines.length > 0) break;
    await ctx.delay(100);
  }
  await ctx.delay(1000);

  await selectLesson17ResultsExplorerIteration(ctx, 0);

  for (let i = 0; i < 40; i++) {
    const body = document.querySelector(REX.CONSOLE_BODY);
    if (consoleBodyHasIterationDetail(body)) break;
    if (document.querySelector('[data-testid="results-console-disabled"]')) break;
    await ctx.delay(100);
  }
  await fitLesson17ResultsExplorerDiagram(ctx);
  await ctx.delay(1200);
}

/** Close Results Explorer so the Export JSON header button is visible. */
export async function closeLesson17ResultsExplorerIfOpen(ctx: DemoActionContext): Promise<void> {
  const closeBtn = document.querySelector<HTMLElement>('.results-explorer-footer-actions .cat-btn');
  if (closeBtn?.textContent?.trim() === 'Close') {
    closeBtn.click();
    await ctx.delay(600);
  }
}

// ── Setup / Cleanup ───────────────────────────────────────────────────────────

/** Setup for Lesson 17 — seed the workflow and navigate to workflow-runner. */
export async function gqlWorkflowRunnerLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson17SessionFlags();
  await seedNamedWorkflow(ctx, LESSON17_WF_NAME, createGqlLatencyDemoWorkflow(), {
    deleteDelayMs: 100,
    insertDelayMs: 300,
  });
  ctx.navigateToTab('workflow-runner');
  await ctx.delay(600);
  await selectGqlLatencyDemoWorkflow(ctx);
  await ensureLesson17RunnerDemoConfig(ctx);
}

/** Cleanup for Lesson 17. */
export async function gqlWorkflowRunnerLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson17SessionFlags();
  await ctx.delay(100);
}
