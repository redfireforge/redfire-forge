/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractionEditor from './ExtractionEditor';
import type { Extraction } from '../../../shared/types';

// Mock ExpressionInput
vi.mock('../../workflow/components/expression/ExpressionInput', () => ({
  __esModule: true,
  default: ({ value, onChange, placeholder, disabled, className, 'aria-label': ariaLabel }: {
    value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; className?: string; 'aria-label'?: string;
  }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      data-testid="expression-input"
    />
  ),
}));

// Mock ExtractionPathPickerModal and ExtractionMapperModal
vi.mock('./ExtractionPathPickerModal', () => ({
  __esModule: true,
  default: ({ onApply, onClose }: { onApply: (expr: string) => void; onClose: () => void }) => (
    <div data-testid="picker-modal">
      <button onClick={() => onApply('$.data.id')}>Apply Path</button>
      <button onClick={onClose}>Close Picker</button>
    </div>
  ),
}));

vi.mock('./ExtractionMapperModal', () => ({
  __esModule: true,
  default: ({ onApply, onClose }: { onApply: (mapped: Extraction[]) => void; onClose: () => void }) => (
    <div data-testid="mapper-modal">
      <button onClick={() => onApply([{ name: 'mapped', source: 'body', expression: '$.x', fallback: '' }])}>Apply Map</button>
      <button onClick={onClose}>Close Mapper</button>
    </div>
  ),
}));

function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return { name: 'userId', source: 'body', expression: '$.data.id', fallback: '', ...overrides };
}

describe('ExtractionEditor', () => {
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

  // Fetch & Map section
  it('renders Fetch & Map button when fetchSample is provided', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: null };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.getByText('⚡ Fetch & Map')).toBeTruthy();
  });

  it('shows Fetching text when fetching', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: true, error: null };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect(screen.getByText('Fetching…')).toBeTruthy();
  });

  it('disables Fetch button when fetching', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: true, error: null };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    expect((screen.getByText('Fetching…') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows fetch error when present', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: 'Connection refused' };
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

  // Path picker modal
  it('opens path picker when pick button clicked', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'body' })]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    expect(screen.getByTestId('picker-modal')).toBeTruthy();
  });

  it('closes path picker on close', () => {
    render(<ExtractionEditor extractions={[makeExtraction({ source: 'body' })]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Browse JSON and pick a path'));
    fireEvent.click(screen.getByText('Close Picker'));
    expect(screen.queryByTestId('picker-modal')).toBeNull();
  });

  // Mapper modal
  it('opens mapper modal when Fetch & Map clicked', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: null };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    fireEvent.click(screen.getByText('⚡ Fetch & Map'));
    expect(screen.getByTestId('mapper-modal')).toBeTruthy();
  });

  it('applies mapper results', () => {
    const onChange = vi.fn();
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: null };
    render(<ExtractionEditor extractions={[]} onChange={onChange} fetchSample={fetchSample} />);
    fireEvent.click(screen.getByText('⚡ Fetch & Map'));
    fireEvent.click(screen.getByText('Apply Map'));
    expect(onChange).toHaveBeenCalledWith([{ name: 'mapped', source: 'body', expression: '$.x', fallback: '' }]);
  });

  it('closes mapper modal on close', () => {
    const fetchSample = { onFetch: vi.fn(), fetching: false, error: null };
    render(<ExtractionEditor extractions={[]} onChange={vi.fn()} fetchSample={fetchSample} />);
    fireEvent.click(screen.getByText('⚡ Fetch & Map'));
    fireEvent.click(screen.getByText('Close Mapper'));
    expect(screen.queryByTestId('mapper-modal')).toBeNull();
  });
});
