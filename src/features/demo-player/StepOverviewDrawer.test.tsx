/**
 * @vitest-environment jsdom
 * Unit tests for StepOverviewDrawer component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    expect(counter!.textContent).toMatch(/2\s*\/\s*3/);
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

  it('shows progress bar reflecting currentStepIndex (1-based, matches mini card)', () => {
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
    // index 2 → step 3 of 3 → 3/3 = 100%
    expect(parseFloat(style)).toBeGreaterThan(99);
  });

  it('shows ~33% progress on the first step (index 0)', () => {
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
    // index 0 → step 1 of 3 → 1/3 ≈ 33.3% (matches LiveDemo mini card)
    expect(parseFloat(style)).toBeGreaterThan(30);
    expect(parseFloat(style)).toBeLessThan(40);
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
    fireEvent.mouseDown(header!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
    fireEvent.mouseUp(document);
  });

  it('ignores drag when mousedown starts on close button', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const modal = container.querySelector('.demo-overview-modal') as HTMLElement;
    const closeBtn = screen.getByLabelText('Close steps overview');
    fireEvent.mouseDown(closeBtn, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });
    expect(modal.style.top).toBe('');
  });

  it('resizes panel via bottom-right handle', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const modal = container.querySelector('.demo-overview-modal') as HTMLElement;
    const initialWidth = modal.style.width;
    const handle = container.querySelector('.demo-overview-resize-handle') as HTMLElement;
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(document);
    expect(modal.style.width).not.toBe(initialWidth);
  });

  it('shows done checkmark for steps before current index', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={2}
        onClose={onClose}
      />,
    );
    expect(container.querySelectorAll('.demo-overview-check').length).toBe(2);
  });

  it('shows jump hint in footer when onGoToStep is provided', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onGoToStep={onGoToStep}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/Click to jump/)).toBeTruthy();
  });

  it('scrolls active step into view via callback ref', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={1}
        onClose={onClose}
      />,
    );
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('closes when clicking outside the modal after pointerdown delay', async () => {
    vi.useFakeTimers();
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(150); });
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not close when clicking inside the modal', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(150); });
    const modal = container.querySelector('.demo-overview-modal')!;
    fireEvent.pointerDown(modal);
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('drag clamps position within viewport bounds', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const modal = container.querySelector('.demo-overview-modal') as HTMLElement;
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, width: 360, height: 500,
      right: 360, bottom: 500, x: 0, y: 0, toJSON: () => ({}),
    });
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

    const header = container.querySelector('.demo-overview-modal-header')!;
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 900, clientY: 700 });
    fireEvent.mouseUp(document);

    expect(parseInt(modal.style.left, 10)).toBeLessThanOrEqual(800 - 360);
    expect(parseInt(modal.style.top, 10)).toBeLessThanOrEqual(600 - 500);
  });

  it('resize clamps width and height to min/max bounds', () => {
    const { container } = render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    const modal = container.querySelector('.demo-overview-modal') as HTMLElement;
    const handle = container.querySelector('.demo-overview-resize-handle') as HTMLElement;
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 2000, clientY: 2000 });
    fireEvent.mouseUp(document);
    expect(parseInt(modal.style.width, 10)).toBeLessThanOrEqual(720);
    expect(parseInt(modal.style.height, 10)).toBeLessThanOrEqual(900);
  });

  it('shows read-only footer hint without jump text when onGoToStep omitted', () => {
    render(
      <StepOverviewDrawer
        lesson={makeLesson()}
        currentStepIndex={0}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/Drag header to reposition/)).toBeTruthy();
    expect(screen.queryByText(/Click to jump/)).toBeNull();
  });
});
