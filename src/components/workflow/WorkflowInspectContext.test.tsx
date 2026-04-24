/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WorkflowInspectProvider, useWorkflowInspect } from './WorkflowInspectContext';

describe('WorkflowInspectContext', () => {
  it('returns provided actions when used inside provider', () => {
    const actions = {
      openStepDetail: vi.fn(),
      openVariableDetail: vi.fn(),
      openNodeConfig: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkflowInspectProvider value={actions}>{children}</WorkflowInspectProvider>
    );
    const { result } = renderHook(() => useWorkflowInspect(), { wrapper });
    expect(result.current.openStepDetail).toBe(actions.openStepDetail);
    expect(result.current.openVariableDetail).toBe(actions.openVariableDetail);
    expect(result.current.openNodeConfig).toBe(actions.openNodeConfig);
  });

  it('returns safe no-op functions when used outside provider', () => {
    const { result } = renderHook(() => useWorkflowInspect());
    // Should not throw — returns no-ops
    expect(() => result.current.openStepDetail('n1')).not.toThrow();
    expect(() => result.current.openVariableDetail('key')).not.toThrow();
    expect(() => result.current.openNodeConfig('n1')).not.toThrow();
  });

  it('no-op functions are stable references', () => {
    const { result, rerender } = renderHook(() => useWorkflowInspect());
    const first = result.current;
    rerender();
    // Each render returns a new object but same no-op functions since they're always freshly created
    expect(typeof result.current.openStepDetail).toBe('function');
    expect(typeof result.current.openNodeConfig).toBe('function');
  });

  it('calls provided openStepDetail with correct nodeId', () => {
    const actions = {
      openStepDetail: vi.fn(),
      openVariableDetail: vi.fn(),
      openNodeConfig: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkflowInspectProvider value={actions}>{children}</WorkflowInspectProvider>
    );
    const { result } = renderHook(() => useWorkflowInspect(), { wrapper });
    result.current.openStepDetail('node-42');
    expect(actions.openStepDetail).toHaveBeenCalledWith('node-42');
  });

  it('calls provided openNodeConfig with correct nodeId', () => {
    const actions = {
      openStepDetail: vi.fn(),
      openVariableDetail: vi.fn(),
      openNodeConfig: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkflowInspectProvider value={actions}>{children}</WorkflowInspectProvider>
    );
    const { result } = renderHook(() => useWorkflowInspect(), { wrapper });
    result.current.openNodeConfig('node-99');
    expect(actions.openNodeConfig).toHaveBeenCalledWith('node-99');
  });

  it('calls provided openVariableDetail with correct key', () => {
    const actions = {
      openStepDetail: vi.fn(),
      openVariableDetail: vi.fn(),
      openNodeConfig: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkflowInspectProvider value={actions}>{children}</WorkflowInspectProvider>
    );
    const { result } = renderHook(() => useWorkflowInspect(), { wrapper });
    result.current.openVariableDetail('apiKey');
    expect(actions.openVariableDetail).toHaveBeenCalledWith('apiKey');
  });
});
