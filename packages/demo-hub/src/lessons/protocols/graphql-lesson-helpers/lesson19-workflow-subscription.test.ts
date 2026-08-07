/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../../test-utils/workflowBridgeStubs';
import { GQL, WF } from '@shared/selectors';
import {
  LESSON19_WF_NAME,
  LESSON19_NODE_SUB,
  LESSON19_FINAL_STATUS_VAR,
  LESSON19_STOP_AFTER_SECS,
  LESSON19_STOP_AFTER_MESSAGES,
  resetGqlLesson19SessionFlags,
  createGqlOrderFlowDemoWorkflow,
  gqlWorkflowSubscriptionLessonSetup,
  gqlWorkflowSubscriptionLessonCleanup,
  ensureLesson19WorkflowLoaded,
  ensureLesson19SubscriptionConfigured,
  ensureLesson19SubscriptionTimeout,
  ensureLesson19SubscriptionCorrelation,
  ensureLesson19SubscriptionOutputBound,
  ensureLesson19QuickTestRun,
  performLesson19QuickTestRun,
  performLesson19SubscriptionConfigured,
  performLesson19SubscriptionVariables,
  performLesson19SubscriptionTimeout,
  performLesson19SubscriptionCorrelation,
  performLesson19SubscriptionOutputBound,
  prepareLesson19CreateOrderSpotlight,
  prepareLesson19SubscriptionSpotlight,
  prepareLesson19VariablesSpotlight,
  prepareLesson19StopTimeoutSpotlight,
  prepareLesson19StopMessagesSpotlight,
  prepareLesson19OutputSpotlight,
  prepareLesson19QuickTestSpotlight,
  prepareLesson19SummarySpotlight,
  performLesson19CreateOrderTour,
  selectGqlOrderFlowDemoWorkflow,
  isLesson19CreateNodeReady,
  isLesson19SubOperationReady,
  isLesson19SubVariablesReady,
  isLesson19SubQueryReady,
  isLesson19SubNodeReady,
  isLesson19AssertNodeReady,
  LESSON19_SUBSCRIPTION_VARS,
} from './lesson19-workflow-subscription';
import {
  getWfConfigDemoTiming,
  setWfConfigDemoTiming,
  WF_CONFIG_DEMO_TIMING_BRISK,
} from '../../wf-demo-helpers';

function seedLesson19WorkflowBridge(overrides?: Partial<Record<string, unknown>>): void {
  const wf = createGqlOrderFlowDemoWorkflow();
  if (overrides) Object.assign(wf, overrides);
  (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
    name === LESSON19_WF_NAME ? wf : null;
}

function fieldValue(selector: string): string {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  return el?.value ?? '';
}

function buildSubscriptionPanelDom(withStop = false, withOutput = false, activeTab = 'Subscription'): string {
  const tabs = ['Subscription', 'Stop', 'Output'].map((label) =>
    `<button class="gql-wf-subtab${label === activeTab ? ' active' : ''}">${label}</button>`,
  ).join('');
  return `
    <div class="wf-canvas-area"></div>
    <div class="wf-sidebar-item">${LESSON19_WF_NAME}</div>
    <button title="Fit view"></button>
    <div class="wf-config-modal">
    <div data-testid="gql-wf-subscription-panel">
      ${tabs}
      <input data-testid="gql-wf-endpoint-input" />
      <textarea data-testid="gql-wf-subscription-query-editor"></textarea>
      <textarea data-testid="gql-wf-sub-variables-editor"></textarea>
      <input data-testid="gql-wf-stop-secs-input" type="number" value="${withStop ? LESSON19_STOP_AFTER_SECS : ''}" />
      <input data-testid="gql-wf-stop-messages-input" type="number" value="${withStop ? LESSON19_STOP_AFTER_MESSAGES : ''}" />
      <div data-testid="gql-wf-output-table">
        ${withOutput ? '<select data-testid="gql-wf-output-field-select"></select>' : ''}
        <button data-testid="gql-wf-output-add-btn">+ Add</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
      </div>
      <div class="wf-config-modal-footer-actions">
        <button class="btn-ghost">Close</button>
        <button class="btn-primary">Save</button>
      </div>
    </div>
    </div>
  `;
}

describe('lesson19-workflow-subscription helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson19SessionFlags();
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    setWfConfigDemoTiming(null);
  });

  it('createGqlOrderFlowDemoWorkflow seeds mutation, subscription shell, and assert', () => {
    const wf = createGqlOrderFlowDemoWorkflow();
    expect(wf.name).toBe(LESSON19_WF_NAME);
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    expect(nodes.find((n) => n.id === LESSON19_NODE_SUB)?.data.subscriptionQuery).toBe('');
    expect(isLesson19AssertNodeReady()).toBe(false);
    seedLesson19WorkflowBridge();
    expect(isLesson19CreateNodeReady()).toBe(true);
  });

  it('readiness helpers reflect configured subscription node state', () => {
    seedLesson19WorkflowBridge();
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    sub.data.variables = '{ "orderId": {{orderId}} }';
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    sub.data.stopAfterMessages = Number(LESSON19_STOP_AFTER_MESSAGES);
    sub.data.outputBindings = [{ field: 'lastMessage', variableName: LESSON19_FINAL_STATUS_VAR, enabled: true }];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    expect(isLesson19SubQueryReady()).toBe(true);
    expect(isLesson19SubNodeReady()).toBe(true);
    expect(isLesson19AssertNodeReady()).toBe(true);
  });

  it('seeded subscription starts without Variables correlation', () => {
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    expect(sub.data.variables).toBe('{}');
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    expect(isLesson19SubQueryReady()).toBe(false);
  });

  it('selectGqlOrderFlowDemoWorkflow skips click when no sidebar match', async () => {
    document.body.innerHTML = '<div class="wf-sidebar-item">Unrelated</div>';
    const ctx = makeCtx();
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGqlOrderFlowDemoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson19WorkflowLoaded short-circuits when canvas already loaded', async () => {
    document.body.innerHTML = '<div class="wf-canvas-area"></div>';
    const ctx = makeCtx();
    await selectGqlOrderFlowDemoWorkflow(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson19WorkflowLoaded(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('prepareLesson19SubscriptionSpotlight reuses open modal without bridge call', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom();
    const openSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson19SubscriptionSpotlight(ctx);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('prepareLesson19StopTimeoutSpotlight opens modal when absent', async () => {
    document.body.innerHTML = buildWorkflowShellDom();
    const openSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await selectGqlOrderFlowDemoWorkflow(ctx);
    await prepareLesson19StopTimeoutSpotlight(ctx);
    expect(openSpy).toHaveBeenCalledWith(LESSON19_NODE_SUB);
  });

  it('setup enables brisk config timing', async () => {
    stubWorkflowSeedBridge(LESSON19_WF_NAME);
    document.body.innerHTML = buildWorkflowShellDom();
    const ctx = makeCtx();
    await gqlWorkflowSubscriptionLessonSetup(ctx);
    expect(getWfConfigDemoTiming()).toEqual(WF_CONFIG_DEMO_TIMING_BRISK);
    await gqlWorkflowSubscriptionLessonCleanup(ctx);
    expect(getWfConfigDemoTiming()).not.toEqual(WF_CONFIG_DEMO_TIMING_BRISK);
  });

  it('performLesson19CreateOrderTour walks mutation tabs then closes', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item">${LESSON19_WF_NAME}</div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-mutation-panel">
          <button class="gql-wf-subtab active">Operation</button>
          <button class="gql-wf-subtab">Variables</button>
          <button class="gql-wf-subtab">Extraction</button>
          <input data-testid="gql-wf-endpoint-input" />
          <textarea data-testid="gql-wf-query-editor"></textarea>
          <textarea data-testid="gql-wf-variables-editor"></textarea>
          <input data-testid="gql-wf-extraction-jsonpath" />
          <input data-testid="gql-wf-extraction-varname" />
          <div class="wf-config-modal-footer-actions">
            <button class="btn-ghost">Close</button>
          </div>
        </div>
      </div>
    `;
    document.querySelector('.btn-ghost')?.addEventListener('click', () => {
      document.querySelector('.wf-config-modal')?.remove();
    });
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson19CreateOrderSpotlight(ctx);
    await performLesson19CreateOrderTour(ctx);
    expect(document.querySelector('.wf-config-modal')).toBeNull();
  });

  it('performLesson19SubscriptionConfigured fills endpoint and query only', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom();
    const openSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionConfigured(ctx);
    expect(openSpy).not.toHaveBeenCalled();
    expect(fieldValue(GQL.WF_SUBSCRIPTION_QUERY_EDITOR).length).toBeGreaterThan(0);
    expect(fieldValue(GQL.WF_SUB_VARIABLES_EDITOR)).toBe('');
    // Keeps modal open for the next Watch config beats.
    expect(document.querySelector(GQL.WF_SUBSCRIPTION_PANEL)).toBeTruthy();
  });

  it('performLesson19SubscriptionVariables fills correlation JSON', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionVariables(ctx);
    expect(fieldValue(GQL.WF_SUB_VARIABLES_EDITOR)).toBe(LESSON19_SUBSCRIPTION_VARS);
  });

  it('prepareLesson19VariablesSpotlight opens subscription panel', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom();
    const openSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareLesson19VariablesSpotlight(ctx);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('performLesson19SubscriptionTimeout fills stop seconds on Stop tab', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom(false, false, 'Stop');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionTimeout(ctx);
    expect(fieldValue(GQL.WF_STOP_SECS_INPUT)).toBe(LESSON19_STOP_AFTER_SECS);
  });

  it('performLesson19SubscriptionCorrelation fills stop messages', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom(true, false, 'Stop');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionCorrelation(ctx);
    expect(fieldValue(GQL.WF_STOP_MESSAGES_INPUT)).toBe(LESSON19_STOP_AFTER_MESSAGES);
  });

  it('performLesson19SubscriptionOutputBound adds output binding row when missing', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom(true, false, 'Output');
    document.querySelectorAll(GQL.WF_OUTPUT_FIELD_SELECT).forEach((el) => el.remove());
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionOutputBound(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.WF_OUTPUT_ADD_BTN);
    expect(fieldValue(GQL.WF_OUTPUT_VARNAME)).toBe(LESSON19_FINAL_STATUS_VAR);
  });

  it('ensureLesson19SubscriptionConfigured skips when operation already ready', async () => {
    seedLesson19WorkflowBridge();
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    document.body.innerHTML = buildSubscriptionPanelDom();
    const ctx = makeCtx();
    await performLesson19SubscriptionConfigured(ctx);
    expect(isLesson19SubOperationReady()).toBe(true);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson19SubscriptionConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson19SubscriptionTimeout skips when stopAfterMs already set', async () => {
    seedLesson19WorkflowBridge();
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    sub.data.variables = LESSON19_SUBSCRIPTION_VARS;
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    document.body.innerHTML = buildSubscriptionPanelDom(true);
    const ctx = makeCtx();
    await performLesson19SubscriptionConfigured(ctx);
    await performLesson19SubscriptionVariables(ctx);
    await performLesson19SubscriptionTimeout(ctx);
    expect(isLesson19SubVariablesReady()).toBe(true);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson19SubscriptionTimeout(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson19QuickTestRun skips when prior quick test passed', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-console-panel"></div>
      <div data-testid="exec-summary"></div>
      <div class="wf-exec-strip-pass"></div>
      <button class="wf-quick-test-btn"></button>
    `;
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    sub.data.variables = LESSON19_SUBSCRIPTION_VARS;
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    sub.data.stopAfterMessages = 3;
    sub.data.outputBindings = [{ field: 'lastMessage', variableName: LESSON19_FINAL_STATUS_VAR, enabled: true }];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON19_WF_NAME ? wf : null;
    const ctx = makeCtx();
    await performLesson19QuickTestRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson19QuickTestRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('prepareLesson19QuickTestSpotlight opens console and closes config modal', async () => {
    document.body.innerHTML = `
      ${buildWorkflowShellDom()}
      <div class="wf-config-modal"><div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button></div></div>
      <div class="wf-console-badge"></div>
    `;
    document.querySelector('.btn-ghost')?.addEventListener('click', () => {
      document.querySelector('.wf-config-modal')?.remove();
    });
    document.querySelector('.wf-console-badge')?.addEventListener('click', () => {
      if (!document.querySelector('.wf-console-panel')) {
        document.body.insertAdjacentHTML('beforeend', '<div class="wf-console-panel"></div>');
      }
    });
    const ctx = makeCtx();
    await selectGqlOrderFlowDemoWorkflow(ctx);
    await prepareLesson19QuickTestSpotlight(ctx);
    expect(document.querySelector('.wf-config-modal')).toBeNull();
    expect(document.querySelector('.wf-console-panel')).not.toBeNull();
  });

  it('prepareLesson19SummarySpotlight closes console when open', async () => {
    document.body.innerHTML = `
      ${buildWorkflowShellDom()}
      <div class="wf-console-panel"></div>
      <div class="wf-console-badge"></div>
    `;
    document.querySelector('.wf-console-badge')?.addEventListener('click', () => {
      document.querySelector('.wf-console-panel')?.remove();
    });
    const ctx = makeCtx();
    await selectGqlOrderFlowDemoWorkflow(ctx);
    await prepareLesson19SummarySpotlight(ctx);
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

  it('prepareLesson19StopMessagesSpotlight switches to Stop tab', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom(true, false, 'Subscription');
    wireSubtabClicks();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await selectGqlOrderFlowDemoWorkflow(ctx);
    await prepareLesson19StopMessagesSpotlight(ctx);
    expect(document.querySelector('.gql-wf-subtab.active')?.textContent).toContain('Stop');
  });

  it('prepareLesson19OutputSpotlight switches to Output tab', async () => {
    document.body.innerHTML = buildSubscriptionPanelDom(true, false, 'Stop');
    wireSubtabClicks();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await selectGqlOrderFlowDemoWorkflow(ctx);
    await prepareLesson19OutputSpotlight(ctx);
    expect(document.querySelector('.gql-wf-subtab.active')?.textContent).toContain('Output');
  });

  it('ensureLesson19SubscriptionCorrelation skips when messages already configured', async () => {
    seedLesson19WorkflowBridge();
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    sub.data.variables = LESSON19_SUBSCRIPTION_VARS;
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    sub.data.stopAfterMessages = Number(LESSON19_STOP_AFTER_MESSAGES);
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    document.body.innerHTML = buildSubscriptionPanelDom(true);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionConfigured(ctx);
    await performLesson19SubscriptionVariables(ctx);
    await performLesson19SubscriptionTimeout(ctx);
    await performLesson19SubscriptionCorrelation(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson19SubscriptionCorrelation(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson19SubscriptionOutputBound skips when node fully ready', async () => {
    seedLesson19WorkflowBridge();
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    sub.data.variables = LESSON19_SUBSCRIPTION_VARS;
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    sub.data.stopAfterMessages = Number(LESSON19_STOP_AFTER_MESSAGES);
    sub.data.outputBindings = [{ field: 'lastMessage', variableName: LESSON19_FINAL_STATUS_VAR, enabled: true }];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    document.body.innerHTML = buildSubscriptionPanelDom(true, true, 'Output');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await performLesson19SubscriptionConfigured(ctx);
    await performLesson19SubscriptionVariables(ctx);
    await performLesson19SubscriptionTimeout(ctx);
    await performLesson19SubscriptionCorrelation(ctx);
    await performLesson19SubscriptionOutputBound(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson19SubscriptionOutputBound(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson19QuickTestRun runs when pass strip not visible', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-console-panel"></div>
      <div class="wf-console-badge"></div>
      <div data-testid="exec-summary"></div>
      <button class="wf-quick-test-btn"></button>
    `;
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = 'subscription { orderStatus { status } }';
    sub.data.variables = LESSON19_SUBSCRIPTION_VARS;
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    sub.data.stopAfterMessages = 3;
    sub.data.outputBindings = [{ field: 'lastMessage', variableName: LESSON19_FINAL_STATUS_VAR, enabled: true }];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON19_WF_NAME ? wf : null;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await selectGqlOrderFlowDemoWorkflow(ctx);
    await performLesson19SubscriptionConfigured(ctx);
    await performLesson19SubscriptionVariables(ctx);
    await performLesson19SubscriptionTimeout(ctx);
    await performLesson19SubscriptionCorrelation(ctx);
    await performLesson19SubscriptionOutputBound(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson19QuickTestRun(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gqlWorkflowSubscriptionLessonSetup inserts workflow via bridge', async () => {
    const { deleteByName: deleteSpy, insertWorkflow: insertSpy } = stubWorkflowSeedBridge(LESSON19_WF_NAME);
    document.body.innerHTML = buildWorkflowShellDom();
    const ctx = makeCtx();
    await gqlWorkflowSubscriptionLessonSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON19_WF_NAME);
    expect(insertSpy).toHaveBeenCalled();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('gqlWorkflowSubscriptionLessonCleanup deletes workflow and resets flags', async () => {
    const { deleteByName: deleteSpy } = stubWorkflowSeedBridge(LESSON19_WF_NAME);
    document.body.innerHTML = buildWorkflowShellDom();
    const ctx = makeCtx();
    await gqlWorkflowSubscriptionLessonCleanup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON19_WF_NAME);
  });

  it('dismissWorkflowOnboarding clicks skip when tooltip present', async () => {
    stubWorkflowSeedBridge(LESSON19_WF_NAME);
    document.body.innerHTML = `
      ${buildWorkflowShellDom()}
      <button class="onboarding-tooltip-skip">Skip</button>
    `;
    const skip = document.querySelector<HTMLElement>('.onboarding-tooltip-skip')!;
    const clickSpy = vi.spyOn(skip, 'click');
    const ctx = makeCtx();
    await gqlWorkflowSubscriptionLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});

function wireSubtabClicks(): void {
  document.querySelectorAll<HTMLElement>('.gql-wf-subtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.gql-wf-subtab').forEach((b) => b.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function buildWorkflowShellDom(): string {
  return `
    <div class="wf-canvas-area">
      <div class="react-flow__node" data-id="${LESSON19_NODE_SUB}">
        <div data-testid="gql-canvas-subscription-node">Watch Order Status</div>
      </div>
    </div>
    <div class="wf-sidebar-item">${LESSON19_WF_NAME}</div>
    <button title="Fit view"></button>
  `;
}
