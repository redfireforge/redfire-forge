/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '../../../shared/grpc/grpcPersistenceSchema';
import type { UseGrpcCallHistoryResult } from '../hooks/useGrpcCallHistory';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  resetGrpcTabCounterForTests,
} from '../grpcStudioTypes';
import * as grpcReplayBinding from '../utils/grpcReplayBinding';
import { GrpcHistoryPanel } from './GrpcHistoryPanel';

const TS = '2026-06-29T12:00:00.000Z';

function historyEntry(
  id: string,
  patch: {
    grpcStatus?: number;
    error?: boolean;
    bodyTruncated?: boolean;
    capturedAt?: string;
  } = {},
) {
  return prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: `req-${id}`,
      capturedAt: patch.capturedAt ?? TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    ...(patch.error
      ? {
        error: {
          code: 'call_failed',
          message: 'Transport failed',
        },
      }
      : {
        result: {
          callType: 'unary' as const,
          status: patch.grpcStatus ?? 0,
          statusMessage: patch.grpcStatus === 0 ? 'OK' : 'Failed',
          headers: {},
          trailers: {},
          message: {},
          durationMs: 12,
        },
      }),
    bodyTruncated: patch.bodyTruncated,
  });
}

function buildHistoryMock(overrides: Partial<UseGrpcCallHistoryResult> = {}): UseGrpcCallHistoryResult {
  return {
    entries: [],
    filteredEntries: [],
    filters: {},
    filterOptions: {
      services: [],
      methods: [],
      grpcStatuses: [],
      hasOkEntries: false,
      hasErrorEntries: false,
    },
    loading: false,
    clearLastMutationError: vi.fn(),
    setFilters: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn(),
    clearAll: vi.fn().mockResolvedValue(undefined),
    clearFiltered: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPanel(
  history: UseGrpcCallHistoryResult,
  panelOverrides: Partial<Parameters<typeof GrpcHistoryPanel>[0]> = {},
) {
  resetGrpcTabCounterForTests();
  const tab = createGrpcStudioTab({
    target: 'localhost:50051',
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
  });
  const onReplay = vi.fn();
  const onCopyGrpcurl = vi.fn();
  const grpcurlForEntry = vi.fn(() => 'grpcurl localhost:50051 echo.EchoService/Echo');

  render(
    <GrpcHistoryPanel
      history={history}
      studio={{
        activeTab: tab,
        activeTabDescriptor: {
          ...createEmptyTabDescriptorState(),
          loadState: 'loaded',
          descriptor: FIXTURE_DESCRIPTOR,
          driftState: 'none',
        },
        profiles: [],
      }}
      envVarMap={{}}
      pageDefaults={{ target: 'localhost:50051', tlsMode: 'disabled' }}
      profiles={[]}
      onReplay={onReplay}
      onCopyGrpcurl={onCopyGrpcurl}
      grpcurlForEntry={grpcurlForEntry}
      {...panelOverrides}
    />,
  );

  return { onReplay, onCopyGrpcurl, grpcurlForEntry };
}

describe('GrpcHistoryPanel coverage gaps (Phase 5H)', () => {
  it('shows loading hint', () => {
    renderPanel(buildHistoryMock({ loading: true }));
    expect(screen.getByTestId('grpc-history-loading')).toBeTruthy();
    expect(screen.getByText(/Loading call history/i)).toBeTruthy();
  });

  it('shows empty hints when no entries', () => {
    renderPanel(buildHistoryMock());
    expect(screen.getByTestId('grpc-history-list-empty')).toBeTruthy();
    expect(screen.getByText(/No call history yet/i)).toBeTruthy();
    expect(screen.getByTestId('grpc-history-detail-empty')).toBeTruthy();
    expect(screen.getByText(/Call history is empty/i)).toBeTruthy();
  });

  it('shows filtered empty state when filters hide all entries', () => {
    const entry = historyEntry('hidden-1');
    renderPanel(buildHistoryMock({
      entries: [entry],
      filteredEntries: [],
      filters: { text: 'missing' },
      filterOptions: {
        services: [entry.service],
        methods: [entry.method],
        grpcStatuses: [0],
        hasOkEntries: true,
        hasErrorEntries: false,
      },
    }));
    expect(screen.getByTestId('grpc-history-list-empty-filtered')).toBeTruthy();
    expect(screen.getByText(/No matching entries/i)).toBeTruthy();
    expect(screen.getByTestId('grpc-history-detail-empty').textContent).toMatch(/No entries match your filters/i);
  });

  it('shows mutation error banner', () => {
    renderPanel(buildHistoryMock({ lastMutationError: 'Clear failed' }));
    expect(screen.getByTestId('grpc-history-mutation-error').textContent).toBe('Clear failed');
  });

  it('renders status variants and selects entry for detail', async () => {
    const ok = historyEntry('ok-1');
    const warn = historyEntry('warn-1', { grpcStatus: 16 });
    const err = historyEntry('err-1', { error: true });
    const badTime = historyEntry('bad-time', { capturedAt: 'not-a-date' });

    const { onReplay, onCopyGrpcurl } = renderPanel(buildHistoryMock({
      filteredEntries: [ok, warn, err, badTime],
      filterOptions: {
        services: [ok.service],
        methods: [ok.method],
        grpcStatuses: [0, 16],
        hasOkEntries: true,
        hasErrorEntries: true,
      },
    }));

    expect(screen.getByTestId('grpc-history-entry-ok-1').textContent).toMatch(/OK/);
    expect(screen.getByTestId('grpc-history-entry-warn-1').textContent).toMatch(/Code 16/);
    expect(screen.getByTestId('grpc-history-entry-err-1').textContent).toMatch(/Error/);
    expect(screen.getByTestId('grpc-history-entry-bad-time').textContent).toContain('not-a-date');

    fireEvent.click(screen.getByTestId('grpc-history-entry-ok-1'));
    expect(screen.getByTestId('grpc-history-detail').textContent).toMatch(/echo\.EchoService\/Echo/);
    expect(screen.getByText(/grpcurl command/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-history-replay-btn'));
    expect(onReplay).toHaveBeenCalledWith(ok);

    fireEvent.click(screen.getByTestId('grpc-history-copy-grpcurl'));
    expect(onCopyGrpcurl).toHaveBeenCalledWith('grpcurl localhost:50051 echo.EchoService/Echo');
  });

  it('shows truncated body warning in detail', () => {
    const truncated = historyEntry('trunc-1', { bodyTruncated: true });
    renderPanel(buildHistoryMock({ filteredEntries: [truncated] }));
    fireEvent.click(screen.getByTestId('grpc-history-entry-trunc-1'));
    expect(screen.getByText(/truncated when this entry was captured/i)).toBeTruthy();
  });

  it('wires filter controls and clear actions', () => {
    const setFilters = vi.fn();
    const clearLastMutationError = vi.fn();
    const clearFiltered = vi.fn().mockResolvedValue(undefined);
    const clearAll = vi.fn().mockResolvedValue(undefined);

    renderPanel(buildHistoryMock({
      filters: {},
      filterOptions: {
        services: ['echo.EchoService'],
        methods: ['Echo'],
        grpcStatuses: [0],
        hasOkEntries: true,
        hasErrorEntries: true,
      },
      setFilters,
      clearLastMutationError,
      clearFiltered,
      clearAll,
    }));

    fireEvent.change(screen.getByTestId('grpc-history-search'), { target: { value: 'echo' } });
    expect(setFilters).toHaveBeenCalledWith({ text: 'echo' });

    fireEvent.change(screen.getByTestId('grpc-history-filter-service'), {
      target: { value: 'echo.EchoService' },
    });
    expect(setFilters).toHaveBeenCalledWith({ service: 'echo.EchoService' });

    fireEvent.change(screen.getByTestId('grpc-history-filter-status'), { target: { value: 'error' } });
    expect(setFilters).toHaveBeenCalledWith({ outcome: 'error', grpcStatus: undefined });

    fireEvent.click(screen.getByTestId('grpc-history-clear-filtered'));
    expect(clearLastMutationError).toHaveBeenCalled();
    expect(clearFiltered).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-history-clear-all'));
    expect(clearAll).toHaveBeenCalled();
  });

  it('disables replay when drift blocks execution', () => {
    const entry = historyEntry('blocked-1');
    renderPanel(buildHistoryMock({ filteredEntries: [entry] }), {
      studio: {
        activeTab: createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY }),
        activeTabDescriptor: {
          ...createEmptyTabDescriptorState(),
          loadState: 'loaded',
          descriptor: {
            ...FIXTURE_DESCRIPTOR,
            services: [{
              ...FIXTURE_DESCRIPTOR.services[0]!,
              methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((m) => m.name !== 'Echo'),
            }],
          },
          driftState: 'blocking',
          driftMessage: 'Method missing',
        },
        profiles: [],
      },
    });

    fireEvent.click(screen.getByTestId('grpc-history-entry-blocked-1'));
    const replayBtn = screen.getByTestId('grpc-history-replay-btn') as HTMLButtonElement;
    expect(replayBtn.disabled).toBe(true);
    expect(replayBtn.title).toMatch(/schema|available/i);
  });

  it('surfaces replay preview errors from resolver', () => {
    const entry = historyEntry('preview-err');
    vi.spyOn(grpcReplayBinding, 'resolveGrpcHistoryEntryReplay').mockImplementation(() => {
      throw new Error('Replay preview failed');
    });

    renderPanel(buildHistoryMock({ filteredEntries: [entry] }));
    fireEvent.click(screen.getByTestId('grpc-history-entry-preview-err'));

    const replayBtn = screen.getByTestId('grpc-history-replay-btn') as HTMLButtonElement;
    expect(replayBtn.disabled).toBe(true);
    expect(replayBtn.title).toBe('Replay preview failed');

    vi.restoreAllMocks();
  });

  it('clears selection when filtered entry disappears', async () => {
    const entry = historyEntry('gone-1');
    const history = buildHistoryMock({ filteredEntries: [entry] });
    const { rerender } = render(
      <GrpcHistoryPanel
        history={history}
        studio={{
          activeTab: createGrpcStudioTab(),
          activeTabDescriptor: createEmptyTabDescriptorState(),
          profiles: [],
        }}
        envVarMap={{}}
        pageDefaults={{ target: 'localhost:50051', tlsMode: 'disabled' }}
        profiles={[]}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => ''}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-history-entry-gone-1'));
    expect(screen.queryByText(/Select a call to inspect/i)).toBeNull();

    rerender(
      <GrpcHistoryPanel
        history={{ ...history, filteredEntries: [] }}
        studio={{
          activeTab: createGrpcStudioTab(),
          activeTabDescriptor: createEmptyTabDescriptorState(),
          profiles: [],
        }}
        envVarMap={{}}
        pageDefaults={{ target: 'localhost:50051', tlsMode: 'disabled' }}
        profiles={[]}
        onReplay={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        grpcurlForEntry={() => ''}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('grpc-history-detail-empty')).toBeTruthy();
      expect(screen.getByText(/Call history is empty/i)).toBeTruthy();
    });
  });

  afterEach(() => {
    cleanup();
  });
});
