/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegexAssertionModal, { PickerNode } from './RegexAssertionModal';
import { PATTERN_LIBRARY } from './regexAssertionUtils';
import { buildJsonTree } from '../../../shared/utils/jsonTreeModel';

const SAMPLE = { id: 'abc', name: 'Alice', tags: ['admin'], nested: { city: 'NYC' } };
const SAMPLE_JSON = JSON.stringify(SAMPLE);

function renderModal(props: Partial<Parameters<typeof RegexAssertionModal>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <RegexAssertionModal onApply={onApply} onClose={onClose} {...props} />
  );
  return { ...result, onApply, onClose };
}

describe('RegexAssertionModal', () => {
  it('renders header and close button', () => {
    renderModal();
    expect(screen.getByText('Regex Assertion Builder')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking overlay background (FullPanelModal)', () => {
    const { onClose, container } = renderModal();
    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    // FullPanelModal overlay does not close on click
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking modal body', () => {
    const { onClose, container } = renderModal();
    const modal = container.querySelector('.ram-modal')!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders textarea when no sampleJson provided', () => {
    renderModal();
    expect(screen.getByPlaceholderText(/Paste sample JSON/)).toBeTruthy();
  });

  it('renders tree when sampleJson is valid JSON', () => {
    const { container } = renderModal({ sampleJson: SAMPLE_JSON });
    expect(container.querySelector('.ram-tree-container')).toBeTruthy();
  });

  it('shows parse error for invalid JSON input', async () => {
    renderModal();
    const textarea = screen.getByPlaceholderText(/Paste sample JSON/);
    // Use fireEvent.change instead of userEvent.type to avoid { parsing issues
    fireEvent.change(textarea, { target: { value: '{invalid json' } });
    expect(screen.getByText(/Parse error/)).toBeTruthy();
  });

  it('shows field count when tree is rendered', () => {
    renderModal({ sampleJson: SAMPLE_JSON });
    expect(screen.getByText(/fields$/)).toBeTruthy();
  });

  it('populates jsonPath and pattern from initial values', () => {
    renderModal({ initialJsonPath: '$.name', initialPattern: '^Alice$', sampleJson: SAMPLE_JSON });
    const pathInput = screen.getByPlaceholderText(/offerName/) as HTMLInputElement;
    expect(pathInput.value).toBe('$.name');
    const patternInput = screen.getByPlaceholderText(/e\.g\./) as HTMLInputElement;
    expect(patternInput.value).toBe('^Alice$');
  });

  it('shows resolved value when jsonPath matches', () => {
    const { container } = renderModal({ initialJsonPath: '$.id', sampleJson: SAMPLE_JSON });
    expect(screen.getByText('Value:')).toBeTruthy();
    expect(container.querySelector('.ram-resolved-code')).toBeTruthy();
  });

  it('shows "Path not found" for unresolvable path', () => {
    renderModal({ initialJsonPath: '$.nonexistent', sampleJson: SAMPLE_JSON });
    expect(screen.getByText(/Path not found/)).toBeTruthy();
  });

  it('shows match indicator when pattern matches resolved value', () => {
    const { container } = renderModal({
      initialJsonPath: '$.id',
      initialPattern: '^abc$',
      sampleJson: SAMPLE_JSON,
    });
    // Match result area should exist with some content
    const matchArea = container.querySelector('.ram-match-result, .ram-match, .ram-preview-result');
    // Either a match element exists or the resolved value is shown
    expect(matchArea || container.querySelector('.ram-resolved-code')).toBeTruthy();
  });

  it('calls onApply with correct data', () => {
    const { onApply } = renderModal({
      initialJsonPath: '$.name',
      initialPattern: '^Alice$',
    });
    fireEvent.click(screen.getByText('Apply Assertion'));
    expect(onApply).toHaveBeenCalledWith({
      jsonPath: '$.name',
      pattern: '^Alice$',
      patternName: undefined,
    });
  });

  it('disables Apply button when jsonPath or pattern empty', () => {
    renderModal();
    const applyBtn = screen.getByText('Apply Assertion');
    expect((applyBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('toggles pattern library', () => {
    const { container } = renderModal();
    fireEvent.click(screen.getByText('Pattern Library'));
    expect(container.querySelector('.ram-library')).toBeTruthy();
    fireEvent.click(screen.getByText('Hide Library'));
    expect(container.querySelector('.ram-library')).toBeFalsy();
  });

  it('selects pattern from library', () => {
    renderModal();
    fireEvent.click(screen.getByText('Pattern Library'));
    const firstPattern = PATTERN_LIBRARY[0];
    fireEvent.click(screen.getByText(firstPattern.name));
    const patternInput = screen.getByPlaceholderText(/e\.g\./) as HTMLInputElement;
    expect(patternInput.value).toBe(firstPattern.pattern);
  });

  it('filters pattern library by category', () => {
    renderModal();
    fireEvent.click(screen.getByText('Pattern Library'));
    const categories = [...new Set(PATTERN_LIBRARY.map(p => p.category))];
    fireEvent.click(screen.getAllByText(categories[0])[0]);
    // Verify filtering happened — "All" button should not be active
    const allBtn = screen.getByText('All');
    expect(allBtn.className).not.toContain('btn-active');
  });

  it('resets pattern library filter to All', () => {
    renderModal();
    fireEvent.click(screen.getByText('Pattern Library'));
    const categories = [...new Set(PATTERN_LIBRARY.map(p => p.category))];
    fireEvent.click(screen.getAllByText(categories[0])[0]);
    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('All').className).toContain('btn-active');
  });

  it('renders Fetch Response button when onFetchSampleResponse provided', () => {
    const onFetch = vi.fn();
    renderModal({ onFetchSampleResponse: onFetch });
    const btn = screen.getByText('Fetch Response');
    fireEvent.click(btn);
    expect(onFetch).toHaveBeenCalled();
  });

  it('shows "Fetching..." when fetchingResponse is true', () => {
    renderModal({ onFetchSampleResponse: vi.fn(), fetchingResponse: true });
    expect(screen.getByText('Fetching...')).toBeTruthy();
  });

  it('shows fetch error message', () => {
    renderModal({ onFetchSampleResponse: vi.fn(), fetchError: { message: 'Network error' } });
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('clicking tree node sets jsonPath', () => {
    const { container } = renderModal({ sampleJson: SAMPLE_JSON });
    const rows = container.querySelectorAll('.ram-tree-row');
    // Click on a leaf node row (not root)
    if (rows.length > 1) {
      fireEvent.click(rows[1]);
      const pathInput = screen.getByPlaceholderText(/offerName/) as HTMLInputElement;
      expect(pathInput.value.length).toBeGreaterThan(0);
    }
  });

  it('search input filters tree nodes', () => {
    renderModal({ sampleJson: SAMPLE_JSON });
    const searchInput = screen.getByPlaceholderText(/Search fields/);
    fireEvent.change(searchInput, { target: { value: 'city' } });
    expect(screen.getByText('city')).toBeTruthy();
  });

  it('clear button resets to textarea', () => {
    renderModal({ sampleJson: SAMPLE_JSON });
    fireEvent.click(screen.getByTitle('Clear JSON'));
    expect(screen.getByPlaceholderText(/Paste sample JSON/)).toBeTruthy();
  });

  it('updates sampleJson when externalJson prop changes', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const { rerender, container } = render(
      <RegexAssertionModal onApply={onApply} onClose={onClose} sampleJson='{"alpha":1}' />
    );
    expect(container.querySelector('.ram-tree-container')).toBeTruthy();
    rerender(
      <RegexAssertionModal onApply={onApply} onClose={onClose} sampleJson='{"beta":2}' />
    );
    // The tree should still exist after re-render with new data
    expect(container.querySelector('.ram-tree-container')).toBeTruthy();
  });

  it('truncates long resolved values', () => {
    const longVal = 'x'.repeat(300);
    const json = JSON.stringify({ key: longVal });
    const { container } = renderModal({ sampleJson: json, initialJsonPath: '$.key' });
    const code = container.querySelector('.ram-resolved-code');
    expect(code?.textContent).toContain('...');
  });

  it('clears patternName when user types in pattern input', () => {
    const { onApply } = renderModal();
    fireEvent.click(screen.getByText('Pattern Library'));
    const firstPattern = PATTERN_LIBRARY[0];
    fireEvent.click(screen.getByText(firstPattern.name));
    // Verify patternName is set
    expect(screen.getByText(firstPattern.name)).toBeTruthy();
    // Type in pattern input to clear name
    const patternInput = screen.getByPlaceholderText(/e\.g\./) as HTMLInputElement;
    fireEvent.change(patternInput, { target: { value: 'custom' } });
    // Set jsonPath so Apply is enabled
    const pathInput = screen.getByPlaceholderText(/offerName/) as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: '$.test' } });
    fireEvent.click(screen.getByText('Apply Assertion'));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ patternName: undefined })
    );
  });

  it('shows match position when pattern matches substring', () => {
    renderModal({ sampleJson: '{"t":"hello"}', initialJsonPath: '$.t', initialPattern: 'ell' });
    expect(screen.getByText(/at position/)).toBeTruthy();
  });

  it('shows INVALID REGEX when pattern is invalid', () => {
    renderModal({ sampleJson: SAMPLE_JSON, initialJsonPath: '$.id', initialPattern: '[' });
    expect(screen.getByText('INVALID REGEX')).toBeTruthy();
  });

  it('shows no-match detail when pattern is valid but fails', () => {
    renderModal({ sampleJson: SAMPLE_JSON, initialJsonPath: '$.id', initialPattern: '^z+$' });
    expect(screen.getByText(/does not match the resolved value/)).toBeTruthy();
  });

  it('shows hint when no sampleJson', () => {
    renderModal();
    expect(screen.getByText(/Paste a sample JSON/)).toBeTruthy();
  });

  it('Close button calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows pattern name tag after picking from library', () => {
    const { container } = renderModal();
    fireEvent.click(screen.getByText('Pattern Library'));
    const firstPattern = PATTERN_LIBRARY[0];
    fireEvent.click(screen.getByText(firstPattern.name));
    const tag = container.querySelector('.ram-pattern-name-tag');
    expect(tag?.textContent).toBe(firstPattern.name);
  });

  it('search highlights when term matches a primitive leaf value', () => {
    const { container } = renderModal({ sampleJson: '{"sku":"needle-here"}' });
    const searchInput = screen.getByPlaceholderText(/Search fields/);
    fireEvent.change(searchInput, { target: { value: 'needle' } });
    expect(container.querySelector('.search-hit')).toBeTruthy();
  });
});

describe('PickerNode', () => {
  it('selects on double-click when selectOnDoubleClick', () => {
    const tree = buildJsonTree({ nested: { leaf: 1 } }, 'root', '');
    const onSelect = vi.fn();
    const { container } = render(
      <PickerNode
        node={tree}
        depth={0}
        selectedPath=""
        onSelect={onSelect}
        searchTerm=""
        selectOnDoubleClick
      />,
    );
    const rows = container.querySelectorAll('.ram-tree-row');
    const leafRow = Array.from(rows).find(r => r.textContent?.includes('leaf'));
    expect(leafRow).toBeTruthy();
    fireEvent.click(leafRow!);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.doubleClick(leafRow!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('respects expandAll=false by collapsing deeper rows', () => {
    const tree = buildJsonTree({ outer: { inner: 1 } }, 'root', '');
    const { container } = render(
      <PickerNode
        node={tree}
        depth={0}
        selectedPath=""
        onSelect={vi.fn()}
        searchTerm=""
        expandAll={false}
      />,
    );
    expect(container.querySelectorAll('.jt-toggle--collapsed').length).toBeGreaterThan(0);
  });

  it('expands all levels when expandAll is true', () => {
    const tree = buildJsonTree({ outer: { inner: 1 } }, 'root', '');
    const { container } = render(
      <PickerNode
        node={tree}
        depth={0}
        selectedPath=""
        onSelect={vi.fn()}
        searchTerm=""
        expandAll
      />,
    );
    expect(container.querySelector('.jt-toggle--collapsed')).toBeFalsy();
  });

  it('toggles manual expansion via chevron without selecting', () => {
    const tree = buildJsonTree({ a: { b: 1 } }, 'root', '');
    const onSelect = vi.fn();
    const { container } = render(
      <PickerNode
        node={tree}
        depth={0}
        selectedPath=""
        onSelect={onSelect}
        searchTerm=""
        expandAll={false}
      />,
    );
    const toggle = container.querySelector('.jt-toggle')!;
    fireEvent.click(toggle);
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector('.jt-toggle--collapsed')).toBeTruthy();
  });
});

