/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { GraphqlStudioPageOverlays } from './GraphqlStudioPageOverlays';

vi.mock('./GraphqlBatchResults', () => ({
  GraphqlBatchResults: () => <div data-testid="batch-results" />,
}));
vi.mock('./GqlPageToasts', () => ({
  GqlPageToasts: ({
    onSaveSnapshot,
    onDismissSchemaDiff,
    onDismissApq,
    onDismissBatch,
  }: {
    onSaveSnapshot: () => void;
    onDismissSchemaDiff: () => void;
    onDismissApq: () => void;
    onDismissBatch: () => void;
  }) => (
    <div data-testid="page-toasts">
      <button data-testid="save-snapshot-btn" type="button" onClick={onSaveSnapshot}>Save Snapshot</button>
      <button data-testid="dismiss-schema-diff-btn" type="button" onClick={onDismissSchemaDiff}>Dismiss Diff</button>
      <button data-testid="dismiss-apq-btn" type="button" onClick={onDismissApq}>Dismiss APQ</button>
      <button data-testid="dismiss-batch-btn" type="button" onClick={onDismissBatch}>Dismiss Batch</button>
    </div>
  ),
}));
vi.mock('./GraphqlSchemaDiff', () => ({
  GraphqlSchemaDiff: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="schema-diff">
      <button type="button" data-testid="close-diff-btn" onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('./GraphqlCollections', () => ({
  SaveToCollectionModal: (props: {
    onSave: (c: string, f: string | undefined, n: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="save-to-collection">
      <button type="button" onClick={() => props.onSave('col-1', undefined, 'Saved Query')}>save</button>
      <button type="button" onClick={props.onCancel}>cancel</button>
    </div>
  ),
}));

const baseProps = {
  batchResult: null,
  batchResultsOpen: false,
  dismissBatchResults: vi.fn(),
  schemaDiffToast: false,
  snapshots: [],
  toastBaselineSnapshotIdRef: { current: null },
  schemaInfo: null,
  handleOpenDiff: vi.fn(),
  setRightView: vi.fn(),
  setSchemaDiffToast: vi.fn(),
  apqUnsupportedToast: false,
  setApqUnsupportedToast: vi.fn(),
  batchUnsupportedToast: false,
  setBatchUnsupportedToast: vi.fn(),
  diffModal: null,
  setDiffModal: vi.fn(),
  invalidItemIds: new Set<string>(),
  handleAcknowledge: vi.fn(),
  handleUnacknowledge: vi.fn(),
  saveToColItem: null,
  setSaveToColItem: vi.fn(),
  collectionTrees: [],
  onSaveToCollection: vi.fn().mockResolvedValue(undefined),
  setActivityTab: vi.fn(),
};

describe('GraphqlStudioPageOverlays — coverage gaps', () => {
  it('renders batch results when open', () => {
    const { getByTestId } = render(
      <GraphqlStudioPageOverlays
        {...baseProps}
        batchResult={{ results: [], totalLatencyMs: 0, batchUnsupported: false }}
        batchResultsOpen
      />,
    );
    expect(getByTestId('batch-results')).toBeTruthy();
  });

  it('save-to-collection onSave swallows rejections and switches activity tab', async () => {
    const onSaveToCollection = vi.fn().mockRejectedValue(new Error('fail'));
    const setSaveToColItem = vi.fn();
    const setActivityTab = vi.fn();
    const { getByText } = render(
      <GraphqlStudioPageOverlays
        {...baseProps}
        onSaveToCollection={onSaveToCollection}
        setSaveToColItem={setSaveToColItem}
        setActivityTab={setActivityTab}
        saveToColItem={{
          id: 'h1',
          connectionId: 'c1',
          operation: { id: 'op1', query: 'query { x }', variables: '{}', operationType: 'query' },
          response: '{}',
          timestamp: 1,
          latencyMs: 1,
          status: 'success',
        }}
      />,
    );
    fireEvent.click(getByText('save'));
    await waitFor(() => expect(onSaveToCollection).toHaveBeenCalled());
    expect(setSaveToColItem).toHaveBeenCalledWith(null);
    expect(setActivityTab).toHaveBeenCalledWith('collections');
  });

  it('save-to-collection cancel button closes modal', () => {
    const setSaveToColItem = vi.fn();
    const { getByText } = render(
      <GraphqlStudioPageOverlays
        {...baseProps}
        setSaveToColItem={setSaveToColItem}
        saveToColItem={{
          id: 'h2',
          connectionId: 'c1',
          operation: { id: 'op2', query: 'query { x }', variables: '{}', operationType: 'query' },
          response: '{}',
          timestamp: 1,
          latencyMs: 1,
          status: 'success',
        }}
      />,
    );
    fireEvent.click(getByText('cancel'));
    expect(setSaveToColItem).toHaveBeenCalledWith(null);
  });

  it('renders schema diff when diffModal is set and exposes onClose callback', () => {
    const setDiffModal = vi.fn();
    const { getByTestId } = render(
      <GraphqlStudioPageOverlays
        {...baseProps}
        setDiffModal={setDiffModal}
        diffModal={{
          result: { changes: [] },
          oldSdl: 'type Query { old: String }',
          newSdl: 'type Query { new: String }',
          oldLabel: 'old',
          newLabel: 'new',
          snapshotId: 'snap-1',
        }}
      />,
    );
    expect(getByTestId('schema-diff')).toBeTruthy();
    fireEvent.click(getByTestId('close-diff-btn'));
    expect(setDiffModal).toHaveBeenCalledWith(null);
  });

  it('GqlPageToasts callbacks invoke the correct setters', () => {
    const setRightView = vi.fn();
    const setSchemaDiffToast = vi.fn();
    const setApqUnsupportedToast = vi.fn();
    const setBatchUnsupportedToast = vi.fn();
    const { getByTestId } = render(
      <GraphqlStudioPageOverlays
        {...baseProps}
        setRightView={setRightView}
        setSchemaDiffToast={setSchemaDiffToast}
        setApqUnsupportedToast={setApqUnsupportedToast}
        setBatchUnsupportedToast={setBatchUnsupportedToast}
      />,
    );
    fireEvent.click(getByTestId('save-snapshot-btn'));
    expect(setRightView).toHaveBeenCalledWith('schema');
    fireEvent.click(getByTestId('dismiss-schema-diff-btn'));
    expect(setSchemaDiffToast).toHaveBeenCalledWith(false);
    fireEvent.click(getByTestId('dismiss-apq-btn'));
    expect(setApqUnsupportedToast).toHaveBeenCalledWith(false);
    fireEvent.click(getByTestId('dismiss-batch-btn'));
    expect(setBatchUnsupportedToast).toHaveBeenCalledWith(false);
  });
});
