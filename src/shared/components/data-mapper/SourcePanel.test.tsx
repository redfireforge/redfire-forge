/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SourcePanel from './SourcePanel';
import type { MapperSource } from './types';

const sources: MapperSource[] = [
  { id: 's1', label: 'Response Body', sampleData: { name: 'Alice', age: 30 } },
  { id: 's2', label: 'Headers', sampleData: { 'Content-Type': 'application/json' } },
];

function renderPanel(overrides?: Partial<Parameters<typeof SourcePanel>[0]>) {
  const defaults = {
    sources,
    activeSourceId: 's1',
    sourceSampleOverrides: {},
    onSourceChange: vi.fn(),
    onDragStart: vi.fn(),
    onSourceSampleChange: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  const result = render(<SourcePanel {...props} />);
  return { ...result, props };
}

describe('SourcePanel – tree view', () => {
  it('renders source tree from sampleData', () => {
    renderPanel();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('age')).toBeTruthy();
  });

  it('shows source tabs for multiple sources', () => {
    renderPanel();
    expect(screen.getByText('Response Body')).toBeTruthy();
    expect(screen.getByText('Headers')).toBeTruthy();
  });

  it('shows empty state when no sampleData', () => {
    renderPanel({ sources: [{ id: 's1', label: 'Empty' }] });
    expect(screen.getByText(/No sample data/)).toBeTruthy();
  });

  it('shows guided empty-state actions when source is empty', () => {
    renderPanel({
      sources: [{ id: 's1', label: 'Empty', sampleData: undefined }],
      canFetch: true,
      onFetchSample: vi.fn(),
    });
    expect(screen.getByText('Paste JSON')).toBeTruthy();
    expect(screen.getByText('Fetch sample')).toBeTruthy();
  });

  it('uses sourceSampleOverrides over adapter data', () => {
    renderPanel({
      sourceSampleOverrides: { s1: { overridden: true, color: 'red' } },
    });
    expect(screen.getByText('overridden')).toBeTruthy();
    expect(screen.getByText('color')).toBeTruthy();
    expect(screen.queryByText('name')).toBeNull();
  });

  it('search filters tree nodes', () => {
    renderPanel();
    const searchInput = screen.getByPlaceholderText('Search fields…');
    fireEvent.change(searchInput, { target: { value: 'age' } });
    expect(screen.getByText('age')).toBeTruthy();
    expect(screen.queryByText('name')).toBeNull();
  });
});

describe('SourcePanel – paste JSON mode', () => {
  it('toggles paste mode on button click', () => {
    renderPanel();
    const pasteBtn = screen.getByLabelText('Paste JSON');
    fireEvent.click(pasteBtn);
    expect(screen.getByPlaceholderText(/Paste JSON/)).toBeTruthy();
    expect(screen.getByText('Apply')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('pre-fills textarea with current data when entering paste mode', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Alice');
  });

  it('applies valid JSON and calls onSourceSampleChange', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON/);
    fireEvent.change(textarea, { target: { value: '{"color":"blue"}' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(props.onSourceSampleChange).toHaveBeenCalledWith('s1', { color: 'blue' });
  });

  it('shows error for invalid JSON', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON/);
    fireEvent.change(textarea, { target: { value: '{bad json' } });
    fireEvent.click(screen.getByText('Apply'));
    const errorDiv = container.querySelector('.dm-paste-error');
    expect(errorDiv).toBeTruthy();
    expect(errorDiv?.textContent).toMatch(/Expected|Unexpected|JSON/i);
  });

  it('shows error for empty paste', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON/);
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(screen.getByText('Paste some JSON')).toBeTruthy();
  });

  it('cancel exits paste mode without applying', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('name')).toBeTruthy();
    expect(props.onSourceSampleChange).not.toHaveBeenCalled();
  });

  it('toggles back to tree view from paste mode', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    expect(screen.getByPlaceholderText(/Paste JSON/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Show tree view'));
    expect(screen.getByText('name')).toBeTruthy();
  });
});

describe('SourcePanel – fetch sample', () => {
  it('shows fetch button when canFetch is true', () => {
    renderPanel({ canFetch: true, onFetchSample: vi.fn() });
    expect(screen.getByLabelText('Fetch live sample')).toBeTruthy();
  });

  it('hides fetch button when canFetch is false', () => {
    renderPanel({ canFetch: false });
    expect(screen.queryByLabelText('Fetch live sample')).toBeNull();
  });

  it('calls onFetchSample when fetch button clicked', async () => {
    const onFetch = vi.fn().mockResolvedValue(undefined);
    renderPanel({ canFetch: true, onFetchSample: onFetch });
    fireEvent.click(screen.getByLabelText('Fetch live sample'));
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));
  });

  it('resets paste mode when activeSourceId changes', () => {
    const { rerender, props } = renderPanel({ activeSourceId: 's1' });
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    expect(screen.getByPlaceholderText(/Paste JSON here/)).toBeTruthy();

    rerender(<SourcePanel {...props} activeSourceId="s2" />);
    expect(screen.queryByPlaceholderText(/Paste JSON here/)).toBeNull();
    expect(screen.getByText('Content-Type')).toBeTruthy();
  });

  it('expand all shows all fields', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('age')).toBeTruthy();
  });

  it('collapse all still shows root-level fields', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Expand all'));
    fireEvent.click(screen.getByLabelText('Collapse all'));
    expect(screen.getByText('name')).toBeTruthy();
  });

  it('shows source tabs when multiple sources exist', () => {
    const sources = [
      { id: 's1', label: 'Source A', sampleData: { a: 1 } },
      { id: 's2', label: 'Source B', sampleData: { b: 2 } },
    ];
    renderPanel({ sources, activeSourceId: 's1' });
    expect(screen.getByText('Source A')).toBeTruthy();
    expect(screen.getByText('Source B')).toBeTruthy();
  });

  it('calls onSourceChange when a source tab is clicked', () => {
    const sources = [
      { id: 's1', label: 'Source A', sampleData: { a: 1 } },
      { id: 's2', label: 'Source B', sampleData: { b: 2 } },
    ];
    const onChange = vi.fn();
    renderPanel({ sources, activeSourceId: 's1', onSourceChange: onChange });
    fireEvent.click(screen.getByText('Source B'));
    expect(onChange).toHaveBeenCalledWith('s2');
  });

  it('pre-populates paste textarea with current sample data', () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON here/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Alice');
  });

  it('shows fetch error message when fetchError is set', () => {
    renderPanel({ fetchError: 'Network failure' });
    expect(screen.getByText('Network failure')).toBeTruthy();
  });

  it('shows empty state when no sample data', () => {
    const sources = [{ id: 's1', label: 'S', sampleData: undefined }];
    renderPanel({ sources });
    expect(screen.getByText(/No sample data/)).toBeTruthy();
  });

  it('opens paste mode from empty-state action', () => {
    const sources = [{ id: 's1', label: 'S', sampleData: undefined }];
    renderPanel({ sources });
    fireEvent.click(screen.getByText('Paste JSON'));
    expect(screen.getByPlaceholderText(/Paste JSON here/)).toBeTruthy();
  });

  it('passes searchInputRef to search input', () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement | null>;
    renderPanel({ searchInputRef: ref });
    expect(ref.current).toBeTruthy();
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('shows loading indicator while fetching', async () => {
    let resolver!: () => void;
    const onFetch = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolver = resolve; }));
    renderPanel({ canFetch: true, onFetchSample: onFetch });
    const fetchBtn = screen.getByLabelText('Fetch live sample');
    expect(fetchBtn.textContent).toBe('↻');
    fireEvent.click(fetchBtn);
    expect(fetchBtn.textContent).toBe('…');
    resolver();
    await waitFor(() => expect(fetchBtn.textContent).toBe('↻'));
  });

  it('handles string sampleData in togglePasteMode', () => {
    renderPanel({
      sources: [{ id: 's1', label: 'S', sampleData: '{"key":"value"}' }],
    });
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON here/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('key');
  });

  it('handles unparseable string sampleData in togglePasteMode gracefully', () => {
    renderPanel({
      sources: [{ id: 's1', label: 'S', sampleData: 'not json' }],
    });
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON here/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('hides expand/collapse buttons in paste mode', () => {
    renderPanel();
    expect(screen.getByLabelText('Expand all')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    expect(screen.queryByLabelText('Expand all')).toBeNull();
    expect(screen.queryByLabelText('Collapse all')).toBeNull();
  });

  it('does not show source tabs for single source', () => {
    const { container } = renderPanel({ sources: [{ id: 's1', label: 'Only', sampleData: { x: 1 } }] });
    expect(container.querySelector('.dm-source-tabs')).toBeNull();
  });

  it('clears paste error when typing in textarea', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByLabelText('Paste JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON here/);
    fireEvent.change(textarea, { target: { value: '{bad' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(container.querySelector('.dm-paste-error')).toBeTruthy();
    fireEvent.change(textarea, { target: { value: '{"good": true}' } });
    expect(container.querySelector('.dm-paste-error')).toBeNull();
  });

  it('shows empty state with no expand/collapse when tree is null and in paste mode', () => {
    renderPanel({ sources: [{ id: 's1', label: 'S', sampleData: null }] });
    expect(screen.getByText(/No sample data/)).toBeTruthy();
  });

  it('does not render search clear button when search is empty', () => {
    renderPanel();
    expect(screen.queryByText('×')).toBeNull();
  });

  it('clears search on × click', () => {
    renderPanel();
    const input = screen.getByPlaceholderText('Search fields…');
    fireEvent.change(input, { target: { value: 'name' } });
    expect(screen.getByText('×')).toBeTruthy();
    fireEvent.click(screen.getByText('×'));
    expect(input).toHaveProperty('value', '');
  });

  it('resets fetching state after successful fetch', async () => {
    const onFetch = vi.fn().mockResolvedValue(undefined);
    renderPanel({ canFetch: true, onFetchSample: onFetch });
    fireEvent.click(screen.getByLabelText('Fetch live sample'));
    await waitFor(() => expect(onFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('Fetch live sample').textContent).toBe('↻'));
  });

  it('does not call onFetchSample when not provided', async () => {
    renderPanel({ canFetch: true });
    const fetchBtn = screen.queryByLabelText('Fetch live sample');
    expect(fetchBtn).toBeTruthy();
    if (fetchBtn) {
      fireEvent.click(fetchBtn);
    }
  });

  it('toggles expanded path on tree node click', () => {
    const nestedSources: MapperSource[] = [
      { id: 's1', label: 'S', sampleData: { user: { name: 'Bob', age: 25 } } },
    ];
    renderPanel({ sources: nestedSources, activeSourceId: 's1' });
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(screen.getByText('name')).toBeTruthy();
    const collapseBtn = screen.getAllByLabelText('Collapse');
    if (collapseBtn.length > 1) {
      fireEvent.click(collapseBtn[collapseBtn.length - 1]);
    }
  });
});
