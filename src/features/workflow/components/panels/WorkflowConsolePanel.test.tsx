/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import WorkflowConsolePanel from './WorkflowConsolePanel';
import type { ConsoleLine } from '../../../requests/hooks/useResponseCache';

const makeLine = (text: string, prefix = '*', ts?: number): ConsoleLine => ({ text, prefix, ts });

const sampleLines: ConsoleLine[] = [
  makeLine('Starting run', '*', 1700000000000),
  makeLine('GET /api/users', '>', 1700000000100),
  makeLine('200 OK', '<', 1700000000200),
  makeLine('Extracted token', '#', 1700000000300),
  makeLine('Error connecting', '!', 1700000000400),
];

describe('WorkflowConsolePanel', () => {
  const defaultProps = {
    lines: sampleLines,
    onClear: vi.fn(),
    onClose: vi.fn(),
    runBehavior: 'clear' as const,
    onRunBehaviorChange: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock scrollIntoView (not available in jsdom)
    Element.prototype.scrollIntoView = vi.fn();
    // Mock localStorage for mode persistence
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => { store[key] = val; });
  });

  it('renders all console lines', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const lineEls = container.querySelectorAll('.wf-cl-line');
    expect(lineEls.length).toBe(5);
  });

  it('renders line text content', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    expect(screen.getByText('Starting run')).toBeTruthy();
    expect(screen.getByText('GET /api/users')).toBeTruthy();
    expect(screen.getByText('Error connecting')).toBeTruthy();
  });

  it('applies correct CSS classes for different prefixes', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const lines = container.querySelectorAll('.wf-cl-line');
    expect(lines[0].classList.contains('wf-cl-info')).toBe(true);
    expect(lines[1].classList.contains('wf-cl-out')).toBe(true);
    expect(lines[2].classList.contains('wf-cl-in')).toBe(true);
    expect(lines[3].classList.contains('wf-cl-extract')).toBe(true);
    expect(lines[4].classList.contains('wf-cl-error')).toBe(true);
  });

  it('renders separator lines with correct class', () => {
    const lines: ConsoleLine[] = [makeLine('Run · 10:00:00', '---')];
    const { container } = render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    expect(container.querySelector('.wf-cl-separator')).toBeTruthy();
  });

  it('shows empty message when no lines', () => {
    render(<WorkflowConsolePanel {...defaultProps} lines={[]} />);
    expect(screen.getByText(/Run a Quick Test to see activity logs/)).toBeTruthy();
  });

  it('shows line count in header', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    expect(screen.getByText('5 lines')).toBeTruthy();
  });

  it('shows singular "line" for count of 1', () => {
    render(<WorkflowConsolePanel {...defaultProps} lines={[makeLine('one')]} />);
    expect(screen.getByText('1 line')).toBeTruthy();
  });

  it('calls onClear when Clear button clicked', () => {
    const onClear = vi.fn();
    render(<WorkflowConsolePanel {...defaultProps} onClear={onClear} />);
    fireEvent.click(screen.getByTitle('Clear console'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<WorkflowConsolePanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close console'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays auto-clear toggle in clear mode', () => {
    render(<WorkflowConsolePanel {...defaultProps} runBehavior="clear" />);
    expect(screen.getByText('Auto-clear')).toBeTruthy();
  });

  it('displays append toggle in append mode', () => {
    render(<WorkflowConsolePanel {...defaultProps} runBehavior="append" />);
    expect(screen.getByText('Append')).toBeTruthy();
  });

  it('toggles run behavior when toggle clicked', () => {
    const onRunBehaviorChange = vi.fn();
    render(<WorkflowConsolePanel {...defaultProps} onRunBehaviorChange={onRunBehaviorChange} />);
    fireEvent.click(screen.getByText('Auto-clear'));
    expect(onRunBehaviorChange).toHaveBeenCalledWith('append');
  });

  it('toggles from append to clear', () => {
    const onRunBehaviorChange = vi.fn();
    render(<WorkflowConsolePanel {...defaultProps} runBehavior="append" onRunBehaviorChange={onRunBehaviorChange} />);
    fireEvent.click(screen.getByText('Append'));
    expect(onRunBehaviorChange).toHaveBeenCalledWith('clear');
  });

  it('opens search bar when Search button clicked', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    expect(container.querySelector('.wf-console-search-bar')).toBeNull();
    fireEvent.click(screen.getByTitle('Search console'));
    expect(container.querySelector('.wf-console-search-bar')).toBeTruthy();
  });

  it('filters and highlights matching lines in search', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Search console'));
    const searchInput = screen.getByPlaceholderText('Search console…');
    fireEvent.change(searchInput, { target: { value: 'token' } });
    const matchLines = container.querySelectorAll('.wf-cl-line-match, .wf-cl-line-current-match');
    expect(matchLines.length).toBe(1);
  });

  it('shows match count in search bar', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: 'token' } });
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('shows "No matches" when search yields nothing', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: 'zzzzz' } });
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('closes search bar on second click and clears query', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: 'test' } });
    fireEvent.click(screen.getByTitle('Search console'));
    expect(container.querySelector('.wf-console-search-bar')).toBeNull();
  });

  it('renders Log and Timeline view buttons', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    expect(screen.getByText('Log')).toBeTruthy();
    expect(screen.getByText('Timeline')).toBeTruthy();
  });

  it('disables Timeline button when no stepSummaries', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    const timelineBtn = screen.getByText('Timeline');
    expect((timelineBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders timeline view when stepSummaries are provided and Timeline clicked', () => {
    const summaries = [
      { label: 'Step 1', state: 'success' as const, statusCode: 200, responseTimeMs: 50 },
    ];
    const { container } = render(
      <WorkflowConsolePanel {...defaultProps} stepSummaries={summaries} />,
    );
    const timelineBtn = screen.getByText('Timeline');
    expect((timelineBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(timelineBtn);
    expect(container.querySelector('.wf-timeline')).toBeTruthy();
    expect(screen.getByText('Step 1')).toBeTruthy();
  });

  it('has mode selector with docked/floating/fullscreen options', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
  });

  it('renders plain lines without prefix icon or timestamp', () => {
    const plainLines: ConsoleLine[] = [{ text: 'plain text', prefix: '' }];
    const { container } = render(<WorkflowConsolePanel {...defaultProps} lines={plainLines} />);
    const line = container.querySelector('.wf-cl-plain')!;
    expect(line).toBeTruthy();
    // No timestamp span when ts is undefined
    expect(line.querySelector('.wf-cl-ts')).toBeNull();
  });

  it('navigates to next match with Enter key', () => {
    const lines: ConsoleLine[] = [
      makeLine('foo bar', '*'),
      makeLine('hello world', '*'),
      makeLine('foo baz', '*'),
    ];
    render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    fireEvent.click(screen.getByTitle('Search console'));
    const input = screen.getByPlaceholderText('Search console…');
    fireEvent.change(input, { target: { value: 'foo' } });
    expect(screen.getByText('1/2')).toBeTruthy();
    // Press Enter to go to next match
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('navigates to previous match with Shift+Enter key', () => {
    const lines: ConsoleLine[] = [
      makeLine('foo bar', '*'),
      makeLine('hello world', '*'),
      makeLine('foo baz', '*'),
    ];
    render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    fireEvent.click(screen.getByTitle('Search console'));
    const input = screen.getByPlaceholderText('Search console…');
    fireEvent.change(input, { target: { value: 'foo' } });
    // Go to next first
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2/2')).toBeTruthy();
    // Press Shift+Enter to go back
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('closes search with Escape key', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Search console'));
    expect(container.querySelector('.wf-console-search-bar')).toBeTruthy();
    const input = screen.getByPlaceholderText('Search console…');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('.wf-console-search-bar')).toBeNull();
  });

  it('navigates matches with prev/next buttons', () => {
    const lines: ConsoleLine[] = [
      makeLine('foo one', '*'),
      makeLine('foo two', '*'),
      makeLine('foo three', '*'),
    ];
    render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    fireEvent.click(screen.getByTitle('Search console'));
    const input = screen.getByPlaceholderText('Search console…');
    fireEvent.change(input, { target: { value: 'foo' } });
    expect(screen.getByText('1/3')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('wraps around when navigating matches forward', () => {
    const lines: ConsoleLine[] = [makeLine('foo one', '*'), makeLine('foo two', '*')];
    render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(screen.getByText('2/2')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('wraps around when navigating matches backward', () => {
    const lines: ConsoleLine[] = [makeLine('foo one', '*'), makeLine('foo two', '*')];
    render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('changes mode via selector', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'floating' } });
    expect(container.querySelector('.wf-console-floating')).toBeTruthy();
  });

  it('changes to maximized mode via selector', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'maximized' } });
    expect(container.querySelector('.wf-console-maximized')).toBeTruthy();
  });

  it('renders floating grip and edge when in floating mode', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'floating' } });
    expect(container.querySelector('.wf-console-float-grip')).toBeTruthy();
    expect(container.querySelector('.wf-console-float-edge-right')).toBeTruthy();
  });

  it('renders docked resize handle when in docked mode', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    expect(container.querySelector('.wf-console-resize-handle')).toBeTruthy();
  });

  it('does not render docked resize handle in maximized mode', () => {
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'maximized' } });
    expect(container.querySelector('.wf-console-resize-handle')).toBeNull();
  });

  it('renders timeline with error state', () => {
    const summaries = [
      { label: 'Failed Step', state: 'error' as const, statusCode: 500, responseTimeMs: 200, error: 'Connection refused' },
    ];
    const { container } = render(
      <WorkflowConsolePanel {...defaultProps} stepSummaries={summaries} />,
    );
    fireEvent.click(screen.getByText('Timeline'));
    expect(container.querySelector('.wf-timeline-error')).toBeTruthy();
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('renders timeline with skipped state', () => {
    const summaries = [
      { label: 'Skipped Step', state: 'skipped' as const },
    ];
    render(<WorkflowConsolePanel {...defaultProps} stepSummaries={summaries} />);
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('SKIPPED')).toBeTruthy();
  });

  it('renders timeline step without responseTimeMs', () => {
    const summaries = [
      { label: 'No Time', state: 'success' as const, statusCode: 200 },
    ];
    render(<WorkflowConsolePanel {...defaultProps} stepSummaries={summaries} />);
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('renders timeline step without statusCode', () => {
    const summaries = [
      { label: 'No Code', state: 'success' as const, responseTimeMs: 50 },
    ];
    render(<WorkflowConsolePanel {...defaultProps} stepSummaries={summaries} />);
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('— · 50ms')).toBeTruthy();
  });

  it('renders timestamps when ts is provided', () => {
    const lines: ConsoleLine[] = [makeLine('With time', '*', 1700000000000)];
    const { container } = render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    expect(container.querySelector('.wf-cl-ts')).toBeTruthy();
  });

  it('handles highlightMatches with regex special characters', () => {
    const lines: ConsoleLine[] = [makeLine('test (foo) bar', '*')];
    render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: '(foo)' } });
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('auto-scroll re-enables on separator line', () => {
    const lines1: ConsoleLine[] = [makeLine('line1', '*')];
    const { rerender } = render(<WorkflowConsolePanel {...defaultProps} lines={lines1} />);
    // Add separator (new run marker) to trigger auto-scroll re-enable
    const lines2: ConsoleLine[] = [...lines1, makeLine('Run · 10:00:00', '---')];
    rerender(<WorkflowConsolePanel {...defaultProps} lines={lines2} />);
    // scrollIntoView should have been called
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('search next/prev do nothing when no matches', () => {
    render(<WorkflowConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Search console'));
    fireEvent.change(screen.getByPlaceholderText('Search console…'), { target: { value: 'zzzzz' } });
    // Should not throw when clicking disabled buttons
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('uses stored mode from localStorage', () => {
    localStorage.setItem('wf-console-default-mode', 'maximized');
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    expect(container.querySelector('.wf-console-maximized')).toBeTruthy();
  });

  it('falls back to docked when localStorage has invalid mode', () => {
    localStorage.setItem('wf-console-default-mode', 'invalid');
    const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
    expect(container.querySelector('.wf-console-docked')).toBeTruthy();
  });

  it('handles unknown prefix gracefully', () => {
    const lines: ConsoleLine[] = [{ text: 'unknown prefix', prefix: 'X' as ConsoleLine['prefix'] }];
    const { container } = render(<WorkflowConsolePanel {...defaultProps} lines={lines} />);
    // Should use wf-cl-plain as fallback
    expect(container.querySelector('.wf-cl-plain')).toBeTruthy();
  });

  // ── E3: Sub-Workflow Child Results in Timeline ──

  it('renders sub-workflow steps in timeline with expand toggle', () => {
    const stepSummaries = [
      {
        nodeId: 'sw1',
        label: 'Sub-Workflow',
        state: 'pass' as const,
        childWorkflowName: 'Auth Flow',
        childSteps: [
          { nodeId: 'ch1', label: 'Login', state: 'pass' as const, statusCode: 200, responseTimeMs: 50 },
          { nodeId: 'ch2', label: 'Token', state: 'pass' as const, statusCode: 200, responseTimeMs: 30 },
        ],
        childDurationMs: 85,
        childAttempt: 0,
      },
    ];
    const { container } = render(
      <WorkflowConsolePanel {...defaultProps} stepSummaries={stepSummaries} />,
    );
    // Switch to timeline view
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('Sub-Workflow')).toBeTruthy();
    expect(screen.getByText('→ Auth Flow')).toBeTruthy();
    // Should show step count badge
    expect(screen.getByText('2 steps · 85ms')).toBeTruthy();
    // Child steps hidden by default
    expect(screen.queryByText('Login')).toBeFalsy();
    // Click to expand
    fireEvent.click(container.querySelector('.wf-timeline-item-expandable')!);
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Token')).toBeTruthy();
  });

  it('collapses child steps on second click', () => {
    const stepSummaries = [
      {
        nodeId: 'sw1',
        label: 'Sub-Workflow',
        state: 'pass' as const,
        childWorkflowName: 'Auth Flow',
        childSteps: [
          { nodeId: 'ch1', label: 'Login', state: 'pass' as const, statusCode: 200 },
        ],
        childDurationMs: 50,
      },
    ];
    const { container } = render(
      <WorkflowConsolePanel {...defaultProps} stepSummaries={stepSummaries} />,
    );
    fireEvent.click(screen.getByText('Timeline'));
    const expandable = container.querySelector('.wf-timeline-item-expandable')!;
    // Expand
    fireEvent.click(expandable);
    expect(screen.getByText('Login')).toBeTruthy();
    // Collapse
    fireEvent.click(expandable);
    expect(screen.queryByText('Login')).toBeFalsy();
  });

  it('shows retry attempt number in timeline badge', () => {
    const stepSummaries = [
      {
        nodeId: 'sw1',
        label: 'Flaky Sub',
        state: 'pass' as const,
        childWorkflowName: 'Retry Flow',
        childSteps: [
          { nodeId: 'ch1', label: 'Step 1', state: 'pass' as const },
        ],
        childDurationMs: 100,
        childAttempt: 2,
      },
    ];
    render(
      <WorkflowConsolePanel {...defaultProps} stepSummaries={stepSummaries} />,
    );
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('1 step · 100ms · attempt 3')).toBeTruthy();
  });

  it('renders regular HTTP steps in timeline unchanged', () => {
    const stepSummaries = [
      { nodeId: 'h1', label: 'GET Users', state: 'pass' as const, statusCode: 200, responseTimeMs: 45 },
    ];
    render(
      <WorkflowConsolePanel {...defaultProps} stepSummaries={stepSummaries} />,
    );
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('GET Users')).toBeTruthy();
    expect(screen.getByText('200 · 45ms')).toBeTruthy();
  });

  describe('docked resize', () => {
    it('resizes docked panel via drag on resize handle', () => {
      const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
      const handle = container.querySelector('.wf-console-resize-handle')!;
      fireEvent.mouseDown(handle, { clientX: 0, clientY: 300 });
      // Drag upward to increase height
      fireEvent.mouseMove(window, { clientX: 0, clientY: 200 });
      fireEvent.mouseUp(window);
      expect(document.body.style.cursor).toBe('');
    });
  });

  describe('floating drag', () => {
    it('drags floating panel via header mousedown + mousemove', () => {
      const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
      const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'floating' } });
      const header = container.querySelector('.wf-console-header')!;
      fireEvent.mouseDown(header, { clientX: 100, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 150, clientY: 80 });
      fireEvent.mouseUp(window);
      expect(document.body.style.cursor).toBe('');
    });

    it('does not start drag when mousedown on button inside header', () => {
      const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
      const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'floating' } });
      const clearBtn = screen.getByTitle('Clear console');
      fireEvent.mouseDown(clearBtn, { clientX: 100, clientY: 50 });
      // Body cursor should not become grabbing
      expect(document.body.style.cursor).not.toBe('grabbing');
    });
  });

  describe('floating resize (corner)', () => {
    it('resizes floating panel via grip mousedown + mousemove', () => {
      const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
      const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'floating' } });
      const grip = container.querySelector('.wf-console-float-grip')!;
      fireEvent.mouseDown(grip, { clientX: 500, clientY: 400 });
      fireEvent.mouseMove(window, { clientX: 600, clientY: 500 });
      fireEvent.mouseUp(window);
      expect(document.body.style.cursor).toBe('');
    });
  });

  describe('floating resize (right edge)', () => {
    it('resizes floating panel width via right edge drag', () => {
      const { container } = render(<WorkflowConsolePanel {...defaultProps} />);
      const select = container.querySelector('.wf-console-mode-select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'floating' } });
      const edge = container.querySelector('.wf-console-float-edge-right')!;
      fireEvent.mouseDown(edge, { clientX: 500, clientY: 200 });
      fireEvent.mouseMove(window, { clientX: 600, clientY: 200 });
      fireEvent.mouseUp(window);
      expect(document.body.style.cursor).toBe('');
    });
  });

  describe('timeline active class', () => {
    it('applies active class to Timeline button when selected', () => {
      const summaries = [
        { nodeId: 'h1', label: 'Step', state: 'pass' as const, statusCode: 200 },
      ];
      render(<WorkflowConsolePanel {...defaultProps} stepSummaries={summaries} />);
      const timelineBtn = screen.getByText('Timeline');
      fireEvent.click(timelineBtn);
      expect(timelineBtn.classList.contains('wf-console-view-btn-active')).toBe(true);
    });
  });
});
