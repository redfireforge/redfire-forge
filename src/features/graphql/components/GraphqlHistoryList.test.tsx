/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoryEntryRow, HistoryGroup } from './GraphqlHistoryList';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';

function makeItem(overrides: Partial<GraphqlHistoryItem> = {}): GraphqlHistoryItem {
  return {
    id: 'item-1',
    connectionId: 'conn-1',
    timestamp: Date.now(),
    latencyMs: 42,
    status: 'success',
    operation: {
      query: 'query { health }',
      variables: '{}',
      name: 'Health',
      operationType: 'query',
      headers: [],
    },
    response: '{"data":{"health":"ok"}}',
    ...overrides,
  };
}

describe('HistoryEntryRow', () => {
  it('renders mutation and subscription badges', () => {
    const { rerender } = render(
      <HistoryEntryRow
        item={makeItem({ operation: { ...makeItem().operation, operationType: 'mutation', name: 'Create' } })}
        selected={false}
        compareMode={false}
        compareSlot={null}
        onCompareMark={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('M')).toBeInTheDocument();

    rerender(
      <HistoryEntryRow
        item={makeItem({ operation: { ...makeItem().operation, operationType: 'subscription', name: 'Sub' } })}
        selected={false}
        compareMode={false}
        compareSlot={null}
        onCompareMark={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('shows compare mark button and slot label in compare mode', () => {
    const onCompareMark = vi.fn();
    const onDoubleClick = vi.fn();
    const onClick = vi.fn();
    render(
      <HistoryEntryRow
        item={makeItem()}
        selected
        compareMode
        compareSlot="A"
        onCompareMark={onCompareMark}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={vi.fn()}
      />,
    );
    const mark = screen.getByTestId('gql-history-compare-mark');
    expect(mark).toHaveTextContent('A');
    fireEvent.click(mark);
    expect(onCompareMark).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.doubleClick(mark);
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it('shows error status icon', () => {
    render(
      <HistoryEntryRow
        item={makeItem({ status: 'error' })}
        selected={false}
        compareMode={false}
        compareSlot={null}
        onCompareMark={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('✗')).toBeInTheDocument();
  });
});

describe('HistoryGroup', () => {
  it('renders group label and delegates row clicks', () => {
    const onItemClick = vi.fn();
    render(
      <HistoryGroup
        label="Today"
        items={[makeItem(), makeItem({ id: 'item-2', operation: { ...makeItem().operation, name: 'Other' } })]}
        selected={null}
        compareMode={false}
        compareAId={null}
        compareBId={null}
        onCompareMark={vi.fn()}
        onItemClick={onItemClick}
        onItemDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('gql-history-entry')[0]);
    expect(onItemClick).toHaveBeenCalled();
  });
});
