/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractionEditor from './ExtractionEditor';
import type { Extraction } from '../../../shared/types';

const extractionAdapterOptsRef = vi.hoisted(() => ({
  current: [] as Array<{ fetchSampleData?: () => Promise<unknown> }>,
}));

// Mock ExpressionInput
vi.mock('../../workflow/components/expression/ExpressionInput', () => ({
  __esModule: true,
  default: ({ value, onChange, placeholder, disabled, className, 'aria-label': ariaLabel, variableHints = [] }: {
    value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; className?: string; 'aria-label'?: string;
    variableHints?: unknown[];
  }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      data-testid="expression-input"
      data-hint-count={variableHints.length}
    />
  ),
}));


// Mock DataMapperModal
vi.mock('../../../shared/components/data-mapper', () => ({
  DataMapperModal: ({
    onSave,
    onCancel,
    initialData,
  }: {
    onSave: (mapped: Extraction[]) => void;
    onCancel: () => void;
    initialData?: Extraction[];
  }) => (
    <div data-testid="data-mapper-modal" data-mode={initialData && initialData.length === 1 ? 'picker' : 'mapper'}>
      <button onClick={() => onSave([{ name: 'mapped', source: 'body', expression: '$.x' }])}>Apply Map</button>
      <button onClick={() => {
        if (initialData && initialData.length === 1) {
          onSave([{ ...initialData[0], expression: '$.data.id' }]);
        }
      }}>Apply Path</button>
      <button onClick={onCancel}>Close Modal</button>
    </div>
  ),
  createExtractionAdapter: (opts: { fetchSampleData?: () => Promise<unknown> }) => {
    extractionAdapterOptsRef.current.push(opts);
    return {
      contextId: 'extraction',
      title: 'Test',
      sources: [{ id: 'response-body', label: 'Response Body', sampleData: undefined }],
      target: { label: 'Variables', sampleData: undefined, allowCustomFields: true },
      serialize: (m: unknown[]) => m,
      deserialize: (e: unknown[]) => e,
    };
  },
  splitExtractions: (all: Extraction[]) => ({
    body: all.filter((e: Extraction) => e.source === 'body'),
    nonBody: all.filter((e: Extraction) => e.source !== 'body'),
  }),
}));

function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return { name: 'userId', source: 'body', expression: '$.data.id', fallback: '', ...overrides };
}

describe('ExtractionEditor', () => {
  beforeEach(() => {
    extractionAdapterOptsRef.current = [];
  });

  it('invokes fetchSample.onFetch when adapter fetchSampleData runs', async () => {
    const onFetch = vi.fn().mockResolvedValue(undefined);
    render(
      <ExtractionEditor
        extractions={[makeExtraction()]}
        onChange={vi.fn()}
        fetchSample={{ onFetch, fetching: false, error: null }}
      />,
    );
    const fn = extractionAdapterOptsRef.current.map(o => o.fetchSampleData).find(Boolean);
    expect(fn).toBeDefined();
    await fn!();
    expect(onFetch).toHaveBeenCalled();
  });

  it('clears picker index when extractions shrink below picker row', () => {
    const ext0 = makeExtraction({ name: 'a' });
    const ext1 = makeExtraction({ name: 'b', expression: '$.y' });
    const { rerender } = render(<ExtractionEditor extractions={[ext0, ext1]} onChange={vi.fn()} />);
    const pickBtns = screen.getAllByTitle('Browse JSON and pick a path');
    fireEvent.click(pickBtns[1]);
    expect(screen.getByTestId('data-mapper-modal').getAttribute('data-mode')).toBe('picker');
    rerender(<ExtractionEditor extractions={[ext0]} onChange={vi.fn()} />);
    expect(screen.queryByTestId('data-mapper-modal')).toBeNull();
  });

  it('renders empty state when no extractions', () => {
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/No extractions configured/)).toBeTruthy();
  });

  it('renders hint text about variables', () => {
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/Extract response values/)).toBeTruthy();
  });

  it('renders Add Extraction button', () => {
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} />);
    expect(screen.getByText('+ Add Extraction')).toBeTruthy();
  });

  it('adds an extraction when Add button clicked', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Extraction'));
    expect(onChange).toHaveBeenCalledWith([{ name: '', source: 'body', expression: '', fallback: '' }]);
  });

  it('renders extraction rows with table headers', () => {
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={vi.fn()} />);
    expect(screen.getByText('Variable')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Expression')).toBeTruthy();
    expect(screen.getByText('Fallback')).toBeTruthy();
  });

  it('renders variable name input', () => {
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('userId')).toBeTruthy();
  });

  it('updates variable name on change', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('userId'), { target: { value: 'newVar' } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'newVar' })]);
  });

  it('strips curly braces from variable name', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('userId'), { target: { value: '{{bad}}' } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'bad' })]);
  });

  it('renders source select with Body, Header, Status options', () => {
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={vi.fn()} />);
    const select = screen.getByLabelText('Source') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toEqual(['body', 'header', 'status']);
  });

  it('updates source on change', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'header' } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ source: 'header' })]);
  });

  it('removes extraction when delete button clicked', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove extraction 1'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders multiple extraction rows', () => {
    const extractions = [makeExtraction(), makeExtraction({ name: 'token', expression: '$.token' })];
    render(<ExtractionEditor extractions={extractions} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('userId')).toBeTruthy();
    expect(screen.getByDisplayValue('token')).toBeTruthy();
  });

  it('renders pick button for body source extractions', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'body' })]} onChange={vi.fn()} />);
    expect(screen.getByTitle('Browse JSON and pick a path')).toBeTruthy();
  });

  it('does not render pick button for header source', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'header' })]} onChange={vi.fn()} />);
    expect(screen.queryByTitle('Browse JSON and pick a path')).toBeNull();
  });

  it('does not render pick button for status source', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'status' })]} onChange={vi.fn()} />);
    expect(screen.queryByTitle('Browse JSON and pick a path')).toBeNull();
  });

  it('does not show empty state when extractions exist', () => {
    render(<ExtractionEditor extractions={[makeExtraction()]} onChange={vi.fn()} />);
    expect(screen.queryByText(/No extractions configured/)).toBeNull();
  });

  // Visual Mapper section
  it('renders Visual Mapper button always', () => {
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} />);
    expect(screen.getByText('⚡ Visual Mapper')).toBeTruthy();
  });

  it('renders Visual Mapper button with fetchSample', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: null };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.getByText('⚡ Visual Mapper')).toBeTruthy();
  });

  it('shows fetch error when present', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: { message: 'Connection refused' } };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('shows resolved URL when host info is available', () => {
    const fetchSample = {
      onFetch: vi.fn(),
      fetching: false,
      error: null,
      host: { enabled: false, resolvedBaseUrl: 'http://api.example.com' },
    };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.getByText('http://api.example.com')).toBeTruthy();
  });

  it('does not show resolved URL when host is enabled', () => {
    const fetchSample = {
      onFetch: vi.fn(),
      fetching: false,
      error: null,
      host: { enabled: true, resolvedBaseUrl: 'http://api.example.com' },
    };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.queryByText('http://api.example.com')).toBeNull();
  });

  // Drag and drop
  it('applies dragging class on drag start', () => {
    const { container } = render(<ExtractionEditor extractions={[makeExtraction(), makeExtraction({ name: 'b' })]} onChange={vi.fn()} />);
    const rows = container.querySelectorAll('.ext-row');
    fireEvent.dragStart(rows[0]);
    expect(rows[0].classList.contains('ext-row-dragging')).toBe(true);
  });

  it('applies dragover class on drag over', () => {
    const { container } = render(<ExtractionEditor extractions={[makeExtraction(), makeExtraction({ name: 'b' })]} onChange={vi.fn()} />);
    const rows = container.querySelectorAll('.ext-row');
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    expect(rows[1].classList.contains('ext-row-dragover')).toBe(true);
  });

  it('reorders on drop', () => {
    const onChange = vi.fn();
    const ext1 = makeExtraction({ name: 'first' });
    const ext2 = makeExtraction({ name: 'second' });
    const { container } = render(<ExtractionEditor extractions={[ext1, ext2]} onChange={onChange} />);
    const rows = container.querySelectorAll('.ext-row');
    fireEvent.dragStart(rows[0]);
    fireEvent.drop(rows[1]);
    expect(onChange).toHaveBeenCalledWith([ext2, ext1]);
  });

  it('clears drag state on drag end', () => {
    const { container } = render(<ExtractionEditor extractions={[makeExtraction(), makeExtraction({ name: 'b' })]} onChange={vi.fn()} />);
    const rows = container.querySelectorAll('.ext-row');
    fireEvent.dragStart(rows[0]);
    fireEvent.dragEnd(rows[0]);
    expect(rows[0].classList.contains('ext-row-dragging')).toBe(false);
  });

  // Path picker (DataMapperModal in picker mode)
  it('opens data mapper modal when pick button clicked', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'body' })]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    expect(screen.getByTestId('data-mapper-modal')).toBeTruthy();
  });

  it('closes data mapper on cancel', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'body' })]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    fireEvent.click(screen.getByText('Close Modal'));
    expect(screen.queryByTestId('data-mapper-modal')).toBeNull();
  });

  // Full mapper modal
  it('opens mapper modal when Visual Mapper clicked', () => {
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('⚡ Visual Mapper'));
    expect(screen.getByTestId('data-mapper-modal')).toBeTruthy();
  });

  it('applies mapper results', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('⚡ Visual Mapper'));
    fireEvent.click(screen.getByText('Apply Map'));
    expect(onChange).toHaveBeenCalledWith([{ name: 'mapped', source: 'body', expression: '$.x' }]);
  });

  it('closes mapper modal on cancel', () => {
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('⚡ Visual Mapper'));
    fireEvent.click(screen.getByText('Close Modal'));
    expect(screen.queryByTestId('data-mapper-modal')).toBeNull();
  });

  it('suggests variable name when applying path and name is empty', () => {
    const onChange = vi.fn();
    render(
      <ExtractionEditor
        extractions={[{ name: '', source: 'body', expression: '', fallback: '' }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    fireEvent.click(screen.getByText('Apply Path'));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ expression: '$.data.id' }),
    ]);
  });

  it('does not reorder when dropping on same row', () => {
    const onChange = vi.fn();
    const ext1 = makeExtraction({ name: 'only' });
    const { container } = render(<ExtractionEditor extractions={[ext1]} onChange={onChange} />);
    const row = container.querySelector('.ext-row')!;
    fireEvent.dragStart(row);
    fireEvent.drop(row);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses first source hint when source value is invalid', () => {
    render(
      <ExtractionEditor
        extractions={[makeExtraction({ source: 'not-a-real-source' as 'body' })]}
        onChange={vi.fn()}
      />,
    );
    const exprInputs = screen.getAllByLabelText('Expression') as HTMLInputElement[];
    expect(exprInputs[0].placeholder).toBe('$.data.id');
  });

  it('clears fallback to undefined when expression field emptied', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[makeExtraction({ fallback: 'x' })]} onChange={onChange} />);
    const fb = screen.getByLabelText('Fallback');
    fireEvent.change(fb, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ fallback: undefined })]);
  });

  it('updates expression field value', () => {
    const onChange = vi.fn();
    render(<ExtractionEditor extractions={[makeExtraction({ expression: '$.a' })]} onChange={onChange} />);
    const [expressionRow] = screen.getAllByLabelText('Expression');
    fireEvent.change(expressionRow, { target: { value: '$.b' } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ expression: '$.b' })]);
  });

  it('does not show resolved URL when host is disabled but has no base URL', () => {
    const fetchSample = {
      onFetch: vi.fn(),
      fetching: false,
      error: null,
      host: { enabled: false, resolvedBaseUrl: '' },
    };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.queryByText(/Target:/)).toBeNull();
  });

  it('opens data mapper modal with empty sample body', () => {
    render(
      <ExtractionEditor
        extractions={[makeExtraction({ source: 'body' })]}
        onChange={vi.fn()}
        sampleResponseBody="   "
      />,
    );
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    expect(screen.getByTestId('data-mapper-modal')).toBeTruthy();
  });

  it('opens data mapper modal with non-empty sample JSON', () => {
    const body = '{"x":1}';
    render(
      <ExtractionEditor
        extractions={[makeExtraction({ source: 'body' })]}
        onChange={vi.fn()}
        sampleResponseBody={body}
      />,
    );
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    expect(screen.getByTestId('data-mapper-modal')).toBeTruthy();
  });
});
