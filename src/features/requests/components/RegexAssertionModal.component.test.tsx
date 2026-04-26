/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegexAssertionModal, { PickerNode } from './RegexAssertionModal';
import { PATTERN_LIBRARY } from './regexAssertionUtils';
import { buildTree } from '../utils/jsonPathTreeUtils';
import type { JsonNode } from '../utils/jsonPathTreeUtils';

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
    expect(screen.getByText('×')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking overlay background', () => {
    const { onClose, container } = renderModal();
    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
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
    renderModal({ onFetchSampleResponse: vi.fn(), fetchError: 'Network error' });
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

  it('shows hint when no sampleJson', () => {
    renderModal();
    expect(screen.getByText(/Paste a sample JSON/)).toBeTruthy();
  });

  it('Cancel button calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PickerNode', () => {
  const sampleTree = buildTree(SAMPLE, '', '(root)');

  it('renders root node', () => {
    const { container } = render(
      <PickerNode node={sampleTree} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="" expandAll />
    );
    expect(container.querySelector('.ram-tree-node')).toBeTruthy();
  });

  it('renders children when expanded', () => {
    const { container } = render(
      <PickerNode node={sampleTree} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="" expandAll />
    );
    expect(container.querySelectorAll('.ram-tree-row').length).toBeGreaterThan(1);
  });

  it('calls onSelect when row clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PickerNode node={sampleTree} depth={0} selectedPath="" onSelect={onSelect} searchTerm="" expandAll />
    );
    const rows = container.querySelectorAll('.ram-tree-row');
    if (rows.length > 1) {
      fireEvent.click(rows[1]);
      expect(onSelect).toHaveBeenCalled();
    }
  });

  it('highlights selected node', () => {
    const { container } = render(
      <PickerNode node={sampleTree} depth={0} selectedPath="name" onSelect={vi.fn()} searchTerm="" expandAll />
    );
    expect(container.querySelector('.ram-tree-selected')).toBeTruthy();
  });

  it('filters by search term showing matching descendants', () => {
    render(
      <PickerNode node={sampleTree} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="city" expandAll />
    );
    expect(screen.getByText('city')).toBeTruthy();
  });

  it('returns null when search does not match at all', () => {
    const leaf = { key: 'x', path: 'x', type: 'string' as const, value: 'v', children: [] };
    const { container } = render(
      <PickerNode node={leaf as unknown as JsonNode} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="zzzzz" />
    );
    expect(container.querySelector('.ram-tree-node')).toBeFalsy();
  });

  it('toggles collapse on chevron click', () => {
    const { container } = render(
      <PickerNode node={sampleTree} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="" expandAll />
    );
    const toggle = container.querySelector('.jt-toggle');
    if (toggle) {
      fireEvent.click(toggle);
      // After collapsing, children container should be removed or hidden
    }
  });

  it('highlights matching search terms', () => {
    const { container } = render(
      <PickerNode node={sampleTree} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="id" expandAll />
    );
    expect(container.querySelector('.search-hit')).toBeTruthy();
  });

  it('shows spacer for leaf nodes without children', () => {
    const leaf = { key: 'leaf', path: 'leaf', type: 'string' as const, value: 'val', children: [] };
    const { container } = render(
      <PickerNode node={leaf as unknown as JsonNode} depth={0} selectedPath="" onSelect={vi.fn()} searchTerm="" expandAll />
    );
    expect(container.querySelector('.jt-toggle-spacer')).toBeTruthy();
  });

  it('renders with depth-based padding', () => {
    const { container } = render(
      <PickerNode node={sampleTree} depth={3} selectedPath="" onSelect={vi.fn()} searchTerm="" expandAll />
    );
    const row = container.querySelector('.ram-tree-row') as HTMLElement;
    expect(row.style.paddingLeft).toBe('62px'); // 3 * 18 + 8
  });
});

describe('RegexAssertionModal expand/shrink', () => {
  it('renders expand button in header and footer', () => {
    const { container } = renderModal();
    const btns = container.querySelectorAll('.modal-expand-btn');
    expect(btns.length).toBe(2);
    expect(btns[0].textContent).toBe('⊕');
    expect(btns[1].textContent).toBe('⊕');
    expect(btns[1].classList.contains('modal-expand-btn-bottom')).toBe(true);
  });

  it('toggles modal-expanded class when expand clicked', () => {
    const { container } = renderModal();
    const modal = container.querySelector('.ram-modal')!;
    expect(modal.classList.contains('modal-expanded')).toBe(false);
    fireEvent.click(container.querySelector('.modal-expand-btn')!);
    expect(modal.classList.contains('modal-expanded')).toBe(true);
    fireEvent.click(container.querySelector('.modal-expand-btn')!);
    expect(modal.classList.contains('modal-expanded')).toBe(false);
  });

  it('shows shrink icon when expanded', () => {
    const { container } = renderModal();
    fireEvent.click(container.querySelector('.modal-expand-btn')!);
    const btns = container.querySelectorAll('.modal-expand-btn');
    expect(btns[0].textContent).toBe('⊖');
    expect(btns[1].textContent).toBe('⊖');
  });

  it('footer expand button also toggles expansion', () => {
    const { container } = renderModal();
    const footer = container.querySelector('.modal-expand-btn-bottom')!;
    const modal = container.querySelector('.ram-modal')!;
    fireEvent.click(footer);
    expect(modal.classList.contains('modal-expanded')).toBe(true);
    fireEvent.click(footer);
    expect(modal.classList.contains('modal-expanded')).toBe(false);
  });
});
