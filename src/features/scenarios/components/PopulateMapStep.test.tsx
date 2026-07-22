/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { selectOption, selectOptionByIndex } from '../../../test-utils/customSelectHelper';
import PopulateMapStep from './PopulateMapStep';
import type { DetectedArray, FieldMapping } from '../utils/populateFromApiUtils';

const createMockArrays = (): DetectedArray[] => [
  { path: 'users', length: 3, sampleKeys: ['id', 'name'] },
  { path: 'products', length: 5, sampleKeys: ['sku', 'price'] },
];

const createMockFieldMappings = (): FieldMapping[] => [
  { field: 'id', colType: 'path', enabled: true },
  { field: 'name', colType: 'validate', enabled: true },
  { field: 'email', colType: 'validate', enabled: false },
];

const createMockArrayItems = (): Record<string, unknown>[] => [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

describe('PopulateMapStep', () => {
  const defaultProps = {
    detectedArrays: createMockArrays(),
    selectedArray: 'users',
    onArrayChange: vi.fn(),
    arrayItems: createMockArrayItems(),
    fieldMappings: createMockFieldMappings(),
    onToggleField: vi.fn(),
    onChangeFieldType: vi.fn(),
    enabledMappings: createMockFieldMappings().filter(m => m.enabled),
    insertMode: 'append' as const,
    duplicateFlags: [false, false],
    duplicateCount: 0,
    effectiveSelections: [true, true],
    onRowSelectionChange: vi.fn(),
  };

  it('renders array selector when multiple arrays', () => {
    render(<PopulateMapStep {...defaultProps} />);
    expect(screen.getByText('Array source:')).toBeInTheDocument();
    expect(document.querySelectorAll('.cs-wrapper').length).toBeGreaterThan(0);
  });

  it('shows array info when single array', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        detectedArrays={[{ path: 'users', length: 3, sampleKeys: ['id'] }]}
        arrayItems={[{ id: '1' }, { id: '2' }, { id: '3' }]}
      />
    );
    expect(screen.getByText(/Array:/)).toBeInTheDocument();
  });

  it('calls onArrayChange when array selector changes', () => {
    const onArrayChange = vi.fn();
    render(<PopulateMapStep {...defaultProps} onArrayChange={onArrayChange} />);

    selectOption(document.body, 'products');
    expect(onArrayChange).toHaveBeenCalledWith('products');
  });

  it('renders field mapping rows', () => {
    render(<PopulateMapStep {...defaultProps} />);
    expect(screen.getAllByText('id').length).toBeGreaterThan(0);
    expect(screen.getAllByText('name').length).toBeGreaterThan(0);
    expect(screen.getAllByText('email').length).toBeGreaterThan(0);
  });

  it('shows field checkboxes', () => {
    render(<PopulateMapStep {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onToggleField when checkbox clicked', () => {
    const onToggleField = vi.fn();
    render(<PopulateMapStep {...defaultProps} onToggleField={onToggleField} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onToggleField).toHaveBeenCalled();
  });

  it('shows column type selectors', () => {
    render(<PopulateMapStep {...defaultProps} />);
    const selects = document.querySelectorAll('.populate-api-field-row .cs-wrapper');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onChangeFieldType when type changes', () => {
    const onChangeFieldType = vi.fn();
    render(<PopulateMapStep {...defaultProps} onChangeFieldType={onChangeFieldType} />);

    const typeSelects = document.querySelectorAll('.populate-api-field-row .cs-wrapper');
    if (typeSelects.length > 0) {
      selectOption(typeSelects[0]!, 'Header');
      expect(onChangeFieldType).toHaveBeenCalled();
    }
  });

  it('renders preview table', () => {
    render(<PopulateMapStep {...defaultProps} />);
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('shows duplicate count when duplicates exist', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, false]}
        duplicateCount={1}
      />
    );
    expect(screen.getByText(/1 duplicate found/)).toBeInTheDocument();
  });

  it('shows duplicate badges in preview', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, false]}
        duplicateCount={1}
      />
    );
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows selection actions when duplicates exist', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, false]}
        duplicateCount={1}
      />
    );
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('New Only')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('calls onRowSelectionChange for Select All', () => {
    const onRowSelectionChange = vi.fn();
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, false]}
        duplicateCount={1}
        onRowSelectionChange={onRowSelectionChange}
      />
    );

    fireEvent.click(screen.getByText('Select All'));
    expect(onRowSelectionChange).toHaveBeenCalledWith([true, true]);
  });

  it('calls onRowSelectionChange for New Only', () => {
    const onRowSelectionChange = vi.fn();
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, false]}
        duplicateCount={1}
        onRowSelectionChange={onRowSelectionChange}
      />
    );

    fireEvent.click(screen.getByText('New Only'));
    expect(onRowSelectionChange).toHaveBeenCalledWith([false, true]);
  });

  it('calls onRowSelectionChange for None', () => {
    const onRowSelectionChange = vi.fn();
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, false]}
        duplicateCount={1}
        onRowSelectionChange={onRowSelectionChange}
      />
    );

    fireEvent.click(screen.getByText('None'));
    expect(onRowSelectionChange).toHaveBeenCalledWith([false, false]);
  });

  it('hides row checkboxes in replace mode', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        insertMode="replace"
      />
    );

    const table = screen.getByRole('table');
    const headerCheckboxes = table.querySelectorAll('thead input[type="checkbox"]');
    expect(headerCheckboxes).toHaveLength(0);
  });

  it('applies excluded class to deselected rows', () => {
    const { container } = render(
      <PopulateMapStep
        {...defaultProps}
        effectiveSelections={[false, true]}
      />
    );

    const excludedRows = container.querySelectorAll('.populate-api-row-excluded');
    expect(excludedRows).toHaveLength(1);
  });

  it('handles empty array items', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        arrayItems={[]}
        enabledMappings={[]}
      />
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('toggles a preview row checkbox via onRowSelectionChange', () => {
    const onRowSelectionChange = vi.fn();
    const { container } = render(
      <PopulateMapStep {...defaultProps} onRowSelectionChange={onRowSelectionChange} />
    );

    const rowChecks = container.querySelectorAll('tbody input[type="checkbox"]');
    expect(rowChecks.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(rowChecks[0]);
    expect(onRowSelectionChange).toHaveBeenCalledWith([false, true]);
  });

  it('uses root label when single array path is $', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        detectedArrays={[{ path: '$', length: 2, sampleKeys: ['id'] }]}
        selectedArray="$"
        arrayItems={[{ id: '1' }, { id: '2' }]}
      />
    );
    expect(screen.getByText(/\$ \(root\)/)).toBeInTheDocument();
  });

  it('truncates long sample cell display in field row', () => {
    const long = 'a'.repeat(60);
    render(
      <PopulateMapStep
        {...defaultProps}
        detectedArrays={[{ path: 'items', length: 1, sampleKeys: ['x'] }]}
        selectedArray="items"
        arrayItems={[{ x: long }]}
        fieldMappings={[{ field: 'x', colType: 'path', enabled: true }]}
        enabledMappings={[{ field: 'x', colType: 'path', enabled: true }]}
      />
    );
    const span = document.querySelector('.populate-api-sample-val');
    expect(span?.textContent).toContain('…');
    expect(span?.textContent?.length).toBeLessThan(long.length);
  });

  it('uses plural duplicates in preview title when duplicateCount > 1', () => {
    render(
      <PopulateMapStep
        {...defaultProps}
        duplicateFlags={[true, true, false]}
        duplicateCount={2}
      />
    );
    expect(screen.getByText(/2 duplicates found/)).toBeInTheDocument();
  });
});
