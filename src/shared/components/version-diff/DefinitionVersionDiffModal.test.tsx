/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DefinitionVersionDiffModal } from './DefinitionVersionDiffModal';

const tabs = [
  { id: 'nodes', label: 'Nodes', count: 3 },
  { id: 'edges', label: 'Edges', count: 0 },
  { id: 'vars', label: 'Variables', count: 1 },
];

const defaultProps = {
  title: 'Version Comparison',
  olderLabel: 'v1.0',
  newerLabel: 'v2.0',
  onClose: vi.fn(),
  tabs,
  activeTab: 'nodes',
  onTabChange: vi.fn(),
};

describe('DefinitionVersionDiffModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, range labels (olderLabel → newerLabel)', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    expect(screen.getByRole('heading', { name: 'Version Comparison' })).toBeTruthy();
    expect(screen.getByText('v1.0 → v2.0')).toBeTruthy();
  });

  it('renders tabs with labels and count badges', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const nodesTab = screen.getByRole('button', { name: /Nodes/ });
    expect(nodesTab.querySelector('.test-def-diff-tab-count')?.textContent).toBe('3');

    const varsTab = screen.getByRole('button', { name: /Variables/ });
    expect(varsTab.querySelector('.test-def-diff-tab-count')?.textContent).toBe('1');
  });

  it('tab with count=0 does not show badge', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const edgesTab = screen.getByRole('button', { name: 'Edges' });
    expect(edgesTab.querySelector('.test-def-diff-tab-count')).toBeNull();
  });

  it("active tab has 'active' class", () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps} activeTab="vars">
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const activeTab = screen.getByRole('button', { name: /Variables/ });
    expect(activeTab.className).toContain('active');

    const inactiveTab = screen.getByRole('button', { name: /Nodes/ });
    expect(inactiveTab.className).not.toContain(' active');
  });

  it('clicking tab calls onTabChange', () => {
    const onTabChange = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onTabChange={onTabChange}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Variables/ }));
    expect(onTabChange).toHaveBeenCalledWith('vars');
  });

  it('clicking overlay calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(document.querySelector('.test-def-diff-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking modal content does NOT call onClose (stopPropagation)', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(document.querySelector('.test-def-diff-modal')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders children in body', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <p data-testid="child-content">Diff details here</p>
      </DefinitionVersionDiffModal>,
    );

    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Diff details here').closest('.test-def-diff-body')).toBeTruthy();
  });

  it('custom className prefix applies to all elements', () => {
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps} className="custom-diff">
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    expect(container.querySelector('.custom-diff-overlay')).toBeTruthy();
    expect(container.querySelector('.custom-diff-modal')).toBeTruthy();
    expect(container.querySelector('.custom-diff-header')).toBeTruthy();
    expect(container.querySelector('.custom-diff-range')).toBeTruthy();
    expect(container.querySelector('.custom-diff-tabs')).toBeTruthy();
    expect(container.querySelector('.custom-diff-tab')).toBeTruthy();
    expect(container.querySelector('.custom-diff-tab-count')).toBeTruthy();
    expect(container.querySelector('.custom-diff-body')).toBeTruthy();
  });
});
