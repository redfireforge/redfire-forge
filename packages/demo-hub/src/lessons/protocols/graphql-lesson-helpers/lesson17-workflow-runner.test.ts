/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import {
  LESSON17_WF_NAME,
  resetGqlLesson17SessionFlags,
  gqlWorkflowRunnerLessonSetup,
  ensureLesson17WorkflowSelected,
  ensureLesson17ResultsOpen,
  selectGqlLatencyDemoWorkflow,
  selectLesson17ResultsExplorerIteration,
  showLesson17ResultsExplorerConsole,
  scrollLesson17MetricsCardsIntoView,
  tourLesson17MetricsCards,
  tourLesson17ResultsExplorer,
} from './lesson17-workflow-runner';
import * as gqlDemoSpotlight from './gql-demo-spotlight';
import * as demoSpotlightUtils from '../../../demoSpotlightUtils';
import { REX } from '@shared/selectors/rex';
import { RES } from '@shared/selectors/res';

describe('lesson17-workflow-runner helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson17SessionFlags();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
  });

  it('selectGqlLatencyDemoWorkflow skips click when dropdown has no match', async () => {
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel">
        <div class="wfp-dropdown-item">Other Workflow</div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const item = document.querySelector<HTMLElement>('.wfp-dropdown-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson17WorkflowSelected skips when vars section already visible', async () => {
    document.body.innerHTML = '<div class="workflow-vars-section"></div>';
    const ctx = makeCtx();
    await ensureLesson17WorkflowSelected(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson17WorkflowSelected(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('ensureLesson17ResultsOpen navigates to results when no view button', async () => {
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
      <div class="config-form"><div class="form-actions"><button class="btn-primary"></button></div></div>
    `;
    const ctx = makeCtx();
    await ensureLesson17ResultsOpen(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('ensureLesson17ResultsOpen skips when filter tabs already visible', async () => {
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
      <div class="results-run-filter-tabs"></div>
      <div class="config-form"><div class="form-actions"><button class="btn-primary"></button></div></div>
    `;
    const ctx = makeCtx();
    await ensureLesson17ResultsOpen(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson17ResultsOpen(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('gqlWorkflowRunnerLessonSetup runs without workflow bridges', async () => {
    const ctx = makeCtx();
    const adapters = await import('../../../adapters');
    const seedSpy = vi.spyOn(adapters, 'seedNamedWorkflow').mockResolvedValue(false);
    const runnerBridgeSpy = vi.spyOn(adapters, 'waitForRunnerBridge').mockResolvedValue(false);
    document.body.innerHTML = '<div data-testid="workflow-select"></div>';
    try {
      await gqlWorkflowRunnerLessonSetup(ctx);
      expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
    } finally {
      seedSpy.mockRestore();
      runnerBridgeSpy.mockRestore();
    }
  });

  it('selectGqlLatencyDemoWorkflow picks exact name match over prefix copy', async () => {
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel">
        <div class="wfp-dropdown-item">${LESSON17_WF_NAME} (2)</div>
        <div class="wfp-dropdown-item">${LESSON17_WF_NAME}</div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const items = document.querySelectorAll<HTMLElement>('.wfp-dropdown-item');
    const exactSpy = vi.spyOn(items[1], 'click');
    const copySpy = vi.spyOn(items[0], 'click');
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(exactSpy).toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
  });

  it('selectLesson17ResultsExplorerIteration opens picker and selects iteration item', async () => {
    document.body.innerHTML = `
      <button class="iter-picker-toggle aggregate" data-testid="iter-picker-toggle">Aggregate</button>
      <div data-testid="iter-picker-dropdown">
        <button data-testid="iter-picker-item-0">#1</button>
      </div>
    `;
    const ctx = makeCtx();
    const toggle = document.querySelector<HTMLElement>('[data-testid="iter-picker-toggle"]')!;
    toggle.addEventListener('click', () => {
      /* dropdown already in DOM for test */
    });
    const item = document.querySelector<HTMLElement>('[data-testid="iter-picker-item-0"]')!;
    const itemSpy = vi.spyOn(item, 'click');
    await selectLesson17ResultsExplorerIteration(ctx, 0);
    expect(itemSpy).toHaveBeenCalled();
  });

  it('scrollLesson17MetricsCardsIntoView pins cards below sticky results header', async () => {
    document.body.innerHTML = `
      <div class="results-top" style="height: 48px"></div>
      <div class="results-scroll" style="height: 200px; overflow: auto">
        <div data-testid="results-metrics-cards" class="metrics-cards">
          <div class="metrics-row"></div>
          <div class="metrics-row" data-testid="results-metrics-latency-row"></div>
        </div>
      </div>
    `;
    const scrollParent = document.querySelector<HTMLElement>('.results-scroll')!;
    Object.defineProperty(scrollParent, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scrollParent, 'clientHeight', { value: 200, configurable: true });
    scrollParent.scrollTo = vi.fn();
    const pauseSpy = vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll').mockImplementation(() => undefined);
    vi.spyOn(demoSpotlightUtils, 'findScrollableParent').mockReturnValue(scrollParent);
    const ctx = makeCtx();
    try {
      await scrollLesson17MetricsCardsIntoView(ctx);
      expect(pauseSpy).toHaveBeenCalled();
      expect(scrollParent.scrollTo).toHaveBeenCalled();
    } finally {
      pauseSpy.mockRestore();
    }
  });

  it('tourLesson17MetricsCards spotlights cards then latency row', async () => {
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <button class="results-view-tab active">Overview</button>
      <div class="results-top"></div>
      <div data-testid="results-metrics-cards">
        <div class="metrics-row">
          <div class="metric-label">TPS</div>
          <div class="metric-value">10</div>
          <div class="metric-value">1</div>
          <div class="metric-value">2</div>
          <div class="metric-value">3</div>
          <div class="metric-value">4</div>
          <div class="metric-value">5</div>
          <div class="metric-value">6</div>
          <div class="metric-value">7</div>
        </div>
        <div class="metrics-row" data-testid="results-metrics-latency-row">
          <div class="metric-value">8</div>
          <div class="metric-value">9</div>
          <div class="metric-value">10</div>
        </div>
      </div>
    `;
    const ctx = makeCtx();
    const callOrder: string[] = [];
    const spotlightSpy = vi
      .spyOn(gqlDemoSpotlight, 'spotlightAndPause')
      .mockImplementation(async (_ctx, selector) => {
        callOrder.push(selector);
      });
    vi.spyOn(demoSpotlightUtils, 'pauseDemoAutoScroll').mockImplementation(() => undefined);
    vi.spyOn(demoSpotlightUtils, 'findScrollableParent').mockReturnValue(null);
    try {
      await tourLesson17MetricsCards(ctx);
      expect(callOrder[0]).toBe(RES.METRICS_CARDS);
      expect(callOrder).toContain(RES.METRICS_LATENCY_ROW);
    } finally {
      spotlightSpy.mockRestore();
    }
  });

  it('tourLesson17ResultsExplorer spotlights open button before opening modal', async () => {
    document.body.innerHTML = `
      <div class="results-run-filter-tabs"></div>
      <div class="results-top"></div>
      <button title="Explore execution results" data-testid="results-explorer-open-btn">📊 Results Explorer</button>
    `;
    const ctx = makeCtx();
    const explorerBtn = document.querySelector<HTMLElement>(RES.RESULTS_EXPLORER_BTN)!;
    const callOrder: string[] = [];
    const spotlightSpy = vi
      .spyOn(gqlDemoSpotlight, 'spotlightAndPause')
      .mockImplementation(async (_ctx, selector) => {
        callOrder.push(selector);
      });
    vi.spyOn(explorerBtn, 'click').mockImplementation(() => {
      callOrder.push('click');
      const wrap = document.createElement('div');
      wrap.setAttribute('data-testid', 'results-explorer-diagram');
      wrap.className = 'results-explorer-diagram';
      wrap.innerHTML = `
        <div class="react-flow__node"></div>
        <button data-testid="results-explorer-fit-view-btn" title="Fit view">Fit</button>
        <button data-testid="view-toggle-diagram" class="view-toggle-active">Diagram</button>
        <button data-testid="iter-picker-toggle" class="aggregate">Aggregate</button>
        <button data-testid="console-toggle-btn-header">Console</button>
      `;
      document.body.appendChild(wrap);
    });
    const adapters = await import('../../../adapters');
    vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(true);
    vi.spyOn(demoSpotlightUtils, 'findScrollableParent').mockReturnValue(null);
    try {
      await tourLesson17ResultsExplorer(ctx);
      expect(callOrder[0]).toBe(RES.RESULTS_EXPLORER_BTN);
      expect(callOrder.indexOf(RES.RESULTS_EXPLORER_BTN)).toBeLessThan(callOrder.indexOf('click'));
    } finally {
      spotlightSpy.mockRestore();
    }
  });

  it('fitLesson17ResultsExplorerDiagram spotlights and clicks Fit view', async () => {
    document.body.innerHTML = `
      <div data-testid="results-explorer-diagram" class="results-explorer-diagram">
        <div class="react-flow__node"></div>
        <button data-testid="results-explorer-fit-view-btn" title="Fit view">Fit</button>
      </div>
    `;
    const ctx = makeCtx();
    const fitBtn = document.querySelector<HTMLElement>(REX.FIT_VIEW_BTN)!;
    const clickSpy = vi.spyOn(fitBtn, 'click');
    const callOrder: string[] = [];
    const spotlightSpy = vi
      .spyOn(gqlDemoSpotlight, 'spotlightAndPause')
      .mockImplementation(async () => {
        callOrder.push('spotlight');
      });
    clickSpy.mockImplementation(() => {
      callOrder.push('click');
    });
    const adapters = await import('../../../adapters');
    const bridgeSpy = vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    const fitBridgeSpy = vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(true);
    const { fitLesson17ResultsExplorerDiagram } = await import('./lesson17-workflow-runner');
    try {
      await fitLesson17ResultsExplorerDiagram(ctx);
      expect(spotlightSpy).toHaveBeenCalledWith(ctx, REX.FIT_VIEW_BTN, 1200);
      expect(clickSpy).toHaveBeenCalled();
      expect(callOrder.indexOf('spotlight')).toBeLessThan(callOrder.indexOf('click'));
      expect(fitBridgeSpy).toHaveBeenCalled();
    } finally {
      spotlightSpy.mockRestore();
      bridgeSpy.mockRestore();
      fitBridgeSpy.mockRestore();
    }
  });

  it('showLesson17ResultsExplorerConsole spotlights Console before opening it', async () => {
    document.body.innerHTML = `
      <button data-testid="view-toggle-diagram" class="view-toggle-active">Diagram</button>
      <button data-testid="iter-picker-toggle" class="aggregate">Aggregate</button>
      <button data-testid="console-toggle-btn-header">🖥 Console</button>
      <div data-testid="results-explorer-diagram">
        <div class="react-flow__node"></div>
        <button data-testid="results-explorer-fit-view-btn">Fit</button>
      </div>
    `;
    const ctx = makeCtx();
    const consoleBtn = document.querySelector<HTMLElement>(REX.CONSOLE_TOGGLE)!;
    const clickSpy = vi.spyOn(consoleBtn, 'click');
    const callOrder: string[] = [];
    const spotlightSpy = vi
      .spyOn(gqlDemoSpotlight, 'spotlightAndPause')
      .mockImplementation(async () => {
        callOrder.push('spotlight');
      });
    clickSpy.mockImplementation(() => {
      callOrder.push('click');
      consoleBtn.classList.add('view-toggle-active');
      const body = document.createElement('div');
      body.setAttribute('data-testid', 'results-console-body');
      body.innerHTML = '<div class="re-console-line">Iteration #1 started</div>';
      document.body.appendChild(body);
    });
    const adapters = await import('../../../adapters');
    const bridgeSpy = vi.spyOn(adapters, 'waitForResultsExplorerBridge').mockResolvedValue(true);
    const fitSpy = vi.spyOn(adapters, 'fitResultsExplorerDiagram').mockReturnValue(true);
    try {
      await showLesson17ResultsExplorerConsole(ctx);
      expect(spotlightSpy).toHaveBeenCalledWith(ctx, REX.CONSOLE_TOGGLE, 1400);
      expect(clickSpy).toHaveBeenCalled();
      expect(callOrder.indexOf('spotlight')).toBeLessThan(callOrder.indexOf('click'));
    } finally {
      spotlightSpy.mockRestore();
      bridgeSpy.mockRestore();
      fitSpy.mockRestore();
    }
  });
});
