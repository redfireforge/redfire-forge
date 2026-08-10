/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import type { GrpcCollectionV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import type { UseGrpcCollectionsResult } from '../hooks/useGrpcCollections';
import { GrpcCollectionsPanel } from './GrpcCollectionsPanel';

const TS = '2026-06-29T12:00:00.000Z';

function makeSaved(id: string, name: string) {
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: name },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    { id, revisionId: `rev-${id}`, updatedAt: TS, name },
  );
}

function collectionWithSaved(): GrpcCollectionV1 {
  return {
    id: 'col-1',
    name: 'Echo collection',
    savedRequests: [
      makeSaved('saved-1', 'Echo call'),
      { ...makeSaved('saved-2', 'Other svc'), target: undefined },
    ],
  };
}

function buildCollectionsMock(
  collections: GrpcCollectionV1[] = [],
  overrides: Partial<UseGrpcCollectionsResult> = {},
): UseGrpcCollectionsResult {
  return {
    store: { schemaVersion: 1, collections, updatedAt: TS },
    collections,
    loading: false,
    clearLastMutationError: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    addCollection: vi.fn().mockResolvedValue(collectionWithSaved()),
    renameCollection: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    duplicateCollection: vi.fn().mockResolvedValue(undefined),
    saveRequest: vi.fn(),
    updateSavedRequest: vi.fn().mockResolvedValue(undefined),
    deleteSavedRequest: vi.fn().mockResolvedValue(undefined),
    duplicateSavedRequest: vi.fn().mockResolvedValue(makeSaved('saved-copy', 'Echo call (copy)')),
    recordSavedRequestRun: vi.fn().mockResolvedValue(undefined),
    exportCollections: vi.fn().mockResolvedValue({
      _exportMeta: {
        version: '1.0',
        exportedAt: TS,
        source: 'RedfireForge/gRPC',
      },
      store: { schemaVersion: 1, collections, updatedAt: TS },
    }),
    importCollections: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('GrpcCollectionsPanel coverage gaps (Phase 5H)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading, empty, and mutation error states', () => {
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { loading: true })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    expect(screen.getByText(/Loading/i)).toBeTruthy();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { lastMutationError: 'Save failed' })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-collections-mutation-error').textContent).toBe('Save failed');
    expect(screen.getByText(/Create a collection/i)).toBeTruthy();
  });

  it('expands collection, filters search, and selects saved request', () => {
    const onSelectSaved = vi.fn();
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId={null}
        onSelectSaved={onSelectSaved}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Echo collection'));
    fireEvent.click(screen.getByTestId('grpc-collection-saved-saved-1'));
    expect(onSelectSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-1' }),
      'col-1',
    );

    fireEvent.change(screen.getByTestId('grpc-collections-search'), { target: { value: 'no-match' } });
    expect(screen.getByText(/No saved requests yet\./i)).toBeTruthy();
  });

  it('auto-expands collection when selectedSavedId is set', async () => {
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('grpc-collection-saved-saved-1').className).toContain('active');
    });
  });

  it('creates collection from prompt and expands it', async () => {
    const addCollection = vi.fn().mockResolvedValue({ id: 'col-new', name: 'New', savedRequests: [] });
    vi.spyOn(window, 'prompt').mockReturnValue('New');

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { addCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collections-new-btn'));
    await waitFor(() => expect(addCollection).toHaveBeenCalledWith('New'));
  });

  it('wires detail actions for duplicate and delete', async () => {
    const collection = collectionWithSaved();
    const duplicateSavedRequest = vi.fn().mockResolvedValue(makeSaved('saved-copy', 'Echo call (copy)'));
    const deleteSavedRequest = vi.fn().mockResolvedValue(undefined);
    const onSelectSaved = vi.fn();
    const onSavedDeleted = vi.fn();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], {
          duplicateSavedRequest,
          deleteSavedRequest,
        })}
        selectedSavedId="saved-1"
        onSelectSaved={onSelectSaved}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        onSavedDeleted={onSavedDeleted}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-duplicate'));
    await waitFor(() => expect(duplicateSavedRequest).toHaveBeenCalledWith('col-1', 'saved-1'));
    await waitFor(() => expect(onSelectSaved).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('grpc-saved-request-delete'));
    await waitFor(() => expect(deleteSavedRequest).toHaveBeenCalledWith('col-1', 'saved-1'));
    await waitFor(() => expect(onSavedDeleted).toHaveBeenCalledWith('saved-1'));
  });

  it('wires compare schema action from detail panel', async () => {
    const collection = collectionWithSaved();
    const onCompareSchema = vi.fn();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCompareSchema={onCompareSchema}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-compare-schema'));
    await waitFor(() => expect(onCompareSchema).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-1' }),
      'col-1',
    ));
  });

  it('ignores empty collection name from prompt', async () => {
    const addCollection = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValue('   ');

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { addCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collections-new-btn'));
    expect(addCollection).not.toHaveBeenCalled();
  });

  it('collapses expanded collection on second header click', () => {
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    const header = screen.getByText('Echo collection');
    fireEvent.click(header);
    expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
    fireEvent.click(header);
    expect(screen.queryByTestId('grpc-collection-saved-saved-1')).toBeNull();
  });

  it('renames a saved request from the detail panel', async () => {
    const collection = collectionWithSaved();
    const updateSavedRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { updateSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-rename'));
    expect(screen.getByTestId('grpc-saved-request-rename-modal')).toBeTruthy();
    const input = screen.getByTestId('grpc-saved-request-rename-input');
    fireEvent.change(input, { target: { value: 'Echo happy path' } });
    fireEvent.click(screen.getByTestId('grpc-saved-request-rename-save'));

    await waitFor(() => expect(updateSavedRequest).toHaveBeenCalledWith(
      'col-1',
      'saved-1',
      { name: 'Echo happy path' },
    ));
    expect(screen.queryByTestId('grpc-saved-request-rename-modal')).toBeNull();
  });

  it('cancels saved-request rename without mutating', async () => {
    const collection = collectionWithSaved();
    const updateSavedRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { updateSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-rename'));
    fireEvent.change(screen.getByTestId('grpc-saved-request-rename-input'), {
      target: { value: 'Should not save' },
    });
    fireEvent.click(screen.getByTestId('grpc-saved-request-rename-cancel'));
    expect(updateSavedRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-saved-request-rename-modal')).toBeNull();
  });

  it('closes collection rename modal without mutating when name is unchanged', async () => {
    const collection = collectionWithSaved();
    const renameCollection = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { renameCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Echo collection'));
    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    fireEvent.click(screen.getByTestId('grpc-collection-rename-save'));

    await waitFor(() => {
      expect(screen.queryByTestId('grpc-collection-rename-modal')).toBeNull();
    });
    expect(renameCollection).not.toHaveBeenCalled();
  });

  it('submits saved-request rename with Enter and closes unchanged names without update', async () => {
    const collection = collectionWithSaved();
    const updateSavedRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { updateSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-rename'));
    fireEvent.keyDown(screen.getByTestId('grpc-saved-request-rename-input'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-saved-request-rename-modal')).toBeNull();
    });
    expect(updateSavedRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-saved-request-rename'));
    fireEvent.change(screen.getByTestId('grpc-saved-request-rename-input'), {
      target: { value: 'Echo via enter' },
    });
    fireEvent.keyDown(screen.getByTestId('grpc-saved-request-rename-input'), { key: 'Enter' });
    await waitFor(() => expect(updateSavedRequest).toHaveBeenCalledWith(
      'col-1',
      'saved-1',
      { name: 'Echo via enter' },
    ));
  });

  it('updates and clears response baseline from detail panel', async () => {
    const savedWithBaseline = {
      ...makeSaved('saved-1', 'Echo call'),
      responseBaseline: {
        capturedAt: TS,
        status: 0,
        statusMessage: 'OK',
        body: { message: 'prior' },
        headers: {},
        trailers: {},
      },
    };
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Echo collection',
      savedRequests: [savedWithBaseline],
    };
    const updateSavedRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { updateSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        lastUnaryResult={{
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          message: { message: 'ok' },
          durationMs: 5,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-snapshot-update-baseline'));
    await waitFor(() => expect(updateSavedRequest).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('grpc-snapshot-clear-baseline'));
    await waitFor(() => expect(updateSavedRequest).toHaveBeenCalledWith(
      'col-1',
      'saved-1',
      expect.objectContaining({ responseBaseline: undefined }),
    ));
  });

  it('swallows addCollection errors from prompt flow', async () => {
    const addCollection = vi.fn().mockRejectedValue(new Error('create failed'));
    vi.spyOn(window, 'prompt').mockReturnValue('New collection');

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { addCollection, lastMutationError: 'create failed' })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collections-new-btn'));
    await waitFor(() => expect(addCollection).toHaveBeenCalled());
  });

  it('keeps expanded state when selected saved id is stable', async () => {
    const collection = collectionWithSaved();
    const props = {
      collections: buildCollectionsMock([collection]),
      selectedSavedId: 'saved-1' as string | null,
      onSelectSaved: vi.fn(),
      grpcurlForSaved: () => 'grpcurl cmd',
      onOpenInStudio: vi.fn(),
      onCopyGrpcurl: vi.fn(),
    };
    const { rerender } = render(<GrpcCollectionsPanel {...props} />);
    await waitFor(() => expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy());
    rerender(<GrpcCollectionsPanel {...props} />);
    expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
  });

  it('ignores delete callback when deleteSavedRequest fails', async () => {
    const collection = collectionWithSaved();
    const deleteSavedRequest = vi.fn().mockRejectedValue(new Error('delete failed'));
    const onSavedDeleted = vi.fn();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { deleteSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        onSavedDeleted={onSavedDeleted}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-delete'));
    await waitFor(() => expect(deleteSavedRequest).toHaveBeenCalled());
    expect(onSavedDeleted).not.toHaveBeenCalled();
  });

  it('shows all saved rows when search is cleared', () => {
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Echo collection'));
    fireEvent.change(screen.getByTestId('grpc-collections-search'), { target: { value: 'Echo call' } });
    expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
    fireEvent.change(screen.getByTestId('grpc-collections-search'), { target: { value: '' } });
    expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
    expect(screen.getByTestId('grpc-collection-saved-saved-2')).toBeTruthy();
  });

  it('preserves manual expand when selection arrives', async () => {
    const collection = collectionWithSaved();
    const { rerender } = render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Echo collection'));
    rerender(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
    });
  });

  it('ignores duplicate failure without selecting copy', async () => {
    const collection = collectionWithSaved();
    const duplicateSavedRequest = vi.fn().mockRejectedValue(new Error('dup failed'));
    const onSelectSaved = vi.fn();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { duplicateSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={onSelectSaved}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-duplicate'));
    await waitFor(() => expect(duplicateSavedRequest).toHaveBeenCalled());
    expect(onSelectSaved).not.toHaveBeenCalled();
  });

  it('ignores baseline update failures', async () => {
    const collection = collectionWithSaved();
    const updateSavedRequest = vi.fn().mockRejectedValue(new Error('update failed'));

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { updateSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        lastUnaryResult={{
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          message: { message: 'ok' },
          durationMs: 5,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-snapshot-update-baseline'));
    await waitFor(() => expect(updateSavedRequest).toHaveBeenCalled());
  });

  it('expands the collection that owns a selected saved id after empty collections', async () => {
    const owned = collectionWithSaved();
    const collections = [
      { id: 'col-empty', name: 'Empty', savedRequests: [] },
      owned,
    ];

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock(collections)}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
    });
  });

  it('opens in studio when enabled', () => {
    const collection = collectionWithSaved();
    const onOpenInStudio = vi.fn();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={onOpenInStudio}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-saved-request-open-studio'));
    expect(onOpenInStudio).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-1' }),
      'col-1',
    );
  });

  it('exports collections JSON from header action', async () => {
    const collection = collectionWithSaved();
    const exportCollections = vi.fn().mockResolvedValue({
      _exportMeta: { version: '1.0', exportedAt: TS, source: 'RedfireForge/gRPC' },
      store: { schemaVersion: 1, collections: [collection], updatedAt: TS },
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { exportCollections })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collections-export-btn'));
    await waitFor(() => expect(exportCollections).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it('imports collections JSON from hidden input', async () => {
    const importCollections = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const file = new File([JSON.stringify({ store: { schemaVersion: 1, collections: [], updatedAt: TS } })], 'collections.json', {
      type: 'application/json',
    });

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { importCollections })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    const input = screen.getByTestId('grpc-collections-import-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(importCollections).toHaveBeenCalledWith(expect.any(Object), 'merge'));
  });

  it('skips import when the user cancels the confirm dialog', async () => {
    const importCollections = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const file = new File(['{}'], 'collections.json', { type: 'application/json' });

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { importCollections })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-collections-import-input'), { target: { files: [file] } });
    await waitFor(() => expect(importCollections).not.toHaveBeenCalled());
  });

  it('opens in studio and copies grpcurl from detail', () => {
    const collection = collectionWithSaved();
    const onCopyGrpcurl = vi.fn();

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl export'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={onCopyGrpcurl}
        openInStudioDisabled
        openInStudioTitle="Blocked by drift"
      />,
    );

    const openBtn = screen.getByTestId('grpc-saved-request-open-studio') as HTMLButtonElement;
    expect(openBtn.disabled).toBe(true);
    expect(openBtn.title).toBe('Blocked by drift');

    fireEvent.click(screen.getByTestId('grpc-saved-request-copy-grpcurl'));
    expect(onCopyGrpcurl).toHaveBeenCalled();
  });

  it('filters saved requests by search query and shows empty-state copy', () => {
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-collection-saved-saved-1')).toBeTruthy();
    fireEvent.change(screen.getByTestId('grpc-collections-search'), { target: { value: 'no-match-xyz' } });
    expect(screen.getByText(/No saved requests yet\./i)).toBeTruthy();
  });

  it('skips new collection when prompt is cancelled or blank', async () => {
    const addCollection = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValueOnce(null);
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { addCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-collections-new-btn'));
    expect(addCollection).not.toHaveBeenCalled();

    vi.mocked(window.prompt).mockReturnValueOnce('   ');
    fireEvent.click(screen.getByTestId('grpc-collections-new-btn'));
    expect(addCollection).not.toHaveBeenCalled();
  });

  it('imports collections in replace mode and ignores export failures', async () => {
    const importCollections = vi.fn().mockResolvedValue(undefined);
    const exportCollections = vi.fn().mockRejectedValue(new Error('export failed'));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const file = new File(['{}'], 'collections.json', { type: 'application/json' });

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { importCollections, exportCollections })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-collections-import-input'), { target: { files: [file] } });
    await waitFor(() => expect(importCollections).toHaveBeenCalledWith(expect.any(Object), 'replace'));

    fireEvent.click(screen.getByTestId('grpc-collections-export-btn'));
    await waitFor(() => expect(exportCollections).toHaveBeenCalled());
  });

  it('shows empty collections hint when store is empty', () => {
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([])}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    expect(screen.getByText(/Create a collection/i)).toBeTruthy();
  });

  it('invokes onSavedDeleted after successful delete', async () => {
    const collection = collectionWithSaved();
    const deleteSavedRequest = vi.fn().mockResolvedValue(undefined);
    const onSavedDeleted = vi.fn();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { deleteSavedRequest })}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        onSavedDeleted={onSavedDeleted}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-saved-request-delete'));
    await waitFor(() => expect(onSavedDeleted).toHaveBeenCalledWith('saved-1'));
  });

  it('creates a collection when prompt returns a valid name', async () => {
    const addCollection = vi.fn().mockResolvedValue({ id: 'col-new', name: 'New', savedRequests: [] });
    vi.spyOn(window, 'prompt').mockReturnValue('New Collection');
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { addCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-collections-new-btn'));
    await waitFor(() => expect(addCollection).toHaveBeenCalledWith('New Collection'));
  });

  it('ignores invalid import files and swallows JSON parse failures', async () => {
    const importCollections = vi.fn().mockResolvedValue(undefined);
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([], { importCollections })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    const invalidJson = new File(['not-json'], 'collections.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('grpc-collections-import-input'), { target: { files: [invalidJson] } });
    await waitFor(() => expect(importCollections).not.toHaveBeenCalled());
  });

  it('opens the hidden import input from the header button', () => {
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([])}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );
    const input = screen.getByTestId('grpc-collections-import-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('grpc-collections-import-btn'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renames a collection from the header rename button', async () => {
    const collection = collectionWithSaved();
    const renameCollection = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { renameCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    fireEvent.change(screen.getByTestId('grpc-collection-rename-input'), { target: { value: 'Renamed collection' } });
    fireEvent.click(screen.getByTestId('grpc-collection-rename-save'));
    await waitFor(() => expect(renameCollection).toHaveBeenCalledWith('col-1', 'Renamed collection'));
  });

  it('ignores rename when modal is cancelled, blank, or unchanged', async () => {
    const collection = collectionWithSaved();
    const renameCollection = vi.fn().mockResolvedValue(undefined);

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { renameCollection })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    fireEvent.click(screen.getByTestId('grpc-collection-rename-cancel'));
    expect(renameCollection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    fireEvent.change(screen.getByTestId('grpc-collection-rename-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('grpc-collection-rename-save'));
    expect(renameCollection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    fireEvent.change(screen.getByTestId('grpc-collection-rename-input'), { target: { value: collection.name } });
    fireEvent.click(screen.getByTestId('grpc-collection-rename-save'));
    expect(renameCollection).not.toHaveBeenCalled();
  });

  it('swallows renameCollection errors from the header button', async () => {
    const collection = collectionWithSaved();
    const renameCollection = vi.fn().mockRejectedValue(new Error('rename failed'));

    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection], { renameCollection, lastMutationError: 'rename failed' })}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    fireEvent.change(screen.getByTestId('grpc-collection-rename-input'), { target: { value: 'Renamed collection' } });
    fireEvent.click(screen.getByTestId('grpc-collection-rename-save'));
    await waitFor(() => expect(renameCollection).toHaveBeenCalled());
  });

  it('invokes run load test callback from the detail panel', () => {
    const collection = collectionWithSaved();
    const onRunLoadTest = vi.fn();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        onRunLoadTest={onRunLoadTest}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-saved-request-run-load-test'));
    expect(onRunLoadTest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-1' }),
      'col-1',
    );
  });

  it('passes stream comparison eligibility when the active tab matches the saved request', () => {
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId="saved-1"
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
        activeTab={{
          id: 'tab-1',
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          streamLifecycle: 'streaming',
          streamMessages: [{ sequence: 1, body: { message: 'hi' } }],
        } as GrpcStudioTabState}
      />,
    );

    expect(screen.getByTestId('grpc-saved-request-detail')).toBeTruthy();
  });

  it('closes rename modal on Escape and ignores empty import file selection', async () => {
    const collection = collectionWithSaved();
    render(
      <GrpcCollectionsPanel
        collections={buildCollectionsMock([collection])}
        selectedSavedId={null}
        onSelectSaved={vi.fn()}
        grpcurlForSaved={() => 'grpcurl cmd'}
        onOpenInStudio={vi.fn()}
        onCopyGrpcurl={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-collection-group-rename-col-1'));
    expect(screen.getByTestId('grpc-collection-rename-input')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-collection-rename-input')).toBeNull();
    });

    fireEvent.change(screen.getByTestId('grpc-collections-import-input'), {
      target: { files: [] },
    });
  });
});
