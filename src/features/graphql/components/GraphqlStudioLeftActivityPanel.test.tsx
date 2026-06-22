/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphqlStudioLeftActivityPanel } from './GraphqlStudioLeftActivityPanel';
import type { GqlStudioTab } from '../utils/tabPersistence';

vi.mock('./GraphqlHistoryPanel', () => ({
  GraphqlHistoryPanel: () => <div data-testid="history-panel-mock">History</div>,
}));
vi.mock('./GraphqlMockPanel', () => ({
  GraphqlMockPanel: () => <div data-testid="mock-panel-mock">Mock</div>,
}));
vi.mock('./GraphqlCollections', () => ({
  GraphqlCollections: ({ currentOperation }: { currentOperation: { id: string } }) => (
    <div data-testid="collections-panel-mock">{currentOperation.id}</div>
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
    expect(screen.getByTestId('collections-panel-mock').textContent).toBe('op-from-history');
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
});
