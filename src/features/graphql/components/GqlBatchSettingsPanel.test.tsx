/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  deriveTabLabel: vi.fn(() => 'Untitled'),
}));

import { selectOption } from '../../../test-utils/customSelectHelper';
import { GqlBatchSettingsPanel } from './GqlBatchSettingsPanel';
import type { GqlStudioTab } from '../utils/tabPersistence';

const groups = [
  { key: 'https://a.com/gql', resolvedEndpoint: 'https://a.com/gql', displayLabel: 'a.com', tabIds: ['t1', 't2'] },
  { key: 'https://b.com/gql', resolvedEndpoint: 'https://b.com/gql', displayLabel: 'b.com', tabIds: ['t3'] },
];

function makeTab(id: string, overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id,
    label: id,
    modelUri: `model://${id}`,
    query: `query { ${id} }`,
    variables: '{}',
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
    ...overrides,
  };
}

describe('GqlBatchSettingsPanel', () => {
  it('shows empty state when no groups', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[]}
        activeGroupKey={null}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[]}
      />,
    );
    expect(screen.getByText(/No query or mutation tabs are open/)).toBeInTheDocument();
  });

  it('shows single-group label and tab checklist', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set(['t1'])}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1'), makeTab('t2')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-panel')).toBeInTheDocument();
    expect(screen.getByTestId('gql-adv-batch-group-label')).toHaveTextContent('a.com');
    expect(screen.getByTestId('gql-adv-batch-tab-cb-t1')).toBeChecked();
    expect(screen.getByTestId('gql-adv-batch-tab-cb-t2')).not.toBeChecked();
  });

  it('shows group dropdown when multiple groups exist', () => {
    render(
      <GqlBatchSettingsPanel
        groups={groups}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1'), makeTab('t2'), makeTab('t3')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-group-select')).toBeInTheDocument();
  });

  it('calls onToggleBatchTab when a tab checkbox is clicked', () => {
    const onToggleBatchTab = vi.fn();
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={onToggleBatchTab}
        tabs={[makeTab('t1'), makeTab('t2')]}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-adv-batch-tab-cb-t1'));
    expect(onToggleBatchTab).toHaveBeenCalledWith('t1');
  });

  it('shows demo workspace badge when demoLessonActive', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1')]}
        demoLessonActive
      />,
    );
    expect(screen.getByText('Demo workspace')).toBeInTheDocument();
  });

  it('select all checks every tab in the group', () => {
    const onToggleBatchTab = vi.fn();
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={onToggleBatchTab}
        tabs={[makeTab('t1'), makeTab('t2')]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onToggleBatchTab).toHaveBeenCalledTimes(2);
  });

  it('clear all unchecks every batched tab in the group', () => {
    const onToggleBatchTab = vi.fn();
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set(['t1', 't2'])}
        onToggleBatchTab={onToggleBatchTab}
        tabs={[makeTab('t1'), makeTab('t2')]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onToggleBatchTab).toHaveBeenCalledTimes(2);
    expect(onToggleBatchTab).toHaveBeenCalledWith('t1');
    expect(onToggleBatchTab).toHaveBeenCalledWith('t2');
  });

  it('calls onGroupChange when group select changes', () => {
    const onGroupChange = vi.fn();
    render(
      <GqlBatchSettingsPanel
        groups={groups}
        activeGroupKey={groups[0]!.key}
        onGroupChange={onGroupChange}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1'), makeTab('t2'), makeTab('t3')]}
      />,
    );
    selectOption(screen.getByTestId('gql-adv-batch-group-select'), 'b.com · 1 tab');
    expect(onGroupChange).toHaveBeenCalledWith(groups[1]!.key);
  });

  it('shows warn hint when group has only one tab', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[{ key: 'solo', resolvedEndpoint: 'https://solo/gql', displayLabel: 'solo', tabIds: ['t1'] }]}
        activeGroupKey="solo"
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-selection-hint')).toHaveTextContent(
      'Add another tab with this endpoint to enable batching.',
    );
  });

  it('shows ready hint when two tabs are checked', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set(['t1', 't2'])}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1'), makeTab('t2')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-selection-hint')).toHaveTextContent('Ready — use Send Batch');
  });

  it('shows partial selection hint when fewer than two tabs checked', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set(['t1'])}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1'), makeTab('t2'), makeTab('t3')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-selection-hint')).toHaveTextContent('1 of 2 selected');
  });

  it('uses first group when activeGroupKey is null', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={null}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1'), makeTab('t2')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-group-label')).toHaveTextContent('a.com');
  });

  it('renders mutation and subscription op badges', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[
          makeTab('t1', { operationType: 'mutation' }),
          makeTab('t2', { operationType: 'subscription' }),
        ]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-tab-row-t1')).toHaveTextContent('M');
    expect(screen.getByTestId('gql-adv-batch-tab-row-t2')).toHaveTextContent('S');
  });

  it('shows empty query preview for blank query', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1', { query: '   \n  ' })]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-tab-row-t1')).toHaveTextContent('(empty query)');
  });

  it('normalizes multiline query to a single-line preview', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1', { query: 'query {\n  health\n}' })]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-tab-row-t1')).toHaveTextContent('query { health }');
  });

  it('shows (empty query) for query { } placeholder', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1', { query: 'query {\n\n}' })]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-tab-row-t1')).toHaveTextContent('(empty query)');
  });

  it('truncates long query preview with ellipsis', () => {
    const longQuery = `query { ${'x'.repeat(100)} }`;
    render(
      <GqlBatchSettingsPanel
        groups={[groups[0]!]}
        activeGroupKey={groups[0]!.key}
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1', { query: longQuery })]}
      />,
    );
    const row = screen.getByTestId('gql-adv-batch-tab-row-t1');
    expect(row.textContent).toContain('…');
  });

  it('uses singular tab label for one-tab group chip', () => {
    render(
      <GqlBatchSettingsPanel
        groups={[{ key: 'solo', resolvedEndpoint: 'https://solo/gql', displayLabel: 'solo', tabIds: ['t1'] }]}
        activeGroupKey="solo"
        onGroupChange={vi.fn()}
        batchedTabIds={new Set()}
        onToggleBatchTab={vi.fn()}
        tabs={[makeTab('t1')]}
      />,
    );
    expect(screen.getByTestId('gql-adv-batch-group-label')).toHaveTextContent('1 tab');
    expect(screen.getByTestId('gql-adv-batch-group-label')).not.toHaveTextContent('1 tabs');
  });
});
