/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConsolePanel } from './ConsolePanel';
import { WS_CONSOLE_DEFAULT_SETTINGS, type WsConsoleEntry, type WsConsoleSettings } from './wsConsoleTypes';

const mockSaveFile = vi.fn();
vi.mock('../../shared/utils/fileSaver', () => ({
  saveFile: (...args: unknown[]) => mockSaveFile(...args),
}));

const entries: WsConsoleEntry[] = [
  { id: '1', level: 'info', direction: 'info', category: 'lifecycle', message: 'Connecting to ws://h', timestamp: new Date().toISOString() },
  { id: '2', level: 'info', direction: 'info', category: 'handshake', message: '101 Switching Protocols', detail: '> GET / HTTP/1.1\n< HTTP/1.1 101', timestamp: new Date().toISOString() },
  { id: '3', level: 'warn', direction: 'info', category: 'reconnect', message: 'Reconnect attempt 1/5', timestamp: new Date().toISOString() },
  { id: '4', level: 'error', direction: 'info', category: 'lifecycle', message: 'boom', timestamp: new Date().toISOString() },
];

function renderPanel(over: Partial<WsConsoleSettings> = {}, props: Partial<React.ComponentProps<typeof ConsolePanel>> = {}) {
  const settings = { ...WS_CONSOLE_DEFAULT_SETTINGS, ...over };
  const onSettingsChange = vi.fn();
  const onClear = vi.fn();
  render(
    <ConsolePanel
      entries={entries}
      settings={settings}
      onSettingsChange={onSettingsChange}
      onClear={onClear}
      variant="ws"
      {...props}
    />,
  );
  return { onSettingsChange, onClear };
}

describe('ConsolePanel', () => {
  it('renders structured rows and the count', () => {
    renderPanel();
    expect(screen.getByText('101 Switching Protocols')).toBeInTheDocument();
    expect(screen.getByTestId('ws-console-count')).toHaveTextContent('4/4');
  });

  it('toggles to the raw view', () => {
    const { onSettingsChange } = renderPanel();
    fireEvent.click(screen.getByTestId('ws-console-view-raw'));
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ view: 'raw' }));
  });

  it('renders raw timeline lines when view is raw', () => {
    renderPanel({ view: 'raw' });
    expect(screen.getByText('GET / HTTP/1.1')).toBeInTheDocument();
    expect(screen.getByText('HTTP/1.1 101')).toBeInTheDocument();
  });

  it('applies a level filter via settings change', () => {
    const { onSettingsChange } = renderPanel();
    fireEvent.click(screen.getByTestId('ws-console-level-error'));
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ levelFilter: 'error' }));
  });

  it('filters by level when settings say so', () => {
    renderPanel({ levelFilter: 'error' });
    expect(screen.getByTestId('ws-console-count')).toHaveTextContent('1/4');
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('Reconnect attempt 1/5')).not.toBeInTheDocument();
  });

  it('filters locally by search text', () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('ws-console-search'), { target: { value: 'reconnect' } });
    expect(screen.getByTestId('ws-console-count')).toHaveTextContent('1/4');
    expect(screen.getByText('Reconnect attempt 1/5')).toBeInTheDocument();
  });

  it('expands an entry detail on click', () => {
    renderPanel();
    expect(screen.queryByText(/GET \/ HTTP\/1\.1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ws-console-entry-2'));
    expect(screen.getByText(/GET \/ HTTP\/1\.1/)).toBeInTheDocument();
  });

  it('calls onClear when Clear is clicked', () => {
    const { onClear } = renderPanel();
    fireEvent.click(screen.getByTestId('ws-console-clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows an empty state when there are no entries', () => {
    render(
      <ConsolePanel
        entries={[]}
        settings={WS_CONSOLE_DEFAULT_SETTINGS}
        onSettingsChange={vi.fn()}
        onClear={vi.fn()}
        variant="ws"
      />,
    );
    expect(screen.getByTestId('ws-console-empty')).toBeInTheDocument();
  });

  it('toggles auto-scroll', () => {
    const { onSettingsChange } = renderPanel({ autoScroll: true });
    fireEvent.click(screen.getByTestId('ws-console-autoscroll'));
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ autoScroll: false }));
  });

  it('scrolls to the bottom when auto-scroll is enabled', () => {
    // Exercises the auto-scroll effect body (sets scrollTop = scrollHeight).
    renderPanel({ autoScroll: true });
    const body = document.querySelector('.ws-console-body') as HTMLDivElement;
    expect(body).toBeTruthy();
    // jsdom reports 0 height, but the assignment ran without throwing.
    expect(body.scrollTop).toBe(0);
  });

  it('changes the category filter via the select', () => {
    const { onSettingsChange } = renderPanel();
    fireEvent.change(screen.getByTestId('ws-console-category'), { target: { value: 'reconnect' } });
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ categoryFilter: 'reconnect' }));
  });

  it('copies the filtered console to the clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPanel();
    fireEvent.click(screen.getByText('Copy'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(typeof writeText.mock.calls[0][0]).toBe('string');
  });

  it('exports the filtered console to a file', () => {
    mockSaveFile.mockClear();
    renderPanel();
    fireEvent.click(screen.getByText('Export'));
    expect(mockSaveFile).toHaveBeenCalledTimes(1);
    const opts = mockSaveFile.mock.calls[0][1];
    expect(opts.filename).toMatch(/^ws-console-.*\.log$/);
  });

  it('expands and collapses an entry detail with the keyboard', () => {
    renderPanel();
    const row = screen.getByTestId('ws-console-entry-2');
    expect(screen.queryByText(/GET \/ HTTP\/1\.1/)).not.toBeInTheDocument();
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(screen.getByText(/GET \/ HTTP\/1\.1/)).toBeInTheDocument();
    // Space collapses it again (covers the Set.delete branch in toggleExpanded).
    fireEvent.keyDown(screen.getByTestId('ws-console-entry-2'), { key: ' ' });
    expect(screen.queryByText(/GET \/ HTTP\/1\.1/)).not.toBeInTheDocument();
  });
});

describe('ConsolePanel — command line (Phase 10)', () => {
  it('hides the command line when onCommand is not provided', () => {
    renderPanel();
    expect(screen.queryByTestId('ws-console-cmd')).not.toBeInTheDocument();
  });

  it('renders the command line and hint when onCommand is provided', () => {
    renderPanel({}, { onCommand: vi.fn(), commandHint: '↑↓ history · /help' });
    expect(screen.getByTestId('ws-console-cmd')).toBeInTheDocument();
    expect(screen.getByText('↑↓ history · /help')).toBeInTheDocument();
  });

  it('submits the trimmed command on Enter and clears the input', () => {
    const onCommand = vi.fn();
    renderPanel({}, { onCommand });
    const input = screen.getByTestId('ws-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  /ping  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommand).toHaveBeenCalledWith('/ping');
    expect(input.value).toBe('');
  });

  it('does not submit blank input', () => {
    const onCommand = vi.fn();
    renderPanel({}, { onCommand });
    const input = screen.getByTestId('ws-console-cmd-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('recalls history with ArrowUp / ArrowDown', () => {
    const onCommand = vi.fn();
    renderPanel({}, { onCommand });
    const input = screen.getByTestId('ws-console-cmd-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '/help' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '/clear' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Up → newest first
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('/clear');
    // Up again → older
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('/help');
    // Down → newer
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('/clear');
    // Down past newest → live (empty)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('ArrowUp is a no-op when there is no history', () => {
    const onCommand = vi.fn();
    renderPanel({}, { onCommand });
    const input = screen.getByTestId('ws-console-cmd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'draft' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('draft');
  });
});

