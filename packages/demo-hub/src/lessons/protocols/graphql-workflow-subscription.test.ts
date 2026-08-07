/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlWorkflowSubscriptionLesson } from './graphql-workflow-subscription';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { GQL, WF } from '@shared/selectors';
import { GQL_DEMO_HTTP } from './graphql-lesson-helpers/core';
import {
  LESSON19_WF_NAME,
  LESSON19_ORDER_ID_VAR,
  LESSON19_FINAL_STATUS_VAR,
  LESSON19_SUBSCRIPTION_QUERY,
  LESSON19_SUBSCRIPTION_VARS,
  LESSON19_STOP_AFTER_SECS,
  LESSON19_STOP_AFTER_MESSAGES,
  LESSON19_NODE_CREATE,
  LESSON19_NODE_SUB,
  resetGqlLesson19SessionFlags,
  createGqlOrderFlowDemoWorkflow,
  isLesson19SubNodeReady,
  gqlWorkflowSubscriptionLessonSetup,
  ensureLesson19WorkflowLoaded,
  ensureLesson19SubscriptionConfigured,
  ensureLesson19SubscriptionVariables,
  ensureLesson19SubscriptionCorrelation,
  ensureLesson19SubscriptionOutputBound,
  performLesson19QuickTestRun,
  prepareLesson19SubscriptionSpotlight,
  gqlWorkflowSubscriptionLessonCleanup,
} from './graphql-lesson-helpers';

describe('gql-workflow-subscription lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson19SessionFlags();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
  });

  // ── Lesson structure ──────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlWorkflowSubscriptionLesson.id).toBe('gql-workflow-subscription');
    expect(gqlWorkflowSubscriptionLesson.category).toBe('graphql');
    expect(gqlWorkflowSubscriptionLesson.name).toBe('Subscription Node in Workflow');
    expect(gqlWorkflowSubscriptionLesson.steps.length).toBe(10);
    expect(gqlWorkflowSubscriptionLesson.estimatedMinutes).toBe(5);
  });

  it('starts at workflow tab', () => {
    expect(gqlWorkflowSubscriptionLesson.initialTab).toBe('workflow');
  });

  it('has correct step IDs in order', () => {
    expect(gqlWorkflowSubscriptionLesson.steps.map((s) => s.id)).toEqual([
      'gql19-intro',
      'gql19-create-order',
      'gql19-config-sub',
      'gql19-variables',
      'gql19-timeout',
      'gql19-correlation',
      'gql19-sample-payload',
      'gql19-quick-test',
      'gql19-load-behavior',
      'gql19-summary',
    ]);
  });

  it('all 10 steps have pauseAfter: true', () => {
    gqlWorkflowSubscriptionLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('uses Docker GraphQL test server', () => {
    expect(gqlWorkflowSubscriptionLesson.dockerEndpoint).toContain('4010');
    expect(gqlWorkflowSubscriptionLesson.tag).toBe('🐳 Docker');
  });

  // ── Concept ───────────────────────────────────────────────────────────────

  it('concept title frames event-driven workflow testing', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.title).toContain('Subscription');
    expect(gqlWorkflowSubscriptionLesson.concept.title).toContain('Event-Driven');
  });

  it('concept body explains WHY subscription vs polling', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.body).toContain('WebSocket');
    expect(gqlWorkflowSubscriptionLesson.concept.body).toContain('polling');
  });

  it('concept body explains WHY orderId correlation', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.body).toContain(LESSON19_ORDER_ID_VAR);
  });

  it('concept body explains WHY stop tab controls', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.body).toContain('maxWaitMs');
    expect(gqlWorkflowSubscriptionLesson.concept.body).toContain('COMPLETE');
  });

  it('concept body explains WHY lastMessage binding', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.body).toContain(LESSON19_FINAL_STATUS_VAR);
  });

  it('has 5 key terms including lastMessage binding', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.keyTerms.length).toBe(5);
    const terms = gqlWorkflowSubscriptionLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('GraphQL Subscription node');
    expect(terms).toContain('Correlation via Variables');
    expect(terms).toContain('lastMessage binding');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('concept diagram is 700x430 SVG', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram shows subscription palette and canvas nodes', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('GraphQL Subscription');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('Watch Status');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('Create Order');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('Assert Complete');
  });

  it('diagram shows Stop tab config preview', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('Stop');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('After N messages');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('PENDING');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('COMPLETE');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('Variables');
  });

  it('diagram shows Console log line', () => {
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('Console');
    expect(gqlWorkflowSubscriptionLesson.concept.diagram).toContain('orderStatus');
  });

  // ── Step spotlights ───────────────────────────────────────────────────────

  it('gql19-intro highlights subscription palette', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-intro')!;
    expect(step.highlight).toBe(WF.PAL_GQL_SUBSCRIPTION);
  });

  it('gql19-create-order highlights mutation query and verifies mutation node', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-create-order')!;
    expect(step.highlight).toBe(GQL.WF_QUERY_EDITOR);
    expect(step.verify).toBe(GQL.WF_CANVAS_MUTATION_NODE);
  });

  it('gql19-config-sub highlights subscription query editor', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-config-sub')!;
    expect(step.highlight).toBe(GQL.WF_SUBSCRIPTION_QUERY_EDITOR);
  });

  it('gql19-config-sub preAction opens subscription tab for reading', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-config-sub')!;
    expect(step.preAction).toBe(prepareLesson19SubscriptionSpotlight);
  });

  it('gql19-variables highlights Variables editor and uses variables spotlight prep', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-variables')!;
    expect(step.highlight).toBe(GQL.WF_SUB_VARIABLES_EDITOR);
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
  });

  it('gql19-timeout preAction prepares stop tab spotlight', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-timeout')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('gql19-timeout highlights stop seconds input', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-timeout')!;
    expect(step.highlight).toBe(GQL.WF_STOP_SECS_INPUT);
  });

  it('gql19-correlation highlights stop messages input', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-correlation')!;
    expect(step.highlight).toBe(GQL.WF_STOP_MESSAGES_INPUT);
  });

  it('gql19-sample-payload highlights output add button', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-sample-payload')!;
    expect(step.highlight).toBe(GQL.WF_OUTPUT_ADD_BTN);
  });

  it('gql19-quick-test highlights Quick Test and verifies exec summary', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-quick-test')!;
    expect(step.highlight).toBe(WF.QUICK_TEST_BTN);
    expect(step.verify).toBe(WF.EXEC_SUMMARY);
  });

  it('gql19-load-behavior preAction does not run quick test', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-load-behavior')!;
    expect(step.preAction).not.toBe(performLesson19QuickTestRun);
  });

  it('gql19-summary highlights canvas', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-summary')!;
    expect(step.highlight).toBe(WF.CANVAS);
  });

  // ── Step descriptions — WHY framing ──────────────────────────────────────

  it('gql19-intro description states intention create-subscribe-assert', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-intro')!;
    expect(step.description).toContain('Intention');
    expect(step.description).toContain('consume-wait');
    expect(step.description).toContain('WebSocket');
  });

  it('gql19-create-order description walks Operation Variables Extraction', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-create-order')!;
    expect(step.description).toContain('Create Order');
    expect(step.description).toContain('Extraction');
    expect(step.description).toContain(LESSON19_ORDER_ID_VAR);
  });

  it('gql19-config-sub description focuses on endpoint and query', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-config-sub')!;
    expect(step.description).toContain('orderStatus');
    expect(step.description).toContain('Endpoint');
    expect(step.description).toContain('next step');
  });

  it('gql19-variables description teaches correlation via Variables JSON', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-variables')!;
    expect(step.description).toContain(LESSON19_ORDER_ID_VAR);
    expect(step.description).toMatch(/without quotes|no quotes/);
    expect(step.description).toContain('correlation');
  });

  it('gql19-timeout description contrasts with Kafka maxWaitMs', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-timeout')!;
    expect(step.description).toContain('maxWaitMs');
    expect(step.description).toContain(LESSON19_STOP_AFTER_SECS);
  });

  it('gql19-correlation description explains three-message progression', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-correlation')!;
    expect(step.description).toContain('PENDING');
    expect(step.description).toContain('COMPLETE');
    expect(step.description).toContain(LESSON19_STOP_AFTER_MESSAGES);
  });

  it('gql19-sample-payload description explains lastMessage binding to Assert', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-sample-payload')!;
    expect(step.description).toContain('lastMessage');
    expect(step.description).toContain(LESSON19_FINAL_STATUS_VAR);
    expect(step.description).toContain('Assert');
  });

  it('gql19-quick-test description explains three-node pass sequence', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-quick-test')!;
    expect(step.description).toContain('Quick Test');
    expect(step.description).toContain('Console');
    expect(step.description).toContain('COMPLETE');
  });

  it('gql19-load-behavior description explains per-iteration isolation', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-load-behavior')!;
    expect(step.description).toContain('concurrency');
    expect(step.description).toContain('Variables');
  });

  it('gql19-summary description recaps create-subscribe-assert pattern', () => {
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-summary')!;
    expect(step.description).toContain('Subscription');
    expect(step.description).toContain('Assert');
    expect(step.description).toContain('Variables');
  });

  // ── Action tests ──────────────────────────────────────────────────────────

  it('gql19-create-order action opens mutation config and closes it', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item">${LESSON19_WF_NAME}</div>
      <div class="wf-config-modal">
        <div data-testid="gql-wf-mutation-panel">
          <button class="gql-wf-subtab active">Operation</button>
          <button class="gql-wf-subtab">Variables</button>
          <button class="gql-wf-subtab">Extraction</button>
          <input data-testid="gql-wf-endpoint-input" value="${GQL_DEMO_HTTP}" />
          <textarea data-testid="gql-wf-query-editor">mutation</textarea>
          <textarea data-testid="gql-wf-variables-editor">{}</textarea>
          <input data-testid="gql-wf-extraction-jsonpath" value="$.createOrder.id" />
          <input data-testid="gql-wf-extraction-varname" value="orderId" />
          <div class="wf-config-modal-footer-actions">
            <button class="btn-ghost">Close</button>
          </div>
        </div>
      </div>
    `;
    document.querySelector('.btn-ghost')?.addEventListener('click', () => {
      document.querySelector('.wf-config-modal')?.remove();
    });
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-create-order')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(document.querySelector('.wf-config-modal')).toBeNull();
  });

  it('gql19-config-sub action configures subscription query only', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = buildSubscriptionPanelDom();
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-config-sub')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(fieldValue(GQL.WF_SUBSCRIPTION_QUERY_EDITOR)).toBe(LESSON19_SUBSCRIPTION_QUERY);
    expect(fieldValue(GQL.WF_SUB_VARIABLES_EDITOR)).toBe('');
  });

  it('gql19-variables action fills correlation Variables JSON', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = buildSubscriptionPanelDom();
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-variables')!;
    await step.action!(ctx);
    expect(fieldValue(GQL.WF_SUB_VARIABLES_EDITOR)).toBe(LESSON19_SUBSCRIPTION_VARS);
  });

  it('gql19-config-sub preAction uses prepareLesson19SubscriptionSpotlight', async () => {
    const ctx = makeCtx();
    const openSpy = vi.fn();
    stubNodeConfigBridge(openSpy);
    document.body.innerHTML = buildSubscriptionPanelDom();
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-config-sub')!;
    await step.preAction!(ctx);
    expect(openSpy).toHaveBeenCalledWith(LESSON19_NODE_SUB);
  });

  it('gql19-timeout action sets stop seconds', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = buildSubscriptionPanelDom(true);
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-timeout')!;
    await step.action!(ctx);
    expect(fieldValue(GQL.WF_STOP_SECS_INPUT)).toBe(LESSON19_STOP_AFTER_SECS);
  });

  it('gql19-correlation action sets stop messages count', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildSubscriptionPanelDom(true, true)}`;
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-correlation')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(fieldValue(GQL.WF_STOP_MESSAGES_INPUT)).toBe(LESSON19_STOP_AFTER_MESSAGES);
  });

  it('gql19-sample-payload action binds lastMessage output variable', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildSubscriptionPanelDom(true, true)}`;
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-sample-payload')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(fieldValue(GQL.WF_OUTPUT_VARNAME)).toBe(LESSON19_FINAL_STATUS_VAR);
  });

  it('gql19-quick-test action clicks Quick Test', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildWorkflowDom()}<div data-testid="exec-summary"></div><button class="wf-quick-test-btn"></button>`;
    const step = gqlWorkflowSubscriptionLesson.steps.find((s) => s.id === 'gql19-quick-test')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  // ── Setup / guard tests ───────────────────────────────────────────────────

  it('setup seeds workflow via __wfInsertWorkflow', async () => {
    const ctx = makeCtx();
    const { deleteByName: deleteSpy, insertWorkflow: insertSpy } = stubWorkflowSeedBridge(LESSON19_WF_NAME);
    document.body.innerHTML = buildWorkflowDom();
    await gqlWorkflowSubscriptionLessonSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON19_WF_NAME);
    expect(insertSpy).toHaveBeenCalled();
  });

  it('ensureLesson19WorkflowLoaded skips when already loaded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildWorkflowDom();
    await ensureLesson19WorkflowLoaded(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson19WorkflowLoaded(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('ensureLesson19SubscriptionConfigured opens subscription node config', async () => {
    const ctx = makeCtx();
    const openSpy = vi.fn();
    stubNodeConfigBridge(openSpy);
    document.body.innerHTML = `${buildMutationPanelDom()}${buildSubscriptionPanelDom()}`;
    await ensureLesson19SubscriptionConfigured(ctx);
    expect(openSpy).toHaveBeenCalledWith(LESSON19_NODE_SUB);
  });

  it('ensureLesson19SubscriptionOutputBound binds lastMessage to finalStatus', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildSubscriptionPanelDom(true, true)}`;
    await ensureLesson19SubscriptionOutputBound(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.WF_OUTPUT_FIELD_SELECT, 'lastMessage');
    expect(fieldValue(GQL.WF_OUTPUT_VARNAME)).toBe(LESSON19_FINAL_STATUS_VAR);
  });

  // ── Helper unit tests ─────────────────────────────────────────────────────

  it('createGqlOrderFlowDemoWorkflow has 5 nodes and order flow chain', () => {
    const wf = createGqlOrderFlowDemoWorkflow();
    expect(wf.name).toBe(LESSON19_WF_NAME);
    expect((wf.nodes as unknown[]).length).toBe(5);
    expect((wf.edges as unknown[]).length).toBe(4);
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    expect(nodes.find((n) => n.id === LESSON19_NODE_CREATE)?.type).toBe('graphqlMutation');
    expect(nodes.find((n) => n.id === LESSON19_NODE_SUB)?.type).toBe('graphqlSubscription');
    const sub = nodes.find((n) => n.id === LESSON19_NODE_SUB)!;
    expect(sub.data.endpoint).toBe(GQL_DEMO_HTTP);
    expect(sub.data.variables).toBe('{}');
    expect(sub.data.subscriptionQuery).toBe('');
    expect(isLesson19SubNodeReady()).toBe(false);
  });

  it('isLesson19SubNodeReady reads live workflow via __wfGetWorkflowByName', () => {
    const wf = createGqlOrderFlowDemoWorkflow();
    const sub = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === LESSON19_NODE_SUB)!;
    sub.data.subscriptionQuery = LESSON19_SUBSCRIPTION_QUERY;
    sub.data.variables = LESSON19_SUBSCRIPTION_VARS;
    sub.data.stopAfterMs = Number(LESSON19_STOP_AFTER_SECS) * 1000;
    sub.data.stopAfterMessages = Number(LESSON19_STOP_AFTER_MESSAGES);
    sub.data.outputBindings = [{ field: 'lastMessage', variableName: LESSON19_FINAL_STATUS_VAR, enabled: true }];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON19_WF_NAME ? wf : null;
    expect(isLesson19SubNodeReady()).toBe(true);
  });

  it('LESSON19_SUBSCRIPTION_VARS parses after orderId extraction substitute', () => {
    const extractedId = JSON.stringify('ord-152');
    const resolved = LESSON19_SUBSCRIPTION_VARS.replace(
      `{{${LESSON19_ORDER_ID_VAR}}}`,
      extractedId,
    );
    expect(JSON.parse(resolved)).toEqual({ orderId: 'ord-152' });
    expect(LESSON19_SUBSCRIPTION_VARS).not.toContain(`"{{${LESSON19_ORDER_ID_VAR}}}"`);
  });

  it('ensureLesson19SubscriptionCorrelation sets stop messages count', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildSubscriptionPanelDom(true, true)}`;
    await ensureLesson19SubscriptionCorrelation(ctx);
    expect(fieldValue(GQL.WF_STOP_MESSAGES_INPUT)).toBe(LESSON19_STOP_AFTER_MESSAGES);
  });

  it('ensureLesson19SubscriptionVariables fills correlation JSON', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = buildSubscriptionPanelDom();
    await ensureLesson19SubscriptionVariables(ctx);
    expect(fieldValue(GQL.WF_SUB_VARIABLES_EDITOR)).toBe(LESSON19_SUBSCRIPTION_VARS);
  });

  it('gqlWorkflowSubscriptionLessonCleanup deletes seeded workflow', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    await gqlWorkflowSubscriptionLessonCleanup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON19_WF_NAME);
  });
});

function stubNodeConfigBridge(openSpy = vi.fn()): void {
  (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
}

function fieldValue(selector: string): string {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  return el?.value ?? '';
}

function buildWorkflowDom(): string {
  return `
    <div class="wf-canvas-area"></div>
    <div class="wf-sidebar-item">${LESSON19_WF_NAME}</div>
    <div data-testid="gql-canvas-subscription-node"></div>
    <div data-testid="gql-canvas-mutation-node"></div>
    <button title="Fit view"></button>
  `;
}

function buildMutationPanelDom(withExtraction = false): string {
  return `
    <div data-testid="gql-wf-mutation-panel">
      <button class="wf-config-tab">Operation</button>
      <button class="wf-config-tab">Variables</button>
      <button class="wf-config-tab">Extraction</button>
      <input data-testid="gql-wf-endpoint-input" />
      <textarea data-testid="gql-wf-query-editor"></textarea>
      <textarea data-testid="gql-wf-variables-editor"></textarea>
      <div data-testid="gql-wf-extraction-table">
        ${withExtraction ? '<input data-testid="gql-wf-extraction-jsonpath" />' : ''}
        <button data-testid="gql-wf-extraction-add-btn">+ Add</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
    </div>
  `;
}

function buildSubscriptionPanelDom(withStop = false, withOutput = false): string {
  return `
    <div data-testid="gql-wf-subscription-panel">
      <button class="wf-config-tab">Subscription</button>
      <button class="wf-config-tab">Stop</button>
      <button class="wf-config-tab">Output</button>
      <input data-testid="gql-wf-endpoint-input" />
      <textarea data-testid="gql-wf-subscription-query-editor"></textarea>
      <textarea data-testid="gql-wf-sub-variables-editor"></textarea>
      <input data-testid="gql-wf-stop-secs-input" type="number" value="${withStop ? LESSON19_STOP_AFTER_SECS : ''}" />
      <input data-testid="gql-wf-stop-messages-input" type="number" value="" />
      <div data-testid="gql-wf-output-table">
        ${withOutput ? '<select data-testid="gql-wf-output-field-select"></select>' : ''}
        <button data-testid="gql-wf-output-add-btn">+ Add</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
      </div>
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Source</button>
        <button class="wf-config-tab">Assertions</button>
        <div class="wf-config-field"><div class="expr-input-wrapper"><input /></div></div>
        <div data-testid="gql-wf-assert-row">
          <input data-testid="gql-wf-assert-jsonpath" />
          <select data-testid="gql-wf-assert-operator"></select>
          <input data-testid="gql-wf-assert-expected" />
          <input data-testid="gql-wf-assert-description" />
        </div>
        <button data-testid="gql-wf-assert-add-btn">+ Add</button>
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
    </div>
  `;
}
