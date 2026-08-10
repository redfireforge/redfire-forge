/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REX } from '@shared/selectors/rex';
import * as adapters from '../../adapters';
import * as demoSpotlightUtils from '../../demoSpotlightUtils';
import { clearWorkflowSeedBridge, stubRunnerBridge, stubWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { makeCtx } from './ws-test-utils';
import { WF14_NAME } from './grpc-workflow-integration-helpers';
import {
  GRPCWR_ITERATIONS,
  GRPCWR_CONCURRENCY,
  grpcWRSession,
  resetGrpcWRSession,
  applyGrpcWRConfig,
  applyGrpcWRConfigVisible,
  ensureChainConnected,
  ensureFullResultsMetricsCards,
  ensureRunnerReady,
  grpcWorkflowRunnerCleanup,
  grpcWorkflowRunnerSetup,
  openAndFitResultsExplorer,
  openRequestDetailsTab,
  tourRequestDetailsRow,
  openResultsOverviewTab,
  runGrpcEchoWorkflow,
  scrollResultsMetricsCardsIntoView,
  scrollResultsMetricsLatencyRowIntoView,
  scrollResultsStickyAwareIntoView,
  seedGrpcWRWorkflowQuiet,
  closeResultsExplorerIfOpen,
  ensureOnResultsTab,
  openResultsFromCompletionBanner,
  selectGrpcEchoWorkflow,
  ensureWorkflowSeededForRunner,
  ensureGrpcWRNodesPresent,
  spotlightGrpcTargetVarRow,
  tourResultsExplorerPanels,
} from './grpc-workflow-runner-helpers';

describe('grpc-workflow-runner-helpers — coverage gaps', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    resetGrpcWRSession();
    stubWorkflowSeedBridge(WF14_NAME);
    const lessonHelpers = await import('./grpc-lesson-helpers');
    vi.spyOn(lessonHelpers, 'spotlightAndPause').mockResolvedValue(undefined);
    vi.spyOn(lessonHelpers, 'spotlightElementAndPause').mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
    vi.restoreAllMocks();
  });

  it('seedGrpcWRWorkflowQuiet seeds workflow and marks designer session flags', async () => {
    const ctx = makeCtx();
    const seedSpy = vi.spyOn(adapters, 'seedNamedWorkflow').mockResolvedValue(true);
    await seedGrpcWRWorkflowQuiet(ctx);
    expect(seedSpy).toHaveBeenCalledWith(
      ctx,
      WF14_NAME,
      expect.objectContaining({
        variables: expect.objectContaining({ grpcTarget: 'localhost:50051' }),
      }),
      expect.any(Object),
    );
    expect(grpcWRSession.workflowCreated).toBe(true);
    expect(grpcWRSession.assertConfigured).toBe(true);
  });

  it('ensureChainConnected wires start, unary, assert, and end nodes', () => {
    document.body.innerHTML = `
      <div class="react-flow__node-start" data-id="start-1"></div>
      <div class="react-flow__node react-flow__node-grpcUnary" data-id="grpc14-echo">
        <div data-testid="grpc-canvas-unary-node"></div>
      </div>
      <div class="react-flow__node react-flow__node-grpcAssert" data-id="grpc14-assert">
        <div data-testid="grpc-canvas-assert-node"></div>
      </div>
      <div class="react-flow__node-end" data-id="end-1"></div>
    `;
    const removeSpy = vi.spyOn(adapters, 'removeWorkflowEdge').mockImplementation(() => undefined);
    const connectSpy = vi.spyOn(adapters, 'connectWorkflowNodes').mockImplementation(() => undefined);
    ensureChainConnected();
    expect(removeSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalledWith('start-1', 'grpc14-echo', 'out', null);
  });

  it('applyGrpcWRConfig applies runner batch settings', async () => {
    const ctx = makeCtx();
    const batchSpy = vi.spyOn(adapters, 'applyRunnerBatchConfig').mockImplementation(() => true);
    vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(true);
    await applyGrpcWRConfig(ctx);
    expect(batchSpy).toHaveBeenCalledWith(GRPCWR_ITERATIONS, GRPCWR_CONCURRENCY, 'standard');
    expect(grpcWRSession.configApplied).toBe(true);
  });

  it('runGrpcEchoWorkflow retries selectAndRun when first attempt fails', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ selectAndRun: false });
    const selectSpy = vi.spyOn(adapters, 'selectAndRunRunnerWorkflow')
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        const completion = document.createElement('div');
        completion.className = 'completion-section';
        completion.scrollIntoView = vi.fn();
        document.body.appendChild(completion);
        return true;
      });
    vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(true);

    await runGrpcEchoWorkflow(ctx);
    expect(selectSpy).toHaveBeenCalledTimes(2);
    expect(grpcWRSession.runCompleted).toBe(true);
  });

  it('applyGrpcWRConfigVisible fills Iterations/Concurrency and applies batch config', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="workflow-runner-config-section">
        <div class="resilience-field"><label>Iterations</label><input type="number" value="1" /></div>
        <div class="resilience-field"><label>Concurrency</label><input type="number" value="2" /></div>
      </div>
    `;
    const batchSpy = vi.spyOn(adapters, 'applyRunnerBatchConfig').mockImplementation(() => true);
    vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(true);
    await applyGrpcWRConfigVisible(ctx);
    expect((document.querySelectorAll('input')[0] as HTMLInputElement).value).toBe(String(GRPCWR_ITERATIONS));
    expect((document.querySelectorAll('input')[1] as HTMLInputElement).value).toBe(String(GRPCWR_CONCURRENCY));
    expect(batchSpy).toHaveBeenCalledWith(GRPCWR_ITERATIONS, GRPCWR_CONCURRENCY, 'standard');
    expect(grpcWRSession.configApplied).toBe(true);
  });

  it('spotlightGrpcTargetVarRow no-ops when variables section is missing', async () => {
    const ctx = makeCtx();
    await expect(spotlightGrpcTargetVarRow(ctx)).resolves.toBeUndefined();
  });

  it('ensureRunnerReady skips select and config when session flags already set', async () => {
    document.body.innerHTML = '<div data-testid="workflow-select"></div>';
    grpcWRSession.workflowSelected = true;
    grpcWRSession.configApplied = true;
    const ctx = makeCtx();
    const selectSpy = vi.spyOn(adapters, 'selectRunnerWorkflowByName');
    const batchSpy = vi.spyOn(adapters, 'applyRunnerBatchConfig');
    await ensureRunnerReady(ctx);
    expect(selectSpy).not.toHaveBeenCalled();
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('ensureFullResultsMetricsCards returns once metric cards are hydrated', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="results-metrics-cards">
        <div class="metrics-row"></div>
        <div class="metrics-row"></div>
        <div class="metric-label">TPS</div>
        ${Array.from({ length: 10 }, (_, i) => `<div class="metric-value">${i + 1}</div>`).join('')}
      </div>
    `;
    await ensureFullResultsMetricsCards(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('scrollResultsMetricsCardsIntoView pauses auto-scroll and scrolls metrics into view', async () => {
    const ctx = makeCtx();
    const cards = document.createElement('div');
    cards.setAttribute('data-testid', 'results-metrics-cards');
    const scrollParent = document.createElement('div');
    scrollParent.style.overflow = 'auto';
    scrollParent.style.height = '200px';
    scrollParent.appendChild(cards);
    const stickyTop = document.createElement('div');
    stickyTop.className = 'results-top';
    document.body.append(scrollParent, stickyTop);

    const pauseSpy = vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll').mockImplementation(() => undefined);
    vi.spyOn(demoSpotlightUtils, 'findScrollableParent').mockReturnValue(scrollParent);
    cards.getBoundingClientRect = () => ({ top: 120, left: 0, width: 100, height: 80, right: 100, bottom: 200, x: 0, y: 0, toJSON: () => '{}' } as DOMRect);
    scrollParent.getBoundingClientRect = () => ({ top: 0, left: 0, width: 100, height: 200, right: 100, bottom: 200, x: 0, y: 0, toJSON: () => '{}' } as DOMRect);
    stickyTop.getBoundingClientRect = () => ({ top: 0, left: 0, width: 100, height: 40, right: 100, bottom: 40, x: 0, y: 0, toJSON: () => '{}' } as DOMRect);
    scrollParent.scrollTo = vi.fn();

    await scrollResultsMetricsCardsIntoView(ctx);
    expect(pauseSpy).toHaveBeenCalledWith(4000);
    expect(scrollParent.scrollTo).toHaveBeenCalled();
  });

  it('openAndFitResultsExplorer opens explorer and uses fit fallback button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button title="Explore execution results" data-testid="results-explorer-open-btn">Explorer</button>
      <button data-testid="results-explorer-fit-view-btn">Fit</button>
    `;
    vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(false);
    const fitBtn = document.querySelector<HTMLElement>(REX.FIT_VIEW_BTN)!;
    const fitSpy = vi.spyOn(fitBtn, 'click');
    await openAndFitResultsExplorer(ctx);
    expect(fitSpy).toHaveBeenCalled();
  });

  it('closeResultsExplorerIfOpen dispatches Escape when close button is missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="results-explorer-diagram"></div>`;
    const escSpy = vi.spyOn(document, 'dispatchEvent');
    await closeResultsExplorerIfOpen(ctx);
    expect(escSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'keydown' }));
  });

  it('openRequestDetailsTab selects Request Details and sets group-by to test', async () => {
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <button class="results-view-tab">Request Details</button>
      <div class="group-by-controls"><select><option value="node">node</option><option value="test">test</option></select></div>
    `;
    const ctx = makeCtx();
    const tab = document.querySelector<HTMLElement>('.results-view-tab')!;
    const tabSpy = vi.spyOn(tab, 'click');
    const select = document.querySelector<HTMLSelectElement>('.group-by-controls select')!;
    await openRequestDetailsTab(ctx);
    expect(tabSpy).toHaveBeenCalled();
    expect(select.value).toBe('test');
  });

  it('tourRequestDetailsRow paces tab, GRPC badge, row, detail, and close', async () => {
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <button class="results-view-tab" data-testid="results-tab-requests">Request Details</button>
      <div class="group-by-controls"><select><option value="node">node</option><option value="test">test</option></select></div>
      <div class="clickable-row">
        <span class="method-badge">GRPCUNARY</span> Echo Call
      </div>
      <div class="response-detail-modal" hidden>
        <button type="button" class="btn-ghost">Close</button>
      </div>
    `;
    const ctx = makeCtx();
    const lessonHelpers = await import('./grpc-lesson-helpers');
    const spotlightSpy = vi.mocked(lessonHelpers.spotlightElementAndPause);
    const row = document.querySelector<HTMLElement>('.clickable-row')!;
    const modal = document.querySelector<HTMLElement>('.response-detail-modal')!;
    const closeBtn = modal.querySelector<HTMLButtonElement>('button')!;
    let rowClicked = false;
    let closeClicked = false;
    row.addEventListener('click', () => {
      rowClicked = true;
      modal.hidden = false;
    });
    closeBtn.addEventListener('click', () => {
      closeClicked = true;
    });

    await tourRequestDetailsRow(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith('.clickable-row');
    expect(rowClicked).toBe(true);
    expect(closeClicked).toBe(true);
    // After-tab / after-row-click / after-close pacing.
    expect(ctx.delay).toHaveBeenCalledWith(800);
    expect(ctx.delay).toHaveBeenCalledWith(1000);
    // Spotlight hold times for tab → badge → row → detail → close.
    expect(spotlightSpy).toHaveBeenCalledWith(ctx, expect.any(HTMLElement), 1000);
    expect(spotlightSpy).toHaveBeenCalledWith(ctx, expect.any(HTMLElement), 1200);
    expect(spotlightSpy).toHaveBeenCalledWith(ctx, expect.any(HTMLElement), 1100);
    expect(spotlightSpy).toHaveBeenCalledWith(ctx, expect.any(HTMLElement), 1400);
    expect(spotlightSpy).toHaveBeenCalledWith(ctx, expect.any(HTMLElement), 700);
  });

  it('openResultsOverviewTab skips click when Overview tab is already active', async () => {
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <button class="results-view-tab active">Overview</button>
    `;
    const ctx = makeCtx();
    const tab = document.querySelector<HTMLElement>('.results-view-tab')!;
    const tabSpy = vi.spyOn(tab, 'click');
    await openResultsOverviewTab(ctx);
    expect(tabSpy).not.toHaveBeenCalled();
  });

  it('grpcWorkflowRunnerSetup deletes existing workflow and expands sidebar for step 1', async () => {
    const ctx = makeCtx();
    const wfHelpers = await import('../wf-demo-helpers');
    vi.spyOn(wfHelpers, 'cleanupWorkflowDemoRunUi').mockResolvedValue(undefined);
    vi.spyOn(wfHelpers, 'closeWfConfigModalIfOpen').mockResolvedValue(undefined);
    const expandSpy = vi.spyOn(wfHelpers, 'expandWfDemoAppSidebar').mockResolvedValue(undefined);
    const fitSpy = vi.spyOn(adapters, 'fitWorkflowCanvasView').mockReturnValue(true);
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue({ name: WF14_NAME });
    const deleteSpy = vi.spyOn(adapters, 'deleteWorkflowByName').mockImplementation(() => undefined);
    document.body.innerHTML = '<button class="onboarding-tooltip-skip">Skip</button>';
    await grpcWorkflowRunnerSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(WF14_NAME);
    expect(expandSpy).toHaveBeenCalled();
    expect(fitSpy).toHaveBeenCalled();
    expect(grpcWRSession.sidebarCollapsed).toBe(false);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('grpcWorkflowRunnerCleanup resets session and deletes workflow', async () => {
    const ctx = makeCtx();
    const lessonHelpers = await import('./grpc-lesson-helpers');
    const wfHelpers = await import('../wf-demo-helpers');
    vi.spyOn(lessonHelpers, 'grpcFirstCallCleanup').mockResolvedValue(undefined);
    vi.spyOn(wfHelpers, 'cleanupWorkflowDemoRunUi').mockResolvedValue(undefined);
    vi.spyOn(wfHelpers, 'closeWfConfigModalIfOpen').mockResolvedValue(undefined);
    const deleteSpy = vi.spyOn(adapters, 'deleteWorkflowByName').mockImplementation(() => undefined);
    grpcWRSession.runCompleted = true;
    await grpcWorkflowRunnerCleanup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(WF14_NAME);
    expect(grpcWRSession.runCompleted).toBe(false);
  });

  it('ensureChainConnected resolves node ids via closest react-flow parent', () => {
    document.body.innerHTML = `
      <div class="react-flow__node-start" data-id="start-1"><span class="label"></span></div>
      <div class="react-flow__node react-flow__node-grpcUnary" data-id="grpc14-echo">
        <div data-testid="grpc-canvas-unary-node"><span class="label"></span></div>
      </div>
      <div class="react-flow__node react-flow__node-grpcAssert" data-id="grpc14-assert">
        <div data-testid="grpc-canvas-assert-node"></div>
      </div>
      <div class="react-flow__node-end" data-id="end-1"></div>
    `;
    const connectSpy = vi.spyOn(adapters, 'connectWorkflowNodes').mockImplementation(() => undefined);
    ensureChainConnected();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('ensureChainConnected no-ops when canvas nodes are missing', () => {
    const connectSpy = vi.spyOn(adapters, 'connectWorkflowNodes').mockImplementation(() => undefined);
    ensureChainConnected();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('selectGrpcEchoWorkflow uses prefix match when exact name is absent', async () => {
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel">
        <div class="wfp-dropdown-item">${WF14_NAME} (archived)</div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const item = document.querySelector<HTMLElement>('.wfp-dropdown-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGrpcEchoWorkflow(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureWorkflowSeededForRunner seeds when workflow is missing', async () => {
    const ctx = makeCtx();
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue(null);
    const seedSpy = vi.spyOn(adapters, 'seedNamedWorkflow').mockResolvedValue(true);
    await ensureWorkflowSeededForRunner(ctx);
    expect(seedSpy).toHaveBeenCalled();
  });

  it('ensureGrpcWRNodesPresent seeds when grpc nodes are missing from canvas', async () => {
    document.body.innerHTML = '<div class="wf-canvas-area"></div>';
    const ctx = makeCtx();
    const seedSpy = vi.spyOn(adapters, 'seedNamedWorkflow').mockResolvedValue(true);
    await ensureGrpcWRNodesPresent(ctx);
    expect(seedSpy).toHaveBeenCalled();
  });

  it('ensureRunnerReady navigates to workflow-runner when picker is absent', async () => {
    const ctx = makeCtx();
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue({ name: WF14_NAME });
    vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(true);
    await ensureRunnerReady(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
    expect(grpcWRSession.workflowSelected).toBe(true);
    expect(grpcWRSession.configApplied).toBe(true);
  });

  it('openResultsFromCompletionBanner runs workflow when completion banner is missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel"><div class="wfp-dropdown-item">${WF14_NAME}</div></div>
    `;
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue({ name: WF14_NAME });
    vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'selectAndRunRunnerWorkflow').mockImplementation(() => {
      if (!document.querySelector('.completion-section')) {
        const completion = document.createElement('div');
        completion.className = 'completion-section';
        completion.scrollIntoView = vi.fn();
        const link = document.createElement('button');
        link.className = 'btn-primary';
        link.textContent = 'View Full Results';
        completion.appendChild(link);
        document.body.appendChild(completion);
      }
      return true;
    });
    await openResultsFromCompletionBanner(ctx);
    expect(grpcWRSession.runCompleted).toBe(true);
  });

  it('tourResultsExplorerPanels opens explorer and rings diagram when present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button title="Explore execution results" data-testid="results-explorer-open-btn">Explorer</button>
      <div data-testid="results-explorer-diagram"></div>
      <div class="results-explorer-detail"></div>
      <div class="iteration-matrix"></div>
      <button data-testid="results-explorer-fit-view-btn">Fit</button>
    `;
    vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(true);
    await tourResultsExplorerPanels(ctx);
    expect(document.querySelector('[data-testid="results-explorer-diagram"]')).toBeTruthy();
  });

  it('ensureOnResultsTab navigates to results when run already completed', async () => {
    const ctx = makeCtx();
    grpcWRSession.runCompleted = true;
    await ensureOnResultsTab(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('ensureOnResultsTab orchestrates runner flow when results are not open yet', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel"><div class="wfp-dropdown-item">${WF14_NAME}</div></div>
      <a data-testid="view-results-btn">View</a>
    `;
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue({ name: WF14_NAME });
    vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'selectAndRunRunnerWorkflow').mockReturnValue(true);
    let delayCalls = 0;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      delayCalls += 1;
      if (delayCalls === 4) {
        const completion = document.createElement('div');
        completion.className = 'completion-section';
        completion.scrollIntoView = vi.fn();
        document.body.appendChild(completion);
      }
      if (delayCalls === 8) {
        document.body.insertAdjacentHTML('beforeend', '<div class="results-run-filter-tabs"></div>');
      }
    });
    await ensureOnResultsTab(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('openResultsOverviewTab clicks Overview when tab is inactive', async () => {
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <button class="results-view-tab">Overview</button>
    `;
    const ctx = makeCtx();
    const tab = document.querySelector<HTMLElement>('.results-view-tab')!;
    const tabSpy = vi.spyOn(tab, 'click');
    await openResultsOverviewTab(ctx);
    expect(tabSpy).toHaveBeenCalled();
  });

  it('ensureFullResultsMetricsCards polls until metrics hydrate', async () => {
    const ctx = makeCtx();
    let polls = 0;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      polls += 1;
      if (polls === 2) {
        document.body.innerHTML = `
          <div data-testid="results-metrics-cards">
            <div class="metrics-row"></div>
            <div class="metrics-row"></div>
            <div class="metric-label">TPS</div>
            ${Array.from({ length: 10 }, (_, i) => `<div class="metric-value">${i + 1}</div>`).join('')}
          </div>
        `;
      }
    });
    await ensureFullResultsMetricsCards(ctx);
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it('scrollResultsMetricsCardsIntoView returns early when metrics cards are absent', async () => {
    const ctx = makeCtx();
    const pauseSpy = vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll');
    await scrollResultsMetricsCardsIntoView(ctx);
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('scrollResultsMetricsLatencyRowIntoView returns early when latency row is absent', async () => {
    const ctx = makeCtx();
    const pauseSpy = vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll');
    await scrollResultsMetricsLatencyRowIntoView(ctx);
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('scrollResultsMetricsLatencyRowIntoView scrolls latency row below sticky header', async () => {
    const ctx = makeCtx();
    const latencyRow = document.createElement('div');
    latencyRow.setAttribute('data-testid', 'results-metrics-latency-row');
    const scrollParent = document.createElement('div');
    scrollParent.style.overflow = 'auto';
    scrollParent.style.height = '200px';
    scrollParent.appendChild(latencyRow);
    const stickyTop = document.createElement('div');
    stickyTop.className = 'results-top';
    document.body.append(scrollParent, stickyTop);

    const pauseSpy = vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll').mockImplementation(() => undefined);
    vi.spyOn(demoSpotlightUtils, 'findScrollableParent').mockReturnValue(scrollParent);
    latencyRow.getBoundingClientRect = () =>
      ({ top: 80, left: 0, width: 100, height: 90, right: 100, bottom: 170, x: 0, y: 0, toJSON: () => '{}' }) as DOMRect;
    scrollParent.getBoundingClientRect = () =>
      ({ top: 0, left: 0, width: 100, height: 200, right: 100, bottom: 200, x: 0, y: 0, toJSON: () => '{}' }) as DOMRect;
    stickyTop.getBoundingClientRect = () =>
      ({ top: 0, left: 0, width: 100, height: 48, right: 100, bottom: 48, x: 0, y: 0, toJSON: () => '{}' }) as DOMRect;
    scrollParent.scrollTo = vi.fn();
    Object.defineProperty(scrollParent, 'scrollTop', { value: 200, writable: true });

    await scrollResultsMetricsLatencyRowIntoView(ctx);
    expect(pauseSpy).toHaveBeenCalledWith(4000);
    expect(scrollParent.scrollTo).toHaveBeenCalledWith({
      top: Math.max(0, 80 - 0 + 200 - 48 - 16),
      behavior: 'instant',
    });
  });

  it('scrollResultsStickyAwareIntoView falls back to scrollIntoView without scroll parent', async () => {
    const ctx = makeCtx();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll').mockImplementation(() => undefined);
    vi.spyOn(demoSpotlightUtils, 'findScrollableParent').mockReturnValue(null);
    await scrollResultsStickyAwareIntoView(ctx, el);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'instant',
      block: 'start',
      inline: 'nearest',
    });
    expect(ctx.delay).toHaveBeenCalledWith(120);
  });

  it('openAndFitResultsExplorer skips explorer button when diagram already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="results-explorer-diagram"></div>`;
    vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(true);
    const explorerBtn = document.createElement('button');
    explorerBtn.title = 'Explore execution results';
    const clickSpy = vi.spyOn(explorerBtn, 'click');
    document.body.appendChild(explorerBtn);
    await openAndFitResultsExplorer(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('closeResultsExplorerIfOpen clicks explicit modal close button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="results-explorer-diagram"></div>
      <button data-testid="results-explorer-close-btn">Close</button>
    `;
    const closeBtn = document.querySelector<HTMLElement>('[data-testid="results-explorer-close-btn"]')!;
    const clickSpy = vi.spyOn(closeBtn, 'click');
    await closeResultsExplorerIfOpen(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('closeResultsExplorerIfOpen finds Close button by label inside explorer footer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="results-explorer-diagram"></div>
      <div class="results-explorer-footer">
        <button>Close</button>
      </div>
    `;
    const closeBtn = document.querySelector<HTMLButtonElement>('.results-explorer-footer button')!;
    Object.defineProperty(closeBtn, 'offsetParent', { value: document.body, configurable: true });
    const clickSpy = vi.spyOn(closeBtn, 'click');
    await closeResultsExplorerIfOpen(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('grpcWorkflowRunnerSetup skips delete when workflow does not exist', async () => {
    const ctx = makeCtx();
    const wfHelpers = await import('../wf-demo-helpers');
    vi.spyOn(wfHelpers, 'cleanupWorkflowDemoRunUi').mockResolvedValue(undefined);
    vi.spyOn(wfHelpers, 'closeWfConfigModalIfOpen').mockResolvedValue(undefined);
    vi.spyOn(wfHelpers, 'expandWfDemoAppSidebar').mockResolvedValue(undefined);
    vi.spyOn(adapters, 'getWorkflowByName').mockReturnValue(null);
    const deleteSpy = vi.spyOn(adapters, 'deleteWorkflowByName').mockImplementation(() => undefined);
    await grpcWorkflowRunnerSetup(ctx);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(grpcWRSession.sidebarCollapsed).toBe(false);
  });
});
