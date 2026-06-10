/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SseMessageLog } from './SseMessageLog';
import type { SseEvent, SseStats } from './sseTypes';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 28,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 28,
        size: 28,
        key: i,
      })),
  }),
}));

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn(),
}));

function makeEvent(overrides: Partial<SseEvent> = {}): SseEvent {
  return {
    id: `sse-${Math.random()}`,
    eventType: 'message',
    data: '{"hello":"world"}',
    lastEventId: '',
    size: 17,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const defaultStats: SseStats = {
  eventCount: 0,
  startedAt: null,
  eventTypeCounts: {},
};

describe('SseMessageLog', () => {
  it('renders empty state when no events', () => {
    render(
      <SseMessageLog
        events={[]}
        stats={defaultStats}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );
    expect(screen.getByText('Waiting for events…')).toBeDefined();
  });

  it('renders event rows', () => {
    const events = [makeEvent({ id: 'e1' }), makeEvent({ id: 'e2' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 2, startedAt: Date.now(), eventTypeCounts: { message: 2 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={Date.now()}
      />,
    );
    expect(screen.getAllByTestId('sse-event-row')).toHaveLength(2);
  });

  it('filters events by search text', () => {
    const events = [
      makeEvent({ id: 'e1', data: 'apple' }),
      makeEvent({ id: 'e2', data: 'banana' }),
    ];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 2, startedAt: null, eventTypeCounts: { message: 2 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.change(screen.getByTestId('sse-search'), { target: { value: 'apple' } });
    expect(screen.getAllByTestId('sse-event-row')).toHaveLength(1);
  });

  it('filters events by event type', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'update' }),
      makeEvent({ id: 'e2', eventType: 'delete' }),
      makeEvent({ id: 'e3', eventType: 'update' }),
    ];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 3, startedAt: null, eventTypeCounts: { update: 2, delete: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.change(screen.getByTestId('sse-type-filter'), { target: { value: 'delete' } });
    expect(screen.getAllByTestId('sse-event-row')).toHaveLength(1);
  });

  it('filters bookmarked events', () => {
    const events = [
      makeEvent({ id: 'e1' }),
      makeEvent({ id: 'e2' }),
    ];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 2, startedAt: null, eventTypeCounts: { message: 2 } }}
        bookmarkedIds={new Set(['e1'])}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.click(screen.getByTestId('sse-bookmark-filter'));
    expect(screen.getAllByTestId('sse-event-row')).toHaveLength(1);
  });

  it('shows event detail on row click', () => {
    const events = [makeEvent({ id: 'e1', data: '{"test":true}' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.click(screen.getByTestId('sse-event-row'));
    expect(screen.getByTestId('sse-event-detail')).toBeDefined();
  });

  it('closes event detail panel', () => {
    const events = [makeEvent({ id: 'e1' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.click(screen.getByTestId('sse-event-row'));
    expect(screen.getByTestId('sse-event-detail')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Close detail'));
    expect(screen.queryByTestId('sse-event-detail')).toBeNull();
  });

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn();
    render(
      <SseMessageLog
        events={[makeEvent()]}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={onClear}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.click(screen.getByTestId('sse-clear-btn'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleBookmark when bookmark button clicked', () => {
    const onToggleBookmark = vi.fn();
    const events = [makeEvent({ id: 'e1' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={onToggleBookmark}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.click(screen.getByLabelText('Add bookmark'));
    expect(onToggleBookmark).toHaveBeenCalledWith('e1');
  });

  it('shows Last-Event-ID in status bar when present', () => {
    render(
      <SseMessageLog
        events={[]}
        stats={defaultStats}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId="42"
        uptime={null}
      />,
    );

    expect(screen.getByTestId('sse-status-bar').textContent).toContain('Last-Event-ID: 42');
  });

  it('shows filter-empty message when filters match nothing', () => {
    const events = [makeEvent({ id: 'e1', data: 'hello' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );

    fireEvent.change(screen.getByTestId('sse-search'), { target: { value: 'zzzzzzz' } });
    expect(screen.getByText('No events match the current filters')).toBeDefined();
  });

  it('export button calls saveJsonFile', async () => {
    const { saveJsonFile } = await import('../../shared/utils/fileSaver');
    const events = [makeEvent({ id: 'e1' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );
    fireEvent.click(screen.getByTestId('sse-export-btn'));
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('shows status bar with event counts', () => {
    const events = [makeEvent({ id: 'e1' }), makeEvent({ id: 'e2' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 2, startedAt: null, eventTypeCounts: { message: 2 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );
    const statusBar = screen.getByTestId('sse-status-bar');
    expect(statusBar.textContent).toContain('Events: 2');
    expect(statusBar.textContent).toContain('Showing: 2');
  });

  it('shows uptime in status bar', () => {
    // uptime is a startedAt timestamp; 65 seconds ago => should show "1m Xs"
    const startedAt = Date.now() - 65000;
    render(
      <SseMessageLog
        events={[]}
        stats={{ eventCount: 0, startedAt: null, eventTypeCounts: {} }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={startedAt}
      />,
    );
    const statusBar = screen.getByTestId('sse-status-bar');
    expect(statusBar.textContent).toContain('Uptime:');
    expect(statusBar.textContent).toMatch(/1m \d+s/);
  });

  it('shows lastEventId in status bar when provided', () => {
    render(
      <SseMessageLog
        events={[]}
        stats={{ eventCount: 0, startedAt: null, eventTypeCounts: {} }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId="evt-99"
        uptime={null}
      />,
    );
    const statusBar = screen.getByTestId('sse-status-bar');
    expect(statusBar.textContent).toContain('Last-Event-ID: evt-99');
  });

  it('shows event type counts in status bar', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'update' }),
      makeEvent({ id: 'e2', eventType: 'update' }),
      makeEvent({ id: 'e3', eventType: 'message' }),
    ];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 3, startedAt: null, eventTypeCounts: { update: 2, message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );
    const statusBar = screen.getByTestId('sse-status-bar');
    expect(statusBar.textContent).toContain('Types:');
  });

  it('deselects event on second click', () => {
    const events = [makeEvent({ id: 'e1', data: 'test data' })];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 1, startedAt: null, eventTypeCounts: { message: 1 } }}
        bookmarkedIds={new Set()}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );
    const row = screen.getByTestId('sse-event-row');
    fireEvent.click(row);
    expect(screen.getByTestId('sse-event-detail')).toBeTruthy();
    // Click again to deselect
    fireEvent.click(row);
    expect(screen.queryByTestId('sse-event-detail')).toBeNull();
  });

  it('bookmark filter toggles showing only bookmarked events', () => {
    const events = [
      makeEvent({ id: 'e1', data: 'first' }),
      makeEvent({ id: 'e2', data: 'second' }),
    ];
    render(
      <SseMessageLog
        events={events}
        stats={{ eventCount: 2, startedAt: null, eventTypeCounts: { message: 2 } }}
        bookmarkedIds={new Set(['e1'])}
        onToggleBookmark={vi.fn()}
        onClear={vi.fn()}
        lastEventId=""
        uptime={null}
      />,
    );
    fireEvent.click(screen.getByTestId('sse-bookmark-filter'));
    // Should show only 1 bookmarked event
    const statusBar = screen.getByTestId('sse-status-bar');
    expect(statusBar.textContent).toContain('Showing: 1');
  });
});
