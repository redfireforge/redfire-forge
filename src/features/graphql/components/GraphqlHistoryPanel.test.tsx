/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphqlHistoryPanel } from './GraphqlHistoryPanel';
import type { GraphqlHistoryPanelProps } from './GraphqlHistoryPanel';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';
import type { UseGraphqlHistoryResult } from '../hooks/useGraphqlHistory';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHistoryItem(overrides: Partial<GraphqlHistoryItem> = {}): GraphqlHistoryItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    operation: {
      query: 'query { users { id } }',
      variables: '{}',
      name: 'GetUsers',
      operationType: 'query',
      headers: [],
    },
    response: '{"data":{"users":[]}}',
    connectionId: 'conn-1',
    timestamp: Date.now() - 1000,
    latencyMs: 42,
    status: 'success',
    ...overrides,
  };
}

function makeHistory(
  items: GraphqlHistoryItem[] = [],
  overrides: Partial<UseGraphqlHistoryResult> = {},
): UseGraphqlHistoryResult {
  return {
    items,
    recentItems: items.slice(0, 5),
    loading: false,
    addItem: vi.fn(),
    deleteItem: vi.fn(),
    clearAll: vi.fn(),
    search: vi.fn((q: string) => items.filter((i) => i.operation.query.includes(q) || (i.operation.name ?? '').includes(q))),
    ...overrides,
  };
}

function makeProps(overrides: Partial<GraphqlHistoryPanelProps> = {}): GraphqlHistoryPanelProps {
  return {
    history: makeHistory(),
    onLoadIntoEditor: vi.fn(),
    onSaveToCollection: vi.fn(),
    ...overrides,
  };
}

describe('GraphqlHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  // ── Loading state ─────────────────────────────────────────────────────────────

  it('shows loading spinner when history.loading is true', () => {
    const history = makeHistory([], { loading: true });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByLabelText('Loading history')).toBeInTheDocument();
  });

  it('does not show main panel when loading', () => {
    const history = makeHistory([], { loading: true });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.queryByTestId('gql-history-panel')).not.toBeInTheDocument();
  });

  // ── Empty state ───────────────────────────────────────────────────────────────

  it('renders the history panel when not loading', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    expect(screen.getByTestId('gql-history-panel')).toBeInTheDocument();
  });

  it('shows "No history yet" when items list is empty', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    expect(screen.getByText(/No history yet/)).toBeInTheDocument();
  });

  // ── Search ────────────────────────────────────────────────────────────────────

  it('renders the search input', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    expect(screen.getByTestId('gql-history-search')).toBeInTheDocument();
  });

  it('shows "No results for..." when search has no matches', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items, { search: vi.fn(() => []) });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.change(screen.getByTestId('gql-history-search'), { target: { value: 'zzznomatch' } });
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  // ── History items rendering ───────────────────────────────────────────────────

  it('renders history items in the list', () => {
    const items = [makeHistoryItem({ id: 'item-1', operation: { query: 'query { users { id } }', variables: '{}', name: 'GetUsers', operationType: 'query', headers: [] } })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('GetUsers')).toBeInTheDocument();
  });

  it('shows "Recent" group label', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items, { recentItems: items });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('shows "Today" group for items within 24 hours', () => {
    const recentId = 'recent-1';
    const todayId = 'today-1';
    const recentItem = makeHistoryItem({ id: recentId, timestamp: Date.now() - 1000 });
    const todayItem = makeHistoryItem({ id: todayId, timestamp: Date.now() - 3600_000 });
    const allItems = [recentItem, todayItem];
    const history = makeHistory(allItems, { recentItems: [recentItem] });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows "Yesterday" group for items 24–48 hours old', () => {
    const recentItem = makeHistoryItem({ id: 'recent', timestamp: Date.now() - 1000 });
    const yesterdayItem = makeHistoryItem({ id: 'yesterday', timestamp: Date.now() - 86_400_001 });
    const history = makeHistory([recentItem, yesterdayItem], { recentItems: [recentItem] });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('shows "Last 7 days" group for items 48h–7d old', () => {
    const recentItem = makeHistoryItem({ id: 'recent', timestamp: Date.now() - 1000 });
    const weekItem = makeHistoryItem({ id: 'week', timestamp: Date.now() - 3 * 86_400_000 });
    const history = makeHistory([recentItem, weekItem], { recentItems: [recentItem] });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });

  it('shows "Older" group for items > 7 days old', () => {
    const recentItem = makeHistoryItem({ id: 'recent', timestamp: Date.now() - 1000 });
    const olderItem = makeHistoryItem({ id: 'older', timestamp: Date.now() - 8 * 86_400_000 });
    const history = makeHistory([recentItem, olderItem], { recentItems: [recentItem] });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('Older')).toBeInTheDocument();
  });

  it('shows (anonymous) for items with no operation name', () => {
    const item = makeHistoryItem({ operation: { query: 'query { me { id } }', variables: '{}', name: undefined, operationType: 'query', headers: [] } });
    const history = makeHistory([item]);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getAllByText('(anonymous)').length).toBeGreaterThan(0);
  });

  it('shows Q badge for query operations', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('Q')).toBeInTheDocument();
  });

  it('shows M badge for mutation operations', () => {
    const items = [makeHistoryItem({ operation: { query: 'mutation { createUser { id } }', variables: '{}', name: 'CreateUser', operationType: 'mutation', headers: [] } })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('shows S badge for subscription operations', () => {
    const items = [makeHistoryItem({ operation: { query: 'subscription { onEvent { id } }', variables: '{}', name: 'OnEvent', operationType: 'subscription', headers: [] } })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('shows error status icon for failed items', () => {
    const items = [makeHistoryItem({ status: 'error' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  // ── Click/double-click ────────────────────────────────────────────────────────

  it('shows preview panel when a history item is clicked', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
  });

  it('calls onLoadIntoEditor on double-click (simulated as rapid second click)', () => {
    const onLoadIntoEditor = vi.fn();
    const items = [makeHistoryItem({ id: 'item-dbl' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onLoadIntoEditor })} />);
    const entry = screen.getByTestId('gql-history-entry');
    // First click — selects item
    fireEvent.click(entry);
    // Second rapid click (within 400ms) — triggers load
    fireEvent.click(entry);
    expect(onLoadIntoEditor).toHaveBeenCalledTimes(1);
  });

  // ── Preview panel ─────────────────────────────────────────────────────────────

  it('closes preview panel when close button is clicked', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close preview'));
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
  });

  it('shows "Load into editor" button in preview', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-load')).toBeInTheDocument();
  });

  it('calls onLoadIntoEditor from preview panel', () => {
    const onLoadIntoEditor = vi.fn();
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onLoadIntoEditor })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByTestId('gql-history-load'));
    expect(onLoadIntoEditor).toHaveBeenCalledWith(items[0]);
  });

  it('shows "Open & Run" button in preview when onRunInEditor is provided', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onRunInEditor: vi.fn() })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-run')).toBeInTheDocument();
  });

  it('does not show "Open & Run" button when onRunInEditor is not provided', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.queryByTestId('gql-history-run')).not.toBeInTheDocument();
  });

  it('calls onRunInEditor from preview panel', () => {
    const onRunInEditor = vi.fn();
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onRunInEditor })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByTestId('gql-history-run'));
    expect(onRunInEditor).toHaveBeenCalledWith(items[0]);
  });

  it('shows truncation banner in preview for truncated responses', () => {
    const items = [makeHistoryItem({ response: '{"data":{"users":[]}}\n__TRUNCATED__' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByText(/Response truncated/)).toBeInTheDocument();
  });

  it('truncation banner is clickable and calls onRunInEditor when provided', () => {
    const onRunInEditor = vi.fn();
    const items = [makeHistoryItem({ response: '{"data":{"users":[]}}\n__TRUNCATED__' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onRunInEditor })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    const btn = screen.getByTestId('gql-history-truncation-rerun');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRunInEditor).toHaveBeenCalledWith(items[0]);
  });

  it('truncation banner is non-clickable div when onRunInEditor is not provided', () => {
    const items = [makeHistoryItem({ response: '{"data":{"users":[]}}\n__TRUNCATED__' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('gql-history-truncation-rerun')).toBeNull();
  });

  it('handles malformed JSON in preview gracefully (shows raw text)', () => {
    const items = [makeHistoryItem({ response: 'not-json' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
  });

  // ── Clear history ─────────────────────────────────────────────────────────────

  it('shows clear confirm UI when Clear button is clicked', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-history-clear'));
    expect(screen.getByTestId('gql-history-clear-confirm')).toBeInTheDocument();
  });

  it('calls history.clearAll when "Yes" confirm button is clicked', () => {
    const history = makeHistory();
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-clear'));
    fireEvent.click(screen.getByTestId('gql-history-clear-yes'));
    expect(history.clearAll).toHaveBeenCalledTimes(1);
  });

  it('cancels clear when "No" is clicked', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-history-clear'));
    fireEvent.click(screen.getByTestId('gql-history-clear-no'));
    expect(screen.queryByTestId('gql-history-clear-confirm')).not.toBeInTheDocument();
  });

  // ── Settings ──────────────────────────────────────────────────────────────────

  it('toggles settings row visibility on settings button click', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    expect(screen.queryByTestId('gql-history-settings-row')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-settings'));
    expect(screen.getByTestId('gql-history-settings-row')).toBeInTheDocument();
  });

  it('calls onMaxItemsChange when max items input changes', () => {
    const onMaxItemsChange = vi.fn();
    render(<GraphqlHistoryPanel {...makeProps({ onMaxItemsChange })} />);
    fireEvent.click(screen.getByTestId('gql-history-settings'));
    const input = screen.getByTestId('gql-history-max-items');
    fireEvent.change(input, { target: { value: '200' } });
    expect(onMaxItemsChange).toHaveBeenCalledWith(200);
  });

  it('clamps max items to 10–500 range', () => {
    const onMaxItemsChange = vi.fn();
    render(<GraphqlHistoryPanel {...makeProps({ onMaxItemsChange })} />);
    fireEvent.click(screen.getByTestId('gql-history-settings'));
    const input = screen.getByTestId('gql-history-max-items');
    fireEvent.change(input, { target: { value: '9999' } });
    expect(onMaxItemsChange).toHaveBeenCalledWith(500);
  });

  it('ignores non-numeric max items input', () => {
    const onMaxItemsChange = vi.fn();
    render(<GraphqlHistoryPanel {...makeProps({ onMaxItemsChange })} />);
    fireEvent.click(screen.getByTestId('gql-history-settings'));
    const input = screen.getByTestId('gql-history-max-items');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onMaxItemsChange).not.toHaveBeenCalled();
  });

  // ── Context menu ──────────────────────────────────────────────────────────────

  it('shows context menu on right-click', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'), { clientX: 100, clientY: 200 });
    expect(screen.getByTestId('gql-history-context-menu')).toBeInTheDocument();
  });

  it('closes context menu on mouse leave', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'), { clientX: 100, clientY: 200 });
    fireEvent.mouseLeave(screen.getByTestId('gql-history-context-menu'));
    expect(screen.queryByTestId('gql-history-context-menu')).not.toBeInTheDocument();
  });

  it('calls onSaveToCollection from context menu', () => {
    const onSaveToCollection = vi.fn();
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onSaveToCollection })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Save to Collection/i }));
    expect(onSaveToCollection).toHaveBeenCalledWith(items[0]);
  });

  it('copies query text on "Copy query" context menu click', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy query/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(items[0].operation.query);
  });

  it('copies cURL command on "Copy as cURL" context menu click', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, endpoint: 'http://api/graphql' })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy as cURL/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('curl -X POST'),
    );
  });

  it('deletes item on "Delete" context menu click', () => {
    const items = [makeHistoryItem({ id: 'del-item' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
    expect(history.deleteItem).toHaveBeenCalledWith('del-item');
  });

  it('clears selected item when deleting the currently selected item', () => {
    const item = makeHistoryItem({ id: 'sel-del' });
    const history = makeHistory([item]);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    // First click to select
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
    // Context menu delete
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
    // Preview should disappear
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
  });

  it('uses "<endpoint>" placeholder in cURL when no endpoint is provided', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy as cURL/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('<endpoint>'),
    );
  });
});
