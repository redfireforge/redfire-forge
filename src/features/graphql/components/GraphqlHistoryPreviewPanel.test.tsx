/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphqlHistoryPreviewPanel } from './GraphqlHistoryPreviewPanel';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';

function makeItem(overrides: Partial<GraphqlHistoryItem> = {}): GraphqlHistoryItem {
  return {
    id: 'item-1',
    connectionId: 'conn-1',
    timestamp: Date.now(),
    latencyMs: 42,
    status: 'success',
    operation: {
      query: 'query GetUser($id: ID!) { user(id: $id) { id name } }',
      variables: '{"id":"usr-a"}',
      name: 'GetUser',
      operationType: 'query',
      headers: [],
    },
    response: JSON.stringify({ data: { user: { id: 'usr-a', name: 'Alice' } } }),
    ...overrides,
  };
}

describe('GraphqlHistoryPreviewPanel', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('switches preview tabs and copies query text', () => {
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem()}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onRunInEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-history-preview-tab-request'));
    expect(screen.getByTestId('gql-history-preview-request')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy query' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('shows static truncation banner when onRunInEditor is omitted', () => {
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem({ response: '{"data":{}}\n__TRUNCATED__' })}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    expect(screen.getByText(/Response truncated/)).toBeInTheDocument();
    expect(screen.queryByTestId('gql-history-truncation-rerun')).not.toBeInTheDocument();
  });

  it('Escape closes preview via onClose', () => {
    const onClose = vi.fn();
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem()}
        onClose={onClose}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders mutation operation subtitle', () => {
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem({ operation: { ...makeItem().operation, operationType: 'mutation', name: 'CreateUser' } })}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    expect(screen.getByText('Mutation')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('shows clickable truncation banner when onRunInEditor is provided', () => {
    const onRunInEditor = vi.fn();
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem({ response: '{"data":{}}\n__TRUNCATED__' })}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onRunInEditor={onRunInEditor}
        onSaveToCollection={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-history-truncation-rerun'));
    expect(onRunInEditor).toHaveBeenCalled();
  });

  it('shows error chip when GraphQL errors are present', () => {
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem({
          status: 'success',
          response: JSON.stringify({ data: { user: { name: 'Alice' } }, errors: [{ message: 'fail' }] }),
        })}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('invokes save-to-collection handler from preview actions', () => {
    const onSaveToCollection = vi.fn();
    const item = makeItem();
    render(
      <GraphqlHistoryPreviewPanel
        item={item}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={onSaveToCollection}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-history-save-to-col'));
    expect(onSaveToCollection).toHaveBeenCalledWith(item);
  });

  it('shows full action labels and closes from footer dismiss', () => {
    const onClose = vi.fn();
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem()}
        onClose={onClose}
        onLoadIntoEditor={vi.fn()}
        onRunInEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-history-run')).toHaveTextContent('Open & Run');
    expect(screen.getByTestId('gql-history-load')).toHaveTextContent('Load into editor');
    expect(screen.getByTestId('gql-history-save-to-col')).toHaveTextContent('Save to Collection');
    fireEvent.click(screen.getByTestId('gql-history-preview-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows anonymous title and variables tab content', () => {
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem({ operation: { ...makeItem().operation, name: undefined } })}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-history-preview-tab-variables'));
    expect(screen.getByTestId('gql-history-preview-variables')).toBeInTheDocument();
  });

  it('shows error status chip for failed executions', () => {
    render(
      <GraphqlHistoryPreviewPanel
        item={makeItem({ status: 'error' })}
        onClose={vi.fn()}
        onLoadIntoEditor={vi.fn()}
        onSaveToCollection={vi.fn()}
      />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
