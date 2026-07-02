/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
} from '../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../shared/grpc/grpcApiClient';
import {
  setGrpcStreamEventsOpener,
  setGrpcStreamTransport,
} from '../../shared/grpc/grpcStreamClient';
import { createGrpcSuccessEnvelope } from '../../shared/grpc/contracts';
import { GrpcStudioPage, buildLegacyGrpcEnvVarMap } from './GrpcStudioPage';
import { resetGrpcTabCounterForTests } from './grpcStudioTypes';
import type { UseGrpcCollectionsResult } from './hooks/useGrpcCollections';
import type { UseGrpcCallHistoryResult } from './hooks/useGrpcCallHistory';

const collectionsHookMock = vi.hoisted(() => ({
  value: null as UseGrpcCollectionsResult | null,
}));
const historyHookMock = vi.hoisted(() => ({
  value: null as UseGrpcCallHistoryResult | null,
}));

vi.mock('./hooks/useGrpcCollections', () => ({
  useGrpcCollections: () => collectionsHookMock.value,
}));

vi.mock('./hooks/useGrpcCallHistory', () => ({
  useGrpcCallHistory: () => historyHookMock.value,
}));

function createCollectionsHookMock(): UseGrpcCollectionsResult {
  return {
    store: { schemaVersion: 1, updatedAt: '2026-07-01T00:00:00.000Z', collections: [] },
    collections: [],
    loading: false,
    clearLastMutationError: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    addCollection: vi.fn().mockResolvedValue({
      id: 'col-1',
      name: 'Collection',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      savedRequests: [],
    }),
    renameCollection: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    duplicateCollection: vi.fn().mockResolvedValue(undefined),
    saveRequest: vi.fn().mockImplementation(async (_collectionId, saved) => saved),
    updateSavedRequest: vi.fn().mockResolvedValue(undefined),
    deleteSavedRequest: vi.fn().mockResolvedValue(undefined),
    duplicateSavedRequest: vi.fn().mockImplementation(async () => {
      throw new Error('No saved request selected');
    }),
    recordSavedRequestRun: vi.fn().mockResolvedValue(undefined),
    exportCollections: vi.fn().mockResolvedValue({
      _exportMeta: {
        version: '1.0',
        exportedAt: '2026-07-01T00:00:00.000Z',
        source: 'RedfireForge/gRPC',
      },
      store: { schemaVersion: 1, updatedAt: '2026-07-01T00:00:00.000Z', collections: [] },
    }),
    importCollections: vi.fn().mockResolvedValue(undefined),
  };
}

function createHistoryHookMock(): UseGrpcCallHistoryResult {
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
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    clearFiltered: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GrpcStudioPage (Phase 1D + 1E)', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    setGrpcClientTransport(null);
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
    collectionsHookMock.value = createCollectionsHookMock();
    historyHookMock.value = createHistoryHookMock();
  });

  it('renders studio shell with explorer', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" envName="local" svcName="orders" />);
    expect(screen.getByTestId('grpc-studio-page')).toBeTruthy();
    expect(screen.getByTestId('grpc-tab-bar')).toBeTruthy();
    expect(screen.getByTestId('grpc-connection-bar')).toBeTruthy();
    expect(screen.getByTestId('grpc-target-input')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-badge')).toBeTruthy();
    expect(screen.getByTestId('grpc-auth-badge')).toBeTruthy();
    expect(screen.getByTestId('grpc-service-explorer')).toBeTruthy();
    expect(screen.getByTestId('grpc-method-detail')).toBeTruthy();
    expect(screen.getByTestId('grpc-call-panel')).toBeTruthy();
  });

  it('accepts valid host:port target', () => {
    render(<GrpcStudioPage />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'localhost:50051' } });
    expect(screen.getByTestId('grpc-target-status-ok')).toBeTruthy();
    expect(screen.getByTestId('grpc-target-validation').textContent).toMatch(/Ready/);
  });

  it('accepts in-process target', () => {
    render(<GrpcStudioPage />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'in-process:demo-server' } });
    expect(screen.getByTestId('grpc-target-status-ok').textContent).toMatch(/In-process/);
  });

  it('rejects invalid target format', () => {
    render(<GrpcStudioPage />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-a-target' } });
    expect(screen.getByTestId('grpc-target-status-error')).toBeTruthy();
    expect(screen.getByTestId('grpc-target-validation').textContent).toMatch(/host:port/);
  });

  it('shows unresolved env var hint for {{grpcHost}} without map entry', () => {
    render(<GrpcStudioPage />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '{{grpcHost}}' } });
    expect(screen.getByTestId('grpc-target-status-error')).toBeTruthy();
    expect(screen.getByTestId('grpc-interpolation-error-banner')).toBeTruthy();
    expect(screen.getByTestId('grpc-interpolation-error-message').textContent)
      .toMatch(/Environment Manager/i);
    expect(screen.getByTestId('grpc-target-validation').textContent)
      .toMatch(/Connection blocked until the interpolation issue above is resolved/);
  });

  it('validates empty tab target against environment page default', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    expect(screen.getByTestId('grpc-target-status-ok')).toBeTruthy();
    expect(screen.getByTestId('grpc-target-validation').textContent).toMatch(/environment default/i);
  });

  it('does not seed grpcHost from HTTP resolvedBaseUrl legacy path', () => {
    render(<GrpcStudioPage resolvedBaseUrl="http://localhost:5173" />);
    expect(screen.getByTestId('grpc-target-status-error')).toBeTruthy();
    expect(buildLegacyGrpcEnvVarMap('http://localhost:5173')).toEqual({});
  });

  it('reflects services and binds selected method', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-method-health-v1-health-check'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-method-detail-service').textContent).toBe('health.v1.Health');
      expect(screen.getByTestId('grpc-method-detail-request-type').textContent).toBe('health.v1.HealthCheckRequest');
    });
  });

  it('adds a second tab and keeps first tab target isolated', async () => {
    const user = userEvent.setup();
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;

    await user.clear(input);
    await user.type(input, 'localhost:50051');
    expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).value).toBe('localhost:50051');

    const firstTab = within(screen.getByTestId('grpc-tab-bar')).getByRole('tab', { selected: true });
    const firstTabTestId = firstTab.getAttribute('data-testid')!;

    await user.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => {
      expect(within(screen.getByTestId('grpc-tab-bar')).getAllByRole('tab').length).toBe(2);
      expect(within(screen.getByTestId('grpc-tab-bar')).getByRole('tab', { selected: true }).getAttribute('data-testid')).not.toBe(firstTabTestId);
      expect(within(screen.getByTestId('grpc-tab-bar')).getByRole('tab', { selected: true }).textContent).toContain('Tab 2');
    });

    const secondInput = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    await user.type(secondInput, 'localhost:9090');
    await waitFor(() => {
      expect(secondInput.value).toBe('localhost:9090');
    });

    await user.click(screen.getByTestId(firstTabTestId));
    await waitFor(() => {
      expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).value).toBe('localhost:50051');
    });
  });

  it('keeps per-tab descriptors isolated when switching tabs', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    const user = userEvent.setup();
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    await user.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    const firstTab = within(screen.getByTestId('grpc-tab-bar')).getByRole('tab', { selected: true });
    const firstTabTestId = firstTab.getAttribute('data-testid')!;

    await user.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => {
      expect(within(screen.getByTestId('grpc-tab-bar')).getAllByRole('tab').length).toBe(2);
    });

    expect(screen.getByTestId('grpc-explorer-idle')).toBeTruthy();

    await user.click(screen.getByTestId(firstTabTestId));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
      expect(screen.getByTestId('grpc-method-detail-service').textContent).toBe('echo.EchoService');
    });
  });

  it('edits request body via form and preserves value in JSON tab', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    });

    const input = screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'phase-1f' } });

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));

    await waitFor(() => {
      expect((screen.getByTestId('grpc-request-json') as HTMLTextAreaElement).value).toContain('phase-1f');
    });
  });

  it('disables reflect when target is invalid', () => {
    render(<GrpcStudioPage />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-a-target' } });
    expect((screen.getByTestId('grpc-reflect-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows streaming note for non-unary method selection', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    }));

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-method-health-v1-health-watch'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-method-streaming-ready')).toBeTruthy();
      expect(screen.queryByTestId('grpc-method-unary-ready')).toBeNull();
    });
  });

  it('duplicates active tab via duplicate control', () => {
    render(<GrpcStudioPage />);
    const input = screen.getByTestId('grpc-target-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'localhost:50051' } });

    const firstTab = within(screen.getByTestId('grpc-tab-bar')).getAllByRole('tab')[0]!;
    const duplicateBtn = firstTab.querySelector('[data-testid^="grpc-tab-duplicate-"]') as HTMLElement;
    fireEvent.click(duplicateBtn);

    expect(within(screen.getByTestId('grpc-tab-bar')).getAllByRole('tab').length).toBe(2);
    expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).value).toBe('localhost:50051');
  });

  it('focuses auth tab when connection bar auth badge is clicked (Phase 4J-A)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
    });
  });

  it('opens TLS modal when connection bar TLS badge is clicked (Phase 4J-B)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
      expect(screen.getByTestId('grpc-tls-mode-disabled')).toBeTruthy();
    });
  });

  it('does not auto-open TLS modal when switching tabs after prior badge clicks (Phase 4J-B)', async () => {
    const user = userEvent.setup();
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-tls-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    });
    await user.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => {
      expect(within(screen.getByTestId('grpc-tab-bar')).getAllByRole('tab').length).toBe(2);
    });
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
  });

  it('opens settings drawer from gear button (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
      expect(screen.getByTestId('grpc-settings-panel-tls')).toBeTruthy();
    });
  });

  it('opens settings drawer on call nav when deadline badge is clicked (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-deadline-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-settings-panel-call')).toBeTruthy();
      expect(screen.getByTestId('grpc-call-settings-timeout')).toBeTruthy();
    });
  });

  it('syncs send-bar timeout when call settings drawer edits deadline (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-deadline-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-call-settings-timeout')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('grpc-call-settings-timeout'), {
      target: { value: '45000' },
    });
    await waitFor(() => {
      expect((screen.getByTestId('grpc-call-timeout-input') as HTMLInputElement).value).toBe('45000');
    });
  });

  it('closes settings drawer when TLS badge opens modal (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
      expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
    });
  });

  it('closes TLS modal when settings drawer opens (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
      expect(screen.getAllByTestId('grpc-tls-body')).toHaveLength(1);
    });
  });

  it('shows compression panel and switches to call nav via deadline badge (Phase 4J-D)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-settings-nav-compression'));
    expect(screen.getByTestId('grpc-settings-panel-compression')).toBeTruthy();
    expect(screen.getByTestId('grpc-compression-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-deadline-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-settings-panel-call')).toBeTruthy();
      expect(screen.queryByTestId('grpc-settings-panel-compression')).toBeNull();
    });
  });

  it('closes settings drawer when auth badge focuses auth tab (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
      expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
    });
  });

  it('closes proto manage modal when settings drawer opens (Phase 4J-C)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-manage-modal')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
      expect(screen.queryByTestId('grpc-proto-manage-modal')).toBeNull();
    });
  });

  it('closes settings drawer when switching tabs (Phase 4J-C)', async () => {
    const user = userEvent.setup();
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    });
    await user.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
    });
  });

  it('renders page-level connection chrome without inline TLS PEM (Phase 4J-B / 5H)', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" envName="staging" />);
    const chrome = screen.getByTestId('grpc-connection-chrome');
    expect(chrome.closest('.grpc-studio-page-connection-chrome')).toBeTruthy();
    expect(chrome.querySelector('[data-testid="grpc-connection-bar"]')).toBeTruthy();
    expect(chrome.querySelector('[data-testid="grpc-tls-server-ca"]')).toBeNull();
    expect(screen.getByTestId('grpc-connection-env-badge').textContent).toBe('staging');
  });

  it('keeps Save Request and Import grpcurl on Collections view (Phase 5H)', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" envName="staging" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expect(screen.getByTestId('grpc-collections-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-connection-bar')).toBeTruthy();
    expect(screen.getByTestId('grpc-save-request-btn')).toBeTruthy();
    expect(screen.getByTestId('grpc-import-grpcurl-btn')).toBeTruthy();
    expect(screen.queryByTestId('grpc-tab-bar')).toBeNull();
  });

  it('disables connection bar while unary call is in flight (Phase 4J-A)', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-message'), {
      target: { value: 'phase-4j-a' },
    });
    fireEvent.click(screen.getByTestId('grpc-send-btn'));

    await waitFor(() => {
      expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('grpc-tls-badge') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('grpc-auth-badge') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('grpc-connection-settings-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    resolveCall!();
    await waitFor(() => {
      expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).disabled).toBe(false);
    });
  });

  it('isolates stream event subscriptions per tab (Phase 7E routing)', async () => {
    const openerCalls: Array<{ streamId: string; tabId: string }> = [];
    let streamCounter = 0;

    setGrpcStreamEventsOpener((streamId, tabId) => {
      openerCalls.push({ streamId, tabId });
      return () => undefined;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        streamCounter += 1;
        const tabId = new URL(path, 'http://local').searchParams.get('tabId') ?? 'tab-unknown';
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: `stream-${streamCounter}`,
          requestId: `req-${streamCounter}`,
          tabId,
        });
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-serverstream'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-stream-start-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-stream-start-btn'));
    await waitFor(() => {
      expect(openerCalls).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tab-2')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-tab-2'));

    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-serverstream'));
    fireEvent.click(screen.getByTestId('grpc-stream-start-btn'));

    await waitFor(() => {
      expect(openerCalls).toHaveLength(2);
    });

    expect(openerCalls[0]?.tabId).not.toBe(openerCalls[1]?.tabId);
    expect(openerCalls[0]?.streamId).not.toBe(openerCalls[1]?.streamId);
  });
});
