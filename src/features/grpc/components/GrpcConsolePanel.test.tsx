/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { selectOption } from '../../../test-utils/customSelectHelper';
import { prepareGrpcCallHistoryEntryForPersist } from '../../../shared/grpc/grpcPersistenceSchema';
import type { UseGrpcCallHistoryResult } from '../hooks/useGrpcCallHistory';
import { GrpcConsolePanel } from './GrpcConsolePanel';

function makeEntry(id: string, status = 0) {
  return prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: `req-${id}`,
      capturedAt: '2026-07-05T10:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: `hello-${id}` },
      metadata: { 'x-id': id },
      timeoutMs: 5000,
      descriptorKey: 'descriptor-1',
    },
    result: {
      callType: 'unary',
      status,
      statusMessage: status === 0 ? 'OK' : 'INTERNAL',
      headers: { h: '1' },
      trailers: { t: '1' },
      body: status === 0 ? { echoed: id } : undefined,
      durationMs: 12,
    },
    error: status === 0 ? undefined : {
      message: 'boom',
      details: { grpcStatus: status },
    },
  });
}

function historyStub(entries = [makeEntry('ok-1', 0), makeEntry('err-1', 13)]): UseGrpcCallHistoryResult {
  return {
    entries,
    filteredEntries: entries,
    filters: {},
    filterOptions: {
      services: [],
      hasOkEntries: true,
      hasErrorEntries: true,
      grpcStatuses: [],
    },
    loading: false,
    clearLastMutationError: vi.fn(),
    setFilters: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    clearFiltered: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GrpcConsolePanel', () => {
  it('renders console list and shows selected row details', () => {
    render(
      <GrpcConsolePanel
        history={historyStub()}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => 'grpcurl -plaintext localhost:50051 echo.EchoService/Echo'}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-console-entry-ok-1'));
    expect(screen.getByTestId('grpc-console-detail').textContent).toMatch(/echo\.EchoService\/Echo/);
    expect(screen.getByTestId('grpc-console-detail').textContent).toMatch(/Request body/);
    expect(screen.getByTestId('grpc-console-detail').textContent).toMatch(/Response body/);
  });

  it('filters to errors and triggers row actions', () => {
    const onReplay = vi.fn();
    const onCopyGrpcurl = vi.fn();
    render(
      <GrpcConsolePanel
        history={historyStub()}
        onReplay={onReplay}
        onCopyGrpcurl={onCopyGrpcurl}
        grpcurlForEntry={() => 'grpcurl command'}
      />,
    );

    selectOption(screen.getByTestId('grpc-console-filter-status'), 'Errors');
    expect(screen.queryByTestId('grpc-console-entry-ok-1')).toBeNull();
    fireEvent.click(screen.getByTestId('grpc-console-entry-err-1'));

    fireEvent.click(screen.getByTestId('grpc-console-copy-grpcurl'));
    fireEvent.click(screen.getByTestId('grpc-console-replay-btn'));
    expect(onCopyGrpcurl).toHaveBeenCalledWith('grpcurl command');
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('shows empty states for empty history and filtered-out rows', () => {
    const { rerender } = render(
      <GrpcConsolePanel
        history={historyStub([])}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => 'grpcurl'}
      />,
    );

    expect(screen.getByTestId('grpc-console-empty').textContent).toContain('No calls captured yet');

    rerender(
      <GrpcConsolePanel
        history={historyStub([makeEntry('ok-1', 0)])}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => 'grpcurl'}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-console-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('grpc-console-empty').textContent).toContain('No rows match your console filters');
  });

  it('renders warning status chip and preserves invalid timestamp text', () => {
    const warnEntry = prepareGrpcCallHistoryEntryForPersist({
      id: 'warn-1',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-warn-1',
        capturedAt: 'not-a-date',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        metadata: {},
        timeoutMs: 5000,
        descriptorKey: 'descriptor-1',
      },
      result: {
        callType: 'unary',
        status: 14,
        statusMessage: 'UNAVAILABLE',
        headers: {},
        trailers: {},
        body: null,
        durationMs: 10,
      },
    });

    render(
      <GrpcConsolePanel
        history={historyStub([warnEntry])}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => 'grpcurl'}
      />,
    );

    const row = screen.getByTestId('grpc-console-entry-warn-1');
    expect(row.textContent).toContain('Code 14');
    expect(row.textContent).toContain('not-a-date');
  });

  it('supports ok-only filter and status-code search matches', () => {
    render(
      <GrpcConsolePanel
        history={historyStub()}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => 'grpcurl'}
      />,
    );

    selectOption(screen.getByTestId('grpc-console-filter-status'), 'OK');
    expect(screen.getByTestId('grpc-console-entry-ok-1')).toBeTruthy();
    expect(screen.queryByTestId('grpc-console-entry-err-1')).toBeNull();

    selectOption(screen.getByTestId('grpc-console-filter-status'), 'All statuses');
    fireEvent.change(screen.getByTestId('grpc-console-search'), { target: { value: '13' } });
    expect(screen.queryByTestId('grpc-console-entry-ok-1')).toBeNull();
    expect(screen.getByTestId('grpc-console-entry-err-1')).toBeTruthy();
  });

  it('shows response fallback fields for error-only records', () => {
    const errorOnlyEntry = prepareGrpcCallHistoryEntryForPersist({
      id: 'error-only',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-error-only',
        capturedAt: '2026-07-05T10:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'x' },
        metadata: {},
        timeoutMs: 5000,
        descriptorKey: 'descriptor-1',
      },
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'terminal boom',
      },
    });

    render(
      <GrpcConsolePanel
        history={historyStub([errorOnlyEntry])}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => 'grpcurl'}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-console-entry-error-only'));
    expect(screen.getByTestId('grpc-console-detail').textContent).toContain('terminal boom');
  });
});