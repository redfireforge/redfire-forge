/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpressionEditorStepDebugger from './ExpressionEditorStepDebugger';
import type { EvalStep } from './utils/expressionStepDebugger';

const steps: EvalStep[] = [
  { label: 'Step 1', expression: '$.a', displayValue: '1', error: false },
  { label: 'Step 2', expression: '$.b', displayValue: 'err', error: true },
];

describe('ExpressionEditorStepDebugger', () => {
  it('navigates steps and toggles expand/collapse', () => {
    const onActiveStepChange = vi.fn();
    const onToggleStepExpand = vi.fn();
    const onToggleExpandAll = vi.fn();
    const onDetailStep = vi.fn();

    render(
      <ExpressionEditorStepDebugger
        debugSteps={steps}
        activeStep={0}
        expandedSteps={new Set([0])}
        onActiveStepChange={onActiveStepChange}
        onToggleStepExpand={onToggleStepExpand}
        onToggleExpandAll={onToggleExpandAll}
        onDetailStep={onDetailStep}
      />,
    );

    expect(screen.getByText('Step 1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(onActiveStepChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('Step 1'));
    expect(onToggleStepExpand).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(onToggleExpandAll).toHaveBeenCalled();
  });

  it('opens detail on keyboard and click', () => {
    const onDetailStep = vi.fn();
    render(
      <ExpressionEditorStepDebugger
        debugSteps={steps}
        activeStep={0}
        expandedSteps={new Set([0])}
        onActiveStepChange={vi.fn()}
        onToggleStepExpand={vi.fn()}
        onToggleExpandAll={vi.fn()}
        onDetailStep={onDetailStep}
      />,
    );

    fireEvent.click(screen.getByTitle('Click to view full detail'));
    expect(onDetailStep).toHaveBeenCalledWith(steps[0]);

    fireEvent.keyDown(screen.getByTitle('Click to view full detail'), { key: 'Enter' });
    expect(onDetailStep).toHaveBeenCalledTimes(2);
  });

  it('toggles step expand and opens detail with Space key', () => {
    const onToggleStepExpand = vi.fn();
    const onDetailStep = vi.fn();
    render(
      <ExpressionEditorStepDebugger
        debugSteps={steps}
        activeStep={0}
        expandedSteps={new Set([0])}
        onActiveStepChange={vi.fn()}
        onToggleStepExpand={onToggleStepExpand}
        onToggleExpandAll={vi.fn()}
        onDetailStep={onDetailStep}
      />,
    );

    fireEvent.keyDown(screen.getByText('Step 1').closest('[role="button"]')!, { key: ' ' });
    expect(onToggleStepExpand).toHaveBeenCalledWith(0);

    fireEvent.keyDown(screen.getByTitle('Click to view full detail'), { key: ' ' });
    expect(onDetailStep).toHaveBeenCalledWith(steps[0]);
  });

  it('disables previous at first step and shows collapse-all label when all expanded', () => {
    render(
      <ExpressionEditorStepDebugger
        debugSteps={steps}
        activeStep={1}
        expandedSteps={new Set([0, 1])}
        onActiveStepChange={vi.fn()}
        onToggleStepExpand={vi.fn()}
        onToggleExpandAll={vi.fn()}
        onDetailStep={vi.fn()}
      />,
    );

    expect((screen.getByLabelText('Previous step') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByLabelText('Collapse all')).toBeTruthy();
    expect(screen.getByText('▴ Collapse All')).toBeTruthy();
  });
});
