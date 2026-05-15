/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DslReferencePanel from './DslReferencePanel';

describe('DslReferencePanel', () => {
  it('renders the panel with DSL Reference title', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);
    expect(screen.getByText('DSL Reference')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);
    expect(screen.getByPlaceholderText(/filter operators/i)).toBeInTheDocument();
  });

  it('renders default-open sections (Equality, Comparison, String)', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);
    expect(screen.getByText('Equality')).toBeInTheDocument();
    expect(screen.getByText('Comparison')).toBeInTheDocument();
    expect(screen.getByText('String')).toBeInTheDocument();
    expect(screen.getByText('equals')).toBeInTheDocument();
    expect(screen.getByText('contains')).toBeInTheDocument();
  });

  it('collapses a section when its header is clicked', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);
    expect(screen.getByText('equals')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Equality'));
    expect(screen.queryByText('Exact value match')).not.toBeInTheDocument();
  });

  it('expands a collapsed section when its header is clicked', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.queryByText('ASSERT')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Custom Predicates'));
    expect(screen.getByText('ASSERT')).toBeInTheDocument();
  });

  it('filters entries by search query', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'regex' } });

    expect(screen.getByText('regex')).toBeInTheDocument();
    expect(screen.queryByText('between')).not.toBeInTheDocument();
  });

  it('shows empty state when search has no results', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText(/no matching operators/i)).toBeInTheDocument();
  });

  it('calls onInsert with the example when insert button is clicked', () => {
    const onInsert = vi.fn();
    render(<DslReferencePanel onInsert={onInsert} />);

    const insertButtons = screen.getAllByText('Insert');
    fireEvent.click(insertButtons[0]);
    expect(onInsert).toHaveBeenCalledWith('status  equals  "active"');
  });

  it('renders all 10 section headers', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.getByText('Equality')).toBeInTheDocument();
    expect(screen.getByText('Comparison')).toBeInTheDocument();
    expect(screen.getByText('String')).toBeInTheDocument();
    expect(screen.getByText('Boolean & Null')).toBeInTheDocument();
    expect(screen.getByText('Type & Existence')).toBeInTheDocument();
    expect(screen.getByText('Set Membership')).toBeInTheDocument();
    expect(screen.getByText('Collection')).toBeInTheDocument();
    expect(screen.getByText('Custom Predicates')).toBeInTheDocument();
    expect(screen.getByText('Modifiers')).toBeInTheDocument();
    expect(screen.getByText('Syntax Guide')).toBeInTheDocument();
  });

  it('search auto-expands collapsed sections', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.queryByText('NOT')).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'NOT' } });

    expect(screen.getByText('NOT')).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'regex' } });

    expect(screen.queryByText('equals')).not.toBeInTheDocument();

    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);

    expect(screen.getByText('equals')).toBeInTheDocument();
  });

  it('expand all / collapse all buttons work', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.queryByText('ASSERT')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand all sections'));
    expect(screen.getByText('ASSERT')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Collapse all sections'));
    expect(screen.queryByText('ASSERT')).not.toBeInTheDocument();
    expect(screen.queryByText('Exact value match')).not.toBeInTheDocument();
  });

  it('shows description for each entry', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);
    expect(screen.getByText('Exact value match')).toBeInTheDocument();
    expect(screen.getByText('Substring match')).toBeInTheDocument();
  });

  it('each entry has a code block with syntax', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);
    const codeBlocks = container.querySelectorAll('.vr-ref-code-block code');
    expect(codeBlocks.length).toBeGreaterThan(0);
    expect(codeBlocks[0].textContent).toContain('path');
  });

  it('filters by description text too', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'prefix' } });

    expect(screen.getByText('starts_with')).toBeInTheDocument();
  });

  it('displays total count badge in header', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);
    const badge = container.querySelector('.vr-ref-header-count');
    expect(badge).toBeInTheDocument();
    expect(Number(badge!.textContent)).toBeGreaterThan(30);
  });

  // ── Copy button ──

  it('copies syntax to clipboard when copy button is clicked', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<DslReferencePanel onInsert={vi.fn()} />);

    const copyButtons = screen.getAllByTitle('Copy syntax');
    fireEvent.click(copyButtons[0]);

    expect(writeText).toHaveBeenCalledWith('path  equals  "value"');
  });

  // ── Keyboard navigation on section headers ──

  it('toggles section on Enter key press', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.getByText('equals')).toBeInTheDocument();

    const header = screen.getByText('Equality').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: 'Enter' });

    expect(screen.queryByText('Exact value match')).not.toBeInTheDocument();
  });

  it('toggles section on Space key press', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.getByText('equals')).toBeInTheDocument();

    const header = screen.getByText('Equality').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: ' ' });

    expect(screen.queryByText('Exact value match')).not.toBeInTheDocument();
  });

  it('does not toggle section on other keys', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const header = screen.getByText('Equality').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: 'Tab' });

    expect(screen.getByText('equals')).toBeInTheDocument();
  });

  // ── Search matching by syntax and example ──

  it('filters by syntax text', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'tolerance' } });

    expect(screen.getByText('close_to')).toBeInTheDocument();
  });

  it('filters by example text', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'usr_' } });

    expect(screen.getByText('starts_with')).toBeInTheDocument();
  });

  // ── Empty state includes search query ──

  it('empty state includes the search query text', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'zzznope' } });

    expect(screen.getByText(/zzznope/)).toBeInTheDocument();
  });

  // ── Search clear button visibility ──

  it('does not show clear button when search is empty', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  // ── Section counts ──

  it('shows section entry counts', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);

    const counts = container.querySelectorAll('.vr-ref-count');
    expect(counts.length).toBe(10);
    expect(Number(counts[0].textContent)).toBe(2); // Equality has 2 entries
  });

  // ── Aria labels ──

  it('has role="complementary" and aria-label on the panel', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);
    const panel = container.querySelector('[role="complementary"][aria-label="DSL Reference"]');
    expect(panel).toBeTruthy();
  });

  it('section headers have aria-expanded attribute', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const equalityHeader = screen.getByText('Equality').closest('[role="button"]')!;
    expect(equalityHeader.getAttribute('aria-expanded')).toBe('true');

    const booleanHeader = screen.getByText('Boolean & Null').closest('[role="button"]')!;
    expect(booleanHeader.getAttribute('aria-expanded')).toBe('false');
  });

  // ── Insert buttons have accessible labels ──

  it('insert buttons have aria-labels', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const insertBtns = screen.getAllByLabelText(/Insert .+ example/);
    expect(insertBtns.length).toBeGreaterThan(0);
  });

  it('copy buttons have aria-labels', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const copyBtns = screen.getAllByLabelText(/Copy .+ syntax/);
    expect(copyBtns.length).toBeGreaterThan(0);
  });

  // ── Section badges show correct icons ──

  it('section badges display correct icons', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);

    const badges = container.querySelectorAll('.vr-ref-section-badge');
    expect(badges[0].textContent).toBe('=');
    expect(badges[2].textContent).toBe('Aa');
  });

  // ── Chevron state ──

  it('open sections show open chevron', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);

    const sections = container.querySelectorAll('.vr-ref-section');
    const firstChevron = sections[0].querySelector('.vr-ref-chevron');
    expect(firstChevron!.classList.contains('vr-ref-chevron--open')).toBe(true);
  });

  it('closed sections show closed chevron', () => {
    render(<DslReferencePanel onInsert={vi.fn()} />);

    const booleanHeader = screen.getByText('Boolean & Null').closest('.vr-ref-section-header')!;
    const chevron = booleanHeader.querySelector('.vr-ref-chevron');
    expect(chevron!.classList.contains('vr-ref-chevron--open')).toBe(false);
  });

  // ── Total count updates on search ──

  it('total count updates when search filters results', () => {
    const { container } = render(<DslReferencePanel onInsert={vi.fn()} />);

    const badge = container.querySelector('.vr-ref-header-count')!;
    const fullCount = Number(badge.textContent);
    expect(fullCount).toBeGreaterThan(30);

    const searchInput = screen.getByPlaceholderText(/filter operators/i);
    fireEvent.change(searchInput, { target: { value: 'equals' } });

    const filteredCount = Number(badge.textContent);
    expect(filteredCount).toBeLessThan(fullCount);
    expect(filteredCount).toBeGreaterThan(0);
  });
});
