/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_TARGET,
  FIXTURE_UNARY_CALL_REQUEST,
} from '@shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '@shared/grpc/grpcPersistenceSchema';
import { createGrpcSavedRequestFromSnapshot } from '@shared/grpc/grpcSavedRequest';
import type { UseGrpcCallHistoryResult } from './hooks/useGrpcCallHistory';
import type { UseGrpcCollectionsResult } from './hooks/useGrpcCollections';
import { setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
import { GrpcStudioPage } from './GrpcStudioPage';
import { resetGrpcTabCounterForTests } from './grpcStudioTypes';
import * as grpcReplayBinding from './utils/grpcReplayBinding';
import * as useGrpcStudioModule from './hooks/useGrpcStudio';
import type { GrpcHealthCheckPanelProps } from './components/GrpcHealthCheckPanel';

const TS = '2026-06-29T12:00:00.000Z';

const studioHook = vi.hoisted(() => ({
  wrap: null as ((
    hook: ReturnType<typeof useGrpcStudioModule.useGrpcStudio>,
  ) => ReturnType<typeof useGrpcStudioModule.useGrpcStudio>) | null,
}));

const collectionsHook = vi.hoisted(() => ({
  value: null as UseGrpcCollectionsResult | null,
}));

const historyHook = vi.hoisted(() => ({
  value: null as UseGrpcCallHistoryResult | null,
}));

vi.mock('./components/GrpcHealthCheckPanel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/GrpcHealthCheckPanel')>();
  return {
    ...actual,
    GrpcHealthCheckPanel: (props: GrpcHealthCheckPanelProps) => {
      const [forcedError, setForcedError] = useState<string | null>(null);
      return (
        <div>
          <actual.GrpcHealthCheckPanel {...props} />
          <button
            type="button"
            data-testid="grpc-health-force-check"
            onClick={() => {
              void props.onCheckHealth('').then((outcome) => {
                if (!outcome.ok) setForcedError(outcome.error);
              });
            }}
          >
            force check
          </button>
          <button
            type="button"
            data-testid="grpc-health-force-watch"
            onClick={() => props.onStartWatch('')}
          >
            force watch
          </button>
          {forcedError && (
            <div data-testid="grpc-health-result-error" role="alert">
              {forcedError}
            </div>
          )}
        </div>
      );
    },
  };
});

vi.mock('./hooks/useGrpcStudio', async (importOriginal) => {
  const actual = await importOriginal<typeof useGrpcStudioModule>();
  return {
    ...actual,
    useGrpcStudio: (options?: Parameters<typeof actual.useGrpcStudio>[0]) => {
      const hook = actual.useGrpcStudio(options);
      return studioHook.wrap ? studioHook.wrap(hook) : hook;
    },
  };
});

vi.mock('./components/GrpcConnectionBar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/GrpcConnectionBar')>();
  return {
    ...actual,
    GrpcConnectionBar: (props: ComponentProps<typeof actual.GrpcConnectionBar>) => (
      <actual.GrpcConnectionBar {...props} saveRequestDisabled={false} />
    ),
  };
});

vi.mock('./hooks/useGrpcCollections', () => ({
  useGrpcCollections: () => collectionsHook.value,
}));

vi.mock('./hooks/useGrpcCallHistory', () => ({
  useGrpcCallHistory: () => historyHook.value,
}));

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

function buildHistoryHook(entries = [historyEntry('hist-1')]): UseGrpcCallHistoryResult {
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
  };
}

function makeSaved(id: string) {
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_TARGET.address,
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

function buildCollectionsHook(saved = makeSaved('saved-1')): UseGrpcCollectionsResult {
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
  };
}

function expandCollectionAndSelect(savedId: string) {
  const group = screen.getByTestId('grpc-collection-group-col-1');
  fireEvent.click(group.querySelector('.grpc-collection-group__header')!);
  fireEvent.click(screen.getByTestId(`grpc-collection-saved-${savedId}`));
}

describe('GrpcStudioPage branch coverage gaps', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    studioHook.wrap = null;
    collectionsHook.value = buildCollectionsHook();
    historyHook.value = buildHistoryHook();
    setGrpcClientTransport(null);
    vi.restoreAllMocks();
  });

  it('returns early from health check when health service is unavailable', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-force-check'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result-error').textContent).toMatch(/reflect services first/i);
    });
  });

  it('returns early from health check when descriptor key is missing', async () => {
    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        descriptorKey: undefined,
      },
      activeTabDescriptor: {
        ...hook.activeTabDescriptor,
        descriptor: hook.activeTabDescriptor.descriptor
          ? { ...hook.activeTabDescriptor.descriptor, key: undefined }
          : undefined,
      },
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-force-check'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result-error').textContent).toMatch(/descriptor key is required/i);
    });
  });

  it('returns early from health watch when probe is not ready', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-force-watch'));
    expect(screen.queryByTestId('grpc-method-detail-service')).toBeNull();
  });

  it('returns early from health check when target validation fails', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    studioHook.wrap = (hook) => {
      const base = hook.resolveTabConnection(hook.activeTab.id);
      return {
        ...hook,
        resolveTabConnection: () => ({
          ...base,
          targetValidation: {
            valid: false,
            reason: 'Target must be host:port or in-process:<name>',
            normalized: '',
            kind: 'invalid_format' as const,
          },
        }),
      };
    };
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-force-check'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result-error').textContent).toMatch(/host:port/i);
    });
  });

  it('returns early from health check when TLS configuration is invalid', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        tlsMode: 'mtls',
        tlsConfig: {},
      },
    });
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-force-check'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result-error').textContent).toMatch(/TLS configuration/i);
    });
  });

  it('changes transport mode from the connection settings drawer', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-transport'));
    fireEvent.click(screen.getByTestId('grpc-transport-mode-express'));
    expect(screen.getByTestId('grpc-transport-mode-express').className).toMatch(/active/);
  });

  it('resolves save snapshot without service or method selected', () => {
    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        service: undefined,
        method: undefined,
      },
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-save-request-btn'));
    expect(screen.getByText(/select a method and configure the request before saving/i)).toBeTruthy();
  });

  it('surfaces prepareExecuteSnapshot failures when saving', async () => {
    studioHook.wrap = (hook) => ({
      ...hook,
      prepareExecuteSnapshot: vi.fn(() => {
        throw new Error('snapshot blocked');
      }),
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-save-request-btn'));
    expect(screen.getByRole('alert').textContent).toMatch(/snapshot blocked/i);
  });

  it('uses generic save snapshot error text for non-Error throws', async () => {
    studioHook.wrap = (hook) => ({
      ...hook,
      prepareExecuteSnapshot: vi.fn(() => {
        throw 'snapshot blocked';
      }),
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-save-request-btn'));
    expect(screen.getByRole('alert').textContent).toMatch(/cannot prepare request snapshot/i);
  });

  it('shows blocked open-in-studio title when replay binding is not executable', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');

    const openBtn = screen.getByTestId('grpc-saved-request-open-studio') as HTMLButtonElement;
    expect(openBtn.disabled).toBe(true);
    expect(openBtn.title).toMatch(/load a schema|descriptor|blocked/i);
  });

  it('uses resolver error message when open-in-studio status computation throws', () => {
    vi.spyOn(grpcReplayBinding, 'resolveGrpcReplayBinding').mockImplementation(() => {
      throw new Error('binding boom');
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');

    expect((screen.getByTestId('grpc-saved-request-open-studio') as HTMLButtonElement).title).toBe('binding boom');
  });

  it('clears selected saved request when it is deleted', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-sub-nav-collections'));
    expandCollectionAndSelect('saved-1');
    expect(screen.getByTestId('grpc-saved-request-detail').className).not.toMatch(/empty/);

    fireEvent.click(screen.getByTestId('grpc-saved-request-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-saved-request-detail').className).toMatch(/empty/);
    });
  });

  it('toggles the wire console launcher and shows the event badge count', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    const launcher = screen.getByTestId('grpc-console-launcher');
    expect(launcher.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(launcher);
    expect(launcher.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('grpc-console-modal')).toBeTruthy();

    fireEvent.click(launcher);
    expect(launcher.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('grpc-console-modal')).toBeNull();
  });

  it('mirrors unary send and terminal events into the wire console', () => {
    const snapshot = {
      tabId: 'tab-1',
      requestId: 'req-console-unary',
      capturedAt: TS,
      callType: 'unary' as const,
      target: { address: FIXTURE_TARGET.address, tlsMode: 'disabled' as const },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };

    const { rerender } = render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-console-launcher'));

    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        lifecycle: 'in_flight',
        lastExecuteSnapshot: snapshot,
      },
    });
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        lifecycle: 'success',
        lastExecuteSnapshot: snapshot,
        lastResult: {
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'hello' },
          durationMs: 12,
        },
      },
    });
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    expect(screen.getByTestId('grpc-console-launcher-count').textContent).toBe('2');
    expect(screen.getByTestId('grpc-console-wire-live-feed')).toBeTruthy();
  });

  it('mirrors stream messages and terminal lifecycle into the wire console', () => {
    const streamSnapshot = {
      tabId: 'tab-1',
      requestId: 'req-console-stream',
      capturedAt: TS,
      callType: 'server_streaming' as const,
      target: { address: FIXTURE_TARGET.address, tlsMode: 'disabled' as const },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };

    const { rerender } = render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-console-launcher'));

    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        streamLifecycle: 'streaming',
        streamMessages: [{
          direction: 'inbound' as const,
          sequence: 1,
          timestamp: TS,
          data: { message: 'chunk' },
        }],
        lastExecuteSnapshot: streamSnapshot,
      },
    });
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    studioHook.wrap = (hook) => ({
      ...hook,
      activeTab: {
        ...hook.activeTab,
        streamLifecycle: 'ended',
        streamEndedAt: TS,
        streamStartedAt: TS,
        streamMessages: [{
          direction: 'inbound' as const,
          sequence: 1,
          timestamp: TS,
          data: { message: 'chunk' },
        }],
        lastExecuteSnapshot: streamSnapshot,
      },
    });
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    expect(Number(screen.getByTestId('grpc-console-launcher-count').textContent)).toBeGreaterThanOrEqual(2);
  });
});
