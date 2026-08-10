/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GraphqlHistoryComparePanel } from './GraphqlHistoryComparePanel';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';

function makeItem(id: string, name: string, vars: string, userName: string): GraphqlHistoryItem {
  return {
    id,
    connectionId: 'conn-1',
    timestamp: Date.now(),
    latencyMs: 10,
    status: 'success',
    operation: {
      query: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
      variables: vars,
      name: 'GetUser',
      operationType: 'query',
      headers: [],
    },
    response: JSON.stringify({ data: { user: { id, name: userName, email: `${userName.toLowerCase()}@demo.local` } } }),
  };
}

describe('GraphqlHistoryComparePanel', () => {
  it('renders diff rows for differing response fields', () => {
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{"id":"usr-b"}', 'Bob');
    render(
      <GraphqlHistoryComparePanel
        itemA={itemA}
        itemB={itemB}
        onClose={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-history-compare-panel')).toBeInTheDocument();
    const diffRows = screen.getAllByTestId('gql-history-compare-row').filter(
      (el) => el.getAttribute('data-diff') === 'true',
    );
    expect(diffRows.length).toBeGreaterThan(0);
    expect(screen.getByText('user.name')).toBeInTheDocument();
  });

  it('Escape returns to list via onBack, not onClose', () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{"id":"usr-b"}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={onClose} onBack={onBack} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows empty section when no variable fields differ', () => {
    const itemA = makeItem('a', 'Alice', '{}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText('No fields to compare.')).toBeInTheDocument();
  });

  it('close button exits compare mode via onClose', () => {
    const onClose = vi.fn();
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{"id":"usr-b"}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={onClose} onBack={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses singular diff label when one field differs', () => {
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{"id":"usr-b"}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText(/differing field/)).toBeInTheDocument();
  });

  it('shows query text differs in subtitle', () => {
    const itemA = makeItem('a', 'Alice', '{}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{}', 'Bob');
    itemB.operation.query = 'query Other { health }';
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText(/query text differs/)).toBeInTheDocument();
  });

  it('back button returns to list via onBack', () => {
    const onBack = vi.fn();
    const itemA = makeItem('a', 'Alice', '{}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={onBack} />,
    );
    fireEvent.click(screen.getByTestId('gql-history-compare-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders variables and response tables when both have fields', () => {
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{"id":"usr-b"}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByTestId('gql-history-compare-vars-table')).toBeInTheDocument();
    expect(screen.getByTestId('gql-history-compare-table')).toBeInTheDocument();
  });

  it('uses singular differing-field label when only one field changes', () => {
    const baseOp = makeItem('a', 'Alice', '{}', 'Alice').operation;
    const itemA = makeItem('a', 'Alice', '{}', 'Alice');
    itemA.response = JSON.stringify({ data: { health: 'ok' } });
    itemA.operation = { ...baseOp, variables: '{}' };
    const itemB = makeItem('b', 'Bob', '{}', 'Bob');
    itemB.response = JSON.stringify({ data: { health: 'fail' } });
    itemB.operation = { ...baseOp, variables: '{}' };
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText('1 differing field · same query text')).toBeInTheDocument();
  });

  it('highlights matching rows and reports zero diffs for identical payloads', () => {
    const payload = JSON.stringify({
      data: { user: { id: 'usr-a', name: 'Alice', email: 'alice@demo.local' } },
    });
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Alice', '{"id":"usr-a"}', 'Alice');
    itemA.response = payload;
    itemB.response = payload;
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText('0 differing fields · same query text')).toBeInTheDocument();
    expect(document.querySelector('.gql-history-compare-row--same')).toBeInTheDocument();
  });

  it('uses plural differing-fields label for multiple changes', () => {
    const itemA = makeItem('a', 'Alice', '{"id":"usr-a"}', 'Alice');
    const itemB = makeItem('b', 'Bob', '{"id":"usr-b"}', 'Bob');
    render(
      <GraphqlHistoryComparePanel itemA={itemA} itemB={itemB} onClose={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText(/differing fields · same query text/)).toBeInTheDocument();
  });
});
