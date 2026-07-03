/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  WorkflowDebugStepContext,
  WorkflowNodeRunContext,
  useWorkflowDebugStep,
  useWorkflowNodeRunStatus,
} from './WorkflowNodeRunContext';

function StatusProbe({ nodeId }: { nodeId: string }) {
  const status = useWorkflowNodeRunStatus(nodeId);
  return <div data-testid={`status-${nodeId}`}>{status ?? 'none'}</div>;
}

function DebugProbe() {
  const debugStep = useWorkflowDebugStep();
  return <div data-testid="debug-probe">{debugStep ? 'has-debug' : 'no-debug'}</div>;
}

describe('WorkflowNodeRunContext', () => {
  it('returns undefined status when node id is not present', () => {
    render(
      <WorkflowNodeRunContext.Provider value={{}}>
        <StatusProbe nodeId="node-1" />
      </WorkflowNodeRunContext.Provider>,
    );
    expect(screen.getByTestId('status-node-1').textContent).toBe('none');
  });

  it('returns run status from context by node id', () => {
    render(
      <WorkflowNodeRunContext.Provider value={{ 'node-2': 'running' as never }}>
        <StatusProbe nodeId="node-2" />
      </WorkflowNodeRunContext.Provider>,
    );
    expect(screen.getByTestId('status-node-2').textContent).toBe('running');
  });

  it('returns null debug callback when not provided', () => {
    render(
      <WorkflowDebugStepContext.Provider value={null}>
        <DebugProbe />
      </WorkflowDebugStepContext.Provider>,
    );
    expect(screen.getByTestId('debug-probe').textContent).toBe('no-debug');
  });

  it('returns debug callback when provided', () => {
    render(
      <WorkflowDebugStepContext.Provider value={() => {}}>
        <DebugProbe />
      </WorkflowDebugStepContext.Provider>,
    );
    expect(screen.getByTestId('debug-probe').textContent).toBe('has-debug');
  });
});
