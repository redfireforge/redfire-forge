/**
 * @vitest-environment jsdom
 */
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectOption } from '@test-utils/customSelectHelper';
import { GrpcConsoleModal, type GrpcConsoleWireEvent } from './GrpcConsoleModal';

function makeMultiEvents(): GrpcConsoleWireEvent[] {
  return [
    {
      id: 'evt-1',
      timestamp: '2026-07-05T12:00:00.000Z',
      direction: 'send',
      service: 'echo.EchoService',
      method: 'Echo',
      summary: 'Unary request',
      payload: { id: 1 },
    },
    {
      id: 'evt-2',
      timestamp: '2026-07-05T12:00:10.000Z',
      direction: 'recv',
      service: 'echo.EchoService',
      method: 'Echo',
      summary: 'Unary response',
      payload: { id: 2 },
    },
  ];
}

describe('GrpcConsoleModal coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders live feed payloads while auto-following', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const feed = getByTestId('grpc-console-wire-live-feed');
    expect(feed.textContent).toContain('"id": 1');
    expect(feed.textContent).toContain('"id": 2');
  });

  it('shows service and method metadata in pinned detail header', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(getByTestId('grpc-console-wire-row-evt-1'));
    const detail = getByTestId('grpc-console-wire-detail');
    expect(detail.textContent).toContain('echo.EchoService/Echo');
    expect(detail.textContent).toContain('"id": 1');
  });

  it('omits service/method suffix in pinned detail when metadata is absent', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={[{
          id: 'evt-bare',
          timestamp: '2026-07-05T12:00:00.000Z',
          direction: 'event',
          summary: 'Lifecycle event',
          payload: { ok: true },
        }]}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(getByTestId('grpc-console-wire-row-evt-bare'));
    const detail = getByTestId('grpc-console-wire-detail');
    expect(detail.textContent).toContain('Lifecycle event');
    expect(detail.textContent).not.toContain('EchoService/');
  });

  it('swallows JSON.stringify failures while building search haystacks', () => {
    const poisonPayload = { poison: true };
    const realStringify = JSON.stringify;
    vi.spyOn(JSON, 'stringify').mockImplementation((value: unknown, ...args) => {
      if (value === poisonPayload) {
        throw new TypeError('circular');
      }
      return realStringify(value, ...args);
    });

    const onClearEvents = vi.fn();
    const { getByTestId, rerender } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={onClearEvents}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(getByTestId('grpc-console-wire-row-evt-1'));
    rerender(
      <GrpcConsoleModal
        events={[
          ...makeMultiEvents(),
          {
            id: 'evt-poison',
            timestamp: '2026-07-05T12:00:11.000Z',
            direction: 'event',
            summary: 'Poison payload',
            payload: poisonPayload,
          },
        ]}
        onClearEvents={onClearEvents}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(getByTestId('grpc-console-search'), { target: { value: 'Unary' } });
    expect(getByTestId('grpc-console-wire-row-evt-1')).toBeTruthy();
  });

  it('auto-selects the first visible row when unpinned and selection is stale', () => {
    const { getByTestId, rerender } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    rerender(
      <GrpcConsoleModal
        events={[{
          id: 'evt-new',
          timestamp: '2026-07-05T12:00:20.000Z',
          direction: 'recv',
          summary: 'Fresh response',
          payload: { fresh: true },
        }]}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(getByTestId('grpc-console-wire-row-evt-new').className).toContain('grpc-console-wire-row--active');
  });

  it('renders list rows without service/method suffix when metadata is absent', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={[{
          id: 'evt-bare',
          timestamp: 'not-a-date',
          direction: 'event',
          summary: 'Lifecycle event',
        }]}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const row = getByTestId('grpc-console-wire-row-evt-bare');
    expect(row.textContent).toContain('Lifecycle event');
    expect(row.textContent).not.toMatch(/EchoService\//);
  });

  it('sorts invalid timestamps safely in ascending and descending order', () => {
    const invalidEvents: GrpcConsoleWireEvent[] = [
      {
        id: 'evt-a',
        timestamp: 'invalid-a',
        direction: 'send',
        summary: 'Alpha',
      },
      {
        id: 'evt-b',
        timestamp: 'invalid-b',
        direction: 'recv',
        summary: 'Beta',
      },
    ];

    const { getByTestId } = render(
      <GrpcConsoleModal
        events={invalidEvents}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const descList = getByTestId('grpc-console-wire-list').textContent ?? '';
    expect(descList.indexOf('Alpha')).toBeGreaterThanOrEqual(0);

    selectOption(getByTestId('grpc-console-sort-order'), 'Time: Asc');
    const ascList = getByTestId('grpc-console-wire-list').textContent ?? '';
    expect(ascList.indexOf('Alpha')).toBeGreaterThanOrEqual(0);
  });

  it('shows filtered-empty message when events exist but search removes all rows', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(getByTestId('grpc-console-search'), { target: { value: 'no-match-query' } });
    expect(getByTestId('grpc-console-wire-empty').textContent).toContain('No events match your current search filter.');
  });

  it('uses null fallbacks for missing payloads in both live and pinned views', () => {
    const events: GrpcConsoleWireEvent[] = [
      {
        id: 'evt-missing-payload',
        timestamp: '2026-07-05T12:00:00.000Z',
        direction: 'event',
        summary: 'Missing payload',
      },
    ];

    const { getByTestId } = render(
      <GrpcConsoleModal
        events={events}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(getByTestId('grpc-console-wire-live-feed').textContent).toContain('null');

    fireEvent.click(getByTestId('grpc-console-wire-row-evt-missing-payload'));
    expect(getByTestId('grpc-console-wire-detail').textContent).toContain('null');

    fireEvent.change(getByTestId('grpc-console-search'), { target: { value: 'missing payload' } });
    expect(getByTestId('grpc-console-wire-row-evt-missing-payload')).toBeTruthy();
  });

  it('recomputes style and header drag behavior in expanded mode', () => {
    const { container, getByTestId, rerender } = render(
      <GrpcConsoleModal
        events={makeEventsForExpansion()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const expandBtn = container.querySelector('.modal-expand-btn') as HTMLButtonElement;
    fireEvent.click(expandBtn);

    const modal = getByTestId('grpc-console-modal');
    expect(modal.className).toMatch(/modal-fullscreen/);
    expect(modal.getAttribute('style') ?? '').toContain('width: 100vw');

    fireEvent.mouseDown(getByTestId('grpc-console-modal-header'));

    rerender(
      <GrpcConsoleModal
        events={makeEventsForExpansion()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(getByTestId('grpc-console-modal')).toBeTruthy();
  });
});

function makeEventsForExpansion(): GrpcConsoleWireEvent[] {
  return [{
    id: 'evt-expand',
    timestamp: '2026-07-05T12:00:00.000Z',
    direction: 'send',
    summary: 'Expand me',
    payload: { ok: true },
  }];
}
