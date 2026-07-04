/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_TARGET,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '../../shared/grpc/grpcPersistenceSchema';
import { createGrpcSavedRequestFromSnapshot } from '../../shared/grpc/grpcSavedRequest';
import type { UseGrpcCallHistoryResult } from './hooks/useGrpcCallHistory';
import type { UseGrpcCollectionsResult } from './hooks/useGrpcCollections';
import { setGrpcClientTransport } from '../../shared/grpc/grpcApiClient';
import { GrpcStudioPage } from './GrpcStudioPage';
import { resetGrpcTabCounterForTests } from './grpcStudioTypes';

const TS = '2026-06-29T12:00:00.000Z';

function makeSaved(id: string, target = FIXTURE_TARGET.address) {
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    { id, revisionId: `rev-${id}`, updatedAt: TS, name: 'Echo call' },
  );
}

function historyEntry(id: string) {
  return prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: `req-${id}`,
      capturedAt: TS,
      callType: 'unary',
      target: {
        address: FIXTURE_TARGET.address,
        tlsMode: 'disabled',
      },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    result: {
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      message: {},
      durationMs: 12,
    },
  });
}

function expandCollectionAndSelect(savedId: string) {
  const group = screen.getByTestId('grpc-collection-group-col-1');
  fireEvent.click(group.querySelector('.grpc-collection-group__header')!);
  fireEvent.click(screen.getByTestId(`grpc-collection-saved-${savedId}`));
}

const collectionsHook = vi.hoisted(() => ({
  value: null as UseGrpcCollectionsResult | null,
}));
const historyHook = vi.hoisted(() => ({
  value: null as UseGrpcCallHistoryResult | null,
}));

vi.mock('./hooks/useGrpcCollections', () => ({
  useGrpcCollections: () => collectionsHook.value,
}));

vi.mock('./hooks/useGrpcCallHistory', () => ({
  useGrpcCallHistory: () => historyHook.value,
}));

function buildCollectionsHook(
  saved = makeSaved('saved-1'),
  overrides: Partial<UseGrpcCollectionsResult> = {},
): UseGrpcCollectionsResult {
  const collection = {
    id: 'col-1',
    name: 'Echo collection',
    createdAt: TS,
    updatedAt: TS,
    savedRequests: [saved],
  };
  return {
    store: { schemaVersion: 1, updatedAt: TS, collections: [collection] },
    collections: [collection],
    loading: false,
    clearLastMutationError: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    addCollection: vi.fn().mockResolvedValue(collection),
    renameCollection: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    duplicateCollection: vi.fn().mockResolvedValue(undefined),
    saveRequest: vi.fn().mockResolvedValue(saved),
    updateSavedRequest: vi.fn().mockResolvedValue(undefined),
    deleteSavedRequest: vi.fn().mockImplementation(async (_collectionId, savedId) => {
      collection.savedRequests = collection.savedRequests.filter((entry) => entry.id !== savedId);
    }),
    duplicateSavedRequest: vi.fn().mockResolvedValue(saved),
    buildSavedRequestSchemaCompareIntent: vi.fn((request, currentDescriptorKey: string) => {
      const baselineDescriptorKey = request.descriptorKey ?? '';
      return {
        savedRequestId: request.id,
        baselineDescriptorKey,
        currentDescriptorKey,
        keysDiffer: Boolean(baselineDescriptorKey && currentDescriptorKey && baselineDescriptorKey !== currentDescriptorKey),
      };
    }),
    compareSavedRequestSchema: vi.fn(async (_savedRequest, activeDescriptorKey, resolveDescriptor) => {
      await resolveDescriptor(activeDescriptorKey);
      await resolveDescriptor(activeDescriptorKey);
      return {
        leftDescriptorKey: activeDescriptorKey,
        rightDescriptorKey: activeDescriptorKey,
        generatedAt: TS,
        summary: {
          breaking: 0,
          nonBreaking: 0,
          informational: 0,
        },
        changes: [],
      };
    }),
    detectHistoryDescriptorDrift: vi.fn((entry, currentDescriptorKey: string) => {
      const baselineDescriptorKey = entry.record.snapshot.descriptorKey ?? '';
      if (!baselineDescriptorKey || baselineDescriptorKey === currentDescriptorKey) {
        return null;
      }
      return {
        baselineDescriptorKey,
        currentDescriptorKey,
      };
    }),
    buildHistoryDescriptorDriftReport: vi.fn(async (_entry, activeDescriptorKey, resolveDescriptor) => {
      await resolveDescriptor(activeDescriptorKey);
      await resolveDescriptor(activeDescriptorKey);
      return {
        leftDescriptorKey: activeDescriptorKey,
        rightDescriptorKey: activeDescriptorKey,
        generatedAt: TS,
        summary: {
          breaking: 0,
          nonBreaking: 0,
          informational: 0,
        },
        changes: [],
      };
    }),
    ...overrides,
  };
}

function buildHistoryHook(
  entries = [historyEntry('hist-1')],
  overrides: Partial<UseGrpcCallHistoryResult> = {},
): UseGrpcCallHistoryResult {
  return {
    entries,
    filteredEntries: entries,
    filters: {},
    filterOptions: {
      services: [],
      methods: [],
      grpcStatuses: [],
      hasOkEntries: true,
      hasErrorEntries: false,
    },
    loading: false,
    clearLastMutationError: vi.fn(),
    setFilters: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    clearFiltered: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('GrpcStudioPage Phase 5H coverage gaps', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    setGrpcClientTransport(null);
    collectionsHook.value = buildCollectionsHook();
    historyHook.value = buildHistoryHook();
  });

  it('switches to history view and renders history panel', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-history'));
    expect(screen.getByTestId('grpc-history-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-sub-nav-history-badge').textContent).toBe('1');
    expect(screen.queryByTestId('grpc-tab-bar')).toBeNull();
  });

  it('defaults to compact density when localStorage read fails', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    expect((screen.getByTestId('grpc-density-compact-btn') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    getItemSpy.mockRestore();
  });

  it('restores comfortable density mode from localStorage', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('comfortable');

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    expect((screen.getByTestId('grpc-density-comfortable-btn') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    getItemSpy.mockRestore();
  });

  it('persists density changes best-effort when localStorage write fails', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('comfortable');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('write blocked');
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-density-compact-btn'));

    await waitFor(() => {
      expect((screen.getByTestId('grpc-density-compact-btn') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    });

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('opens a saved request in studio from collections', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_DESCRIPTOR,
    }));

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');
    fireEvent.click(screen.getByTestId('grpc-saved-request-open-studio'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-sub-nav-studio').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-method-detail-service').textContent).toBe('echo.EchoService');
      expect(screen.queryByTestId('grpc-replay-action-error')).toBeNull();
    });
  });

  it('copies grpcurl command from collections selection', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');
    fireEvent.click(screen.getByTestId('grpc-saved-request-copy-grpcurl'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  it('copies grpcurl command from history panel', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-history'));
    fireEvent.click(screen.getByTestId('grpc-history-entry-hist-1'));
    fireEvent.click(screen.getByTestId('grpc-history-copy-grpcurl'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  it('replays a history entry into the active studio tab', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_DESCRIPTOR,
    }));

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-sub-nav-history'));
    fireEvent.click(screen.getByTestId('grpc-history-entry-hist-1'));
    fireEvent.click(screen.getByTestId('grpc-history-replay-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-sub-nav-studio').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-method-detail-service').textContent).toBe('echo.EchoService');
    });
  });

  it('saves the active request to a new collection and navigates to collections', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });
    collectionsHook.value = buildCollectionsHook(makeSaved('saved-1'), {
      collections: [],
      store: { schemaVersion: 1, updatedAt: TS, collections: [] },
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-save-request-btn'));
    expect(screen.getByTestId('grpc-save-request-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => {
      expect(collectionsHook.value?.saveRequest).toHaveBeenCalled();
      expect(screen.getByTestId('grpc-collections-panel')).toBeTruthy();
    });
  });

  it('imports a grpcurl command into the active tab', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-import-grpcurl-btn'));
    fireEvent.change(screen.getByTestId('grpc-import-grpcurl-textarea'), {
      target: {
        value: 'grpcurl -plaintext localhost:50051 echo.EchoService/Echo',
      },
    });
    fireEvent.click(screen.getByTestId('grpc-import-grpcurl-submit'));

    await waitFor(() => {
      expect(screen.queryByTestId('grpc-import-grpcurl-modal')).toBeNull();
      expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).value).toBe('localhost:50051');
    });
  });

  it('shows health unavailable hint before services are reflected', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    expect(screen.getByTestId('grpc-health-unavailable').textContent).toMatch(/reflect services first/i);
    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables health check when target is invalid after reflect', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.change(screen.getByTestId('grpc-target-input'), { target: { value: 'not-a-target' } });
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));

    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('updates TLS config from settings drawer and TLS modal restore', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => expect(screen.getByTestId('grpc-tls-body')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    fireEvent.change(screen.getByTestId('grpc-tls-server-name'), { target: { value: 'grpc.example.com' } });

    fireEvent.change(screen.getByTestId('grpc-tls-server-name'), { target: { value: 'override.example.com' } });
    fireEvent.click(screen.getByTestId('grpc-tls-reset'));
    fireEvent.click(screen.getByTestId('grpc-tls-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    });
  });

  it('toggles target connection from connection bar', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.change(screen.getByTestId('grpc-target-input'), { target: { value: 'localhost:50051' } });
    fireEvent.click(screen.getByTestId('grpc-connection-toggle-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-connection-status-dot').getAttribute('aria-label')).toMatch(/Connection status:/i);
    });
  });

  it('deletes selected saved request from collections detail panel', async () => {
    const deleteSavedRequest = vi.fn().mockResolvedValue(undefined);
    collectionsHook.value = buildCollectionsHook(makeSaved('saved-1'), { deleteSavedRequest });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');
    fireEvent.click(screen.getByTestId('grpc-saved-request-delete'));

    await waitFor(() => {
      expect(deleteSavedRequest).toHaveBeenCalledWith('col-1', 'saved-1');
    });
  });

  it('updates auth secret fields from the bottom auth tab', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    fireEvent.change(screen.getByTestId('grpc-auth-type-select'), { target: { value: 'bearer' } });
    fireEvent.change(screen.getByTestId('grpc-auth-bearer-token'), { target: { value: 'secret-token' } });
    expect((screen.getByTestId('grpc-auth-bearer-token') as HTMLInputElement).value).toBe('secret-token');
  });

  it('returns early when compare schema is triggered without active descriptor key', async () => {
    const compareSavedRequestSchema = vi.fn();
    collectionsHook.value = buildCollectionsHook(makeSaved('saved-1'), { compareSavedRequestSchema });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');
    fireEvent.click(screen.getByTestId('grpc-saved-request-compare-schema'));

    await waitFor(() => {
      expect(compareSavedRequestSchema).not.toHaveBeenCalled();
      expect(screen.getByTestId('grpc-collections-panel')).toBeTruthy();
    });
  });

  it('opens advanced schema diff from saved request compare action', async () => {
    const saved = { ...makeSaved('saved-compare') };
    saved.descriptorKey = 'baseline-descriptor';

    const compareSavedRequestSchema = vi.fn(async (_savedRequest, activeDescriptorKey: string, resolveDescriptor: (key: string) => Promise<unknown>) => {
      await resolveDescriptor(activeDescriptorKey);
      await resolveDescriptor(activeDescriptorKey);
      return {
        leftDescriptorKey: 'baseline-descriptor',
        rightDescriptorKey: activeDescriptorKey,
        generatedAt: TS,
        summary: {
          breaking: 0,
          nonBreaking: 1,
          informational: 0,
        },
        changes: [],
      };
    });

    collectionsHook.value = buildCollectionsHook(saved, { compareSavedRequestSchema });
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      if (op === 'lookup_descriptor') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, op: 'lookup_descriptor', data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-compare');
    fireEvent.click(screen.getByTestId('grpc-saved-request-compare-schema'));

    await waitFor(() => {
      expect(compareSavedRequestSchema).toHaveBeenCalled();
      expect(screen.getByTestId('grpc-sub-nav-advanced').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-schema-diff-panel')).toBeTruthy();
    });
  });

  it('opens advanced load-test panel from saved request action', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');
    fireEvent.click(screen.getByTestId('grpc-saved-request-run-load-test'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-sub-nav-advanced').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-load-test-panel')).toBeTruthy();
    });
  });

  it('opens advanced schema diff from history open-diff action', async () => {
    const entry = historyEntry('hist-diff');
    (entry as { descriptorKey: string }).descriptorKey = 'baseline-history-descriptor';
    entry.record.snapshot.descriptorKey = 'baseline-history-descriptor';
    historyHook.value = buildHistoryHook([entry]);

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      if (op === 'lookup_descriptor') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, op: 'lookup_descriptor', data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-sub-nav-history'));
    fireEvent.click(screen.getByTestId('grpc-history-entry-hist-diff'));
    const openDiffButton = screen.getByTestId('grpc-history-open-diff-btn') as HTMLButtonElement;
    expect(openDiffButton.disabled).toBe(false);
    fireEvent.click(openDiffButton);

    await waitFor(() => {
      expect(screen.getByTestId('grpc-sub-nav-advanced').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-schema-diff-panel')).toBeTruthy();
    });
  });

  it('keeps history view when history schema diff report is unavailable', async () => {
    const entry = historyEntry('hist-no-report');
    (entry as { descriptorKey: string }).descriptorKey = 'baseline-history-descriptor';
    entry.record.snapshot.descriptorKey = 'baseline-history-descriptor';
    historyHook.value = buildHistoryHook([entry]);
    collectionsHook.value = buildCollectionsHook(makeSaved('saved-1'), {
      buildHistoryDescriptorDriftReport: vi.fn(async () => null),
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      if (op === 'lookup_descriptor') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, op: 'lookup_descriptor', data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-sub-nav-history'));
    fireEvent.click(screen.getByTestId('grpc-history-entry-hist-no-report'));
    fireEvent.click(screen.getByTestId('grpc-history-open-diff-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-sub-nav-studio').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-call-method-name').textContent).toMatch(/Echo/i);
      expect(screen.getByTestId('grpc-sub-nav-advanced').className).not.toMatch(/active/);
      expect(screen.queryByTestId('grpc-schema-diff-panel')).toBeNull();
    });
  });

  it('sends stream message immediately and removes queued message', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-clientstream'));
    await waitFor(() => expect(screen.getByTestId('grpc-stream-start-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-stream-start-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-stream-add-queue-btn')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-stream-add-queue-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-stream-pending-remove-0')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-stream-send-now-btn'));
    fireEvent.click(screen.getByTestId('grpc-stream-pending-remove-0'));

    await waitFor(() => {
      expect(screen.queryByTestId('grpc-stream-pending-item-0')).toBeNull();
    });
  });

});
