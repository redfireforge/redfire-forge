/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockResolveHttpNodeBaseUrl = vi.fn(() => 'http://resolved.com');
const mockResolveServiceAuth = vi.fn(() => undefined);
const mockIsHttpWorkflowNode = vi.fn(() => false);

vi.mock('../utils/workflowHostResolve', () => ({
  resolveHttpNodeBaseUrl: (
    data: import('../types/workflow').HttpNodeData,
    microservices: import('../../../shared/types').Microservice[],
    hostProfiles?: import('../types/workflow').WorkflowHostProfile[],
    services?: import('../types/workflow').WorkflowService[],
    selectedEnvId?: string,
  ) => mockResolveHttpNodeBaseUrl(data, microservices, hostProfiles, services, selectedEnvId),
  resolveServiceAuth: (
    data: import('../types/workflow').HttpNodeData,
    services?: import('../types/workflow').WorkflowService[],
    selectedEnvId?: string,
    microservices?: import('../../../shared/types').Microservice[],
    globalAuthProfiles?: import('../../../shared/types').GlobalAuthProfile[],
  ) => mockResolveServiceAuth(data, services, selectedEnvId, microservices, globalAuthProfiles),
}));

vi.mock('../utils/workflowVariableHints', () => ({
  isHttpWorkflowNode: (n: { type?: string; data?: unknown }) => mockIsHttpWorkflowNode(n),
}));

import { useWorkflowResolvers } from './useWorkflowResolvers';
import type { Workflow } from '../types/workflow';
import type { Environment, Microservice, GlobalAuthProfile } from '../../../shared/types';
import type {
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
  HttpNodeData,
} from '../types/workflow';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';

function makeWorkflow(id = 'wf-1', lastSelectedEnvId?: string): Workflow {
  return {
    id,
    name: 'Test Workflow',
    nodes: [],
    edges: [],
    variables: {},
    lastSelectedEnvId,
  } as unknown as Workflow;
}

const baseOpts = () => ({
  selected: makeWorkflow(),
  previewWorkflow: null,
  selectedEnvId: 'env-1',
  resolvedBaseUrl: 'http://default.com',
  environments: [] as Environment[],
  microservices: [] as Microservice[],
  globalAuthProfiles: [] as GlobalAuthProfile[],
  workflowHostProfiles: [] as WorkflowHostProfile[],
  workflowAuthProfiles: [] as WorkflowAuthProfile[],
  workflowServices: [] as WorkflowService[],
  selectedNode: undefined as WorkflowRFNode | undefined,
  onEnvSelect: vi.fn(),
  update: vi.fn(),
});

describe('useWorkflowResolvers', () => {
  it('handleEnvSelect calls onEnvSelect and persists', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    act(() => { result.current.handleEnvSelect('env-2'); });
    expect(opts.onEnvSelect).toHaveBeenCalledWith('env-2');
    expect(opts.update).toHaveBeenCalledWith('wf-1', { lastSelectedEnvId: 'env-2' });
  });

  it('handleEnvSelect does not persist in preview mode', () => {
    const opts = baseOpts();
    opts.previewWorkflow = opts.selected;
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    act(() => { result.current.handleEnvSelect('env-2'); });
    expect(opts.onEnvSelect).toHaveBeenCalledWith('env-2');
    expect(opts.update).not.toHaveBeenCalled();
  });

  it('restores lastSelectedEnvId on workflow switch', () => {
    const opts = baseOpts();
    // First render with wf-initial to set prevWfIdForEnv
    opts.selected = makeWorkflow('wf-initial');
    opts.environments = [{ id: 'env-saved', name: 'Saved', variables: {} }];
    const { rerender } = renderHook(() => useWorkflowResolvers(opts));
    // Switch to a different workflow that has lastSelectedEnvId
    opts.selected = makeWorkflow('wf-1', 'env-saved');
    rerender();
    expect(opts.onEnvSelect).toHaveBeenCalledWith('env-saved');
  });

  it('effectiveQuickTestBaseUrl returns resolvedBaseUrl when no selectedNode', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    expect(result.current.effectiveQuickTestBaseUrl).toBe('http://default.com');
  });

  it('effectiveQuickTestBaseUrl uses resolved node URL when selectedNode is HTTP', () => {
    mockIsHttpWorkflowNode.mockReturnValue(true);
    mockResolveHttpNodeBaseUrl.mockReturnValue('http://node-resolved.com');
    const opts = baseOpts();
    opts.selectedNode = { data: { baseUrl: 'http://node.com' } } as WorkflowRFNode;
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    expect(result.current.effectiveQuickTestBaseUrl).toBe('http://node-resolved.com');
    mockIsHttpWorkflowNode.mockReturnValue(false);
    mockResolveHttpNodeBaseUrl.mockReturnValue('http://resolved.com');
  });

  it('resolveHttpBaseUrlForGraph delegates to resolveHttpNodeBaseUrl', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    const data = { baseUrl: 'http://test.com' } as HttpNodeData;
    const url = result.current.resolveHttpBaseUrlForGraph(data);
    expect(mockResolveHttpNodeBaseUrl).toHaveBeenCalledWith(data, opts.microservices, opts.workflowHostProfiles, opts.workflowServices, opts.selectedEnvId);
    expect(url).toBe('http://resolved.com');
  });

  it('resolveHttpAuthForGraph returns service auth when found', () => {
    mockResolveServiceAuth.mockReturnValue({ type: 'bearer', token: 'x' });
    const opts = baseOpts();
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    const auth = result.current.resolveHttpAuthForGraph({ authProfileId: 'ap-1' } as HttpNodeData);
    expect(auth).toEqual({ type: 'bearer', token: 'x' });
    mockResolveServiceAuth.mockReturnValue(undefined);
  });

  it('resolveHttpAuthForGraph falls back to workflow auth profile', () => {
    mockResolveServiceAuth.mockReturnValue(undefined);
    const opts = baseOpts();
    opts.workflowAuthProfiles = [{ id: 'ap-1', name: 'Bearer', auth: { type: 'bearer', token: 'y' } }];
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    const auth = result.current.resolveHttpAuthForGraph({ authProfileId: 'ap-1' } as HttpNodeData);
    expect(auth).toEqual({ type: 'bearer', token: 'y' });
  });

  it('resolveHttpAuthForGraph returns undefined when no auth', () => {
    mockResolveServiceAuth.mockReturnValue(undefined);
    const opts = baseOpts();
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    const auth = result.current.resolveHttpAuthForGraph({} as HttpNodeData);
    expect(auth).toBeUndefined();
  });

  it('resolveHttpAuthForGraph returns undefined when profile id does not match', () => {
    mockResolveServiceAuth.mockReturnValue(undefined);
    const opts = baseOpts();
    opts.workflowAuthProfiles = [{ id: 'other', name: 'X', auth: { type: 'bearer', token: 'z' } }];
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    const auth = result.current.resolveHttpAuthForGraph({ authProfileId: 'missing' } as HttpNodeData);
    expect(auth).toBeUndefined();
  });

  it('clears env ref when selected becomes null', () => {
    const opts = baseOpts();
    opts.selected = makeWorkflow('wf-a');
    const { rerender } = renderHook(() => useWorkflowResolvers(opts));
    opts.selected = null;
    rerender();
    opts.selected = makeWorkflow('wf-b', 'env-1');
    opts.environments = [{ id: 'env-1', name: 'E', variables: {} }];
    rerender();
    expect(opts.onEnvSelect).not.toHaveBeenCalledWith('env-1');
  });

  it('does not restore env when lastSelectedEnvId is not in environments', () => {
    const opts = baseOpts();
    opts.selected = makeWorkflow('wf-initial');
    opts.environments = [{ id: 'env-1', name: 'E', variables: {} }];
    const { rerender } = renderHook(() => useWorkflowResolvers(opts));
    opts.selected = makeWorkflow('wf-next', 'missing-env');
    rerender();
    expect(opts.onEnvSelect).not.toHaveBeenCalledWith('missing-env');
  });

  it('effectiveQuickTestBaseUrl falls back when HTTP node resolves empty URL', () => {
    mockIsHttpWorkflowNode.mockReturnValue(true);
    mockResolveHttpNodeBaseUrl.mockReturnValue('');
    const opts = baseOpts();
    opts.selectedNode = { data: {} } as WorkflowRFNode;
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    expect(result.current.effectiveQuickTestBaseUrl).toBe('http://default.com');
    mockIsHttpWorkflowNode.mockReturnValue(false);
    mockResolveHttpNodeBaseUrl.mockReturnValue('http://resolved.com');
  });

  it('handleEnvSelect does not persist when selected is null', () => {
    const opts = baseOpts();
    opts.selected = null;
    const { result } = renderHook(() => useWorkflowResolvers(opts));
    act(() => { result.current.handleEnvSelect('env-x'); });
    expect(opts.onEnvSelect).toHaveBeenCalledWith('env-x');
    expect(opts.update).not.toHaveBeenCalled();
  });
});
