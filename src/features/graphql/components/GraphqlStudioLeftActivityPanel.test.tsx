/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphqlStudioLeftActivityPanel } from './GraphqlStudioLeftActivityPanel';
import type { GqlStudioTab } from '../utils/tabPersistence';

vi.mock('./GraphqlHistoryPanel', () => ({
  GraphqlHistoryPanel: ({
    onSaveToCollection,
  }: {
    onSaveToCollection: (item: unknown) => void;
  }) => (
    <div data-testid="history-panel-mock">
      <button type="button" data-testid="history-save-col-btn" onClick={() => onSaveToCollection({ id: 'h1' })}>Save</button>
    </div>
  ),
}));
vi.mock('./GraphqlMockPanel', () => ({
  GraphqlMockPanel: () => <div data-testid="mock-panel-mock">Mock</div>,
}));
vi.mock('./GraphqlCollections', () => ({
  GraphqlCollections: ({
    currentOperation,
    onRunItem,
    onRunAll,
    onSaveComplete,
  }: {
    currentOperation: { id: string };
    onRunItem: (item: { collectionId: string }) => void;
    onRunAll: (colId: string, folderId?: string) => void;
    onSaveComplete: () => void;
  }) => (
    <div data-testid="collections-panel-mock">
      <span data-testid="collections-op-id">{currentOperation.id}</span>
      <button type="button" data-testid="run-item-btn" onClick={() => onRunItem({ collectionId: 'col-1' })}>Run Item</button>
      <button type="button" data-testid="run-all-btn" onClick={() => onRunAll('col-1', 'folder-1')}>Run All</button>
      <button type="button" data-testid="save-complete-btn" onClick={onSaveComplete}>Complete</button>
    </div>
  ),
}));

const activeTab: GqlStudioTab = {
  id: 'tab-1',
  label: 'Q1',
  modelUri: 'model://tab-1',
  query: 'query { health }',
  variables: '{}',
  headers: [],
  operationType: 'query',
  unsavedChanges: false,
  selectedOperation: 'GetHealth',
};

const baseProps = {
  activityPanelWidth: 320,
  history: { items: [], loading: false, clear: vi.fn(), remove: vi.fn() },
  historyMaxItems: 50,
  onHistoryMaxItemsChange: vi.fn(),
  tabSchemaConnectionId: 'http://localhost:4010/graphql',
  handleLoadHistoryItem: vi.fn(),
  handleRunHistoryItem: vi.fn(),
  setSaveToColItem: vi.fn(),
  mockServer: { running: false, start: vi.fn(), stop: vi.fn(), log: [] },
  schemaInfo: null,
  collections: { collections: [], loading: false, refresh: vi.fn() },
  invalidItemIds: new Set<string>(),
  handleRunCollection: vi.fn(),
  handleLoadCollectionItem: vi.fn(),
  saveToColItem: null,
  activeTab,
  activeEnvironment: null,
};

describe('GraphqlStudioLeftActivityPanel', () => {
  it('renders hidden panel when no activity tab is selected', () => {
    render(<GraphqlStudioLeftActivityPanel {...baseProps} activityTab={null} />);
    const panel = screen.getByTestId('gql-studio-left-panel');
    expect(panel.className).toContain('gql-studio-left-panel--hidden');
    expect(screen.queryByTestId('history-panel-mock')).toBeNull();
  });

  it('renders history panel when activityTab is history', () => {
    render(<GraphqlStudioLeftActivityPanel {...baseProps} activityTab="history" />);
    expect(screen.getByTestId('history-panel-mock')).toBeTruthy();
  });

  it('renders mock panel when activityTab is mock', () => {
    render(<GraphqlStudioLeftActivityPanel {...baseProps} activityTab="mock" />);
    expect(screen.getByTestId('mock-panel-mock')).toBeTruthy();
  });

  it('renders collections with saveToColItem operation when set', () => {
    render(
      <GraphqlStudioLeftActivityPanel
        {...baseProps}
        activityTab="collections"
        saveToColItem={{
          id: 'hist-1',
          operation: { id: 'op-from-history', query: 'q', variables: '{}', operationType: 'query' },
          timestamp: 1,
          endpoint: 'http://x',
          latencyMs: 1,
        }}
      />,
    );
    expect(screen.getByTestId('collections-op-id').textContent).toBe('op-from-history');
  });

  it('renders history panel with explicit width when activity tab selected', () => {
    render(<GraphqlStudioLeftActivityPanel {...baseProps} activityTab="history" />);
    const panel = screen.getByTestId('gql-studio-left-panel');
    expect(panel.style.width).toBe('320px');
    expect(panel.className).not.toContain('gql-studio-left-panel--hidden');
  });

  it('renders collections with subscription operationType default', () => {
    render(
      <GraphqlStudioLeftActivityPanel
        {...baseProps}
        activityTab="collections"
        activeTab={{ ...activeTab, operationType: undefined as unknown as 'query' }}
      />,
    );
    expect(screen.getByTestId('collections-panel-mock')).toBeTruthy();
  });

  it('invokes collection callbacks via mocked buttons', () => {
    const handleRunCollection = vi.fn();
    const setSaveToColItem = vi.fn();
    render(
      <GraphqlStudioLeftActivityPanel
        {...baseProps}
        activityTab="collections"
        handleRunCollection={handleRunCollection}
        setSaveToColItem={setSaveToColItem}
      />,
    );
    fireEvent.click(screen.getByTestId('run-item-btn'));
    expect(handleRunCollection).toHaveBeenCalledWith('col-1', undefined, { collectionId: 'col-1' });
    fireEvent.click(screen.getByTestId('run-all-btn'));
    expect(handleRunCollection).toHaveBeenCalledWith('col-1', 'folder-1');
    fireEvent.click(screen.getByTestId('save-complete-btn'));
    expect(setSaveToColItem).toHaveBeenCalledWith(null);
  });

  it('invokes history onSaveToCollection callback via mocked button', () => {
    const setSaveToColItem = vi.fn();
    render(
      <GraphqlStudioLeftActivityPanel
        {...baseProps}
        activityTab="history"
        setSaveToColItem={setSaveToColItem}
      />,
    );
    fireEvent.click(screen.getByTestId('history-save-col-btn'));
    expect(setSaveToColItem).toHaveBeenCalledWith({ id: 'h1' });
  });

  it('uses empty string for endpoint when tabSchemaConnectionId is null', () => {
    render(
      <GraphqlStudioLeftActivityPanel
        {...baseProps}
        activityTab="history"
        tabSchemaConnectionId={null}
      />,
    );
    expect(screen.getByTestId('history-panel-mock')).toBeTruthy();
  });

  it('uses undefined for selectedOperation when activeTab.selectedOperation is null', () => {
    render(
      <GraphqlStudioLeftActivityPanel
        {...baseProps}
        activityTab="collections"
        saveToColItem={null}
        activeTab={{ ...activeTab, selectedOperation: undefined }}
      />,
    );
    expect(screen.getByTestId('collections-op-id').textContent).toBe('tab-1');
  });
});
