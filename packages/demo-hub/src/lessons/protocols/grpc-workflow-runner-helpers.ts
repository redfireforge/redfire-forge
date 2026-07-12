/** GRPC-24 Workflow Runner lesson — shared helpers, session, setup/cleanup */
import type { DemoActionContext } from '../../types';
import { WF } from '@shared/selectors';
import { RES } from '@shared/selectors/res';
import { REX } from '@shared/selectors/rex';
import { FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';
import {
  connectWorkflowNodes,
  deleteWorkflowByName,
  fitResultsExplorerDiagram,
  getGrpcActiveDescriptorKey,
  getWorkflowByName,
  applyRunnerBatchConfig,
  removeWorkflowEdge,
  seedNamedWorkflow,
  selectAndRunRunnerWorkflow,
  selectRunnerWorkflowByName,
  waitForResultsExplorerBridge,
  waitForRunnerBridge,
} from '../../adapters';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  collapseWfDemoAppSidebar,
} from '../wf-demo-helpers';
import {
  WF14_NAME,
  WF14_NODE_GRPC,
  WF14_NODE_ASSERT,
  isNodeOnCanvas,
  isWorkflowPresent,
} from './grpc-workflow-integration-helpers';
import { grpcFirstCallSetup, grpcFirstCallCleanup } from './grpc-lesson-helpers';
import { findScrollableParent, pauseDemoAutoScroll } from '../../demoSpotlightUtils';

// ── Constants ──────────────────────────────────────────────────────────────

/** Workflow-level variable name shown in INITIAL VARIABLES panel. */
export const GRPCWR_TARGET_VAR = 'grpcTarget';
/** Default value — the local Echo server without TLS. */
export const GRPCWR_TARGET_DEFAULT = 'localhost:50051';
/** Template expression used inside the Unary node target field. */
export const GRPCWR_TARGET_EXPR = '{{grpcTarget}}';

export const GRPCWR_ITERATIONS = 3;
export const GRPCWR_CONCURRENCY = 1;
export const GRPCWR_TRACE_LEVEL = 'standard' as const;

export const WF_RUNNER_SELECT = '[data-testid="workflow-select"]';
export const GRPCWR_EXPLORER_BTN = 'button[title="Explore execution results"]';

// ── Session flags ──────────────────────────────────────────────────────────

export const grpcWRSession = {
  // Designer build phase
  workflowCreated: false,
  variablesDefined: false,
  sidebarCollapsed: false,
  unaryAdded: false,
  unaryConfigured: false,
  assertAdded: false,
  assertConfigured: false,
  quickTestRun: false,
  // Workflow Runner phase
  workflowSelected: false,
  configApplied: false,
  runCompleted: false,
};

export function resetGrpcWRSession(): void {
  Object.assign(grpcWRSession, {
    workflowCreated: false,
    variablesDefined: false,
    sidebarCollapsed: false,
    unaryAdded: false,
    unaryConfigured: false,
    assertAdded: false,
    assertConfigured: false,
    quickTestRun: false,
    workflowSelected: false,
    configApplied: false,
    runCompleted: false,
  });
}

// ── Workflow factory (with grpcTarget variable) ────────────────────────────

export function resolveDescriptorKey(): string {
  return getGrpcActiveDescriptorKey() ?? FIXTURE_DESCRIPTOR_KEY;
}

function buildGrpcEchoWorkflowWithVars(): Record<string, unknown> {
  return {
    id: 'grpc24-wf-demo',
    name: WF14_NAME,
    schemaVersion: 6,
    variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: 'grpc24-start',
        type: 'start',
        position: { x: 100, y: 200 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: WF14_NODE_GRPC,
        type: 'grpcUnary',
        position: { x: 320, y: 200 },
        data: {
          label: 'Echo Call',
          callType: 'unary',
          target: GRPCWR_TARGET_EXPR,
          descriptorKey: resolveDescriptorKey(),
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'workflow-test' },
          saveAs: 'echoReply',
          onError: 'fail',
        },
      },
      {
        id: WF14_NODE_ASSERT,
        type: 'grpcAssert',
        position: { x: 580, y: 200 },
        data: {
          label: 'Assert Echo',
          source: 'echoReply',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: 'message', equals: 'workflow-test' },
          ],
          onError: 'fail',
        },
      },
      {
        id: 'grpc24-end',
        type: 'end',
        position: { x: 820, y: 200 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'grpc24-e1', source: 'grpc24-start', target: WF14_NODE_GRPC },
      { id: 'grpc24-e2', source: WF14_NODE_GRPC, target: WF14_NODE_ASSERT },
      { id: 'grpc24-e3', source: WF14_NODE_ASSERT, target: 'grpc24-end' },
    ],
  };
}

/** Exported for unit tests — full workflow with grpcTarget variable. */
export function createGrpcEchoWorkflowWithVars(): Record<string, unknown> {
  return buildGrpcEchoWorkflowWithVars();
}

// ── Canvas helpers ─────────────────────────────────────────────────────────

function resolveCanvasNodeId(selector: string): string {
  const el = document.querySelector<HTMLElement>(selector);
  return (
    el?.getAttribute('data-id') ??
    el?.closest('.react-flow__node')?.getAttribute('data-id') ??
    ''
  );
}

function connectEdge(sourceSelector: string, targetSelector: string, handle?: string): void {
  const src = resolveCanvasNodeId(sourceSelector);
  const tgt = resolveCanvasNodeId(targetSelector);
  if (!src || !tgt) return;
  removeWorkflowEdge(src, tgt);
  connectWorkflowNodes(src, tgt, handle ?? null, null);
}

export function ensureChainConnected(): void {
  connectEdge('.react-flow__node-start', WF.NODE_GRPC_UNARY, 'out');
  connectEdge(WF.NODE_GRPC_UNARY, WF.NODE_GRPC_ASSERT);
  connectEdge(WF.NODE_GRPC_ASSERT, '.react-flow__node-end');
}

// ── Designer build helpers ─────────────────────────────────────────────────

export async function seedGrpcWRWorkflowQuiet(ctx: DemoActionContext): Promise<void> {
  await seedNamedWorkflow(ctx, WF14_NAME, buildGrpcEchoWorkflowWithVars(), {
    deleteDelayMs: 150,
    insertPreDelayMs: 100,
    insertDelayMs: 350,
  });
  Object.assign(grpcWRSession, {
    workflowCreated: true,
    variablesDefined: true,
    sidebarCollapsed: true,
    unaryAdded: true,
    unaryConfigured: true,
    assertAdded: true,
    assertConfigured: true,
  });
}

export async function ensureOnWorkflowTab(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.CANVAS)) {
    ctx.navigateToTab('workflow');
    await ctx.delay(500);
  }
}

export async function ensureGrpcWRNodesPresent(ctx: DemoActionContext): Promise<void> {
  await ensureOnWorkflowTab(ctx);
  if (
    !isWorkflowPresent() ||
    !isNodeOnCanvas(WF14_NODE_GRPC) ||
    !isNodeOnCanvas(WF14_NODE_ASSERT)
  ) {
    await seedGrpcWRWorkflowQuiet(ctx);
  }
}

// ── Workflow Runner helpers ────────────────────────────────────────────────

export async function ensureWorkflowSeededForRunner(ctx: DemoActionContext): Promise<void> {
  if (!getWorkflowByName(WF14_NAME)) {
    await seedGrpcWRWorkflowQuiet(ctx);
  }
}

export async function selectGrpcEchoWorkflow(ctx: DemoActionContext): Promise<void> {
  selectRunnerWorkflowByName(WF14_NAME);
  await ctx.click(WF_RUNNER_SELECT);
  await ctx.waitFor('.wfp-dropdown-panel');
  await ctx.delay(400);
  const items = Array.from(document.querySelectorAll<HTMLElement>('.wfp-dropdown-item'));
  const target =
    items.find((el) => el.textContent?.trim() === WF14_NAME) ??
    items.find((el) => el.textContent?.trim().startsWith(WF14_NAME));
  if (target) {
    target.click();
    await ctx.delay(700);
  }
  grpcWRSession.workflowSelected = true;
}

export async function applyGrpcWRConfig(ctx: DemoActionContext): Promise<void> {
  selectRunnerWorkflowByName(WF14_NAME);
  await waitForRunnerBridge(ctx);
  applyRunnerBatchConfig(GRPCWR_ITERATIONS, GRPCWR_CONCURRENCY, GRPCWR_TRACE_LEVEL);
  grpcWRSession.configApplied = true;
}

export async function runGrpcEchoWorkflow(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector('.completion-section')) return;
  selectRunnerWorkflowByName(WF14_NAME);
  await waitForRunnerBridge(ctx);
  applyRunnerBatchConfig(GRPCWR_ITERATIONS, GRPCWR_CONCURRENCY, GRPCWR_TRACE_LEVEL);
  let started = selectAndRunRunnerWorkflow(WF14_NAME);
  if (!started) {
    await ctx.delay(400);
    started = selectAndRunRunnerWorkflow(WF14_NAME);
  }
  for (let i = 0; i < 60; i++) {
    await ctx.delay(500);
    if (document.querySelector('.completion-section')) break;
  }
  document.querySelector('.completion-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await ctx.delay(500);
  grpcWRSession.runCompleted = true;
}

export async function ensureRunnerReady(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF_RUNNER_SELECT)) {
    ctx.navigateToTab('workflow-runner');
    await ctx.delay(700);
  }
  await ensureWorkflowSeededForRunner(ctx);
  if (!grpcWRSession.workflowSelected) await selectGrpcEchoWorkflow(ctx);
  if (!grpcWRSession.configApplied) await applyGrpcWRConfig(ctx);
}

export async function openResultsFromCompletionBanner(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector('.completion-section')) {
    await ensureRunnerReady(ctx);
    await runGrpcEchoWorkflow(ctx);
  }
  const link = document.querySelector<HTMLElement>(
    '.wfp-view-results-btn, .completion-section a, [data-testid="view-results-btn"]',
  );
  if (link) {
    link.click();
  } else {
    ctx.navigateToTab('results');
  }
  await ctx.delay(900);
}

export async function ensureOnResultsTab(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector('.results-run-filter-tabs')) return;
  if (!grpcWRSession.runCompleted) {
    ctx.navigateToTab('workflow-runner');
    await ctx.delay(600);
    await ensureRunnerReady(ctx);
    await runGrpcEchoWorkflow(ctx);
    await openResultsFromCompletionBanner(ctx);
    return;
  }
  ctx.navigateToTab('results');
  await ctx.delay(700);
}

export async function openRequestDetailsTab(ctx: DemoActionContext): Promise<void> {
  await ensureOnResultsTab(ctx);
  const tab = Array.from(document.querySelectorAll<HTMLElement>('.results-view-tab')).find(
    (el) => el.textContent?.trim() === 'Request Details',
  );
  if (tab) {
    tab.click();
    await ctx.delay(500);
  }
  const groupBySelect = document.querySelector<HTMLSelectElement>('.group-by-controls select');
  if (groupBySelect) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    nativeSet?.call(groupBySelect, 'test');
    groupBySelect.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(400);
  }
}

export async function openResultsOverviewTab(ctx: DemoActionContext): Promise<void> {
  await ensureOnResultsTab(ctx);
  const tab = Array.from(document.querySelectorAll<HTMLElement>('.results-view-tab')).find(
    (el) => el.textContent?.trim() === 'Overview',
  );
  if (tab && !tab.classList.contains('active')) {
    tab.click();
    await ctx.delay(450);
  }
}

export async function ensureFullResultsMetricsCards(ctx: DemoActionContext): Promise<void> {
  // Metrics cards can briefly render in a partial state while run summary data hydrates.
  // Wait until rows are present and core numeric values are populated before highlighting.
  for (let i = 0; i < 25; i++) {
    const cards = document.querySelector<HTMLElement>(RES.METRICS_CARDS);
    if (cards) {
      const rows = cards.querySelectorAll<HTMLElement>('.metrics-row');
      const hasTwoRows = rows.length >= 2;
      const hasTps = Array.from(cards.querySelectorAll<HTMLElement>('.metric-label')).some(
        (el) => el.textContent?.trim().toUpperCase() === 'TPS',
      );
      const metricValues = Array.from(cards.querySelectorAll<HTMLElement>('.metric-value'))
        .map((el) => el.textContent?.trim() ?? '');
      const hasEnoughValues = metricValues.length >= 10;
      const coreValues = metricValues.slice(0, 8);
      const coreFilled = coreValues.length >= 8 && coreValues.every((v) => v.length > 0);
      const hasNumericCore = coreValues.some((v) => /\d/.test(v));
      if (hasTwoRows && hasTps && hasEnoughValues && coreFilled && hasNumericCore) return;
    }
    await ctx.delay(250);
  }
}

export async function scrollResultsMetricsCardsIntoView(ctx: DemoActionContext): Promise<void> {
  const cards = document.querySelector<HTMLElement>(RES.METRICS_CARDS);
  if (!cards) return;

  // Pause the LiveDemo auto-scroll so it cannot override our manual position.
  // The metrics cards (331px) are taller than the gap between sticky header and
  // demo narration panel (~241px), so isElementVisibleInViewport always returns
  // false and scrollDemoTargetIntoView would fire and push row 1 behind the
  // sticky header if we don't suppress it here.
  pauseDemoAutoScroll(4000);

  const scrollParent = findScrollableParent(cards);
  const stickyTop = document.querySelector<HTMLElement>('.results-top');
  if (scrollParent && stickyTop) {
    const cardsRect = cards.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const stickyRect = stickyTop.getBoundingClientRect();
    const cardsTopInParent = cardsRect.top - parentRect.top + scrollParent.scrollTop;
    const targetTop = Math.max(0, cardsTopInParent - stickyRect.height - 16);
    // Use 'instant' so the scroll completes before the spotlight ring measures.
    scrollParent.scrollTo({ top: targetTop, behavior: 'instant' });
    await ctx.delay(100);
    return;
  }

  await ctx.delay(100);
}

export async function openAndFitResultsExplorer(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(REX.DIAGRAM)) {
    const explorerBtn = document.querySelector<HTMLElement>(GRPCWR_EXPLORER_BTN);
    if (explorerBtn) {
      explorerBtn.click();
      await ctx.delay(600);
    }
  }
  await waitForResultsExplorerBridge(ctx);
  if (!fitResultsExplorerDiagram()) {
    const fitBtn = document.querySelector<HTMLElement>(REX.FIT_VIEW_BTN);
    fitBtn?.click();
    await ctx.delay(300);
  }
  await ctx.delay(400);
}

export async function closeResultsExplorerIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(REX.DIAGRAM)) return;

  // 1) Prefer explicit close controls when available (legacy + current UIs).
  let closeBtn = document.querySelector<HTMLElement>(
    '.results-explorer-modal-close-btn, [data-testid="results-explorer-close-btn"], .results-explorer-footer-actions .cat-btn',
  );

  // 2) Fallback: any visible button labeled exactly "Close" inside Explorer.
  if (!closeBtn) {
    const closeByText = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (btn) =>
        btn.offsetParent !== null &&
        btn.textContent?.trim().toLowerCase() === 'close' &&
        (btn.closest('.results-explorer-overlay') || btn.closest('.results-explorer-modal') || btn.closest('.results-explorer-footer')),
    );
    closeBtn = closeByText ?? null;
  }

  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(450);
  }

  // 3) Final fallback: Escape key (Explorer listens for Esc to close).
  if (document.querySelector(REX.DIAGRAM)) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await ctx.delay(250);
  }
}

// ── Setup / Cleanup ────────────────────────────────────────────────────────

export async function grpcWorkflowRunnerSetup(ctx: DemoActionContext): Promise<void> {
  resetGrpcWRSession();
  await grpcFirstCallSetup(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  await closeWfConfigModalIfOpen(ctx);
  if (getWorkflowByName(WF14_NAME)) {
    deleteWorkflowByName(WF14_NAME);
    await ctx.delay(200);
  }
  ctx.navigateToTab('workflow');
  await ctx.delay(600);
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) { skipBtn.click(); await ctx.delay(200); }
  await collapseWfDemoAppSidebar(ctx);
  grpcWRSession.sidebarCollapsed = true;
}

export async function grpcWorkflowRunnerCleanup(ctx: DemoActionContext): Promise<void> {
  resetGrpcWRSession();
  await closeWfConfigModalIfOpen(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  deleteWorkflowByName(WF14_NAME);
  await grpcFirstCallCleanup(ctx);
}