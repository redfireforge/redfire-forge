/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResponseHistoryDropdown } from './ResponseHistoryDropdown';
import type { ResponseHistoryEntry } from '../hooks/useResponseCache';
import type { HttpResponse } from '../../../shared/utils/httpClient';

function http(bodyLen: number, status: number, statusText: string): HttpResponse {
  return {
    status,
    statusText,
    headers: {},
    body: 'x'.repeat(bodyLen),
  };
}

function entry(
  overrides: Partial<ResponseHistoryEntry> & Pick<ResponseHistoryEntry, 'id'> & Partial<{ timestamp: number }>,
): ResponseHistoryEntry {
  return {
    method: 'GET',
    url: 'https://api.example.com/v1/r',
    response: http(10, 200, 'OK'),
    responseTime: 42,
    consoleLines: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('ResponseHistoryDropdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T16:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disables trigger when empty', () => {
    render(
      <ResponseHistoryDropdown
        history={[]}
        currentEntryId={null}
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /No History/ })).toBeDisabled();
  });

  it('shows time ago bands and trims long status text', () => {
    const now = Date.now();
    render(
      <ResponseHistoryDropdown
        history={[
          entry({
            id: 'a',
            timestamp: now - 30_000,
            url: 'https://host.invalid/%20',
            response: http(10, 502, 'Bad Gateway Error'),
          }),
          entry({
            id: 'b',
            timestamp: now - 10 * 86_400_000,
          }),
        ]}
        currentEntryId={null}
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText(/502\s+BA/)).toBeInTheDocument();
    expect(screen.getByText(/\bOlder\b/)).toBeInTheDocument();
  });

  it('closes on outside click and restores selection', () => {
    const onRestore = vi.fn();
    render(
      <ResponseHistoryDropdown
        history={[entry({ id: 'x', timestamp: Date.now() - 61_000 })]}
        currentEntryId="x"
        onRestore={onRestore}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Clear History')).toBeNull();
    fireEvent.click(screen.getByTitle('Response history'));
    fireEvent.click(screen.getByRole('button', { name: /GET/ }));
    expect(onRestore).toHaveBeenCalledWith('x');
  });

  it('clear history and delete current callbacks fire', () => {
    const onClear = vi.fn();
    const onDel = vi.fn();
    render(
      <ResponseHistoryDropdown
        history={[entry({ id: 'keep', timestamp: Date.now() })]}
        currentEntryId="keep"
        onRestore={vi.fn()}
        onDeleteEntry={onDel}
        onClearHistory={onClear}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    fireEvent.click(screen.getByText(/Delete Current Response/));
    expect(onDel).toHaveBeenCalledWith('keep');
    fireEvent.click(screen.getByTitle('Response history'));
    fireEvent.click(screen.getByText(/Clear History/));
    expect(onClear).toHaveBeenCalled();
  });

  it('warn class for transitional status codes', () => {
    render(
      <ResponseHistoryDropdown
        history={[entry({
          id: 'w',
          timestamp: Date.now(),
          response: http(10, 301, 'Moved'),
        })]}
        currentEntryId="w"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(document.querySelector('.resp-history-status.warn')).toBeTruthy();
  });

  it('shows timeago strings for minute, hour, and day scales', () => {
    const now = Date.now();
    const { rerender } = render(
      <ResponseHistoryDropdown
        history={[entry({ id: 'recent', timestamp: now - 20_000 })]}
        currentEntryId="recent"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText(/Just now/)).toBeInTheDocument();

    rerender(
      <ResponseHistoryDropdown
        history={[entry({ id: 'm', timestamp: now - 3 * 60_000 })]}
        currentEntryId="m"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText(/^3 min ago$/)).toBeInTheDocument();

    rerender(
      <ResponseHistoryDropdown
        history={[entry({ id: 'h', timestamp: now - 3 * 60 * 60_000 })]}
        currentEntryId="h"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText(/^3h ago$/)).toBeInTheDocument();

    rerender(
      <ResponseHistoryDropdown
        history={[entry({ id: 'd', timestamp: now - 3 * 24 * 60 * 60_000 })]}
        currentEntryId="d"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText(/^3d ago$/)).toBeInTheDocument();
  });

  it('buckets grouped labels across day and week horizons', () => {
    vi.setSystemTime(new Date('2026-05-18T16:00:00.000Z'));
    const t0 = Date.now();
    const dayStart = Date.UTC(2026, 4, 18, 6, 0, 0);
    const prevWeekDay = Date.UTC(2026, 4, 16, 12, 0, 0);
    const stale = Date.UTC(2026, 4, 5, 12, 0, 0);
    render(
      <ResponseHistoryDropdown
        history={[
          entry({ id: 'jn', timestamp: t0 - 2 * 60_000 }),
          entry({ id: 'et', timestamp: t0 - 45 * 60_000 }),
          entry({ id: 'td', timestamp: dayStart }),
          entry({ id: 'tw', timestamp: prevWeekDay }),
          entry({ id: 'old', timestamp: stale }),
        ]}
        currentEntryId={null}
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText('Just Now')).toBeInTheDocument();
    expect(screen.getByText('Earlier Today')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('Older')).toBeInTheDocument();
  });

  it('uses success styling and short status text for 200 OK', () => {
    render(
      <ResponseHistoryDropdown
        history={[entry({
          id: 'ok',
          timestamp: Date.now(),
          url: '/relative-path',
          response: http(0, 200, 'OK'),
        })]}
        currentEntryId="ok"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.getByText(/200\s+OK/)).toBeInTheDocument();
    expect(document.querySelector('.resp-history-status.success')).toBeTruthy();
    expect(screen.getByTitle('/relative-path')).toHaveTextContent('/relative-path');
  });

  it('styles server errors distinctly from warnings', () => {
    render(
      <ResponseHistoryDropdown
        history={[entry({
          id: 'e',
          timestamp: Date.now(),
          response: http(10, 500, 'Error'),
        })]}
        currentEntryId="e"
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(document.querySelector('.resp-history-status.error')).toBeTruthy();
  });

  it('hides delete-current action without a selected entry id', () => {
    render(
      <ResponseHistoryDropdown
        history={[entry({ id: 'x', timestamp: Date.now() })]}
        currentEntryId={null}
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Response history'));
    expect(screen.queryByText(/Delete Current Response/)).toBeNull();
  });

  it('toggles dropdown arrow orientation', () => {
    render(
      <ResponseHistoryDropdown
        history={[entry({ id: 'a', timestamp: Date.now() })]}
        currentEntryId={null}
        onRestore={vi.fn()}
        onDeleteEntry={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );
    const trigger = screen.getByTitle('Response history');
    expect(trigger).toHaveTextContent('▼');
    fireEvent.click(trigger);
    expect(trigger).toHaveTextContent('▲');
  });
});
