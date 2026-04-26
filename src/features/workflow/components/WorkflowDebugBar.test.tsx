/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowDebugBar from './WorkflowDebugBar';
import { DebugController } from '../engine/debugController';

function makeController(): DebugController {
  return new DebugController();
}

describe('WorkflowDebugBar', () => {
  it('renders debug indicator', () => {
    render(
      <WorkflowDebugBar debugController={makeController()} onStop={vi.fn()} variableCount={3} />,
    );
    expect(screen.getByText(/DEBUG MODE/)).toBeTruthy();
    expect(screen.getByText('Variables: 3')).toBeTruthy();
  });

  it('renders Resume, Step All, and Stop buttons', () => {
    render(
      <WorkflowDebugBar debugController={makeController()} onStop={vi.fn()} variableCount={0} />,
    );
    expect(screen.getByText(/Resume/)).toBeTruthy();
    expect(screen.getByText(/Step All/)).toBeTruthy();
    expect(screen.getByText(/Stop/)).toBeTruthy();
  });

  it('does not render Step Into when no paused sub-workflow', () => {
    render(
      <WorkflowDebugBar debugController={makeController()} onStop={vi.fn()} variableCount={0} />,
    );
    expect(screen.queryByText(/Step Into/)).toBeNull();
  });

  it('renders Step Into when pausedSubWorkflowNodeId is provided', () => {
    render(
      <WorkflowDebugBar
        debugController={makeController()}
        onStop={vi.fn()}
        variableCount={0}
        pausedSubWorkflowNodeId="sw-1"
        onStepInto={vi.fn()}
      />,
    );
    expect(screen.getByText(/Step Into/)).toBeTruthy();
  });

  it('calls onStepInto and stepNode when Step Into clicked', async () => {
    const controller = makeController();
    const onStepInto = vi.fn();
    const stepNodeSpy = vi.spyOn(controller, 'stepNode');

    render(
      <WorkflowDebugBar
        debugController={controller}
        onStop={vi.fn()}
        variableCount={0}
        pausedSubWorkflowNodeId="sw-1"
        onStepInto={onStepInto}
      />,
    );

    fireEvent.click(screen.getByText(/Step Into/));
    expect(stepNodeSpy).toHaveBeenCalledWith('sw-1');
    expect(onStepInto).toHaveBeenCalledWith('sw-1');
  });

  it('calls onStop when Stop clicked', () => {
    const onStop = vi.fn();
    render(
      <WorkflowDebugBar debugController={makeController()} onStop={onStop} variableCount={0} />,
    );
    fireEvent.click(screen.getByText(/Stop/));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
