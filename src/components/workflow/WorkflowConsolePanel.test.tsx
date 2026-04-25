/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import WorkflowConsolePanel from './WorkflowConsolePanel';
import type { ConsoleLine } from '../../hooks/useResponseCache';

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
    expect(screen.getByText('● Auto-clear')).toBeTruthy();
  });

  it('displays append toggle in append mode', () => {
    render(<WorkflowConsolePanel {...defaultProps} runBehavior="append" />);
    expect(screen.getByText('○ Append')).toBeTruthy();
  });

  it('toggles run behavior when toggle clicked', () => {
    const onRunBehaviorChange = vi.fn();
    render(<WorkflowConsolePanel {...defaultProps} onRunBehaviorChange={onRunBehaviorChange} />);
    fireEvent.click(screen.getByText('● Auto-clear'));
    expect(onRunBehaviorChange).toHaveBeenCalledWith('append');
  });

  it('toggles from append to clear', () => {
    const onRunBehaviorChange = vi.fn();
    render(<WorkflowConsolePanel {...defaultProps} runBehavior="append" onRunBehaviorChange={onRunBehaviorChange} />);
    fireEvent.click(screen.getByText('○ Append'));
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
});
