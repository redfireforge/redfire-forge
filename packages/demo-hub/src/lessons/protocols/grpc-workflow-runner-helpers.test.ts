/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';
import * as adapters from '../../adapters';
import { clearWorkflowSeedBridge, stubRunnerBridge, stubWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { makeCtx } from './ws-test-utils';
import * as integrationHelpers from './grpc-workflow-integration-helpers';
import {
  WF14_NAME,
  WF14_NODE_ASSERT,
  WF14_NODE_GRPC,
} from './grpc-workflow-integration-helpers';
import {
  GRPCWR_TARGET_DEFAULT,
  GRPCWR_TARGET_VAR,
  createGrpcEchoWorkflowWithVars,
  grpcWRSession,
  resetGrpcWRSession,
  resolveDescriptorKey,
  selectGrpcEchoWorkflow,
  ensureGrpcWRNodesPresent,
  ensureOnWorkflowTab,
  ensureWorkflowSeededForRunner,
  runGrpcEchoWorkflow,
  ensureOnResultsTab,
  openResultsFromCompletionBanner,
  closeResultsExplorerIfOpen,
} from './grpc-workflow-runner-helpers';

describe('grpc-workflow-runner-helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGrpcWRSession();
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
    vi.restoreAllMocks();
  });

  it('createGrpcEchoWorkflowWithVars includes grpcTarget variable and echo nodes', () => {
    const wf = createGrpcEchoWorkflowWithVars() as {
      name: string;
      variables: Record<string, string>;
      nodes: Array<{ id: string; type: string }>;
      edges: unknown[];
    };
    expect(wf.name).toBe(WF14_NAME);
    expect(wf.variables[GRPCWR_TARGET_VAR]).toBe(GRPCWR_TARGET_DEFAULT);
    expect(wf.nodes.some((n) => n.id === WF14_NODE_GRPC && n.type === 'grpcUnary')).toBe(true);
    expect(wf.nodes.some((n) => n.id === WF14_NODE_ASSERT && n.type === 'grpcAssert')).toBe(true);
    expect(wf.edges.length).toBe(3);
  });

  it('resetGrpcWRSession clears all session flags', () => {
    Object.assign(grpcWRSession, {
      workflowCreated: true,
      workflowSelected: true,
      runCompleted: true,
    });
    resetGrpcWRSession();
    expect(grpcWRSession.workflowCreated).toBe(false);
    expect(grpcWRSession.workflowSelected).toBe(false);
    expect(grpcWRSession.runCompleted).toBe(false);
  });

  it('resolveDescriptorKey falls back to fixture key when active descriptor missing', () => {
    const spy = vi.spyOn(adapters, 'getGrpcActiveDescriptorKey').mockReturnValue(null);
    expect(resolveDescriptorKey()).toBe(FIXTURE_DESCRIPTOR_KEY);
    spy.mockReturnValue('custom-desc');
    expect(resolveDescriptorKey()).toBe('custom-desc');
  });

  it('ensureOnWorkflowTab navigates only when canvas is missing', async () => {
    const ctx = makeCtx();
    await ensureOnWorkflowTab(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');

    document.body.innerHTML = `<div class="wf-canvas-area"></div>`;
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureOnWorkflowTab(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('selectGrpcEchoWorkflow skips click when dropdown has no match', async () => {
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
    await selectGrpcEchoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(grpcWRSession.workflowSelected).toBe(true);
  });

  it('selectGrpcEchoWorkflow prefers exact name match over prefix copy', async () => {
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel">
        <div class="wfp-dropdown-item">${WF14_NAME} (copy)</div>
        <div class="wfp-dropdown-item">${WF14_NAME}</div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const items = document.querySelectorAll<HTMLElement>('.wfp-dropdown-item');
    const exactSpy = vi.spyOn(items[1], 'click');
    const copySpy = vi.spyOn(items[0], 'click');
    await selectGrpcEchoWorkflow(ctx);
    expect(exactSpy).toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
  });

  it('runGrpcEchoWorkflow short-circuits when completion banner already visible', async () => {
    document.body.innerHTML = '<div class="completion-section"></div>';
    const ctx = makeCtx();
    stubRunnerBridge({ selectAndRun: true });
    await runGrpcEchoWorkflow(ctx);
    expect(grpcWRSession.runCompleted).toBe(false);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('ensureOnResultsTab returns early when results filter tabs are visible', async () => {
    document.body.innerHTML = '<div class="results-run-filter-tabs"></div>';
    const ctx = makeCtx();
    await ensureOnResultsTab(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('openResultsFromCompletionBanner navigates to results when link missing', async () => {
    document.body.innerHTML = '<div class="completion-section"></div>';
    const ctx = makeCtx();
    await openResultsFromCompletionBanner(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('openResultsFromCompletionBanner clicks view-results link when present', async () => {
    document.body.innerHTML = `
      <div class="completion-section">
        <a data-testid="view-results-btn">View Full Results</a>
      </div>
    `;
    const ctx = makeCtx();
    const link = document.querySelector<HTMLElement>('[data-testid="view-results-btn"]')!;
    const clickSpy = vi.spyOn(link, 'click');
    await openResultsFromCompletionBanner(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('closeResultsExplorerIfOpen no-ops when explorer diagram is absent', async () => {
    const ctx = makeCtx();
    await closeResultsExplorerIfOpen(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('ensureWorkflowSeededForRunner skips seed when workflow already exists', async () => {
    stubWorkflowSeedBridge(WF14_NAME);
    const ctx = makeCtx();
    const seedSpy = vi.spyOn(adapters, 'seedNamedWorkflow').mockResolvedValue(true);
    await ensureWorkflowSeededForRunner(ctx);
    expect(seedSpy).not.toHaveBeenCalled();
  });

  it('ensureGrpcWRNodesPresent skips seed when workflow nodes are on canvas', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="react-flow__node" data-id="${WF14_NODE_GRPC}"></div>
      <div class="react-flow__node" data-id="${WF14_NODE_ASSERT}"></div>
    `;
    stubWorkflowSeedBridge(WF14_NAME);
    const ctx = makeCtx();
    const seedSpy = vi.spyOn(adapters, 'seedNamedWorkflow').mockResolvedValue(true);
    const presentSpy = vi.spyOn(integrationHelpers, 'isWorkflowPresent').mockReturnValue(true);
    const onCanvasSpy = vi.spyOn(integrationHelpers, 'isNodeOnCanvas').mockReturnValue(true);

    await ensureGrpcWRNodesPresent(ctx);
    expect(seedSpy).not.toHaveBeenCalled();
    presentSpy.mockRestore();
    onCanvasSpy.mockRestore();
  });
});