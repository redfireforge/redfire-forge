/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlWorkflowIntegrationLesson } from './graphql-workflow-integration';
import { makeCtx } from './ws-test-utils';
import { GQL, WF } from '../../../../shared/selectors';
import {
  LESSON11_LATENCY_VAR,
  LESSON11_WF_NAME,
  resetGqlLesson11SessionFlags,
  gqlWorkflowIntegrationLessonSetup,
  ensureLesson11QueryNodeAdded,
  ensureLesson11QueryConfigured,
} from './graphql-lesson-helpers';

describe('gql-workflow-integration lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson11SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).__wfConnect;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('has valid lesson structure', () => {
    expect(gqlWorkflowIntegrationLesson.id).toBe('gql-workflow-integration');
    expect(gqlWorkflowIntegrationLesson.category).toBe('graphql');
    expect(gqlWorkflowIntegrationLesson.name).toBe('Workflow Integration');
    expect(gqlWorkflowIntegrationLesson.steps.length).toBe(8);
    expect(gqlWorkflowIntegrationLesson.estimatedMinutes).toBe(4);
  });

  it('allows workflow and workflow-runner tabs', () => {
    expect(gqlWorkflowIntegrationLesson.allowedTabs).toContain('workflow');
    expect(gqlWorkflowIntegrationLesson.allowedTabs).toContain('workflow-runner');
    expect(gqlWorkflowIntegrationLesson.initialTab).toBe('workflow');
  });

  it('has correct step IDs in order', () => {
    expect(gqlWorkflowIntegrationLesson.steps.map((s) => s.id)).toEqual([
      'gql11-create',
      'gql11-query-node',
      'gql11-config-query',
      'gql11-assert-node',
      'gql11-assert-source',
      'gql11-assert-rule',
      'gql11-run-pass',
      'gql11-run-fail',
    ]);
  });

  it('all 8 steps have pauseAfter: true', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('gql11-create creates blank workflow', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button title="New workflow"></button>
      <div class="wf-new-dropdown-item"></div>
      <input class="req-confirm-input" />
      <button class="req-confirm-ok"></button>
      <div class="wf-canvas-area"></div>
    `;
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
    expect(ctx.fill).toHaveBeenCalledWith(WF.CREATE_INPUT, LESSON11_WF_NAME);
  });

  it('gql11-query-node adds palette block and connects start', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <button class="wf-palette-block-graphqlQuery"></button>
      <div class="react-flow__node-start" data-id="start1"></div>
      <div class="react-flow__node-graphqlQuery" data-id="q1">
        <div data-testid="gql-canvas-query-node"></div>
      </div>
      <button title="New workflow"></button>
      <div class="wf-new-dropdown-item"></div>
      <input class="req-confirm-input" />
      <button class="req-confirm-ok"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_QUERY);
  });

  it('gql11-config-query fills endpoint and output binding', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildQueryConfigDom();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    await ensureLesson11QueryNodeAdded(ctx);
    await ensureLesson11QueryConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(WF.WF_GQL_ENDPOINT, expect.stringContaining('4010'));
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_QUERY_EDITOR, expect.stringContaining('health'));
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_OUTPUT_VARNAME, LESSON11_LATENCY_VAR);
  });

  it('setup deletes stale workflow when bridge available', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    await gqlWorkflowIntegrationLessonSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON11_WF_NAME);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });
});

function buildQueryConfigDom(): string {
  return `
    <div class="wf-canvas-area"></div>
    <button class="wf-palette-block-graphqlQuery"></button>
    <div class="react-flow__node-start" data-id="start1"></div>
    <div class="react-flow__node-graphqlQuery" data-id="q1">
      <div data-testid="gql-canvas-query-node"></div>
    </div>
    <button title="New workflow"></button>
    <div class="wf-new-dropdown-item"></div>
    <input class="req-confirm-input" />
    <button class="req-confirm-ok"></button>
    <div class="wf-config-modal">
      <div data-testid="gql-wf-query-panel">
        <button class="wf-config-tab">Operation</button>
        <button class="wf-config-tab">Output</button>
        <div class="wf-config-field--row"><div class="expr-input-wrapper"><input /></div></div>
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <div data-testid="gql-wf-output-table">
          <button data-testid="gql-wf-output-add-btn"></button>
          <select data-testid="gql-wf-output-field-select"><option value="latencyMs">latencyMs</option></select>
          <input data-testid="gql-wf-output-varname" />
        </div>
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary"></button></div>
    </div>
  `;
}
