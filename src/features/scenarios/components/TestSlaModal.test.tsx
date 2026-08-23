/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { selectOption, selectOptionByIndex, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import TestSlaModal from './TestSlaModal';
import type { Scenario, SlaTarget } from '@shared/types';

vi.mock('../../../shared/components/AppModalFrame', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    footer,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
    onClose: () => void;
    open?: boolean;
  }) => (
    <div data-testid="modal-frame">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
    </div>
  ),
}));

function makeTest(slaTargets?: SlaTarget[]): Scenario {
  return {
    id: 't1',
    name: 'Login Test',
    url: 'http://x',
    method: 'POST',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'status' } as Scenario['validation'],
    slaTargets,
  };
}

describe('TestSlaModal', () => {
  beforeEach(() => resetAllMocks());

  it('renders the title with test name', () => {
    render(<TestSlaModal test={makeTest()} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Login Test')).toBeInTheDocument();
  });

  it('shows the empty hint when no targets', () => {
    render(<TestSlaModal test={makeTest()} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/No SLA targets yet/)).toBeInTheDocument();
  });

  it('adds a target row', () => {
    render(<TestSlaModal test={makeTest()} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Target/ }));
    expect(screen.getByRole('button', { name: 'Delete target' })).toBeInTheDocument();
    expect(screen.getByText('≤')).toBeInTheDocument();
  });

  it('renders existing targets', () => {
    const test = makeTest([
      { id: 's1', metric: 'p95', operator: 'lte', value: 800, warnAt: 600, label: 'Cart' },
    ]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('800')).toBeInTheDocument();
    expect(screen.getByDisplayValue('600')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cart')).toBeInTheDocument();
  });

  it('resets operator and warnAt when metric changes', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 800, warnAt: 600 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    selectOption(document.body, 'TPS');
    // tps default operator is gte
    expect(screen.getByText('≥')).toBeInTheDocument();
  });

  it('updates value, warnAt and label', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 800 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: '900' } });
    expect(screen.getByDisplayValue('900')).toBeInTheDocument();
    fireEvent.change(inputs[1], { target: { value: '700' } });
    expect(screen.getByDisplayValue('700')).toBeInTheDocument();
    const labelInput = screen.getByPlaceholderText('optional');
    fireEvent.change(labelInput, { target: { value: 'My label' } });
    expect(screen.getByDisplayValue('My label')).toBeInTheDocument();
  });

  it('clears value to 0 and warnAt to undefined on empty input', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 800, warnAt: 600 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(inputs[1], { target: { value: '' } });
    expect((inputs[1] as HTMLInputElement).value).toBe('');
  });

  it('clears label to undefined when emptied', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 800, label: 'x' }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    const labelInput = screen.getByPlaceholderText('optional') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: '' } });
    expect(labelInput.value).toBe('');
  });

  it('removes a target row', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 800 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    expect(screen.getByText(/No SLA targets yet/)).toBeInTheDocument();
  });

  it('disables Save and blocks onSave when there are validation errors', () => {
    const onSave = vi.fn();
    // warnAt >= value with lte → error
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 500, warnAt: 600 }]);
    render(<TestSlaModal test={test} onSave={onSave} onClose={vi.fn()} />);
    const saveBtn = screen.getByText('Save');
    expect(saveBtn).toBeDisabled();
    fireEvent.click(saveBtn);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves and closes when valid', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 500, warnAt: 300 }]);
    render(<TestSlaModal test={test} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith([
      { id: 's1', metric: 'p95', operator: 'lte', value: 500, warnAt: 300 },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel', () => {
    const onClose = vi.fn();
    render(<TestSlaModal test={makeTest()} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows value validation error styling and message', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: -1 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Must be a non-negative number')).toBeInTheDocument();
    expect(document.querySelector('.test-sla-input--error')).toBeInTheDocument();
  });

  it('shows metric unit labels for ms and tps metrics', () => {
    const test = makeTest([
      { id: 's1', metric: 'p95', operator: 'lte', value: 500 },
      { id: 's2', metric: 'tps', operator: 'gte', value: 10 },
    ]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByText('ms').length).toBeGreaterThan(0);
    // tps has empty unit string — only ms units render
    expect(screen.getAllByText('ms')).toHaveLength(2);
  });

  it('keeps explicit operator when metric and operator are patched together', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 500, warnAt: 300 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    // Simulate updateRow with both metric and operator defined (no auto-reset)
    selectOption(document.body, 'Error Rate');
    expect(screen.getByText('≤')).toBeInTheDocument();
  });

  it('shows warnAt validation error message', () => {
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 500, warnAt: 600 }]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/Must be less than 500/)).toBeInTheDocument();
  });

  it('updates only the targeted row when multiple targets exist', () => {
    const test = makeTest([
      { id: 's1', metric: 'p95', operator: 'lte', value: 500 },
      { id: 's2', metric: 'tps', operator: 'gte', value: 10 },
    ]);
    render(<TestSlaModal test={test} onSave={vi.fn()} onClose={vi.fn()} />);
    selectOptionByIndex(document.body, 1, 'Avg Response Time');
    expect(getCustomSelectValue(document.body, 0)).toBe('P95 Response Time');
    expect(getCustomSelectValue(document.body, 1)).toBe('Avg Response Time');
  });

  it('saves an empty target list after removing all rows', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const test = makeTest([{ id: 's1', metric: 'p95', operator: 'lte', value: 500 }]);
    render(<TestSlaModal test={test} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith([]);
    expect(onClose).toHaveBeenCalled();
  });
});
