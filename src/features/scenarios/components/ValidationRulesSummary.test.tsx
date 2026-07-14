/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ValidationRulesSummary from './ValidationRulesSummary';

const emptyPivot = {
  columns: [] as string[],
  rows: [] as Array<{ key: string; cells: Map<string, { value?: string }> }>,
  arrayPrefix: null as string | null,
};

describe('ValidationRulesSummary', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders nothing when there are no expected fields', () => {
    const { container } = render(
      <ValidationRulesSummary
        expectedFields={[]}
        pivotedRules={emptyPivot}
        canPivot={false}
        rulesViewMode="flat"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders operator badge defaulting to equals when operator is omitted', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.id', expectedValue: '"1"' }]}
        pivotedRules={emptyPivot}
        canPivot={false}
        rulesViewMode="flat"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('equals')).toBeInTheDocument();
  });

  it('renders operator label with spaces instead of underscores', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.x', expectedValue: '1', operator: 'greater_than' }]}
        pivotedRules={emptyPivot}
        canPivot={false}
        rulesViewMode="flat"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('greater than')).toBeInTheDocument();
  });

  it('shows operatorValue column when provided instead of expectedValue', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{
          jsonPath: '$.n',
          expectedValue: '"ignored"',
          operator: 'between',
          operatorValue: '1..10',
        }]}
        pivotedRules={emptyPivot}
        canPivot={false}
        rulesViewMode="flat"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('1..10')).toBeInTheDocument();
  });

  it('calls onRemoveField with row index from list view', () => {
    const onRemoveField = vi.fn();
    render(
      <ValidationRulesSummary
        expectedFields={[
          { jsonPath: '$.a', expectedValue: '1' },
          { jsonPath: '$.b', expectedValue: '2' },
        ]}
        pivotedRules={emptyPivot}
        canPivot={false}
        rulesViewMode="flat"
        onViewModeChange={vi.fn()}
        onRemoveField={onRemoveField}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove $.b' }));
    expect(onRemoveField).toHaveBeenCalledWith(1);
  });

  it('shows pivot/list toggle when canPivot is true', () => {
    const onViewModeChange = vi.fn();
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['id'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['id', { value: '"99"' }]]),
          }],
        }}
        canPivot
        rulesViewMode="flat"
        onViewModeChange={onViewModeChange}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByRole('tablist', { name: 'Rules view mode' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(onViewModeChange).toHaveBeenCalledWith('pivot');
  });

  it('switches from pivot to flat list when List tab is clicked', () => {
    const onViewModeChange = vi.fn();
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['id'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['id', { value: '"99"' }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={onViewModeChange}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'List' }));
    expect(onViewModeChange).toHaveBeenCalledWith('flat');
  });

  it('renders pivot table with shortened row labels for indexed paths', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['id'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['id', { value: '"quoted"' }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('#0')).toBeInTheDocument();
    expect(screen.getByText('quoted')).toBeInTheDocument();
  });

  it('shows raw row key in pivot when arrayPrefix is null', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.flat', expectedValue: '1' }]}
        pivotedRules={{
          columns: ['c'],
          arrayPrefix: null,
          rows: [{ key: '$.flat.row', cells: new Map() }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('$.flat.row')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onRemoveRowPrefix from pivot remove button', () => {
    const onRemoveRowPrefix = vi.fn();
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['id'],
          arrayPrefix: '$.items',
          rows: [{ key: '$.items[1]', cells: new Map() }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={onRemoveRowPrefix}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove $.items[1]' }));
    expect(onRemoveRowPrefix).toHaveBeenCalledWith('$.items[1]');
  });

  it('renders pivot cell without stripping when value is not JSON-quoted', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['label'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['label', { value: 'plain' }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('plain')).toBeInTheDocument();
  });

  it('does not strip pivot cell when value has leading quote but no trailing quote', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['label'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['label', { value: '"partial' }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('"partial')).toBeInTheDocument();
  });

  it('renders empty pivot cell code when cell value is undefined', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['label'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['label', { value: undefined }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    const codes = document.querySelectorAll('.validation-fields-pivot-val');
    expect(Array.from(codes).some((el) => el.textContent === '')).toBe(true);
  });

  it('does not strip when quoted value is shorter than two characters', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '"1"' }]}
        pivotedRules={{
          columns: ['label'],
          arrayPrefix: '$.items',
          rows: [{
            key: '$.items[0]',
            cells: new Map([['label', { value: '"' }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('"')).toBeInTheDocument();
  });

  it('shows raw indexed row key when pivot arrayPrefix is null', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items[0].id', expectedValue: '1' }]}
        pivotedRules={{
          columns: ['id'],
          arrayPrefix: null,
          rows: [{
            key: '$.items[0]',
            cells: new Map([['id', { value: '"z"' }]]),
          }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    expect(screen.getByText('$.items[0]')).toBeInTheDocument();
    expect(screen.getByText('z')).toBeInTheDocument();
  });

  it('uses full row key for pivot label when arrayPrefix is set but key has no trailing index', () => {
    render(
      <ValidationRulesSummary
        expectedFields={[{ jsonPath: '$.items', expectedValue: '1' }]}
        pivotedRules={{
          columns: ['x'],
          arrayPrefix: '$.items',
          rows: [{ key: '$.items', cells: new Map() }],
        }}
        canPivot
        rulesViewMode="pivot"
        onViewModeChange={vi.fn()}
        onRemoveField={vi.fn()}
        onRemoveRowPrefix={vi.fn()}
      />,
    );
    const tables = screen.getAllByRole('table');
    const pivotTable = tables[tables.length - 1]!;
    expect(within(pivotTable).getAllByText('$.items').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Remove $.items' })).toBeInTheDocument();
  });
});
