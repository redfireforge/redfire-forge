/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import JsonPathBuilder from './JsonPathBuilder';

vi.mock('../../../shared/hooks/useDebounce', () => ({
  useDebounce: (val: string) => val,
}));

vi.mock('../../../shared/components/jsonTreeShared', () => ({
  typeColor: (type: string) => type === 'string' ? '#22c55e' : '#3b82f6',
  getValuePreview: (_type: string, value: unknown, _childCount: number) => String(value ?? ''),
  ChevronIcon: () => <span data-testid="chevron">▶</span>,
}));

const SAMPLE_JSON = JSON.stringify({
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  active: true,
  address: {
    street: '123 Main St',
    city: 'Springfield',
  },
  tags: ['admin', 'user'],
}, null, 2);

const ARRAY_JSON = JSON.stringify({
  offers: [
    { code: 'A1', price: 100 },
    { code: 'B2', price: 200 },
  ],
}, null, 2);

describe('JsonPathBuilder', () => {
  const defaultProps = {
    sampleJson: '',
    onSampleJsonChange: vi.fn(),
    selectiveMode: 'include' as const,
    expectedFields: [],
    excludedPaths: [],
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state (no JSON)', () => {
    it('renders textarea placeholder', () => {
      render(<JsonPathBuilder {...defaultProps} />);
      expect(screen.getByPlaceholderText(/Paste JSON here/)).toBeInTheDocument();
    });

    it('renders validation rules header', () => {
      render(<JsonPathBuilder {...defaultProps} />);
      expect(screen.getByText(/VALIDATION RULES/)).toBeInTheDocument();
    });

    it('shows empty hint when no rules', () => {
      render(<JsonPathBuilder {...defaultProps} />);
      expect(screen.getByText(/No validation rules configured/)).toBeInTheDocument();
    });

    it('shows Add Manual Rule button', () => {
      render(<JsonPathBuilder {...defaultProps} />);
      expect(screen.getByText('+ Add Manual Rule')).toBeInTheDocument();
    });

    it('calls onUpdate to add manual rule', () => {
      const onUpdate = vi.fn();
      render(<JsonPathBuilder {...defaultProps} onUpdate={onUpdate} />);
      fireEvent.click(screen.getByText('+ Add Manual Rule'));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: '', expectedValue: '' }],
      });
    });

    it('renders existing expected fields in list view', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          expectedFields={[
            { jsonPath: 'data.id', expectedValue: '1' },
            { jsonPath: 'data.name', expectedValue: '"Alice"' },
          ]}
        />
      );
      expect(screen.getByText('data.id')).toBeInTheDocument();
      expect(screen.getByText('data.name')).toBeInTheDocument();
    });

    it('shows remove button for each field in include mode', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          expectedFields={[{ jsonPath: 'data.id', expectedValue: '1' }]}
        />
      );
      expect(screen.getByText('×')).toBeInTheDocument();
    });

    it('removes field when × clicked', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          onUpdate={onUpdate}
          expectedFields={[
            { jsonPath: 'data.id', expectedValue: '1' },
            { jsonPath: 'data.name', expectedValue: '"Alice"' },
          ]}
        />
      );
      const removeButtons = screen.getAllByText('×');
      fireEvent.click(removeButtons[0]);
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'data.name', expectedValue: '"Alice"' }],
      });
    });
  });

  describe('With JSON parsed (tree view)', () => {
    it('renders tree when valid JSON provided', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByText('Select All')).toBeInTheDocument();
      expect(screen.getByText('Deselect All')).toBeInTheDocument();
    });

    it('shows field count stats', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByText(/0 \/ \d+ fields selected/)).toBeInTheDocument();
    });

    it('shows mode hint', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByText(/Check fields you want to validate/)).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByPlaceholderText('Search fields...')).toBeInTheDocument();
    });

    it('renders GENERATED VALIDATION RULES section', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByText(/GENERATED VALIDATION RULES/)).toBeInTheDocument();
    });

    it('shows empty include hint when no fields selected', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByText(/Click fields in the tree above/)).toBeInTheDocument();
    });

    it('shows Prettify button when JSON present', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      expect(screen.getByText('Prettify')).toBeInTheDocument();
    });

    it('prettifies JSON on click', () => {
      const onSampleJsonChange = vi.fn();
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"a":1}' onSampleJsonChange={onSampleJsonChange} />);
      fireEvent.click(screen.getByText('Prettify'));
      expect(onSampleJsonChange).toHaveBeenCalledWith('{\n  "a": 1\n}');
    });

    it('does not call onSampleJsonChange when Prettify runs on invalid JSON', () => {
      const onSampleJsonChange = vi.fn();
      render(<JsonPathBuilder {...defaultProps} sampleJson='{broken' onSampleJsonChange={onSampleJsonChange} />);
      fireEvent.click(screen.getByText('Prettify'));
      expect(onSampleJsonChange).not.toHaveBeenCalled();
    });

    it('renders tree nodes with checkboxes', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('renders tree node keys', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"userId": 42, "status": "active"}' />);
      expect(screen.getAllByText('userId').length).toBeGreaterThan(0);
      expect(screen.getAllByText('status').length).toBeGreaterThan(0);
    });

    it('shows parse error for invalid JSON', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson='{invalid json' />);
      expect(screen.getByText(/Parse error/)).toBeInTheDocument();
    });

    it('shows generic invalid message when JSON.parse throws a non-Error', () => {
      const spy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw 'not an Error object';
      });
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"x": 1}' />);
      expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
      spy.mockRestore();
    });

    it('does not show tree for invalid JSON', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson='{bad' />);
      expect(screen.queryByText('Select All')).not.toBeInTheDocument();
    });
  });

  describe('Select All / Deselect All', () => {
    it('selects all fields in include mode', () => {
      const onUpdate = vi.fn();
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"a": 1, "b": 2}' onUpdate={onUpdate} />);
      fireEvent.click(screen.getByText('Select All'));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: expect.arrayContaining([
          expect.objectContaining({ jsonPath: 'a' }),
          expect.objectContaining({ jsonPath: 'b' }),
        ]),
      });
    });

    it('deselects all fields in include mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1}'
          expectedFields={[{ jsonPath: 'a', expectedValue: '1' }]}
          onUpdate={onUpdate}
        />
      );
      fireEvent.click(screen.getByText('Deselect All'));
      expect(onUpdate).toHaveBeenCalledWith({ expectedFields: [] });
    });

    it('selects all (excludes all) in exclude mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1, "b": 2}'
          selectiveMode="exclude"
          onUpdate={onUpdate}
        />
      );
      fireEvent.click(screen.getByText('Select All'));
      expect(onUpdate).toHaveBeenCalledWith({
        excludedPaths: expect.arrayContaining(['a', 'b']),
        expectedFields: [],
      });
    });

    it('deselects all (clears excludedPaths) in exclude mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1, "b": 2}'
          selectiveMode="exclude"
          excludedPaths={['a', 'b']}
          onUpdate={onUpdate}
        />
      );
      fireEvent.click(screen.getByText('Deselect All'));
      expect(onUpdate).toHaveBeenCalledWith({
        excludedPaths: [],
        expectedFields: expect.arrayContaining([
          expect.objectContaining({ jsonPath: 'a' }),
          expect.objectContaining({ jsonPath: 'b' }),
        ]),
      });
    });
  });

  describe('Toggle individual field', () => {
    it('toggles leaf field on in include mode', () => {
      const onUpdate = vi.fn();
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"id": 1, "name": "test"}' onUpdate={onUpdate} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const leafCheckbox = checkboxes.find(cb => !cb.closest('.json-tree-row')?.querySelector('.jt-toggle'));
      if (leafCheckbox) {
        fireEvent.click(leafCheckbox);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('toggles leaf field off in include mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"id": 1, "name": "test"}'
          expectedFields={[{ jsonPath: 'id', expectedValue: '1' }, { jsonPath: 'name', expectedValue: '"test"' }]}
          onUpdate={onUpdate}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('Search functionality', () => {
    it('shows search input', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      const searchInput = screen.getByPlaceholderText('Search fields...');
      expect(searchInput).toBeInTheDocument();
    });

    it('shows select/deselect matched buttons when search has results', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      const searchInput = screen.getByPlaceholderText('Search fields...');
      fireEvent.change(searchInput, { target: { value: 'name' } });
      expect(screen.getByText(/Select Matched/)).toBeInTheDocument();
      expect(screen.getByText('Deselect Matched')).toBeInTheDocument();
    });

    it('selects matched fields on click', () => {
      const onUpdate = vi.fn();
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"name": "test", "id": 1}' onUpdate={onUpdate} />);
      const searchInput = screen.getByPlaceholderText('Search fields...');
      fireEvent.change(searchInput, { target: { value: 'name' } });
      fireEvent.click(screen.getByText(/Select Matched/));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: expect.arrayContaining([
          expect.objectContaining({ jsonPath: 'name' }),
        ]),
      });
    });

    it('Select Matched still runs when matched paths are already selected', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"name": "test", "id": 1}'
          expectedFields={[{ jsonPath: 'name', expectedValue: '"test"' }]}
          onUpdate={onUpdate}
        />
      );
      const searchInput = screen.getByPlaceholderText('Search fields...');
      fireEvent.change(searchInput, { target: { value: 'name' } });
      fireEvent.click(screen.getByText(/Select Matched/));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'name', expectedValue: '"test"' }],
      });
    });

    it('deselects matched fields on click', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"name": "test", "id": 1}'
          expectedFields={[{ jsonPath: 'name', expectedValue: '"test"' }, { jsonPath: 'id', expectedValue: '1' }]}
          onUpdate={onUpdate}
        />
      );
      const searchInput = screen.getByPlaceholderText('Search fields...');
      fireEvent.change(searchInput, { target: { value: 'name' } });
      fireEvent.click(screen.getByText('Deselect Matched'));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'id', expectedValue: '1' }],
      });
    });
  });

  describe('Exclude mode', () => {
    it('shows exclude hint when all excluded', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"id": 1}'
          selectiveMode="exclude"
          excludedPaths={['id']}
          expectedFields={[]}
        />
      );
      expect(screen.getByText(/All fields are currently excluded/)).toBeInTheDocument();
    });

    it('toggles field into excludedPaths in exclude mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"id": 1, "name": "test"}'
          selectiveMode="exclude"
          excludedPaths={[]}
          expectedFields={[
            { jsonPath: 'id', expectedValue: '1' },
            { jsonPath: 'name', expectedValue: '"test"' },
          ]}
          onUpdate={onUpdate}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          excludedPaths: expect.any(Array),
          expectedFields: expect.any(Array),
        }),
      );
    });

    it('toggles field out of excludedPaths (deselect) in exclude mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"id": 1, "name": "test"}'
          selectiveMode="exclude"
          excludedPaths={['id', 'name']}
          expectedFields={[]}
          onUpdate={onUpdate}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          excludedPaths: expect.any(Array),
          expectedFields: expect.any(Array),
        }),
      );
    });
  });

  describe('Rules view toggle', () => {
    it('shows List and Table view buttons when fields exist', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={SAMPLE_JSON}
          expectedFields={[{ jsonPath: 'id', expectedValue: '1' }]}
        />
      );
      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('switches to table view', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={ARRAY_JSON}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
            { jsonPath: 'offers[0].price', expectedValue: '100' },
            { jsonPath: 'offers[1].code', expectedValue: '"B2"' },
            { jsonPath: 'offers[1].price', expectedValue: '200' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('Table'));
      expect(screen.getByText('code')).toBeInTheDocument();
      expect(screen.getByText('price')).toBeInTheDocument();
    });

    it('auto-switches to table when array fields present', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={ARRAY_JSON}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
          ]}
        />
      );
      expect(screen.getByText('code')).toBeInTheDocument();
    });
  });

  describe('RulesTable rendering', () => {
    it('renders table with column headers', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={ARRAY_JSON}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
            { jsonPath: 'offers[0].price', expectedValue: '100' },
            { jsonPath: 'offers[1].code', expectedValue: '"B2"' },
            { jsonPath: 'offers[1].price', expectedValue: '200' },
          ]}
        />
      );
      expect(screen.getByText('code')).toBeInTheDocument();
      expect(screen.getByText('price')).toBeInTheDocument();
    });

    it('renders array row labels', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={ARRAY_JSON}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
            { jsonPath: 'offers[1].code', expectedValue: '"B2"' },
          ]}
        />
      );
      expect(screen.getByText('#0')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    it('renders cell values without quotes', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={ARRAY_JSON}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
          ]}
        />
      );
      expect(screen.getByText('A1')).toBeInTheDocument();
    });

    it('shows dash for missing cells', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson={ARRAY_JSON}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
            { jsonPath: 'offers[0].price', expectedValue: '100' },
            { jsonPath: 'offers[1].code', expectedValue: '"B2"' },
          ]}
        />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('uses Path as the table header when rows are not a uniform array index group', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"user": {"id": 1, "name": "x"}}'
          expectedFields={[
            { jsonPath: 'user.id', expectedValue: '1' },
            { jsonPath: 'user.name', expectedValue: '"x"' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('Table'));
      const pathHeaders = screen.getAllByText('Path');
      expect(pathHeaders.length).toBeGreaterThan(0);
    });

    it('renders a (root) row for json paths without a dot segment', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"id": 1, "name": "n"}'
          expectedFields={[
            { jsonPath: 'id', expectedValue: '1' },
            { jsonPath: 'name', expectedValue: '"n"' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('Table'));
      const table = screen.getByRole('table');
      expect(within(table).getAllByText('(root)').length).toBeGreaterThan(0);
    });

    it('uses plain row keys in the table when there is no shared array prefix', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"offers": [{"x": 1}], "meta": {"y": 2}}'
          expectedFields={[
            { jsonPath: 'offers[0].x', expectedValue: '1' },
            { jsonPath: 'meta.y', expectedValue: '2' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('Table'));
      const table = screen.getByRole('table');
      expect(within(table).getByText('offers[0]')).toBeInTheDocument();
      expect(within(table).getByText('meta')).toBeInTheDocument();
    });
  });

  describe('Textarea interaction', () => {
    it('calls onSampleJsonChange when textarea edited', () => {
      const onSampleJsonChange = vi.fn();
      render(<JsonPathBuilder {...defaultProps} onSampleJsonChange={onSampleJsonChange} />);
      const textarea = screen.getByPlaceholderText(/Paste JSON here/);
      fireEvent.change(textarea, { target: { value: '{"test": 1}' } });
      expect(onSampleJsonChange).toHaveBeenCalledWith('{"test": 1}');
    });
  });

  describe('TreeErrorBoundary', () => {
    it('renders children normally', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"ok": true}' />);
      expect(screen.getAllByText('ok').length).toBeGreaterThan(0);
    });

    it('shows recovery UI when the tree throws and restores on Retry', async () => {
      vi.resetModules();
      const tree = await import('../utils/jsonPathTreeUtils');
      const realGetAllPaths = tree.getAllPaths;
      let allowTree = false;
      const spy = vi.spyOn(tree, 'getAllPaths').mockImplementation((node) => {
        if (!allowTree) throw new Error('tree failure');
        return realGetAllPaths(node);
      });
      const { default: JsonPathBuilderFresh } = await import('./JsonPathBuilder');
      render(
        <JsonPathBuilderFresh
          {...defaultProps}
          sampleJson='{"a": 1}'
        />,
      );
      expect(screen.getByText(/Tree rendering error/)).toBeInTheDocument();
      allowTree = true;
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(screen.getAllByText('a').length).toBeGreaterThan(0);
      spy.mockRestore();
    });
  });

  describe('Tree expand/collapse and search filtering', () => {
    it('collapses a branch when the chevron is clicked', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson={SAMPLE_JSON} />);
      const toggles = document.querySelectorAll('.jt-toggle');
      expect(toggles.length).toBeGreaterThan(0);
      fireEvent.click(toggles[0] as HTMLElement);
      expect(toggles[0].className).toContain('jt-toggle--collapsed');
    });

    it('hides subtree nodes that do not match the search term', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"show": 1, "hide": 2}'
        />
      );
      fireEvent.change(screen.getByPlaceholderText('Search fields...'), {
        target: { value: 'show' },
      });
      expect(screen.getAllByText('show').length).toBeGreaterThan(0);
      expect(screen.queryByText('hide')).not.toBeInTheDocument();
    });
  });

  describe('Manual rule editing', () => {
    it('shows input for empty jsonPath field', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
        />
      );
      expect(screen.getByPlaceholderText('JSON Path (e.g. data.id)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Expected value')).toBeInTheDocument();
    });

    it('updates jsonPath on input change', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          onUpdate={onUpdate}
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
        />
      );
      fireEvent.change(screen.getByPlaceholderText('JSON Path (e.g. data.id)'), {
        target: { value: 'data.id' },
      });
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'data.id', expectedValue: '' }],
      });
    });

    it('updates expectedValue on input change', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          onUpdate={onUpdate}
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
        />
      );
      fireEvent.change(screen.getByPlaceholderText('Expected value'), {
        target: { value: '42' },
      });
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: '', expectedValue: '42' }],
      });
    });

    it('truncates long values in list view', () => {
      const longValue = '"' + 'x'.repeat(100) + '"';
      render(
        <JsonPathBuilder
          {...defaultProps}
          expectedFields={[{ jsonPath: 'data.long', expectedValue: longValue }]}
        />
      );
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });

    it('truncates long values in list view when the sample tree is present', () => {
      const longValue = '"' + 'y'.repeat(100) + '"';
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1}'
          expectedFields={[{ jsonPath: 'data.long', expectedValue: longValue }]}
        />
      );
      fireEvent.click(screen.getByText('List'));
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });
  });

  describe('Add Manual Rule with tree present', () => {
    it('shows Add Manual Rule in include mode with tree', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"a": 1}' />);
      expect(screen.getByText('+ Add Manual Rule')).toBeInTheDocument();
    });

    it('does not show Add Manual Rule in exclude mode with tree', () => {
      render(<JsonPathBuilder {...defaultProps} sampleJson='{"a": 1}' selectiveMode="exclude" />);
      expect(screen.queryByText('+ Add Manual Rule')).not.toBeInTheDocument();
    });

    it('adds manual rule with tree present', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1}'
          expectedFields={[{ jsonPath: 'a', expectedValue: '1' }]}
          onUpdate={onUpdate}
        />
      );
      fireEvent.click(screen.getByText('+ Add Manual Rule'));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [
          { jsonPath: 'a', expectedValue: '1' },
          { jsonPath: '', expectedValue: '' },
        ],
      });
    });

    it('renders editable path input for empty rule in tree mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1}'
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
          onUpdate={onUpdate}
        />
      );
      const pathInput = screen.getByPlaceholderText('JSON Path (e.g. data.id)');
      fireEvent.change(pathInput, { target: { value: 'b.c' } });
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'b.c', expectedValue: '' }],
      });
    });

    it('renders editable value input for empty value in tree mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1}'
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
          onUpdate={onUpdate}
        />
      );
      const valInput = screen.getByPlaceholderText('Expected value');
      fireEvent.change(valInput, { target: { value: '99' } });
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: '', expectedValue: '99' }],
      });
    });

    it('removes rule in tree mode with include', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"a": 1}'
          expectedFields={[
            { jsonPath: 'a', expectedValue: '1' },
            { jsonPath: 'b', expectedValue: '2' },
          ]}
          onUpdate={onUpdate}
        />
      );
      const removeButtons = screen.getAllByText('×');
      fireEvent.click(removeButtons[0]);
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'b', expectedValue: '2' }],
      });
    });

    it('shows overflow hint when more than 50 rules are listed with tree', () => {
      const many = Array.from({ length: 51 }, (_, i) => ({
        jsonPath: `k${i}`,
        expectedValue: `"v${i}"`,
      }));
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"x": 1}'
          expectedFields={many}
        />
      );
      fireEvent.click(screen.getByText('List'));
      expect(screen.getByText('...and 1 more')).toBeInTheDocument();
    });
  });

  describe('No-JSON fallback with fields', () => {
    it('shows List/Table toggle in fallback mode with fields', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          expectedFields={[{ jsonPath: 'data.id', expectedValue: '1' }]}
        />
      );
      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('switches to table view in fallback mode', () => {
      render(
        <JsonPathBuilder
          {...defaultProps}
          expectedFields={[
            { jsonPath: 'offers[0].code', expectedValue: '"A1"' },
            { jsonPath: 'offers[1].code', expectedValue: '"B2"' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('Table'));
      expect(screen.getByText('#0')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    it('removes field in fallback mode', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          onUpdate={onUpdate}
          expectedFields={[
            { jsonPath: 'data.id', expectedValue: '1' },
          ]}
        />
      );
      fireEvent.click(screen.getByText('×'));
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [],
      });
    });

    it('edits jsonPath in fallback mode for empty field', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          onUpdate={onUpdate}
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
        />
      );
      fireEvent.change(screen.getByPlaceholderText('JSON Path (e.g. data.id)'), {
        target: { value: 'new.path' },
      });
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: 'new.path', expectedValue: '' }],
      });
    });

    it('edits expectedValue in fallback mode for empty field', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          onUpdate={onUpdate}
          expectedFields={[{ jsonPath: '', expectedValue: '' }]}
        />
      );
      fireEvent.change(screen.getByPlaceholderText('Expected value'), {
        target: { value: 'hello' },
      });
      expect(onUpdate).toHaveBeenCalledWith({
        expectedFields: [{ jsonPath: '', expectedValue: 'hello' }],
      });
    });

    it('shows overflow hint when more than 50 rules are listed without sample JSON', () => {
      const many = Array.from({ length: 51 }, (_, i) => ({
        jsonPath: `p${i}`,
        expectedValue: `"z${i}"`,
      }));
      render(<JsonPathBuilder {...defaultProps} expectedFields={many} />);
      expect(screen.getByText('...and 1 more')).toBeInTheDocument();
    });
  });

  describe('Search in exclude mode', () => {
    it('selects matched in exclude mode adds to excludedPaths', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"name": "test", "id": 1}'
          selectiveMode="exclude"
          onUpdate={onUpdate}
        />
      );
      const searchInput = screen.getByPlaceholderText('Search fields...');
      fireEvent.change(searchInput, { target: { value: 'name' } });
      fireEvent.click(screen.getByText(/Select Matched/));
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          excludedPaths: expect.arrayContaining(['name']),
        }),
      );
    });

    it('deselects matched in exclude mode removes from excludedPaths', () => {
      const onUpdate = vi.fn();
      render(
        <JsonPathBuilder
          {...defaultProps}
          sampleJson='{"name": "test", "id": 1}'
          selectiveMode="exclude"
          excludedPaths={['name', 'id']}
          onUpdate={onUpdate}
        />
      );
      const searchInput = screen.getByPlaceholderText('Search fields...');
      fireEvent.change(searchInput, { target: { value: 'name' } });
      fireEvent.click(screen.getByText('Deselect Matched'));
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          excludedPaths: ['id'],
        }),
      );
    });
  });
});
