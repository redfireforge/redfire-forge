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
}));
vi.mock('./components/ApiMockStudioTitleBar', () => ({
  ApiMockStudioTitleBar: () => <div data-testid="mock-titlebar" />,
}));
vi.mock('./components/ApiMockStudioActiveSection', () => ({
  ApiMockStudioActiveSection: () => <div data-testid="mock-active-section" />,
}));
vi.mock('./components/ApiMockStudioModals', () => ({
  ApiMockStudioModals: ({ onUpdateServer }: { onUpdateServer: (next: { name: string }) => void }) => (
    <div data-testid="mock-modals">
      <button data-testid="mock-modal-update" onClick={() => onUpdateServer({ name: 'Updated via modal' })}>
        update
      </button>
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
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    commit: vi.fn(),
    transactions: vi.fn(),
    clearTransactions: vi.fn(),
    state: vi.fn(),
    resetState: vi.fn(),
    recordedDrafts: vi.fn(),
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
    await waitFor(() => expect(screen.queryByTestId('mock-active-section')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mock-modal-update'));
    expect(saveApiMockWorkspace).not.toHaveBeenCalled();
  });
});
