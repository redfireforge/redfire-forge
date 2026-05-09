/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkflowDesignerController } from './useWorkflowDesignerController';
import { useWorkflowDesignerControllerPartA } from './useWorkflowDesignerControllerPartA';
import { useWorkflowDesignerControllerPartB } from './useWorkflowDesignerControllerPartB';
import type { WorkflowDesignerProps } from '../utils/workflowDesignerShellTypes';

const partAMock = { fromA: true, shared: 'a' };
const partBMock = { fromB: true, shared: 'b' };

vi.mock('./useWorkflowDesignerControllerPartA', () => ({
  useWorkflowDesignerControllerPartA: vi.fn(() => partAMock),
}));

vi.mock('./useWorkflowDesignerControllerPartB', () => ({
  useWorkflowDesignerControllerPartB: vi.fn(() => partBMock),
}));

const minimalProps = {} as WorkflowDesignerProps;

describe('useWorkflowDesignerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes PartA and PartB with PartB overriding shared keys', () => {
    const { result } = renderHook(() => useWorkflowDesignerController(minimalProps));

    expect(result.current).toEqual({
      fromA: true,
      fromB: true,
      shared: 'b',
    });
  });

  it('passes props to both parts (PartB receives PartA result)', () => {
    renderHook(() => useWorkflowDesignerController(minimalProps));

    expect(useWorkflowDesignerControllerPartA).toHaveBeenCalledWith(minimalProps);
    expect(useWorkflowDesignerControllerPartB).toHaveBeenCalledWith(minimalProps, partAMock);
  });
});
