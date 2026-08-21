/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LiveDemo from './LiveDemo';
import { grpcWorkflowIntegrationLesson } from './lessons/protocols/grpc-workflow-integration';
import {makeLesson,
} from './demo-components.testHelpers';

vi.mock('./utils/checkEndpoint', () => ({
  checkEndpoint: vi.fn().mockResolvedValue(false),
}));

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adapters')>();
  return {
    ...actual,
    countUserTabsInStorage: vi.fn().mockResolvedValue(0),
    userTabsToCloseForLesson: vi.fn(() => 0),
  };
});

describe('LiveDemo', () => {
  const liveProps = {
    lesson: makeLesson(),
    stepIndex: 0,
    isPlaying: false,
    stepPhase: 'done' as const,
    onNext: vi.fn(),
    onTogglePlay: vi.fn(),
    onSkipReading: vi.fn(),
    onRestart: vi.fn(),
    onExit: vi.fn(),
    onComplete: vi.fn(),
  };

  it('renders step title and description', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Do step 1')).toBeTruthy();
  });

  it('renders escaped newline sequences as formatted line breaks', () => {
    render(
      <LiveDemo
        {...liveProps}
        lesson={{
          ...makeLesson(),
          steps: [
            { id: 's1', title: 'Step 1', description: 'Line one\\n\\nLine two' },
            { id: 's2', title: 'Step 2', description: 'Done' },
          ],
        }}
      />,
    );

    expect(screen.getByText('Line one')).toBeTruthy();
    expect(screen.getByText('Line two')).toBeTruthy();
    expect(screen.queryByText('Line one\\n\\nLine two')).toBeNull();
  });

  it('renders the real grpc workflow lesson step without literal newline escape text', () => {
    render(
      <LiveDemo
        {...liveProps}
        lesson={grpcWorkflowIntegrationLesson}
        stepIndex={1}
      />,
    );

    expect(screen.getByText('Add a gRPC Unary Node')).toBeTruthy();
    expect(screen.getByText(/At runtime it sends the request/i)).toBeTruthy();
    expect(screen.queryByText(/\\n\\n/)).toBeNull();
  });

  it('renders step counter', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('renders play button when paused', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByTitle('Play (Space)')).toBeTruthy();
  });

  it('renders pause button when playing', () => {
    render(<LiveDemo {...liveProps} isPlaying={true} />);
    expect(screen.getByTitle('Pause auto-play (Space)')).toBeTruthy();
  });

  it('disables next button on last step', () => {
    render(<LiveDemo {...liveProps} stepIndex={1} />);
    // stepIndex 1 is the last step (2 steps total)
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByTitle('Last step')).toHaveProperty('disabled', true);
  });

  it('disables next button when action is executing (non-reading phase)', () => {
    render(<LiveDemo {...liveProps} stepPhase="action" stepIndex={0} />);
    const nextBtn = screen.getByTitle('Please wait — action in progress');
    expect(nextBtn).toHaveProperty('disabled', true);
  });

  it('disables next button during reading phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="reading" stepIndex={0} />);
    const nextBtn = screen.getByLabelText('Next step');
    expect(nextBtn).toHaveProperty('disabled', true);
    expect(nextBtn.getAttribute('title')).toContain('Finish reading first');
  });

  it('enables next button when step is done', () => {
    render(<LiveDemo {...liveProps} stepPhase="done" stepIndex={0} />);
    const nextBtn = screen.getByLabelText('Next step');
    expect(nextBtn).toHaveProperty('disabled', false);
    expect(nextBtn.getAttribute('title')).toBe('Next (→)');
  });

  it('calls onExit when exit button is clicked', () => {
    const onExit = vi.fn();
    render(<LiveDemo {...liveProps} onExit={onExit} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onExit).toHaveBeenCalled();
  });

  it('calls onTogglePlay when play button is clicked', () => {
    const onTogglePlay = vi.fn();
    render(<LiveDemo {...liveProps} onTogglePlay={onTogglePlay} />);
    fireEvent.click(screen.getByTitle('Play (Space)'));
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('shows reading phase badge when in reading phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="reading" />);
    expect(screen.getByText(/Reading/)).toBeTruthy();
  });

  it('shows action phase badge when in action phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="action" />);
    expect(screen.getByText(/Acting/)).toBeTruthy();
  });

  it('shows verify phase badge when in verify phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="verify" />);
    expect(screen.getByText(/Verifying/)).toBeTruthy();
  });

  it('calls onSkipReading when reading badge is clicked', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="reading" onSkipReading={onSkipReading} />);
    fireEvent.click(screen.getByText(/Reading/));
    expect(onSkipReading).toHaveBeenCalled();
  });

  it('renders keyboard hints', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText(/play\/pause/)).toBeTruthy();
  });

  it('returns null when step is undefined', () => {
    const { container } = render(
      <LiveDemo {...liveProps} lesson={makeLesson({ steps: [] })} stepIndex={0} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders lesson name', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText('Lesson 1')).toBeTruthy();
  });

  it('does not call onNext when next is clicked during reading phase', () => {
    const onNext = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="reading" onNext={onNext} />);
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('calls onNext when next button is clicked after step is done', () => {
    const onNext = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="done" onNext={onNext} />);
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(onNext).toHaveBeenCalled();
  });

  it('calls onRestart when restart button is clicked', () => {
    const onRestart = vi.fn();
    render(<LiveDemo {...liveProps} onRestart={onRestart} />);
    fireEvent.click(screen.getByTitle('Restart demo from beginning'));
    expect(onRestart).toHaveBeenCalled();
  });

  it('does not render speed selector buttons', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.queryByRole('group', { name: 'Playback speed' })).toBeNull();
  });

  it('shows Complete button on last step when canNavigate', () => {
    // stepIndex 1 is the last step of the 2-step lesson, stepPhase='done' → canNavigate
    render(<LiveDemo {...liveProps} stepIndex={1} stepPhase="done" />);
    expect(screen.getByTitle('Mark lesson as complete')).toBeTruthy();
  });

  it('does not show Complete button before last step', () => {
    render(<LiveDemo {...liveProps} stepIndex={0} />);
    expect(screen.queryByTitle('Mark lesson as complete')).toBeNull();
  });

  it('does not show Complete button on last step when action is executing', () => {
    render(<LiveDemo {...liveProps} stepIndex={1} stepPhase="action" />);
    expect(screen.queryByTitle('Mark lesson as complete')).toBeNull();
  });

  it('calls onComplete when Complete button is clicked', () => {
    const onComplete = vi.fn();
    render(<LiveDemo {...liveProps} stepIndex={1} stepPhase="done" onComplete={onComplete} />);
    fireEvent.click(screen.getByTitle('Mark lesson as complete'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('does not render back button', () => {
    render(<LiveDemo {...liveProps} stepIndex={1} />);
    expect(screen.queryByTitle('Previous (←)')).toBeNull();
  });

  it('shows Guide mode badge when no highlight target found', () => {
    const lessonWithHighlight = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'D1', highlight: '.nonexistent-el' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonWithHighlight} />);
    expect(screen.getByText('📖 Guide')).toBeTruthy();
  });

  it('renders step without highlight', () => {
    const lessonNoHighlight = makeLesson({
      steps: [
        { id: 's1', title: 'No Highlight', description: 'No highlight step' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonNoHighlight} />);
    expect(screen.getByText('📖 Guide')).toBeTruthy();
  });

  it('polling finds visible element and shows Live badge', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const target = document.createElement('div');
    target.className = 'poll-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 2000, left: 10, width: 100, height: 50,
      right: 110, bottom: 2050, x: 10, y: 2000, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.poll-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { container } = render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    // Advance past the initial polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // After polling, the element should be found
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByText('🟢 Live')).toBeTruthy();
    expect(container.querySelector('.demo-live-mode-badge.live')).toBeTruthy();

    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('polling pauses while user has text selected in the narration panel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const target = document.createElement('div');
    target.className = 'poll-selection-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 2000, left: 10, width: 100, height: 50,
      right: 110, bottom: 2050, x: 10, y: 2000, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1 copy me', highlight: '.poll-selection-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { container } = render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);

    const desc = container.querySelector('.demo-live-step-desc')!;
    const range = document.createRange();
    range.selectNodeContents(desc);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    vi.mocked(target.scrollIntoView).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(target.scrollIntoView).not.toHaveBeenCalled();

    sel.removeAllRanges();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('polling gives up after max attempts when element not found', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.nonexistent-poll' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    // Advance past the max attempts (20 × 100ms = 2s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText('📖 Guide')).toBeTruthy();
    vi.useRealTimers();
  });

  it('polling cleans up on unmount', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.test-cleanup' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<LiveDemo {...liveProps} lesson={lessonHL} />);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('isElementVisible returns false for zero-size elements', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const target = document.createElement('div');
    target.className = 'zero-size';
    target.scrollIntoView = vi.fn();
    // getBoundingClientRect returns 0 width/height by default in jsdom
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.zero-size' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Element found but not visible → stays in Guide mode
    expect(screen.getByText('📖 Guide')).toBeTruthy();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('renders progress bar', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const progressBar = container.querySelector('.demo-live-progress-bar');
    expect(progressBar).toBeTruthy();
    const fill = container.querySelector('.demo-live-progress-fill') as HTMLElement;
    expect(fill).toBeTruthy();
    // First step of 2 = 50%
    expect(fill.style.width).toBe('50%');
  });

  it('renders progress bar at 100% on last step', () => {
    const { container } = render(<LiveDemo {...liveProps} stepIndex={1} />);
    const fill = container.querySelector('.demo-live-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('shows preparing badge during pre phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="pre" />);
    expect(screen.getByTestId('demo-live-phase-badge')).toBeTruthy();
    expect(screen.getByText(/Preparing/)).toBeTruthy();
  });

  it('does not show phase badge for done phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="done" />);
    expect(screen.queryByText(/Reading/)).toBeNull();
    expect(screen.queryByText(/Acting/)).toBeNull();
    expect(screen.queryByText(/Verifying/)).toBeNull();
  });

  it('reading badge has skippable class', () => {
    const { container } = render(<LiveDemo {...liveProps} stepPhase="reading" />);
    const badge = container.querySelector('.demo-live-phase-badge.skippable');
    expect(badge).toBeTruthy();
  });

  it('reading badge skips reading when Enter or Space pressed', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="reading" onSkipReading={onSkipReading} />);
    const badge = screen.getByTestId('demo-live-phase-badge');
    fireEvent.keyDown(badge, { key: 'Enter' });
    fireEvent.keyDown(badge, { key: ' ' });
    expect(onSkipReading).toHaveBeenCalledTimes(2);
  });

  it('action badge does not call onSkipReading when clicked', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="action" onSkipReading={onSkipReading} />);
    fireEvent.click(screen.getByText(/Acting/));
    expect(onSkipReading).not.toHaveBeenCalled();
  });

  it('drag handle starts drag on mousedown and moves panel', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const handle = container.querySelector('.demo-live-drag-handle') as HTMLElement;
    const panel = container.querySelector('.demo-live-panel') as HTMLElement;
    expect(handle).toBeTruthy();
    expect(panel).toBeTruthy();

    const startTop = panel.style.top;
    const startLeft = panel.style.left;

    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 200, left: 300, width: 400, height: 440,
      right: 700, bottom: 640, x: 300, y: 200, toJSON: () => ({}),
    });

    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 150, clientY: 120 }));
    fireEvent(window, new MouseEvent('mouseup'));

    expect(panel.style.top).toBe('220px');
    expect(panel.style.left).toBe('350px');
    expect(panel.style.top).not.toBe(startTop);
    expect(panel.style.left).not.toBe(startLeft);
  });

  it('drag ignores mousedown on buttons inside header', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const panel = container.querySelector('.demo-live-panel') as HTMLElement;
    const startTop = panel.style.top;
    const startLeft = panel.style.left;
    const exitBtn = screen.getByText('✕');
    fireEvent.mouseDown(exitBtn, { clientX: 100, clientY: 100 });
    expect(panel.style.top).toBe(startTop);
    expect(panel.style.left).toBe(startLeft);
  });

  it('renders resize handles for all edges and corner grip', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByTestId('demo-live-resize-top')).toBeTruthy();
    expect(screen.getByTestId('demo-live-resize-left')).toBeTruthy();
    expect(screen.getByTestId('demo-live-resize-right')).toBeTruthy();
    expect(screen.getByTestId('demo-live-resize-bottom')).toBeTruthy();
    expect(screen.getByTestId('demo-live-resize-corner')).toBeTruthy();
  });

  it('renders step description with markdown', () => {
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'MD Step', description: '**bold** and `code`' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });
    const { container } = render(<LiveDemo {...liveProps} lesson={lesson} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  it('renders drag handle icon', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const handle = container.querySelector('.demo-live-drag-handle');
    expect(handle?.textContent).toBe('⠿');
  });

  it('toggles steps overview drawer open and closed', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<LiveDemo {...liveProps} />);
    const overviewBtn = screen.getByLabelText('Toggle steps overview');
    expect(document.querySelector('.demo-overview-modal')).toBeNull();
    fireEvent.click(overviewBtn);
    expect(document.querySelector('.demo-overview-modal')).toBeTruthy();
    expect(overviewBtn.classList.contains('active')).toBe(true);
    fireEvent.click(overviewBtn);
    expect(document.querySelector('.demo-overview-modal')).toBeNull();
  });

  it('closes overview drawer via onClose callback', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<LiveDemo {...liveProps} />);
    fireEvent.click(screen.getByLabelText('Toggle steps overview'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.demo-overview-modal')).toBeNull();
  });

  it('keeps steps overview open when the demo advances to the next step', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { rerender } = render(<LiveDemo {...liveProps} stepIndex={0} />);
    fireEvent.click(screen.getByLabelText('Toggle steps overview'));
    expect(document.querySelector('.demo-overview-modal')).toBeTruthy();
    rerender(<LiveDemo {...liveProps} stepIndex={1} stepPhase="reading" />);
    expect(document.querySelector('.demo-overview-modal')).toBeTruthy();
    expect(screen.getByLabelText('Toggle steps overview').classList.contains('active')).toBe(true);
  });

  it('hides spotlight during pre phase even when target found', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const target = document.createElement('div');
    target.className = 'pre-phase-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 100, height: 50,
      right: 110, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.pre-phase-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { container } = render(<LiveDemo {...liveProps} lesson={lessonHL} stepPhase="pre" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(container.querySelector('.demo-spotlight')).toBeNull();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('hides spotlight while surfaceReady is false (boot veil)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const target = document.createElement('div');
    target.className = 'boot-veil-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 100, height: 50,
      right: 110, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.boot-veil-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { rerender } = render(
      <LiveDemo {...liveProps} lesson={lessonHL} stepPhase="reading" surfaceReady={false} />,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(document.querySelector('.demo-spotlight-ring')).toBeNull();

    rerender(<LiveDemo {...liveProps} lesson={lessonHL} stepPhase="reading" surfaceReady />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('isElementVisible rejects hidden elements (display none)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const target = document.createElement('div');
    target.className = 'hidden-target';
    target.style.display = 'none';
    target.style.width = '100px';
    target.style.height = '50px';
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.hidden-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByText('📖 Guide')).toBeTruthy();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('polling picks first visible element among multiple matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const hidden = document.createElement('div');
    hidden.className = 'multi-target';
    hidden.style.width = '0';
    hidden.style.height = '0';
    document.body.appendChild(hidden);

    const visible = document.createElement('div');
    visible.className = 'multi-target';
    visible.style.width = '100px';
    visible.style.height = '50px';
    visible.scrollIntoView = vi.fn();
    vi.spyOn(visible, 'getBoundingClientRect').mockReturnValue({
      top: 2000, left: 10, width: 100, height: 50,
      right: 110, bottom: 2050, x: 10, y: 2000, toJSON: () => ({}),
    });
    document.body.appendChild(visible);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.multi-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(visible.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText('🟢 Live')).toBeTruthy();
    document.body.removeChild(hidden);
    document.body.removeChild(visible);
    vi.useRealTimers();
  });
});
