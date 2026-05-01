/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowDetailModal } from './useWorkflowDetailModal';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';

vi.mock('../utils/workflowVariableHints', () => ({
  isHttpWorkflowNode: (n: any) => n.type === 'http',
}));

const makeNode = (overrides: Partial<WorkflowRFNode> = {}): WorkflowRFNode => ({
  id: 'n1',
  type: 'http',
  position: { x: 0, y: 0 },
  data: { label: 'GET Users', initialVariables: { token: 'abc' } },
  ...overrides,
} as any);

const defaultOpts = () => ({
  nodes: [makeNode()] as WorkflowRFNode[],
  nodeStatuses: {} as Record<string, any>,
  selectedNode: null as WorkflowRFNode | null,
  lastRunError: null as string | null,
  workflowVariables: { baseUrl: 'http://localhost' } as Record<string, string>,
  nodeInitialVarsRef: { current: { n1: { token: 'abc' } } } as any,
  setNodeInitialVars: vi.fn(),
  setWorkflowVariables: vi.fn(),
  setSelectedNodeId: vi.fn(),
});

describe('useWorkflowDetailModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with detailModal null', () => {
    const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
    expect(result.current.detailModal).toBeNull();
  });

  it('openStepDetail sets step modal', () => {
    const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
    act(() => result.current.openStepDetail('n1'));
    expect(result.current.detailModal).toEqual({ type: 'step', nodeId: 'n1' });
  });

  it('openRunErrorDetail opens when lastRunError is set', () => {
    const opts = defaultOpts();
    opts.lastRunError = 'Connection refused';
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openRunErrorDetail());
    expect(result.current.detailModal).toEqual({ type: 'runError' });
  });

  it('openRunErrorDetail does nothing when lastRunError is empty', () => {
    const opts = defaultOpts();
    opts.lastRunError = '';
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openRunErrorDetail());
    expect(result.current.detailModal).toBeNull();
  });

  it('openVariableDetail opens with currentValue', () => {
    const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
    act(() => result.current.openVariableDetail('token', 'xyz'));
    expect(result.current.detailModal).toEqual({ type: 'variable', key: 'token' });
    expect(result.current.variableDetailDraft).toBe('xyz');
  });

  it('openVariableDetail uses nodeInitialVarsRef for http selectedNode', () => {
    const opts = defaultOpts();
    opts.selectedNode = makeNode();
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openVariableDetail('token'));
    expect(result.current.variableDetailDraft).toBe('abc');
  });

  it('openVariableDetail uses workflowVariables when no selectedNode', () => {
    const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
    act(() => result.current.openVariableDetail('baseUrl'));
    expect(result.current.variableDetailDraft).toBe('http://localhost');
  });

  it('handleApplyVariableDetail with custom onApply callback', () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
    act(() => result.current.openVariableDetail('token', 'initial', onApply));
    act(() => result.current.setVariableDetailDraft('newVal'));
    act(() => result.current.handleApplyVariableDetail());
    expect(onApply).toHaveBeenCalledWith('newVal');
    expect(result.current.detailModal).toBeNull();
  });

  it('handleApplyVariableDetail updates nodeInitialVars for http node', () => {
    const opts = defaultOpts();
    opts.selectedNode = makeNode();
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openVariableDetail('token'));
    act(() => result.current.setVariableDetailDraft('updated'));
    act(() => result.current.handleApplyVariableDetail());
    expect(opts.setNodeInitialVars).toHaveBeenCalled();
  });

  it('handleApplyVariableDetail updates workflowVariables for non-http node', () => {
    const opts = defaultOpts();
    opts.selectedNode = makeNode({ type: 'condition' });
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openVariableDetail('baseUrl'));
    act(() => result.current.setVariableDetailDraft('http://prod'));
    act(() => result.current.handleApplyVariableDetail());
    expect(opts.setWorkflowVariables).toHaveBeenCalled();
  });

  it('handleApplyVariableDetail is no-op when modal is not variable', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openStepDetail('n1'));
    act(() => result.current.handleApplyVariableDetail());
    // Should not throw, should not call any setters
    expect(opts.setWorkflowVariables).not.toHaveBeenCalled();
    expect(opts.setNodeInitialVars).not.toHaveBeenCalled();
  });

  // ── stepDetailMeta ──

  describe('stepDetailMeta', () => {
    it('returns empty strings when not step modal', () => {
      const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
      expect(result.current.stepDetailMeta).toEqual({ title: '', body: '' });
    });

    it('returns node label and response detail', () => {
      const opts = defaultOpts();
      opts.nodeStatuses = { n1: { state: 'pass', responseDetail: '200 OK' } };
      const { result } = renderHook(() => useWorkflowDetailModal(opts));
      act(() => result.current.openStepDetail('n1'));
      expect(result.current.stepDetailMeta.title).toBe('GET Users');
      expect(result.current.stepDetailMeta.body).toBe('200 OK');
    });

    it('falls back to error when no responseDetail', () => {
      const opts = defaultOpts();
      opts.nodeStatuses = { n1: { state: 'fail', error: 'timeout' } };
      const { result } = renderHook(() => useWorkflowDetailModal(opts));
      act(() => result.current.openStepDetail('n1'));
      expect(result.current.stepDetailMeta.body).toBe('timeout');
    });

    it('falls back to default message when no status', () => {
      const { result } = renderHook(() => useWorkflowDetailModal(defaultOpts()));
      act(() => result.current.openStepDetail('n1'));
      expect(result.current.stepDetailMeta.body).toContain('No details available');
    });
  });

  // ── openNodeConfig ──

  it('openNodeConfig sets selectedNodeId and configModalNodeId', () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useWorkflowDetailModal(opts));
    act(() => result.current.openNodeConfig('n1'));
    expect(opts.setSelectedNodeId).toHaveBeenCalledWith('n1');
    expect(result.current.configModalNodeId).toBe('n1');
  });
});
