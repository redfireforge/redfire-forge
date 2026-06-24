// ── Lesson 17: Workflow Runner & Results ─────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL_DEMO_HEALTH } from './core';

export { GQL_DEMO_HEALTH };

/** Workflow name shared with GQL-16 — Runner builds on the Designer lesson. */
export const LESSON17_WF_NAME = 'GraphQL Latency Demo';

/** Docker endpoint for prerequisite check (same server as GQL-16). */
export const LESSON17_DOCKER_ENDPOINT = GQL_DEMO_HEALTH;

/** Run button selector inside the Workflow Runner. */
export const LESSON17_RUN_BTN = '.config-form .form-actions .btn-primary';

/** Selector for the workflow picker dropdown trigger. */
export const LESSON17_WORKFLOW_SELECT = '[data-testid="workflow-select"]';

/** Selector for the dropdown item list. */
export const LESSON17_DROPDOWN_ITEM = '.wfp-dropdown-item';

// ── Session flags ─────────────────────────────────────────────────────────────

let _lesson17WorkflowSelected = false;
let _lesson17WorkflowRun = false;
let _lesson17ResultsOpen = false;

export function resetGqlLesson17SessionFlags(): void {
  _lesson17WorkflowSelected = false;
  _lesson17WorkflowRun = false;
  _lesson17ResultsOpen = false;
}

// ── Workflow factory ──────────────────────────────────────────────────────────

/**
 * Creates a minimal "GraphQL Latency Demo" workflow:
 * Start → GraphQL Query (health check, latencyMs bound) → GraphQL Assert (< 500ms) → End.
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
    variables: {},
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
          endpoint: 'http://localhost:4010/graphql',
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
            expectedValue: '500',
            description: 'Latency under 500ms',
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

// ── Interaction helpers ───────────────────────────────────────────────────────

/**
 * Open the workflow picker and select the "GraphQL Latency Demo" workflow.
 * Prefers an exact name match so user copies (e.g. "GraphQL Latency Demo (2)") are skipped.
 */
export async function selectGqlLatencyDemoWorkflow(ctx: DemoActionContext): Promise<void> {
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

/**
 * Click the Run Workflow button and wait for the completion banner (up to 20 s).
 * Scrolls the completion banner into view so the viewer can read the result.
 */
export async function runGqlLatencyWorkflow(ctx: DemoActionContext): Promise<void> {
  await ctx.click(LESSON17_RUN_BTN);
  for (let i = 0; i < 40; i++) {
    await ctx.delay(500);
    if (document.querySelector('.completion-section')) break;
  }
  const completionEl = document.querySelector<HTMLElement>('.completion-section');
  if (completionEl && typeof completionEl.scrollIntoView === 'function') {
    completionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  await ctx.delay(600);
  _lesson17WorkflowRun = true;
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

/** Ensure the "GraphQL Latency Demo" workflow is selected in the Runner picker. */
export async function ensureLesson17WorkflowSelected(ctx: DemoActionContext): Promise<void> {
  if (_lesson17WorkflowSelected && document.querySelector('.workflow-vars-section')) return;
  ctx.navigateToTab('workflow-runner');
  await ctx.delay(400);
  await selectGqlLatencyDemoWorkflow(ctx);
}

/** Ensure the workflow has been run at least once (completion banner visible or session flag set). */
export async function ensureLesson17WorkflowRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson17WorkflowSelected(ctx);
  if (_lesson17WorkflowRun && document.querySelector('.completion-section')) return;
  await runGqlLatencyWorkflow(ctx);
}

/** Ensure results tab is open. */
export async function ensureLesson17ResultsOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson17WorkflowRun(ctx);
  if (_lesson17ResultsOpen && document.querySelector('.results-run-filter-tabs')) return;
  // Click "View Full Results →" if completion banner is present; otherwise navigate directly.
  const viewBtn = document.querySelector<HTMLElement>('.completion-section .btn-primary');
  if (viewBtn) {
    viewBtn.click();
    await ctx.delay(600);
  } else {
    ctx.navigateToTab('results');
    await ctx.delay(800);
  }
  _lesson17ResultsOpen = true;
}

// ── Setup / Cleanup ───────────────────────────────────────────────────────────

/** Setup for Lesson 17 — seed the workflow and navigate to workflow-runner. */
export async function gqlWorkflowRunnerLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson17SessionFlags();
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  const wfInsert = (window as unknown as Record<string, unknown>).__wfInsertWorkflow as
    | ((wf: Record<string, unknown>) => void)
    | undefined;
  if (wfDelete) {
    wfDelete(LESSON17_WF_NAME);
    await ctx.delay(100);
  }
  if (wfInsert) {
    wfInsert(createGqlLatencyDemoWorkflow());
    await ctx.delay(300);
  }
  ctx.navigateToTab('workflow-runner');
  await ctx.delay(600);
}

/** Cleanup for Lesson 17. */
export async function gqlWorkflowRunnerLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson17SessionFlags();
  await ctx.delay(100);
}
