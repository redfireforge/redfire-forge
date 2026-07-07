/**
 * @vitest-environment jsdom
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcConsoleModal, type GrpcConsoleWireEvent } from './GrpcConsoleModal';

function makeEvents(): GrpcConsoleWireEvent[] {
  return [
    {
      id: 'evt-1',
      timestamp: '2026-07-05T12:00:00.000Z',
      direction: 'send',
      service: 'echo.EchoService',
      method: 'Echo',
      summary: 'Unary request echo.EchoService/Echo',
      payload: { requestId: 'req-1', body: { message: 'hello' } },
    },
  ];
}

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

describe('GrpcConsoleModal', () => {
  it('toggles fullscreen mode with expand button and hides resize handles when expanded', () => {
    const { container } = render(
      <GrpcConsoleModal
        events={makeEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const modal = container.querySelector('[data-testid="grpc-console-modal"]') as HTMLElement;
    expect(modal.className).not.toMatch(/modal-fullscreen/);
    expect(container.querySelector('.grpc-console-modal__grip')).toBeTruthy();
    expect(container.querySelector('.grpc-console-modal__edge-right')).toBeTruthy();

    const expandBtn = container.querySelector('.modal-expand-btn') as HTMLButtonElement;
    fireEvent.click(expandBtn);

    expect(modal.className).toMatch(/modal-fullscreen/);
    expect(container.querySelector('.grpc-console-modal__grip')).toBeNull();
    expect(container.querySelector('.grpc-console-modal__edge-right')).toBeNull();

    fireEvent.click(expandBtn);

    expect(modal.className).not.toMatch(/modal-fullscreen/);
    expect(container.querySelector('.grpc-console-modal__grip')).toBeTruthy();
    expect(container.querySelector('.grpc-console-modal__edge-right')).toBeTruthy();
  });

  it('supports row selection and returns to live view', () => {
    const { getByTestId, queryByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(getByTestId('grpc-console-wire-live-feed')).toBeTruthy();
    fireEvent.click(getByTestId('grpc-console-wire-row-evt-1'));
    expect(getByTestId('grpc-console-wire-detail').textContent).toContain('Unary request');
    expect(queryByTestId('grpc-console-wire-live-feed')).toBeNull();

    fireEvent.click(getByTestId('grpc-console-back-to-live'));
    expect(getByTestId('grpc-console-wire-live-feed')).toBeTruthy();
  });

  it('filters events and shows empty filtered state', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(getByTestId('grpc-console-search'), { target: { value: 'response' } });
    expect(getByTestId('grpc-console-wire-row-evt-2')).toBeTruthy();

    fireEvent.change(getByTestId('grpc-console-search'), { target: { value: 'does-not-exist' } });
    expect(getByTestId('grpc-console-wire-empty').textContent).toContain('No events match your current search filter');
    expect(getByTestId('grpc-console-wire-live-empty').textContent).toContain('No live events yet');
  });

  it('wires clear and close actions and handles empty event state', () => {
    const onClearEvents = vi.fn();
    const onClose = vi.fn();
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={[]}
        onClearEvents={onClearEvents}
        onClose={onClose}
      />,
    );

    const clear = getByTestId('grpc-console-modal-clear') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    fireEvent.click(getByTestId('grpc-console-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClearEvents).not.toHaveBeenCalled();
  });

  it('sorts ascending and invokes clear when events exist', () => {
    const onClearEvents = vi.fn();
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={onClearEvents}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(getByTestId('grpc-console-sort-order'), { target: { value: 'asc' } });
    const list = getByTestId('grpc-console-wire-list');
    expect(list.textContent).toMatch(/Unary request/);
    fireEvent.click(getByTestId('grpc-console-modal-clear'));
    expect(onClearEvents).toHaveBeenCalledTimes(1);
  });

  it('renders rows without service/method metadata when those fields are missing', () => {
    const events: GrpcConsoleWireEvent[] = [{
      id: 'evt-event',
      timestamp: 'invalid-timestamp',
      direction: 'event',
      summary: 'Connection state changed',
      payload: { connected: true },
    }];

    const { getByTestId } = render(
      <GrpcConsoleModal
        events={events}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const row = getByTestId('grpc-console-wire-row-evt-event');
    expect(row.textContent).toContain('EVENT');
    expect(row.textContent).not.toContain('/');
  });

  it('shows detail-empty when pinned selection is filtered out', () => {
    const { getByTestId } = render(
      <GrpcConsoleModal
        events={makeMultiEvents()}
        onClearEvents={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(getByTestId('grpc-console-wire-row-evt-1'));
    fireEvent.change(getByTestId('grpc-console-search'), { target: { value: 'does-not-exist' } });
    expect(getByTestId('grpc-console-wire-detail-empty').textContent).toContain('Select an event');
  });
});
