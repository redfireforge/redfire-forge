/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockConsolePanel } from './ApiMockConsolePanel';

const lines = [
  { ts: '2026-08-12T00:00:00.000Z', level: 'info', message: 'Started "Mock Server 1" on :4600' },
  { ts: '2026-08-12T00:00:05.000Z', level: 'info', message: 'Stopped "srv-1"' },
  { ts: '2026-08-12T00:00:08.000Z', level: 'info', message: 'Committed gen 2 for "srv-1"' },
  { ts: '2026-08-12T00:00:09.000Z', level: 'error', message: 'bind failed' },
  { message: 'bare line' },
];

describe('ApiMockConsolePanel', () => {
  it('shows the empty state when there are no lines', () => {
    render(<ApiMockConsolePanel lines={[]} />);
    expect(screen.getByTestId('api-mock-dock-console-empty').textContent).toMatch(/No console output/i);
    expect(screen.queryByTestId('api-mock-console-clear')).toBeNull();
  });

  it('renders lines, filters by event, and searches', () => {
    const onClear = vi.fn();
    render(<ApiMockConsolePanel lines={lines} onClear={onClear} />);
    const pane = screen.getByTestId('api-mock-dock-console');
    expect(pane.textContent).toContain('Started "Mock Server 1" on :4600');
    expect(pane.textContent).toContain('Committed gen 2 for "srv-1"');
    expect(pane.textContent).toContain('bare line');

    fireEvent.click(screen.getByTestId('api-mock-console-filter-started'));
    expect(pane.textContent).toContain('Started "Mock Server 1"');
    expect(pane.textContent).not.toContain('Stopped "srv-1"');
    expect(screen.getByTestId('api-mock-console-filter-started').querySelector('.am-count-badge')?.textContent).toBe('1');

    fireEvent.click(screen.getByTestId('api-mock-console-filter-stopped'));
    expect(pane.textContent).toContain('Stopped "srv-1"');
    expect(pane.textContent).not.toContain('Started "Mock Server 1"');

    fireEvent.click(screen.getByTestId('api-mock-console-filter-applied'));
    expect(pane.textContent).toContain('Committed gen 2');

    fireEvent.click(screen.getByTestId('api-mock-console-filter-errors'));
    expect(pane.textContent).toContain('bind failed');
    expect(pane.textContent).not.toContain('Committed gen 2');

    fireEvent.click(screen.getByTestId('api-mock-console-filter-all'));
    fireEvent.change(screen.getByTestId('api-mock-console-search'), { target: { value: 'gen 2' } });
    expect(screen.getByTestId('api-mock-console-match-count').textContent).toMatch(/1 match/);
    expect(pane.textContent).toContain('Committed gen 2');
    expect(pane.textContent).not.toContain('Started "Mock Server 1"');

    fireEvent.change(screen.getByTestId('api-mock-console-search'), { target: { value: 'zzz-none' } });
    expect(screen.getByTestId('api-mock-console-filter-empty').textContent).toMatch(/No logs match/i);

    fireEvent.click(screen.getByTestId('api-mock-console-clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('focuses search on Cmd+F / Ctrl+F', () => {
    render(<ApiMockConsolePanel lines={lines} />);
    const input = screen.getByTestId('api-mock-console-search');
    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(document.activeElement).toBe(input);
    (input as HTMLInputElement).blur();
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('skips invalid timestamps', () => {
    render(<ApiMockConsolePanel lines={[{ ts: 'nope', level: 'info', message: 'Started x' }]} />);
    expect(screen.getByTestId('api-mock-dock-console').textContent).toContain('Started x');
  });
});
