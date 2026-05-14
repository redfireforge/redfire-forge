/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TargetNodeOperatorPicker from './TargetNodeOperatorPicker';
import { OPERATOR_REGISTRY } from './utils/operatorRegistry';
import type { FieldOperator } from './types';
import type { OperatorMeta } from './utils/operatorRegistry';

const allOps = Object.entries(OPERATOR_REGISTRY) as [FieldOperator, OperatorMeta][];

function renderPicker(overrides: Partial<{
  operatorSearch: string;
  filteredOperators: [FieldOperator, OperatorMeta][];
  currentOp: FieldOperator;
  mapping: { id: string; negate?: boolean };
  onToggleMappingNegate: ((mappingId: string) => void) | undefined;
  handleOperatorSelect: (op: FieldOperator) => void;
  setOperatorSearch: (s: string) => void;
  pickerPos: { top: number; left: number; openUp: boolean };
}> = {}) {
  const handleOperatorSelect = overrides.handleOperatorSelect ?? vi.fn();
  const setOperatorSearch = overrides.setOperatorSearch ?? vi.fn();
  const mapping = overrides.mapping ?? { id: 'm1', sourcePath: 's', sourceId: 'sid', targetPath: 't' };

  return {
    handleOperatorSelect,
    setOperatorSearch,
    ...render(
      <TargetNodeOperatorPicker
        pickerPos={overrides.pickerPos ?? { top: 10, left: 20, openUp: false }}
        operatorSearch={overrides.operatorSearch ?? ''}
        setOperatorSearch={setOperatorSearch}
        filteredOperators={overrides.filteredOperators ?? allOps}
        currentOp={overrides.currentOp ?? 'equals'}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapping={mapping as any}
        onToggleMappingNegate={overrides.onToggleMappingNegate}
        handleOperatorSelect={handleOperatorSelect}
      />,
    ),
  };
}

describe('TargetNodeOperatorPicker', () => {
  it('renders header and search input', () => {
    renderPicker();
    expect(screen.getByText('Select Operator')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search operators...')).toBeInTheDocument();
  });

  it('renders listbox with all operator categories present', () => {
    renderPicker();
    expect(screen.getByRole('listbox', { name: 'Operators' })).toBeInTheDocument();
    expect(screen.getByText('Equality')).toBeInTheDocument();
    expect(screen.getByText('Comparison')).toBeInTheDocument();
    expect(screen.getByText('String')).toBeInTheDocument();
  });

  it('marks the current operator with aria-selected', () => {
    renderPicker({ currentOp: 'contains' });
    const selected = screen.getAllByRole('option', { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('contains');
  });

  it('clicking an operator calls handleOperatorSelect with that key', () => {
    const handleOperatorSelect = vi.fn();
    renderPicker({ handleOperatorSelect });
    const options = screen.getAllByRole('option');
    const equalsOption = options.find(opt => opt.querySelector('.dm-op-picker-label')?.textContent === 'equals');
    expect(equalsOption).toBeDefined();
    fireEvent.click(equalsOption!);
    expect(handleOperatorSelect).toHaveBeenCalledWith('equals');
  });

  it('typing in search input invokes setOperatorSearch', () => {
    const setOperatorSearch = vi.fn();
    renderPicker({ setOperatorSearch });
    fireEvent.change(screen.getByPlaceholderText('Search operators...'), { target: { value: 'greater' } });
    expect(setOperatorSearch).toHaveBeenCalledWith('greater');
  });

  it('shows "value" hint for operators that need a value', () => {
    renderPicker();
    const hints = screen.getAllByText('value');
    expect(hints.length).toBeGreaterThan(0);
  });

  it('renders empty-state message when filteredOperators is empty', () => {
    renderPicker({ filteredOperators: [] });
    expect(screen.getByText('No matching operators')).toBeInTheDocument();
  });

  it('skips categories that have no matching operators', () => {
    const onlyEquality = allOps.filter(([, m]) => m.category === 'equality');
    renderPicker({ filteredOperators: onlyEquality });
    expect(screen.getByText('Equality')).toBeInTheDocument();
    expect(screen.queryByText('Comparison')).not.toBeInTheDocument();
    expect(screen.queryByText('Boolean')).not.toBeInTheDocument();
  });

  it('shows the Negate (NOT) toggle row when onToggleMappingNegate provided', () => {
    const onToggleMappingNegate = vi.fn();
    renderPicker({ onToggleMappingNegate });
    const btn = screen.getByRole('button', { name: 'Toggle negation' });
    fireEvent.click(btn);
    expect(onToggleMappingNegate).toHaveBeenCalledWith('m1');
  });

  it('renders check mark when mapping.negate is true', () => {
    renderPicker({
      mapping: { id: 'm1', negate: true },
      onToggleMappingNegate: vi.fn(),
    });
    const btn = screen.getByRole('button', { name: 'Toggle negation' });
    expect(btn.className).toContain('dm-op-picker-negate-btn--active');
    expect(btn).toHaveTextContent('✓');
  });

  it('hides Negate row when handler omitted', () => {
    renderPicker({ onToggleMappingNegate: undefined });
    expect(screen.queryByRole('button', { name: 'Toggle negation' })).not.toBeInTheDocument();
  });

  it('renders openUp class when pickerPos.openUp is true', () => {
    const { container } = renderPicker({ pickerPos: { top: 5, left: 5, openUp: true } });
    expect(container.querySelector('.dm-operator-picker--up')).toBeInTheDocument();
  });

  it('positions itself via style top/left from pickerPos', () => {
    const { container } = renderPicker({ pickerPos: { top: 42, left: 17, openUp: false } });
    const root = container.querySelector('.dm-operator-picker') as HTMLElement;
    expect(root.style.top).toBe('42px');
    expect(root.style.left).toBe('17px');
  });
});
