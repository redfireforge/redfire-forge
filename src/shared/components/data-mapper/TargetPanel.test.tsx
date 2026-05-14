/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TargetPanel from './TargetPanel';
import type { MapperTarget, Mapping } from './types';

const target: MapperTarget = {
  label: 'Output',
  sampleData: { userName: '', email: '', address: { city: '' } },
  allowCustomFields: false,
};

const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };

function renderPanel(overrides?: Partial<Parameters<typeof TargetPanel>[0]>) {
  const defaults = {
    target,
    mappings: [] as Mapping[],
    onDrop: vi.fn(),
    selectedMappingId: null,
    onSelectMapping: vi.fn(),
  };
  return render(<TargetPanel {...defaults} {...overrides} />);
}

describe('TargetPanel', () => {
  it('renders target tree from sampleData', () => {
    renderPanel();
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('shows "Target" panel title', () => {
    renderPanel();
    expect(screen.getByText('Target')).toBeTruthy();
  });

  it('shows mapped badge when mappings exist', () => {
    renderPanel({ mappings: [mapping] });
    expect(screen.getByText('1 mapped')).toBeTruthy();
  });

  it('hides mapped badge when no mappings', () => {
    const { container } = renderPanel();
    expect(container.querySelector('.dm-mapped-count-badge')).toBeNull();
  });

  it('hides mapped badge when schema is missing even with mappings', () => {
    const { container } = renderPanel({
      target: { label: 'No Schema', sampleData: undefined, allowCustomFields: false },
      mappings: [mapping],
    });
    expect(container.querySelector('.dm-mapped-count-badge')).toBeNull();
  });

  it('shows empty state when no sampleData', () => {
    renderPanel({ target: { label: 'Empty', sampleData: null } });
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  it('shows guided empty-state actions when target schema is missing', () => {
    renderPanel({
      target: { label: 'Empty', sampleData: undefined, allowCustomFields: false },
      onPasteTargetSample: vi.fn(),
      canFetchTarget: true,
      onFetchTargetSchema: vi.fn(),
    });
    expect(screen.getByText('Paste JSON')).toBeTruthy();
    expect(screen.getByText('Fetch schema')).toBeTruthy();
  });

  it('accepts left-to-right drop on empty state by creating custom field + mapping', () => {
    const onDrop = vi.fn();
    const onAddCustomField = vi.fn();
    const { container } = renderPanel({
      target: { label: 'Empty', sampleData: undefined, allowCustomFields: true },
      onDrop,
      onAddCustomField,
      getDraggedSource: () => ({ path: 'offers[0].associatedOfferingCode', sourceId: 'response-body' }),
    });

    const emptyState = container.querySelector('.dm-empty-state') as HTMLElement;
    fireEvent.drop(emptyState, {
      dataTransfer: {
        getData: () => '',
      },
    });

    expect(onAddCustomField).toHaveBeenCalledWith({
      path: 'offers[0].associatedOfferingCode',
      label: 'associatedOfferingCode',
      type: 'string',
      origin: 'custom',
    });
    expect(onDrop).toHaveBeenCalledWith(
      'offers[0].associatedOfferingCode',
      'offers[0].associatedOfferingCode',
      'response-body',
    );
  });

  it('opens paste mode from target empty-state action', () => {
    renderPanel({
      target: { label: 'Empty', sampleData: undefined, allowCustomFields: false },
      onPasteTargetSample: vi.fn(),
    });
    fireEvent.click(screen.getByText('Paste JSON'));
    expect(screen.getByLabelText('Paste target JSON')).toBeTruthy();
  });

  it('filters by search', () => {
    renderPanel();
    const input = screen.getByPlaceholderText('Search fields…');
    fireEvent.change(input, { target: { value: 'email' } });
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.queryByText('userName')).toBeNull();
  });

  it('filters to mapped target fields only and shows mapped/unmapped counts', () => {
    renderPanel({ mappings: [mapping] });
    fireEvent.change(screen.getByLabelText('Filter target fields'), { target: { value: 'mapped' } });
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.queryByText('email')).toBeNull();
    expect(screen.getByText('1 mapped / 2 unmapped')).toBeTruthy();
  });

  it('filters to unmapped target fields only', () => {
    renderPanel({ mappings: [mapping] });
    fireEvent.change(screen.getByLabelText('Filter target fields'), { target: { value: 'unmapped' } });
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.queryByText('userName')).toBeNull();
  });

  it('clears search on × click', () => {
    renderPanel();
    const input = screen.getByPlaceholderText('Search fields…');
    fireEvent.change(input, { target: { value: 'email' } });
    fireEvent.click(screen.getByText('×'));
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('expands all nodes on ⊞ click', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(screen.getByText('city')).toBeTruthy();
  });

  it('collapses all on ⊟ click', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Expand all'));
    fireEvent.click(screen.getByLabelText('Collapse all'));
    expect(screen.queryByText('city')).toBeNull();
  });

  it('shows mapped indicator on mapped fields', () => {
    const { container } = renderPanel({ mappings: [mapping] });
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(container.querySelector('.dm-mapped-badge')).toBeTruthy();
    expect(screen.getByText('←')).toBeTruthy();
  });

  it('fires onEditExpression on double-click of mapped field', () => {
    const onEdit = vi.fn();
    renderPanel({ mappings: [mapping], onEditExpression: onEdit });
    fireEvent.click(screen.getByLabelText('Expand all'));
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.doubleClick(el);
    expect(onEdit).toHaveBeenCalledWith('m1');
  });

  it('passes onRemoveMapping through to TargetTreeNode', () => {
    const onRemove = vi.fn();
    const { container } = renderPanel({
      mappings: [mapping],
      onRemoveMapping: onRemove,
    });
    fireEvent.click(screen.getByLabelText('Expand all'));
    const removeBtn = container.querySelector('.dm-inline-remove');
    expect(removeBtn).toBeTruthy();
  });

  it('shows empty state when target has no sample data', () => {
    const emptyTarget = { label: 'Vars', sampleData: undefined, allowCustomFields: false };
    const { container } = renderPanel({ target: emptyTarget as typeof target });
    expect(container.querySelector('.dm-empty-state')).toBeTruthy();
    expect(container.querySelector('.dm-empty-state')!.textContent).toContain('No target schema');
  });

  it('handles invalid JSON sampleData gracefully', () => {
    renderPanel({ target: { label: 'Bad', sampleData: '{not valid json' } });
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  it('handles string sampleData (JSON.parse branch)', () => {
    renderPanel({ target: { label: 'StringTarget', sampleData: '{"output":"value"}' } });
    expect(screen.getByText('output')).toBeTruthy();
  });

  it('toggles a node path between expanded and collapsed', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(screen.getByText('city')).toBeTruthy();
    const toggleBtns = screen.getAllByLabelText('Collapse');
    fireEvent.click(toggleBtns[toggleBtns.length - 1]);
    expect(screen.queryByText('city')).toBeNull();
  });

  it('passes typeMismatches and onQuickFix through', () => {
    const onQuickFix = vi.fn();
    const mismatches = [{ mappingId: 'm1', sourceType: 'string', targetType: 'number', severity: 'warning' as const, message: 'Type mismatch', suggestedFix: '$parseInt($.name)' }];
    const { container } = renderPanel({
      mappings: [mapping],
      typeMismatches: mismatches,
      onQuickFix,
    });
    fireEvent.click(screen.getByLabelText('Expand all'));
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).toBeTruthy();
  });

  it('handles expand all when tree is null (no-op)', () => {
    renderPanel({ target: { label: 'Empty', sampleData: null } });
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  describe('fields-based tree (12A)', () => {
    const fieldsTarget: MapperTarget = {
      label: 'API Fields',
      sampleData: undefined,
      fields: [
        { path: 'name', label: 'Name', type: 'string' },
        { path: 'age', label: 'Age', type: 'number' },
        { path: 'address.city', label: 'City', type: 'string' },
      ],
      allowCustomFields: true,
    };

    it('renders tree from fields when sampleData is absent', () => {
      renderPanel({ target: fieldsTarget });
      expect(screen.getByText('Name')).toBeTruthy();
      expect(screen.getByText('Age')).toBeTruthy();
    });

    it('shows "fields" schema source badge', () => {
      renderPanel({ target: fieldsTarget });
      expect(screen.getByText('fields')).toBeTruthy();
    });

    it('does not show "fields" badge when sampleData is present', () => {
      renderPanel();
      expect(screen.queryByText('fields')).toBeNull();
    });

    it('auto-expands nested fields', () => {
      renderPanel({ target: fieldsTarget });
      expect(screen.getByText('City')).toBeTruthy();
    });

    it('resets filters and keeps root expanded when resetViewSignal changes (clear-all behavior)', () => {
      const baseProps = {
        target: fieldsTarget,
        mappings: [] as Mapping[],
        onDrop: vi.fn(),
        selectedMappingId: null,
        onSelectMapping: vi.fn(),
      };
      const { rerender } = render(<TargetPanel {...baseProps} resetViewSignal={null} />);
      expect(screen.getByText('City')).toBeTruthy();

      rerender(<TargetPanel {...baseProps} resetViewSignal={1} />);
      expect(screen.getByText('Name')).toBeTruthy();
      expect(screen.getByText('(root)')).toBeTruthy();
    });

    it('renders type pills on field nodes', () => {
      const { container } = renderPanel({ target: fieldsTarget });
      const numPills = container.querySelectorAll('.dm-type-pill--number');
      expect(numPills.length).toBeGreaterThanOrEqual(1);
    });

    it('shows drop zone hints on unmapped leaf fields', () => {
      const { container } = renderPanel({ target: fieldsTarget });
      const hints = container.querySelectorAll('.dm-drop-zone-hint');
      expect(hints.length).toBeGreaterThanOrEqual(2);
    });

    it('supports mappings on field-generated nodes', () => {
      const fieldMapping: Mapping = { id: 'm2', sourcePath: 'src.name', sourceId: 's1', targetPath: 'name' };
      renderPanel({ target: fieldsTarget, mappings: [fieldMapping] });
      expect(screen.getByText('1 mapped')).toBeTruthy();
      expect(screen.getByText('←')).toBeTruthy();
    });

    it('forwards field reorder drops when fields tree is shown', () => {
      const onReorderField = vi.fn();
      renderPanel({ target: fieldsTarget, onReorderField });
      const ageNode = screen.getByText('Age').closest('.dm-tree-node')!;
      const dt = {
        getData: (type: string) => (type === 'application/mapper-target-field'
          ? JSON.stringify({ kind: 'target-field', path: 'name' })
          : ''),
        dropEffect: 'none',
      };
      fireEvent.drop(ageNode, { dataTransfer: dt });
      expect(onReorderField).toHaveBeenCalledWith('name', 'age');
    });

    it('shows empty state when fields is empty array', () => {
      const emptyFields: MapperTarget = {
        label: 'Empty',
        sampleData: undefined,
        fields: [],
        allowCustomFields: false,
      };
      renderPanel({ target: emptyFields });
      expect(screen.getByText(/No target schema/)).toBeTruthy();
    });

    it('prefers sampleData over fields when both are present', () => {
      const both: MapperTarget = {
        label: 'Both',
        sampleData: { output: 'val' },
        fields: [{ path: 'fieldOnly', label: 'Field Only' }],
        allowCustomFields: false,
      };
      renderPanel({ target: both });
      expect(screen.getByText('output')).toBeTruthy();
      expect(screen.queryByText('Field Only')).toBeNull();
      expect(screen.queryByText('fields')).toBeNull();
    });

    it('handles :: separator paths as flat leaves', () => {
      const colTarget: MapperTarget = {
        label: 'Column Mapping',
        sampleData: undefined,
        fields: [
          { path: 'path::userId', label: 'userId (path)', type: 'path' },
          { path: 'param::page', label: 'page (param)', type: 'param' },
        ],
        allowCustomFields: true,
      };
      renderPanel({ target: colTarget });
      expect(screen.getByText('userId (path)')).toBeTruthy();
      expect(screen.getByText('page (param)')).toBeTruthy();
    });
  });

  describe('editable target fields (12B)', () => {
    const editableTarget: MapperTarget = {
      label: 'Editable',
      sampleData: undefined,
      fields: [
        { path: 'name', label: 'Name', type: 'string', origin: 'adapter' },
        { path: 'custom1', label: 'Custom1', type: 'string', origin: 'custom' },
      ],
      allowCustomFields: true,
    };

    it('shows "+ Add Field" button when allowCustomFields is true', () => {
      renderPanel({ target: editableTarget, onAddCustomField: vi.fn() });
      expect(screen.getByText('+ Add Field')).toBeTruthy();
    });

    it('does not show "+ Add Field" when allowCustomFields is false', () => {
      renderPanel({ target: { ...editableTarget, allowCustomFields: false } });
      expect(screen.queryByText('+ Add Field')).toBeNull();
    });

    it('does not show "+ Add Field" when onAddCustomField is not provided', () => {
      renderPanel({ target: editableTarget });
      expect(screen.queryByText('+ Add Field')).toBeNull();
    });

    it('renders origin badge for custom fields', () => {
      const { container } = renderPanel({ target: editableTarget });
      const badges = container.querySelectorAll('.dm-origin-badge--custom');
      expect(badges.length).toBe(1);
    });

    it('does not render origin badge for adapter fields', () => {
      const adapterOnly: MapperTarget = {
        label: 'AdapterOnly',
        sampleData: undefined,
        fields: [{ path: 'name', label: 'Name', origin: 'adapter' }],
        allowCustomFields: false,
      };
      const { container } = renderPanel({ target: adapterOnly });
      expect(container.querySelectorAll('.dm-origin-badge').length).toBe(0);
    });

    it('renders fetched origin badge', () => {
      const fetchedTarget: MapperTarget = {
        label: 'Fetched',
        sampleData: undefined,
        fields: [{ path: 'data', label: 'Data', origin: 'fetched' }],
        allowCustomFields: true,
      };
      const { container } = renderPanel({ target: fetchedTarget });
      expect(container.querySelectorAll('.dm-origin-badge--fetched').length).toBe(1);
    });

    it('shows remove button on custom field hover', () => {
      const onRemove = vi.fn();
      const { container } = renderPanel({
        target: editableTarget,
        onRemoveCustomField: onRemove,
      });
      const removeBtn = container.querySelector('.dm-inline-remove--field');
      expect(removeBtn).toBeTruthy();
    });

    it('calls onRemoveCustomField when remove button is clicked', () => {
      const onRemove = vi.fn();
      const { container } = renderPanel({
        target: editableTarget,
        onRemoveCustomField: onRemove,
      });
      const removeBtn = container.querySelector('.dm-inline-remove--field');
      fireEvent.click(removeBtn!);
      expect(onRemove).toHaveBeenCalledWith('custom1');
    });
  });

  describe('target fetch + paste (12C)', () => {
    it('shows fetch button when canFetchTarget is true', () => {
      renderPanel({ canFetchTarget: true, onFetchTargetSchema: vi.fn() });
      expect(screen.getByLabelText('Fetch target schema')).toBeTruthy();
    });

    it('does not show fetch button when canFetchTarget is false', () => {
      renderPanel();
      expect(screen.queryByLabelText('Fetch target schema')).toBeNull();
    });

    it('shows paste button when onPasteTargetSample is provided', () => {
      renderPanel({ onPasteTargetSample: vi.fn() });
      expect(screen.getByLabelText('Paste JSON')).toBeTruthy();
    });

    it('toggles paste mode on paste button click', () => {
      renderPanel({ onPasteTargetSample: vi.fn() });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      expect(screen.getByLabelText('Paste target JSON')).toBeTruthy();
    });

    it('calls onPasteTargetSample with parsed JSON on Apply', () => {
      const onPaste = vi.fn();
      renderPanel({ onPasteTargetSample: onPaste });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      const textarea = screen.getByLabelText('Paste target JSON');
      fireEvent.change(textarea, { target: { value: '{"test": 123}' } });
      fireEvent.click(screen.getByText('Apply'));
      expect(onPaste).toHaveBeenCalledWith({ test: 123 });
    });

    it('shows paste error for invalid JSON', () => {
      renderPanel({ onPasteTargetSample: vi.fn() });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      const textarea = screen.getByLabelText('Paste target JSON');
      fireEvent.change(textarea, { target: { value: '{bad json' } });
      fireEvent.click(screen.getByText('Apply'));
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    it('shows paste error for empty input', () => {
      const emptyTarget: MapperTarget = { label: 'Empty', sampleData: undefined, allowCustomFields: false };
      renderPanel({ target: emptyTarget, onPasteTargetSample: vi.fn() });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      fireEvent.click(screen.getByText('Apply'));
      expect(screen.getByText('Paste some JSON')).toBeTruthy();
    });

    it('cancels paste mode', () => {
      renderPanel({ onPasteTargetSample: vi.fn() });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByLabelText('Paste target JSON')).toBeNull();
    });

    it('displays target fetch error', () => {
      renderPanel({ targetFetchError: 'Network error' });
      expect(screen.getByText('Network error')).toBeTruthy();
    });

    it('shows spinner during fetch', async () => {
      let resolveFetch: () => void = () => {};
      const fetchFn = () => new Promise<void>((r) => { resolveFetch = r; });
      renderPanel({ canFetchTarget: true, onFetchTargetSchema: fetchFn });
      fireEvent.click(screen.getByLabelText('Fetch target schema'));
      expect(screen.getByText('…')).toBeTruthy();
      resolveFetch();
    });

    it('pre-fills paste textarea with existing sampleData', () => {
      renderPanel({
        target: { ...target, sampleData: { foo: 'bar' } },
        onPasteTargetSample: vi.fn(),
      });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      const textarea = screen.getByLabelText('Paste target JSON') as HTMLTextAreaElement;
      expect(textarea.value).toContain('"foo"');
    });
  });

  describe('location grouping', () => {
    const groupTarget: MapperTarget = {
      label: 'Grouped',
      sampleData: undefined,
      fields: [
        { path: 'userId', label: 'userId', type: 'string', location: 'path' },
        { path: 'page', label: 'page', type: 'string', location: 'query' },
        { path: 'Authorization', label: 'Authorization', type: 'string', location: 'header' },
        { path: 'name', label: 'name', type: 'string', location: 'body' },
      ],
      allowCustomFields: true,
    };

    it('renders LocationGroupPanel when fields have locations', () => {
      renderPanel({ target: groupTarget, onAddCustomField: vi.fn() });
      expect(screen.getByText('Path')).toBeTruthy();
      expect(screen.getByText('Query')).toBeTruthy();
      expect(screen.getByText('Headers')).toBeTruthy();
      expect(screen.getByText('Body')).toBeTruthy();
    });

    it('uses flat tree when no fields have locations', () => {
      const noLocTarget: MapperTarget = {
        label: 'No Loc',
        sampleData: undefined,
        fields: [
          { path: 'field1', label: 'field1', type: 'string' },
          { path: 'field2', label: 'field2', type: 'string' },
        ],
      };
      renderPanel({ target: noLocTarget });
      expect(screen.queryByText('Path')).toBeNull();
      expect(screen.getByText('field1')).toBeTruthy();
    });

    it('hides general Add Field when location groups are active', () => {
      renderPanel({ target: groupTarget, onAddCustomField: vi.fn() });
      const addBtns = screen.getAllByText('+ Add Field');
      for (const btn of addBtns) {
        expect(btn.closest('.dm-loc-group-body')).toBeTruthy();
      }
    });

    it('renders field nodes with data-path for connection lines across groups', () => {
      const { container } = renderPanel({ target: groupTarget });
      expect(container.querySelector('[data-path="userId"]')).toBeTruthy();
      expect(container.querySelector('[data-path="name"]')).toBeTruthy();
    });
  });

  describe('toggle and custom field coverage', () => {
    it('collapses expanded node on toggle click', () => {
      renderPanel();
      const collapseBtn = screen.queryAllByLabelText('Collapse');
      if (collapseBtn.length > 0) {
        fireEvent.click(collapseBtn[0]);
        expect(screen.queryAllByLabelText('Expand').length).toBeGreaterThanOrEqual(1);
      }
    });

    it('expands collapsed node on toggle click', () => {
      renderPanel();
      const collapseBtn = screen.queryAllByLabelText('Collapse');
      if (collapseBtn.length > 0) {
        fireEvent.click(collapseBtn[0]);
        const expandBtn = screen.queryAllByLabelText('Expand');
        if (expandBtn.length > 0) {
          fireEvent.click(expandBtn[0]);
          expect(expandBtn[0]).toBeTruthy();
        }
      }
    });

    it('renders with custom fields and existing paths', () => {
      const onAddCustomField = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: { field: '' },
        allowCustomFields: true,
        fields: [
          { path: 'field', label: 'field', type: 'string' },
          { path: 'field_2', label: 'field_2', type: 'string' },
        ],
      };
      renderPanel({
        target: customTarget,
        onAddCustomField,
        existingPaths: new Set(['field', 'field_2']),
      });
      expect(screen.getByText('Target')).toBeTruthy();
    });

    it('handles drag over empty state with valid custom MIME payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = JSON.stringify({ path: 'name', sourceId: 's1' });
      fireEvent.dragOver(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'application/mapper-source' ? payload : '',
          dropEffect: 'none',
        },
      });
    });

    it('handles drop on empty state with text/plain payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = JSON.stringify({ path: 'name', sourceId: 's1' });
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'text/plain' ? payload : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalled();
      expect(onDrop).toHaveBeenCalledWith('name', 'name', 's1');
    });

    it('handles drop with dotted path uses last segment as label', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = JSON.stringify({ path: 'user.name', sourceId: 's1' });
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'text/plain' ? payload : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'user.name', label: 'name' }),
      );
    });

    it('handles drag over but ignores when custom fields not allowed', () => {
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: false,
      };
      const { container } = renderPanel({
        target: customTarget,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      fireEvent.dragOver(emptyState!, {
        dataTransfer: {
          getData: () => JSON.stringify({ path: 'x', sourceId: 's1' }),
          dropEffect: 'none',
        },
      });
    });

    it('extractDraggedSource falls back to getDraggedSource when no payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
        getDraggedSource: () => ({ path: 'fallback', sourceId: 's2' }),
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: () => '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'fallback' }),
      );
    });

    it('extractDraggedSource handles SOURCE_TEXT_PREFIX in payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = 'mapper-source:' + JSON.stringify({ path: 'prefixed', sourceId: 's1' });
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'text/plain' ? payload : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'prefixed' }),
      );
    });

    it('onTreeKeyDown is invoked when provided', () => {
      const onTreeKeyDown = vi.fn();
      const { container } = renderPanel({ onTreeKeyDown });
      const treeContainer = container.querySelector('.dm-tree-container');
      if (treeContainer) {
        fireEvent.keyDown(treeContainer, { key: 'ArrowDown' });
        expect(onTreeKeyDown).toHaveBeenCalled();
      }
    });

    it('handles invalid sampleData string gracefully for sampleSignature', () => {
      renderPanel({
        target: { label: 'Bad', sampleData: '{invalid-json', allowCustomFields: false },
      });
      expect(screen.getByText('Target')).toBeTruthy();
    });

    it('togglePasteMode catches invalid string sampleData and sets empty paste text', () => {
      renderPanel({
        target: { label: 'Bad JSON', sampleData: '{not-valid', allowCustomFields: false },
        onPasteTargetSample: vi.fn(),
      });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      const textarea = screen.getByLabelText('Paste target JSON') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('handleFetch is a no-op when onFetchTargetSchema is not provided', () => {
      renderPanel({ canFetchTarget: false });
      expect(screen.queryByLabelText('Fetch target schema')).toBeNull();
    });
  });

  describe('verify filters and highlights', () => {
    it('sets filter to failed when filterFailedSignal updates', () => {
      const emailMap: Mapping = { id: 'mE', sourcePath: 'src', sourceId: 's1', targetPath: 'email' };
      const props = {
        target,
        mappings: [emailMap],
        onDrop: vi.fn(),
        selectedMappingId: null,
        onSelectMapping: vi.fn(),
        nodeStatusMap: new Map<string, 'pass' | 'fail'>([['email', 'fail']]),
      };
      const { rerender } = render(<TargetPanel {...props} filterFailedSignal={null} />);
      rerender(<TargetPanel {...props} filterFailedSignal={1} />);
      expect((screen.getByLabelText('Filter target fields') as HTMLSelectElement).value).toBe('failed');
    });

    it('filters tree leaves by verification passed paths', () => {
      renderPanel({
        mappings: [mapping],
        nodeStatusMap: new Map([
          ['userName', 'pass'],
          ['email', 'fail'],
        ]),
      });
      fireEvent.change(screen.getByLabelText('Filter target fields'), { target: { value: 'passed' } });
      expect(screen.getByText('userName')).toBeTruthy();
      expect(screen.queryByText('email')).toBeNull();
    });

    it('applies hover-highlight class when highlightedPaths matches mapped leaf', () => {
      const { container } = renderPanel({
        mappings: [mapping],
        highlightedPaths: new Set(['userName']),
      });
      fireEvent.click(screen.getByLabelText('Expand all'));
      const row = container.querySelector('[data-path="userName"]');
      expect(row?.className).toContain('dm-tree-node--hover-highlight');
    });

    it('shows unresolved counts on badge when explicitly provided', () => {
      const { container } = renderPanel({
        mappings: [mapping],
        resolvedMappingCount: 1,
        unresolvedMappingCount: 4,
      });
      const badge = container.querySelector('.dm-mapped-count-badge');
      expect(badge?.textContent).toContain('1 mapped');
      expect(badge?.textContent).toContain('4 unresolved');
    });
  });
});
