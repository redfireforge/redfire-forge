/**
 * @vitest-environment jsdom
 * Unit tests for StepOverviewDrawer component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StepOverviewDrawer from './StepOverviewDrawer';
import type { DemoLesson } from './types';

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'l1',
    domainId: 'd1',
    name: 'Test Lesson',
    description: 'A test lesson',
    estimatedMinutes: 5,
    concept: { title: 'Concept', body: 'Body' },
    steps: [
      { id: 's1', title: 'Step One', description: 'First step' },
      { id: 's2', title: 'Step Two', description: 'Second step' },
      { id: 's3', title: 'Step Three', description: 'Third step' },
    ],
    ...overrides,
  };
}

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('StepOverviewDrawer', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onGoToStep: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onGoToStep = vi.fn();
    document.body.innerHTML = '';
  });

  it('renders the lesson name in the title', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Test Lesson')).toBeTruthy();
  });

  it('renders all step titles', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Step One')).toBeTruthy();
    expect(screen.getByText('Step Two')).toBeTruthy();
    expect(screen.getByText('Step Three')).toBeTruthy();
  });

  it('shows step counter in header', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={1}
        onClose={onClose}
      />,
    );
    const counter = container.querySelector('.demo-overview-modal-counter');
    expect(counter).toBeTruthy();
    expect(counter!.textContent).toMatch(/1\s*\/\s*3/);
  });

  it('renders read-only (div) step items when onGoToStep is not provided', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    // Without onGoToStep, items should have readonly class
    const readonlyItems = container.querySelectorAll('.demo-overview-modal-item--readonly');
    expect(readonlyItems.length).toBe(3);
    // Step items should be divs not buttons
    const stepDivs = container.querySelectorAll('div.demo-overview-modal-item');
    expect(stepDivs.length).toBe(3);
  });

  it('renders clickable step items when onGoToStep is provided', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onGoToStep={onGoToStep}
        onClose={onClose}
      />,
    );
    // Steps should be clickable buttons when onGoToStep is provided
    const stepBtns = screen.getAllByRole('button').filter(
      b => b.textContent?.includes('Step'),
    );
    expect(stepBtns.length).toBeGreaterThan(0);
  });

  it('calls onGoToStep when a step button is clicked', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onGoToStep={onGoToStep}
        onClose={onClose}
      />,
    );
    const stepBtns = screen.getAllByRole('button').filter(
      b => b.textContent?.includes('Step'),
    );
    fireEvent.click(stepBtns[1]);
    expect(onGoToStep).toHaveBeenCalledWith(1);
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const closeBtn = screen.getByLabelText('Close steps overview');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows progress bar reflecting currentStepIndex', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={2}
        onClose={onClose}
      />,
    );
    const progressFill = container.querySelector('.demo-overview-modal-progress-fill');
    expect(progressFill).toBeTruthy();
    const style = (progressFill as HTMLElement).style.width;
    // 2/3 = ~66.67%
    expect(parseFloat(style)).toBeGreaterThan(60);
  });

  it('shows 0% progress when on step 0', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const progressFill = container.querySelector('.demo-overview-modal-progress-fill');
    expect(progressFill).toBeTruthy();
    const style = (progressFill as HTMLElement).style.width;
    expect(style).toBe('0%');
  });

  it('handles empty steps list gracefully (0% progress)', () => {
    const lesson = makeLesson({ steps: [] });
    const { container } = render(
      <StepOverviewDrawer
        lesson={lesson}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const progressFill = container.querySelector('.demo-overview-modal-progress-fill');
    expect(progressFill).toBeTruthy();
    expect((progressFill as HTMLElement).style.width).toBe('0%');
  });

  it('marks current step as active via aria-current', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={1}
        onClose={onClose}
        onGoToStep={onGoToStep}
      />,
    );
    const activeItems = container.querySelectorAll('[aria-current="step"]');
    expect(activeItems.length).toBe(1);
  });

  it('removes Escape listener on unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    unmount();
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
  });

  it('handles drag mouse down on header', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const header = container.querySelector('.demo-overview-modal-header');
    expect(header).toBeTruthy();
    // Should not throw when dragging
    fireEvent.mouseDown(header!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
    fireEvent.mouseUp(document);
  });
});
