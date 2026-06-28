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
  GqlPageToasts: () => <div data-testid="page-toasts" />,
}));
vi.mock('./GraphqlSchemaDiff', () => ({
  GraphqlSchemaDiff: () => <div data-testid="schema-diff" />,
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
});
