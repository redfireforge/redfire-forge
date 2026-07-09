/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrpcStudioPage } from './GrpcStudioPage';

const studioState = {
  activeDescriptorKey: '',
  replayOpenInStudio: false,
  replayOpenLoadTest: false,
  replayHistory: false,
  lastActionError: '',
  compareIntent: { baselineDescriptorKey: '', currentDescriptorKey: '', keysDiffer: true },
  historyDriftIntent: { baselineDescriptorKey: '', currentDescriptorKey: '', keysDiffer: true } as null | { baselineDescriptorKey: string; currentDescriptorKey: string; keysDiffer: boolean },
  compareResolveKey: undefined as string | undefined,
  historyResolveKey: undefined as string | undefined,
};

const spies = {
  restorePersistedSession: vi.fn(),
  toggleTargetConnection: vi.fn(),
  sendStreamMessageCall: vi.fn(),
  removePendingStreamMessage: vi.fn(),
  enqueueStreamMessage: vi.fn(),
  sendAllPendingStreamMessages: vi.fn(),
  endStreamCall: vi.fn(),
  clearStreamLog: vi.fn(),
  retryUnaryWithExpress: vi.fn(),
  retryStreamWithExpress: vi.fn(),
  updateTab: vi.fn(),
  setActiveFeatureTab: vi.fn(),
  applySchemaDiffComparison: vi.fn(),
};

type SubNavView = 'studio' | 'collections' | 'history' | 'advanced';

vi.mock('../../shared/components/ProtocolEndpointPreview', () => ({
  ProtocolEndpointPreview: () => React.createElement('div', { 'data-testid': 'endpoint-preview' }),
}));

vi.mock('./components/GrpcConnectionBar', () => ({
  GrpcConnectionBar: (props: { onConnectionToggle?: () => void }) => React.createElement('button', {
    'data-testid': 'mock-toggle-connection',
    onClick: props.onConnectionToggle,
  }, 'toggle'),
}));

vi.mock('./components/GrpcTargetPanel', () => ({ GrpcTargetPanel: () => null }));
vi.mock('./components/GrpcTlsPanel', () => ({ GrpcTlsPanel: () => null }));
vi.mock('./components/GrpcTabBar', () => ({ GrpcTabBar: () => React.createElement('div', { 'data-testid': 'grpc-tab-bar' }) }));
vi.mock('./components/GrpcProtoManageModal', () => ({ GrpcProtoManageModal: () => null }));
vi.mock('./components/GrpcSaveRequestModal', () => ({ GrpcSaveRequestModal: () => null }));
vi.mock('./components/GrpcGrpcurlImportModal', () => ({ GrpcGrpcurlImportModal: () => null }));

vi.mock('./components/GrpcStudioSubNav', () => ({
  GrpcStudioSubNav: (props: { onSelect: (view: SubNavView) => void }) => React.createElement('div', {}, [
    React.createElement('button', { key: 'studio', 'data-testid': 'mock-nav-studio', onClick: () => props.onSelect('studio') }, 'studio'),
    React.createElement('button', { key: 'collections', 'data-testid': 'mock-nav-collections', onClick: () => props.onSelect('collections') }, 'collections'),
    React.createElement('button', { key: 'history', 'data-testid': 'mock-nav-history', onClick: () => props.onSelect('history') }, 'history'),
    React.createElement('button', { key: 'advanced', 'data-testid': 'mock-nav-advanced', onClick: () => props.onSelect('advanced') }, 'advanced'),
  ]),
}));

vi.mock('./components/GrpcCollectionsPanel', () => ({
  GrpcCollectionsPanel: (props: { onCompareSchema?: (saved: { id: string; updatedAt: string }, collectionId: string) => void; onRunLoadTest?: (saved: { id: string; updatedAt: string }, collectionId: string) => void }) => {
    const saved = { id: 'saved-1', updatedAt: '2026-07-01T00:00:00.000Z' };
    return React.createElement('div', { 'data-testid': 'mock-collections-panel' }, [
      React.createElement('button', {
        key: 'compare',
        'data-testid': 'mock-compare-schema',
        onClick: () => props.onCompareSchema?.(saved, 'col-1'),
      }, 'compare'),
      React.createElement('button', {
        key: 'load',
        'data-testid': 'mock-run-load-test',
        onClick: () => props.onRunLoadTest?.(saved, 'col-1'),
      }, 'load'),
    ]);
  },
}));

vi.mock('./components/GrpcHistoryPanel', () => ({
  GrpcHistoryPanel: (props: { onOpenDiff?: (entry: { id: string; capturedAt: string; descriptorKey: string; record: { snapshot: { descriptorKey: string } } }) => void }) => {
    const entry = {
      id: 'hist-1',
      capturedAt: '2026-07-01T00:00:00.000Z',
      descriptorKey: 'baseline-descriptor',
      record: { snapshot: { descriptorKey: 'baseline-descriptor' } },
    };
    return React.createElement('button', {
      'data-testid': 'mock-open-diff',
      onClick: () => props.onOpenDiff?.(entry),
    }, 'open-diff');
  },
}));

vi.mock('./components/GrpcAdvancedFeaturesShell', () => ({ GrpcAdvancedFeaturesShell: () => React.createElement('div', { 'data-testid': 'mock-advanced-shell' }) }));

vi.mock('./components/GrpcExplorerPane', () => ({
  GrpcExplorerPane: (props: { connectionChrome: React.ReactNode; onSendStreamMessage?: (overrides?: { body?: Record<string, unknown> }) => void; onEnqueueStreamMessage?: (overrides?: { body?: Record<string, unknown> }) => void; onRemovePendingStreamMessage?: (index: number) => void; onSendAllPendingStreamMessages?: () => void | Promise<void>; onEndStream?: () => void; onRetryUnaryWithExpress?: () => void; onRetryStreamWithExpress?: () => void }) => React.createElement('div', { 'data-testid': 'mock-explorer-pane' }, [
    React.createElement('div', { key: 'chrome' }, props.connectionChrome),
    React.createElement('button', { key: 'send', 'data-testid': 'mock-send-stream', onClick: () => props.onSendStreamMessage?.({ body: { a: 1 } }) }, 'send-stream'),
    React.createElement('button', { key: 'enqueue', 'data-testid': 'mock-enqueue-stream', onClick: () => props.onEnqueueStreamMessage?.({ body: { queued: true } }) }, 'enqueue'),
    React.createElement('button', { key: 'send-all', 'data-testid': 'mock-send-all-stream', onClick: () => { void props.onSendAllPendingStreamMessages?.(); } }, 'send-all'),
    React.createElement('button', { key: 'end', 'data-testid': 'mock-end-stream', onClick: () => props.onEndStream?.() }, 'end'),
    React.createElement('button', { key: 'remove', 'data-testid': 'mock-remove-pending', onClick: () => props.onRemovePendingStreamMessage?.(0) }, 'remove'),
    React.createElement('button', { key: 'retry-u', 'data-testid': 'mock-retry-unary', onClick: () => props.onRetryUnaryWithExpress?.() }, 'retry-unary'),
    React.createElement('button', { key: 'retry-s', 'data-testid': 'mock-retry-stream', onClick: () => props.onRetryStreamWithExpress?.() }, 'retry-stream'),
  ]),
}));

vi.mock('./components/GrpcConnectionSettingsDrawer', () => ({
  GrpcConnectionSettingsDrawer: (props: { onK8sPortForwardChange?: (session: { active: boolean; config: { namespace: string; name: string; targetType: string; remotePort: number; localPort: number } }) => void; onK8sApplyTarget?: (target: string) => void; onMaxResponseSizeMbChange?: (value: number) => void; onKeepaliveIntervalSecChange?: (value: number) => void }) => React.createElement('div', { 'data-testid': 'mock-settings-drawer' }, [
    React.createElement('button', {
      key: 'k8s-pf',
      'data-testid': 'mock-k8s-port-forward',
      onClick: () => props.onK8sPortForwardChange?.({ active: true, config: { namespace: 'default', name: 'svc', targetType: 'service', remotePort: 50051, localPort: 50051 } }),
    }, 'k8s-pf'),
    React.createElement('button', {
      key: 'k8s-target',
      'data-testid': 'mock-k8s-apply-target',
      onClick: () => props.onK8sApplyTarget?.('127.0.0.1:50051'),
    }, 'k8s-target'),
    React.createElement('button', {
      key: 'max-response',
      'data-testid': 'mock-max-response',
      onClick: () => props.onMaxResponseSizeMbChange?.(32),
    }, 'max-response'),
    React.createElement('button', {
      key: 'keepalive',
      'data-testid': 'mock-keepalive',
      onClick: () => props.onKeepaliveIntervalSecChange?.(15),
    }, 'keepalive'),
  ]),
}));

vi.mock('./hooks/useGrpcTls', () => ({ useGrpcTls: () => ({ valid: true, issues: [] }) }));

vi.mock('./hooks/useGrpcStudioPersistence', () => ({
  useGrpcStudioPersistence: (_state: unknown, onRestore: (persisted: unknown) => void) => {
    onRestore({ tabs: [], activeTabId: 'grpc-tab-1', tabDescriptors: {} });
    onRestore({ tabs: [], activeTabId: 'grpc-tab-1', tabDescriptors: {} });
  },
}));

vi.mock('./hooks/useGrpcCollections', () => ({
  useGrpcCollections: () => ({
    collections: [],
    buildSavedRequestSchemaCompareIntent: vi.fn(() => studioState.compareIntent),
    compareSavedRequestSchema: vi.fn(async (_saved: unknown, _activeDescriptorKey: string, resolveDescriptor: (key: string) => Promise<unknown>) => {
      if (studioState.compareResolveKey !== undefined) {
        await resolveDescriptor(studioState.compareResolveKey);
      }
      return { generatedAt: '', changes: [], summary: { breaking: 0, nonBreaking: 0, informational: 0 } };
    }),
    detectHistoryDescriptorDrift: vi.fn(() => studioState.historyDriftIntent),
    buildHistoryDescriptorDriftReport: vi.fn(async (_entry: unknown, _activeDescriptorKey: string, resolveDescriptor: (key: string) => Promise<unknown>) => {
      if (studioState.historyResolveKey !== undefined) {
        await resolveDescriptor(studioState.historyResolveKey);
      }
      return { generatedAt: '', changes: [], summary: { breaking: 0, nonBreaking: 0, informational: 0 } };
    }),
  }),
}));

vi.mock('./hooks/useGrpcCallHistory', () => ({ useGrpcCallHistory: () => ({ entries: [], filteredEntries: [], filters: {}, filterOptions: {}, loading: false }) }));

vi.mock('./hooks/useGrpcStudioAdvancedFeatures', () => ({
  useGrpcStudioAdvancedFeatures: () => ({
    setActiveFeatureTab: spies.setActiveFeatureTab,
    applySchemaDiffComparison: spies.applySchemaDiffComparison,
  }),
}));

vi.mock('./hooks/useGrpcStudioReplayActions', () => ({
  useGrpcStudioReplayActions: () => ({
    lastActionError: studioState.lastActionError,
    clearLastActionError: vi.fn(),
    openSavedRequestInStudio: vi.fn(() => studioState.replayOpenInStudio),
    openSavedRequestForLoadTest: vi.fn(() => studioState.replayOpenLoadTest),
    replayHistoryEntry: vi.fn(() => studioState.replayHistory),
  }),
}));

vi.mock('./hooks/useGrpcStudioPageCollections', () => ({
  useGrpcSavedRequestRunTracking: () => undefined,
  useGrpcStudioSaveSnapshot: () => () => null,
  useGrpcSelectedSavedRequest: () => ({
    lastUnaryResultForSelected: undefined,
    openInStudioStatusForSelected: { executable: true, title: '' },
    runLoadTestStatusForSelected: { executable: true, title: '' },
    compareSchemaStatusForSelected: { executable: true, title: '' },
  }),
}));

vi.mock('../../shared/grpc/grpcApiClient', () => ({
  postGrpcDescriptorLookup: vi.fn(async () => ({ data: { key: 'descriptor' } })),
}));

vi.mock('./hooks/useGrpcStudio', () => ({
  useGrpcStudio: () => ({
    tabs: [{ id: 'grpc-tab-1', descriptorKey: studioState.activeDescriptorKey, body: {}, metadata: {}, timeoutMs: 30000, tlsConfig: {}, auth: { type: 'none' }, lifecycle: 'idle', streamLifecycle: 'idle', maskedSecretFields: {}, connectionId: 'c1', envVarOverrides: {}, target: '', targetConnection: 'disconnected' }],
    activeTabId: 'grpc-tab-1',
    activeTab: { id: 'grpc-tab-1', descriptorKey: studioState.activeDescriptorKey, body: {}, metadata: {}, timeoutMs: 30000, tlsConfig: {}, auth: { type: 'none' }, lifecycle: 'idle', streamLifecycle: 'idle', maskedSecretFields: {}, connectionId: 'c1', envVarOverrides: {}, target: '', targetConnection: 'disconnected' },
    activeTabDescriptor: { descriptor: studioState.activeDescriptorKey ? { key: studioState.activeDescriptorKey, services: [] } : undefined, protoIngest: undefined, loadState: 'idle' },
    tabDescriptors: { 'grpc-tab-1': { descriptor: studioState.activeDescriptorKey ? { key: studioState.activeDescriptorKey, services: [] } : undefined } },
    profiles: [],
    canAddTab: true,
    maxTabs: 8,
    restorePersistedSession: spies.restorePersistedSession,
    resolveTabConnection: () => ({ target: 'localhost:50051', targetValidation: { valid: true, normalized: 'localhost:50051' }, tlsMode: 'disabled' }),
    updateTab: spies.updateTab,
    toggleTargetConnection: spies.toggleTargetConnection,
    selectTab: vi.fn(),
    addTab: vi.fn(),
    closeTab: vi.fn(),
    duplicateTab: vi.fn(),
    renameTab: vi.fn(),
    reflectTab: vi.fn(),
    patchTabProtoIngest: vi.fn(),
    selectMethod: vi.fn(),
    toggleServiceExpanded: vi.fn(),
    executeUnaryCall: vi.fn(),
    cancelUnaryCall: vi.fn(),
    startStreamCall: vi.fn(),
    cancelStreamCall: vi.fn(),
    sendStreamMessageCall: spies.sendStreamMessageCall,
    enqueueStreamMessage: spies.enqueueStreamMessage,
    removePendingStreamMessage: spies.removePendingStreamMessage,
    sendAllPendingStreamMessages: spies.sendAllPendingStreamMessages,
    endStreamCall: spies.endStreamCall,
    clearStreamLog: spies.clearStreamLog,
    retryUnaryWithExpress: spies.retryUnaryWithExpress,
    retryStreamWithExpress: spies.retryStreamWithExpress,
    dismissSchemaDrift: vi.fn(),
    pruneSchemaDriftBody: vi.fn(),
    rebindSchemaDriftMethod: vi.fn(),
    setTabTransportMode: vi.fn(),
    describeFromIngest: vi.fn(),
    exportProtoset: vi.fn(),
    retryUnaryWithExpressProxy: vi.fn(),
  }),
}));

describe('GrpcStudioPage callback branch coverage', () => {
  beforeEach(() => {
    studioState.activeDescriptorKey = '';
    studioState.replayOpenInStudio = false;
    studioState.replayOpenLoadTest = false;
    studioState.replayHistory = false;
    studioState.lastActionError = '';
    studioState.compareIntent = { baselineDescriptorKey: '', currentDescriptorKey: '', keysDiffer: true };
    studioState.historyDriftIntent = { baselineDescriptorKey: 'baseline-descriptor', currentDescriptorKey: 'current-descriptor', keysDiffer: true };
    studioState.compareResolveKey = undefined;
    studioState.historyResolveKey = undefined;
    Object.values(spies).forEach((spy) => spy.mockReset());
  });

  it('covers guarded callback branches and callback handlers', () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    fireEvent.click(screen.getByTestId('mock-toggle-connection'));
    fireEvent.click(screen.getByTestId('mock-send-stream'));
    fireEvent.click(screen.getByTestId('mock-enqueue-stream'));
    fireEvent.click(screen.getByTestId('mock-send-all-stream'));
    fireEvent.click(screen.getByTestId('mock-end-stream'));
    fireEvent.click(screen.getByTestId('mock-remove-pending'));
    fireEvent.click(screen.getByTestId('mock-retry-unary'));
    fireEvent.click(screen.getByTestId('mock-retry-stream'));
    fireEvent.click(screen.getByTestId('mock-k8s-port-forward'));
    fireEvent.click(screen.getByTestId('mock-k8s-apply-target'));

    fireEvent.click(screen.getByTestId('mock-nav-collections'));
    fireEvent.click(screen.getByTestId('mock-compare-schema'));
    fireEvent.click(screen.getByTestId('mock-run-load-test'));

    fireEvent.click(screen.getByTestId('mock-nav-history'));
    fireEvent.click(screen.getByTestId('mock-open-diff'));

    expect(spies.toggleTargetConnection).toHaveBeenCalled();
    expect(spies.sendStreamMessageCall).toHaveBeenCalled();
    expect(spies.enqueueStreamMessage).toHaveBeenCalled();
    expect(spies.sendAllPendingStreamMessages).toHaveBeenCalled();
    expect(spies.endStreamCall).toHaveBeenCalled();
    expect(spies.removePendingStreamMessage).toHaveBeenCalledWith('grpc-tab-1', 0);
    expect(spies.retryUnaryWithExpress).toHaveBeenCalledWith('grpc-tab-1');
    expect(spies.retryStreamWithExpress).toHaveBeenCalledWith('grpc-tab-1');
    expect(spies.updateTab).toHaveBeenCalled();
    expect(spies.restorePersistedSession).toHaveBeenCalledTimes(1);
  });

  it('covers compare keysDiffer false branch with active descriptor', () => {
    studioState.activeDescriptorKey = 'current-descriptor';
    studioState.replayOpenInStudio = true;
    studioState.compareIntent = { baselineDescriptorKey: 'current-descriptor', currentDescriptorKey: 'current-descriptor', keysDiffer: false };

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('mock-nav-collections'));
    fireEvent.click(screen.getByTestId('mock-compare-schema'));

    expect(spies.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('covers compare-schema early returns for missing active descriptor and blank descriptor lookup keys', () => {
    studioState.replayOpenInStudio = true;

    const { rerender } = render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('mock-nav-collections'));
    fireEvent.click(screen.getByTestId('mock-compare-schema'));
    expect(spies.applySchemaDiffComparison).not.toHaveBeenCalled();

    studioState.activeDescriptorKey = 'current-descriptor';
    studioState.compareResolveKey = '';
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('mock-nav-collections'));
    fireEvent.click(screen.getByTestId('mock-compare-schema'));
    expect(spies.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('covers history diff early returns for missing descriptor, null drift intent, and blank descriptor lookup keys', () => {
    studioState.replayHistory = true;

    const { rerender } = render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('mock-nav-history'));
    fireEvent.click(screen.getByTestId('mock-open-diff'));
    expect(spies.applySchemaDiffComparison).not.toHaveBeenCalled();

    studioState.activeDescriptorKey = 'current-descriptor';
    studioState.historyDriftIntent = null;
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('mock-nav-history'));
    fireEvent.click(screen.getByTestId('mock-open-diff'));
    expect(spies.applySchemaDiffComparison).not.toHaveBeenCalled();

    studioState.historyDriftIntent = { baselineDescriptorKey: '', currentDescriptorKey: 'current-descriptor', keysDiffer: true };
    studioState.historyResolveKey = '';
    rerender(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('mock-nav-history'));
    fireEvent.click(screen.getByTestId('mock-open-diff'));
    expect(spies.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('renders replay action errors and wires advanced drawer size callbacks', () => {
    studioState.lastActionError = 'Replay action failed';

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);

    expect(screen.getByTestId('grpc-replay-action-error').textContent).toContain('Replay action failed');
    fireEvent.click(screen.getByTestId('mock-max-response'));
    fireEvent.click(screen.getByTestId('mock-keepalive'));

    expect(spies.updateTab).toHaveBeenCalledWith('grpc-tab-1', { maxResponseSizeMb: 32 });
    expect(spies.updateTab).toHaveBeenCalledWith('grpc-tab-1', { keepaliveIntervalSec: 15 });
  });
});
