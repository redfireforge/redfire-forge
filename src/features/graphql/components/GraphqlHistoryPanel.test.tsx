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

  it('calls onLoadIntoEditor on double-click', () => {
    const onLoadIntoEditor = vi.fn();
    const items = [makeHistoryItem({ id: 'item-dbl' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onLoadIntoEditor })} />);
    fireEvent.doubleClick(screen.getByTestId('gql-history-entry'));
    expect(onLoadIntoEditor).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
  });

  // ── Preview panel ─────────────────────────────────────────────────────────────

  it('closes preview panel when close button is clicked', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close preview'));
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('returns to history list when back button is clicked', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByTestId('gql-history-preview-back'));
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes preview panel on Escape', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    fireEvent.keyDown(window, { key: 'Escape' });
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

  it('preview shows Request and Response tabs with metadata chips', () => {
    const items = [makeHistoryItem({
      response: JSON.stringify({
        data: { health: 'ok' },
        httpStatus: 200,
        httpHeaders: { 'content-type': 'application/json' },
        latencyMs: 15,
        timestamp: Date.now(),
      }),
      latencyMs: 15,
    })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, onRunInEditor: vi.fn() })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview-tab-request')).toBeInTheDocument();
    expect(screen.getByTestId('gql-history-preview-tab-response')).toBeInTheDocument();
    expect(screen.getByTestId('gql-history-preview-response')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    expect(screen.getByText('15 ms')).toBeInTheDocument();
    expect(screen.getByText(/"health": "ok"/)).toBeInTheDocument();
    expect(screen.queryByText(/httpHeaders/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-preview-tab-request'));
    expect(screen.getByTestId('gql-history-preview-request')).toBeInTheDocument();
  });

  it('switches between Request, Variables, and Response tabs', () => {
    const items = [makeHistoryItem({
      operation: {
        query: 'query { health }',
        variables: '{"id":"usr-7"}',
        name: 'Health',
        operationType: 'query',
        headers: [],
      },
    })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));

    fireEvent.click(screen.getByTestId('gql-history-preview-tab-request'));
    expect(screen.getByTestId('gql-history-preview-request')).toBeInTheDocument();
    expect(screen.queryByTestId('gql-history-preview-response')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('gql-history-preview-tab-variables'));
    expect(screen.getByTestId('gql-history-preview-variables')).toBeInTheDocument();
    expect(screen.getByText(/"id": "usr-7"/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('gql-history-preview-tab-response'));
    expect(screen.getByTestId('gql-history-preview-response')).toBeInTheDocument();
  });

  it('preview copy query button copies operation text to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const items = [makeHistoryItem({ operation: { query: 'query { health }', variables: '{}', name: 'Health', operationType: 'query', headers: [] } })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByTestId('gql-history-preview-tab-request'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy query' }));
    expect(writeText).toHaveBeenCalledWith('query { health }');
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

  it('closes context menu on outside click', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'), { clientX: 100, clientY: 200 });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('gql-history-context-menu')).not.toBeInTheDocument();
  });

  it('closes context menu on Escape', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'), { clientX: 100, clientY: 200 });
    fireEvent.keyDown(document, { key: 'Escape' });
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
    fireEvent.click(screen.getByTestId('gql-history-ctx-copy-curl'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('curl -X POST'),
    );
  });

  it('adds --noproxy to cURL for localhost endpoints', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history, endpoint: 'http://127.0.0.1:4010/graphql' })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByTestId('gql-history-ctx-copy-curl'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("--noproxy '*'"),
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

  it('clears preview when deleting the open item closes detail view', () => {
    const item = makeHistoryItem({ id: 'sel-del' });
    const history = makeHistory([item]);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-preview-back'));
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
    expect(history.deleteItem).toHaveBeenCalledWith('sel-del');
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

  // ── Compare mode ────────────────────────────────────────────────────────────

  it('renders compare toggle button', () => {
    render(<GraphqlHistoryPanel {...makeProps()} />);
    expect(screen.getByTestId('gql-history-compare-toggle')).toBeInTheDocument();
  });

  it('shows compare bar when compare mode is enabled', () => {
    const items = [makeHistoryItem()];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    expect(screen.getByTestId('gql-history-compare-bar')).toBeInTheDocument();
    expect(screen.getAllByTestId('gql-history-compare-mark').length).toBeGreaterThan(0);
    expect(screen.getByTestId('gql-history-compare-slot-a')).toHaveAttribute('data-filled', 'false');
    expect(screen.getByTestId('gql-history-compare-slot-b')).toHaveAttribute('data-filled', 'false');
  });

  it('updates compare bar slot data-filled when entries are marked', () => {
    const items = [makeHistoryItem({ id: 'a' }), makeHistoryItem({ id: 'b' })];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    expect(screen.getByTestId('gql-history-compare-slot-a')).toHaveAttribute('data-filled', 'true');
    expect(screen.getByTestId('gql-history-compare-slot-b')).toHaveAttribute('data-filled', 'false');
    fireEvent.click(marks[1]);
    expect(screen.getByTestId('gql-history-compare-slot-b')).toHaveAttribute('data-filled', 'true');
  });

  it('marks two entries and opens compare panel', () => {
    const alice = makeHistoryItem({
      id: 'alice',
      operation: {
        query: 'query GetUser { user { name } }',
        variables: '{"id":"a"}',
        name: 'GetUser',
        operationType: 'query',
        headers: [],
      },
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
    });
    const bob = makeHistoryItem({
      id: 'bob',
      operation: {
        query: 'query GetUser { user { name } }',
        variables: '{"id":"b"}',
        name: 'GetUser',
        operationType: 'query',
        headers: [],
      },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    const history = makeHistory([alice, bob], { recentItems: [alice, bob] });
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.click(screen.getByTestId('gql-history-compare-btn'));
    expect(screen.getByTestId('gql-history-compare-panel')).toBeInTheDocument();
    expect(screen.getByTestId('gql-history-compare-table')).toBeInTheDocument();
  });

  it('closes context menu when opening compare view', () => {
    const a = makeHistoryItem({
      id: 'a',
      operation: { ...makeHistoryItem().operation, variables: '{"id":"1"}' },
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
    });
    const b = makeHistoryItem({
      id: 'b',
      operation: { ...makeHistoryItem().operation, variables: '{"id":"2"}' },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory([a, b]) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.contextMenu(screen.getAllByTestId('gql-history-entry')[0]);
    expect(screen.getByTestId('gql-history-context-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-compare-btn'));
    expect(screen.queryByTestId('gql-history-context-menu')).not.toBeInTheDocument();
  });

  it('closes context menu when compare toggle is clicked', () => {
    const items = [makeHistoryItem()];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-context-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    expect(screen.queryByTestId('gql-history-context-menu')).not.toBeInTheDocument();
  });

  it('does not open preview when clicking entry in compare mode', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
  });

  it('does not load into editor on double-click in compare mode', () => {
    const onLoad = vi.fn();
    const items = [makeHistoryItem()];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items), onLoadIntoEditor: onLoad })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    fireEvent.doubleClick(screen.getByTestId('gql-history-entry'));
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('unmarks a slot when its compare mark button is clicked again', () => {
    const items = [makeHistoryItem({ id: 'only' })];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const mark = screen.getByTestId('gql-history-compare-mark');
    fireEvent.click(mark);
    expect(screen.getByTestId('gql-history-entry')).toHaveAttribute('data-compare-slot', 'A');
    fireEvent.click(mark);
    expect(screen.getByTestId('gql-history-entry')).not.toHaveAttribute('data-compare-slot');
  });

  it('clears compare slots when history is cleared', () => {
    const items = [makeHistoryItem({ id: 'a' }), makeHistoryItem({ id: 'b' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.click(screen.getByTestId('gql-history-clear'));
    fireEvent.click(screen.getByTestId('gql-history-clear-yes'));
    expect(history.clearAll).toHaveBeenCalled();
    expect(screen.queryByTestId('gql-history-compare-bar')).not.toBeInTheDocument();
    expect(screen.getByTestId('gql-history-compare-toggle')).not.toHaveClass('gql-history-compare-toggle--active');
  });

  it('closes context menu when history is cleared', () => {
    const items = [makeHistoryItem()];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.contextMenu(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-context-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-clear'));
    fireEvent.click(screen.getByTestId('gql-history-clear-yes'));
    expect(screen.queryByTestId('gql-history-context-menu')).not.toBeInTheDocument();
  });

  it('closes preview and clears search when history is cleared', () => {
    const items = [makeHistoryItem({ id: 'preview-me' })];
    const history = makeHistory(items);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.change(screen.getByTestId('gql-history-search'), { target: { value: 'GetUser' } });
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
    expect(screen.getByTestId('gql-history-search')).toHaveValue('GetUser');
    fireEvent.click(screen.getByTestId('gql-history-clear'));
    fireEvent.click(screen.getByTestId('gql-history-clear-yes'));
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('gql-history-search')).toHaveValue('');
  });

  it('clears stale compare slot when item is removed from history', () => {
    const a = makeHistoryItem({ id: 'slot-a' });
    const b = makeHistoryItem({ id: 'slot-b' });
    const { rerender } = render(
      <GraphqlHistoryPanel {...makeProps({ history: makeHistory([a, b]) })} />,
    );
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    expect(document.querySelector('[data-compare-slot="A"]')).toBeInTheDocument();
    rerender(<GraphqlHistoryPanel {...makeProps({ history: makeHistory([b]) })} />);
    expect(document.querySelector('[data-compare-slot="A"]')).not.toBeInTheDocument();
  });

  it('unmarks compare slot B when its mark button is clicked again', () => {
    const items = [makeHistoryItem({ id: 'a' }), makeHistoryItem({ id: 'b' })];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    expect(document.querySelector('[data-compare-slot="B"]')).toBeInTheDocument();
    fireEvent.click(marks[1]);
    expect(document.querySelector('[data-compare-slot="B"]')).not.toBeInTheDocument();
  });

  it('disables compare mode and clears slots when toggle is clicked again', () => {
    const items = [makeHistoryItem({ id: 'a' }), makeHistoryItem({ id: 'b' })];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    expect(screen.queryByTestId('gql-history-compare-bar')).not.toBeInTheDocument();
    expect(document.querySelector('[data-compare-slot="A"]')).not.toBeInTheDocument();
  });

  it('exits compare mode when compare panel close button is clicked', () => {
    const a = makeHistoryItem({
      id: 'a',
      operation: { ...makeHistoryItem().operation, name: 'GetUser', variables: '{"id":"1"}' },
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
    });
    const b = makeHistoryItem({
      id: 'b',
      operation: { ...makeHistoryItem().operation, name: 'GetUser', variables: '{"id":"2"}' },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory([a, b]) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.click(screen.getByTestId('gql-history-compare-btn'));
    fireEvent.click(screen.getByTestId('gql-history-compare-close'));
    expect(screen.queryByTestId('gql-history-compare-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('gql-history-compare-toggle')).not.toHaveClass('gql-history-compare-toggle--active');
  });

  it('clears compare slot when a marked entry is deleted from context menu', () => {
    const a = makeHistoryItem({
      id: 'del-a',
      operation: { ...makeHistoryItem().operation, name: 'GetUser', variables: '{"id":"1"}' },
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
    });
    const b = makeHistoryItem({
      id: 'del-b',
      operation: { ...makeHistoryItem().operation, name: 'GetUser', variables: '{"id":"2"}' },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    const history = makeHistory([a, b]);
    render(<GraphqlHistoryPanel {...makeProps({ history })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.contextMenu(screen.getAllByTestId('gql-history-entry')[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }));
    expect(history.deleteItem).toHaveBeenCalledWith('del-a');
    expect(document.querySelector('[data-compare-slot="A"]')).not.toBeInTheDocument();
  });

  it('replaces compare slot B when a third entry is marked', () => {
    const items = [
      makeHistoryItem({ id: 'one' }),
      makeHistoryItem({ id: 'two' }),
      makeHistoryItem({ id: 'three' }),
    ];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.click(marks[2]);
    expect(document.querySelector('[data-compare-slot="B"]')).toBeInTheDocument();
  });

  it('clears preview when compare mode is enabled', () => {
    const items = [makeHistoryItem({ id: 'preview-item' })];
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory(items) })} />);
    fireEvent.click(screen.getByTestId('gql-history-entry'));
    expect(screen.getByTestId('gql-history-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    expect(screen.queryByTestId('gql-history-preview')).not.toBeInTheDocument();
  });

  it('returns to list from compare view via back button without exiting compare mode', () => {
    const a = makeHistoryItem({
      id: 'a',
      operation: { ...makeHistoryItem().operation, variables: '{"id":"1"}' },
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
    });
    const b = makeHistoryItem({
      id: 'b',
      operation: { ...makeHistoryItem().operation, variables: '{"id":"2"}' },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    render(<GraphqlHistoryPanel {...makeProps({ history: makeHistory([a, b]) })} />);
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.click(screen.getByTestId('gql-history-compare-btn'));
    fireEvent.click(screen.getByTestId('gql-history-compare-back'));
    expect(screen.queryByTestId('gql-history-compare-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('gql-history-compare-toggle')).toHaveClass('gql-history-compare-toggle--active');
  });

  it('closes compare view when a marked item disappears from history', () => {
    const a = makeHistoryItem({
      id: 'evict-a',
      operation: { ...makeHistoryItem().operation, variables: '{"id":"1"}' },
      response: JSON.stringify({ data: { user: { name: 'Alice' } } }),
    });
    const b = makeHistoryItem({
      id: 'evict-b',
      operation: { ...makeHistoryItem().operation, variables: '{"id":"2"}' },
      response: JSON.stringify({ data: { user: { name: 'Bob' } } }),
    });
    const { rerender } = render(
      <GraphqlHistoryPanel {...makeProps({ history: makeHistory([a, b]) })} />,
    );
    fireEvent.click(screen.getByTestId('gql-history-compare-toggle'));
    const marks = screen.getAllByTestId('gql-history-compare-mark');
    fireEvent.click(marks[0]);
    fireEvent.click(marks[1]);
    fireEvent.click(screen.getByTestId('gql-history-compare-btn'));
    expect(screen.getByTestId('gql-history-compare-panel')).toBeInTheDocument();
    rerender(<GraphqlHistoryPanel {...makeProps({ history: makeHistory([b]) })} />);
    expect(screen.queryByTestId('gql-history-compare-panel')).not.toBeInTheDocument();
  });
});
