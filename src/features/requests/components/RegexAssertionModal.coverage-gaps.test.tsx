/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegexAssertionModal from './RegexAssertionModal';

const SAMPLE_JSON = JSON.stringify({ id: 'abc', nested: { city: 'NYC' }, tags: ['admin'] });

describe('RegexAssertionModal coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('collapses and expands tree nodes via chevron toggle', () => {
    const { container } = render(
      <RegexAssertionModal onApply={vi.fn()} onClose={vi.fn()} sampleJson={SAMPLE_JSON} />,
    );
    const toggle = container.querySelector('.jt-toggle');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);
    expect(container.querySelector('.jt-toggle--collapsed')).toBeTruthy();
    fireEvent.click(toggle!);
    expect(container.querySelector('.jt-toggle--collapsed')).toBeNull();
  });

  it('hides tree nodes that do not match search', () => {
    const { container } = render(
      <RegexAssertionModal onApply={vi.fn()} onClose={vi.fn()} sampleJson={SAMPLE_JSON} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search fields/), { target: { value: 'zzzz-no-match' } });
    expect(container.querySelectorAll('.ram-tree-row').length).toBe(0);
  });

  it('matches search against primitive leaf values', () => {
    const { container } = render(
      <RegexAssertionModal onApply={vi.fn()} onClose={vi.fn()} sampleJson='{"sku":"needle-value"}' />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search fields/), { target: { value: 'needle' } });
    expect(container.querySelector('.search-hit')).toBeTruthy();
  });

  it('shows generic parse error when JSON.parse throws a non-Error', () => {
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'bad';
    });
    render(<RegexAssertionModal onApply={vi.fn()} onClose={vi.fn()} sampleJson='{"x":1}' />);
    expect(screen.getByText('Parse error: Invalid JSON')).toBeTruthy();
  });

  it('collapse mode keeps only top-level nodes expanded initially', () => {
    const { container } = render(
      <RegexAssertionModal
        onApply={vi.fn()}
        onClose={vi.fn()}
        sampleJson={SAMPLE_JSON}
        treeExpandAll={false}
      />,
    );
    expect(container.querySelector('.jt-toggle--collapsed')).toBeTruthy();
  });

  it('prefixes jsonPath with $ when selecting a path without dollar prefix', () => {
    const { container } = render(
      <RegexAssertionModal
        onApply={vi.fn()}
        onClose={vi.fn()}
        sampleJson={SAMPLE_JSON}
        selectPathOnDoubleClick
      />,
    );
    const cityRow = Array.from(container.querySelectorAll('.ram-tree-row'))
      .find((row) => row.textContent?.includes('city'));
    expect(cityRow).toBeTruthy();
    fireEvent.doubleClick(cityRow!);
    const pathInput = screen.getByPlaceholderText(/offerName/) as HTMLInputElement;
    expect(pathInput.value.startsWith('$.')).toBe(true);
  });

  it('keeps jsonPath when selected node already uses $ prefix', () => {
    render(
      <RegexAssertionModal
        onApply={vi.fn()}
        onClose={vi.fn()}
        sampleJson='{"id":"x"}'
        initialJsonPath="$.id"
      />,
    );
    const pathInput = screen.getByPlaceholderText(/offerName/) as HTMLInputElement;
    expect(pathInput.value).toBe('$.id');
  });

  it('marks mapped paths in the tree when mappedPaths is provided', () => {
    const { container } = render(
      <RegexAssertionModal
        onApply={vi.fn()}
        onClose={vi.fn()}
        sampleJson={SAMPLE_JSON}
        mappedPaths={new Set(['$.nested.city'])}
      />,
    );
    expect(container.querySelector('.ram-tree-mapped .emm-mapped-check')).toBeTruthy();
  });
});
