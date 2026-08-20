/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from './apiMockGalleryImport';

const loadApiMockWorkspace = vi.fn();
const saveApiMockWorkspace = vi.fn();

vi.mock('./apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadApiMockWorkspace(...args),
  saveApiMockWorkspace: (...args: unknown[]) => saveApiMockWorkspace(...args),
  publishApiMockWorkspace: vi.fn(),
  publishApiMockRuntimeChanged: vi.fn(),
}));
vi.mock('./components/ApiMockStudioTitleBar', () => ({
  ApiMockStudioTitleBar: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <div data-testid="mock-titlebar">
      <button data-testid="mock-select-srv-1" onClick={() => onSelect('srv-1')}>select-srv-1</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockStudioActivePanel', () => ({
  ApiMockStudioActivePanel: ({
    onStart,
    onStop,
    onApply,
    onRestart,
    onResetState,
    onClearTransactions,
    onAddFolder,
    onToggleFolder,
    onRenameFolder,
    onDeleteFolder,
    onOpenInRequests,
    onCreateRouteFromTransaction,
    onSaveSampleFromTransaction,
    onUpdateSample,
    onDeleteSample,
    onAcknowledgeConflict,
    onOpenRuntime,
  }: any) => (
    <div data-testid="mock-active-panel">
      <button data-testid="mock-start" onClick={onStart}>start</button>
      <button data-testid="mock-stop" onClick={onStop}>stop</button>
      <button data-testid="mock-apply" onClick={onApply}>apply</button>
      <button data-testid="mock-restart" onClick={onRestart}>restart</button>
      <button data-testid="mock-reset-state" onClick={onResetState}>reset</button>
      <button data-testid="mock-clear-transactions" onClick={onClearTransactions}>clear</button>
      <button data-testid="mock-add-folder" onClick={onAddFolder}>add-folder</button>
      <button data-testid="mock-toggle-folder" onClick={() => onToggleFolder?.('missing-folder')}>toggle-folder</button>
      <button data-testid="mock-rename-folder" onClick={() => onRenameFolder?.('missing-folder', 'Renamed')}>rename-folder</button>
      <button data-testid="mock-delete-folder" onClick={() => onDeleteFolder?.('missing-folder')}>delete-folder</button>
      <button data-testid="mock-open-requests" onClick={() => onOpenInRequests?.({ id: 'tx-1', request: { method: 'GET', path: '/x' } })}>open-requests</button>
      <button data-testid="mock-create-from-tx" onClick={() => onCreateRouteFromTransaction?.({ id: 'tx-2', request: { method: 'POST', path: '/orders' } })}>create-from-tx</button>
      <button data-testid="mock-save-from-tx" onClick={() => onSaveSampleFromTransaction?.({ id: 'tx-3', request: { method: 'GET', path: '/users' }, outcome: 'unmatched' })}>save-from-tx</button>
      <button data-testid="mock-update-sample" onClick={() => onUpdateSample?.({ id: 'sample-1', name: 'Updated', request: { method: 'GET', path: '/', rawPath: '/', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z' } })}>update-sample</button>
      <button data-testid="mock-delete-sample" onClick={() => onDeleteSample?.('sample-1')}>delete-sample</button>
      <button data-testid="mock-ack-conflict" onClick={() => onAcknowledgeConflict?.({ id: 'f1', acknowledgementStale: true })}>ack</button>
      <button data-testid="mock-open-runtime" onClick={() => onOpenRuntime?.('transactions')}>open-runtime</button>
    </div>
  ),
}));
vi.mock('./components/ApiMockStudioModals', () => ({
  ApiMockStudioModals: ({
    onUpdateServer,
    onSaveSample,
    onUpdateSample,
    onCloseExport,
  }: {
    onUpdateServer: (next: { name: string }) => void;
    onSaveSample?: (sample: unknown) => void;
    onUpdateSample?: (sample: unknown) => void;
    onCloseExport?: () => void;
  }) => (
    <div data-testid="mock-modals">
      <button data-testid="mock-modal-update" onClick={() => onUpdateServer({ name: 'Updated via modal' })}>
        update
      </button>
      <button data-testid="mock-modal-save-sample" onClick={() => onSaveSample?.({ id: 's1', name: 'Sample' })}>save-sample</button>
      <button data-testid="mock-modal-update-sample" onClick={() => onUpdateSample?.({ id: 's1', name: 'Updated' })}>update-sample</button>
      <button data-testid="mock-modal-close-export" onClick={() => onCloseExport?.()}>close-export</button>
    </div>
  ),
}));
vi.mock('./useApiMockConsole', () => ({
  useApiMockConsole: () => ({ lines: [], clear: vi.fn() }),
}));
vi.mock('../../app/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(), confirmDialogElement: null }),
}));
vi.mock('./apiMockControlClient', () => ({
  apiMockControlClient: {
    start: vi.fn().mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } }),
    stop: vi.fn().mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'stopped', generation: 1 } }),
    restart: vi.fn().mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 2 } }),
    commit: vi.fn().mockResolvedValue({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 2 } }),
    transactions: vi.fn().mockResolvedValue({ ok: true, data: { transactions: [], cursor: 0, total: 0, capped: false } }),
    clearTransactions: vi.fn(),
    state: vi.fn().mockResolvedValue({ ok: true, data: { states: {}, counters: {} } }),
    resetState: vi.fn(),
    recordedDrafts: vi.fn().mockResolvedValue({ ok: true, data: { drafts: [], total: 0 } }),
    ackRecordedDrafts: vi.fn(),
    // Hydration reconciles against the live pool; creation asks for a free port.
    list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    status: vi.fn().mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
    nextAutoPort: vi.fn().mockResolvedValue({ ok: true, data: { port: 4600 } }),
  },
}));
vi.mock('../../shared/api-mock/conflictAnalyzer', () => ({ analyzeConflicts: vi.fn() }));

function makeServer() {
  return {
    id: 'srv-1',
    name: 'Mock Server 1',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: {
      selection: { multipleMatchPolicy: 'highest_priority', equalPriorityPolicy: 'reject', ambiguityResponse: { status: 409, headers: [], body: '{}', contentType: 'application/json' } },
      fallback: { unmatchedResponse: { status: 404, headers: [], body: '{}', contentType: 'application/json' }, mode: 'default_response' },
      cors: { enabled: false, allowOrigins: ['*'], allowMethods: ['GET'], allowHeaders: ['Content-Type'], allowCredentials: false, maxAge: 0, exposeHeaders: [] },
      limits: { maxInboundBodyBytes: 1024, maxResponseBodyBytes: 1024, maxConcurrentConnections: 10, maxDelayMs: 0, longRunningEnabled: false, longRunningMaxMs: 0, gracefulDrainMs: 0 },
      journal: { enabled: true, maxEntries: 10, maxCapturedBodyBytes: 1024, persistToDisk: false },
      redaction: { headerNames: [], jsonPaths: [], preserveScheme: true },
    },
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
  };
}

describe('ApiMockStudioPage branch coverage', () => {
  beforeEach(() => {
    loadApiMockWorkspace.mockResolvedValue({ servers: [makeServer()], activeServerId: undefined });
    saveApiMockWorkspace.mockResolvedValue(undefined);
  });

  it('skips modal updates when no active server is selected', async () => {
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);

    await waitFor(() => expect(screen.getByTestId('mock-titlebar')).toBeTruthy());
    window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_CHANGED_EVENT, {
      detail: { servers: [makeServer()], activeServerId: 'srv-missing' },
    }));
    await waitFor(() => expect(screen.queryByTestId('mock-active-panel')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mock-modal-update'));
    fireEvent.click(screen.getByTestId('mock-modal-save-sample'));
    fireEvent.click(screen.getByTestId('mock-modal-update-sample'));
    fireEvent.click(screen.getByTestId('mock-modal-close-export'));
    expect(saveApiMockWorkspace).not.toHaveBeenCalled();
  });

  it('exercises active-panel callback wiring and fallback branches', async () => {
    const { ApiMockStudioPage } = await import('./ApiMockStudioPage');
    render(<ApiMockStudioPage />);

    await waitFor(() => expect(screen.getByTestId('mock-titlebar')).toBeTruthy());
    fireEvent.click(screen.getByTestId('mock-select-srv-1'));
    await waitFor(() => expect(screen.getByTestId('mock-active-panel')).toBeTruthy());

    fireEvent.click(screen.getByTestId('mock-start'));
    fireEvent.click(screen.getByTestId('mock-stop'));
    fireEvent.click(screen.getByTestId('mock-apply'));
    fireEvent.click(screen.getByTestId('mock-restart'));
    fireEvent.click(screen.getByTestId('mock-reset-state'));
    fireEvent.click(screen.getByTestId('mock-clear-transactions'));
    fireEvent.click(screen.getByTestId('mock-add-folder'));
    fireEvent.click(screen.getByTestId('mock-toggle-folder'));
    fireEvent.click(screen.getByTestId('mock-rename-folder'));
    fireEvent.click(screen.getByTestId('mock-delete-folder'));
    fireEvent.click(screen.getByTestId('mock-open-requests'));
    fireEvent.click(screen.getByTestId('mock-create-from-tx'));
    fireEvent.click(screen.getByTestId('mock-save-from-tx'));
    fireEvent.click(screen.getByTestId('mock-update-sample'));
    fireEvent.click(screen.getByTestId('mock-delete-sample'));
    fireEvent.click(screen.getByTestId('mock-ack-conflict'));
    fireEvent.click(screen.getByTestId('mock-open-runtime'));

    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
  });
});
