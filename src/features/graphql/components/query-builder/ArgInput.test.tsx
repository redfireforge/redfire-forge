/**
 * @vitest-environment jsdom
 *
 * ArgInput — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgInput } from './ArgInput';
import type { GraphqlTypeNode } from '../../../../shared/types/graphql';

vi.mock('../../utils/queryBuilderGenerator', () => ({
  stripTypeModifiers: (t: string) => t.replace(/[![\]]/g, ''),
}));

const NO_TYPES: GraphqlTypeNode[] = [];

describe('ArgInput', () => {
  beforeEach(() => resetAllMocks());

  it('renders a text input for a String type', () => {
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="" types={NO_TYPES} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders a number input for Int type', () => {
    render(<ArgInput fieldPath="root" argName="limit" argType="Int" value="" types={NO_TYPES} onChange={vi.fn()} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
  });

  it('renders a boolean select for Boolean type', () => {
    render(<ArgInput fieldPath="root" argName="active" argType="Boolean" value="" types={NO_TYPES} onChange={vi.fn()} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('renders an enum select when type matches an ENUM node', () => {
    const types: GraphqlTypeNode[] = [
      { name: 'Status', kind: 'ENUM', fields: [], enumValues: ['ACTIVE', 'INACTIVE'] },
    ];
    render(<ArgInput fieldPath="root" argName="status" argType="Status" value="" types={types} onChange={vi.fn()} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });

  it('calls onChange when text input changes', () => {
    const onChange = vi.fn();
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="" types={NO_TYPES} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('calls onChange when variable reference input changes', () => {
    const onChange = vi.fn();
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="{{id}}" types={NO_TYPES} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('{{variable}}'), { target: { value: '{{newVar}}' } });
    expect(onChange).toHaveBeenCalledWith('{{newVar}}');
  });

  it('calls onChange when boolean select changes', () => {
    const onChange = vi.fn();
    render(<ArgInput fieldPath="root" argName="active" argType="Boolean" value="" types={NO_TYPES} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'true' } });
    expect(onChange).toHaveBeenCalledWith('true');
  });

  it('calls onChange when enum select changes', () => {
    const onChange = vi.fn();
    const types: GraphqlTypeNode[] = [
      { name: 'Status', kind: 'ENUM', fields: [], enumValues: ['ACTIVE', 'INACTIVE'] },
    ];
    render(<ArgInput fieldPath="root" argName="status" argType="Status" value="" types={types} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ACTIVE' } });
    expect(onChange).toHaveBeenCalledWith('ACTIVE');
  });

  it('renders variable reference input when value is {{…}}', () => {
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="{{myVar}}" types={NO_TYPES} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('{{variable}}');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('{{myVar}}');
  });

  it('renders variable reference input when value starts with $', () => {
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="$myVar" types={NO_TYPES} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('{{variable}}')).toBeInTheDocument();
  });

  it('clicking {{}} button sets a variable reference when value is empty', () => {
    const onChange = vi.fn();
    render(<ArgInput fieldPath="root" argName="my-arg" argType="String" value="" types={NO_TYPES} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Use environment variable'));
    expect(onChange).toHaveBeenCalledWith('{{my_arg}}');
  });

  it('clicking {{}} button clears a variable reference when value is already {{…}}', () => {
    const onChange = vi.fn();
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="{{id}}" types={NO_TYPES} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove variable reference'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the required placeholder for required args', () => {
    render(<ArgInput fieldPath="root" argName="id" argType="String!" value="" types={NO_TYPES} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('required')).toBeInTheDocument();
  });

  it('shows the optional placeholder for optional args', () => {
    render(<ArgInput fieldPath="root" argName="id" argType="String" value="" types={NO_TYPES} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('optional')).toBeInTheDocument();
  });
});
