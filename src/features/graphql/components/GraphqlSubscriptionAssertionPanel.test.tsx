/**
 * @vitest-environment jsdom
 *
 * GraphqlSubscriptionAssertionPanel.test.tsx — Sprint 8 (2C-5)
 *
 * Unit tests for the subscription assertion panel UI component.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import { GraphqlSubscriptionAssertionPanel } from './GraphqlSubscriptionAssertionPanel';
import type { GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';

function makeAssertion(overrides: Partial<GraphqlSubscriptionAssertion> = {}): GraphqlSubscriptionAssertion {
  return {
    id: 'a1',
    jsonPath: '$.data.name',
    operator: 'equals',
    expected: 'Alice',
    description: '',
    ...overrides,
  };
}

describe('GraphqlSubscriptionAssertionPanel', () => {
  it('renders the panel with header', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    expect(screen.getByTestId('gql-assertion-panel')).toBeInTheDocument();
    expect(screen.getByTestId('gql-assertion-toggle')).toBeInTheDocument();
  });

  it('shows "Assertions" label in the toggle', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    expect(screen.getByTestId('gql-assertion-toggle')).toHaveTextContent('Assertions');
  });

  it('shows count badge when assertions are present', () => {
    const assertions = [makeAssertion({ id: 'a1' }), makeAssertion({ id: 'a2' })];
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={() => {}} />);
    // Badge text is "2"
    expect(screen.getByTestId('gql-assertion-toggle')).toHaveTextContent('2');
  });

  it('does not show count badge when no assertions', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    // Should only show "Assertions" text, no number badge
    const toggle = screen.getByTestId('gql-assertion-toggle');
    expect(toggle.textContent).not.toMatch(/^\d/);
  });

  it('renders the Add button', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    expect(screen.getByTestId('gql-assertion-add-btn')).toBeInTheDocument();
  });

  it('shows empty hint when no assertions', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    expect(screen.getByText(/No assertions yet/i)).toBeInTheDocument();
  });

  it('calls onChange with a new assertion when Add is clicked', () => {
    const onChange = vi.fn();
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('gql-assertion-add-btn'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const newAssertions = onChange.mock.calls[0][0] as GraphqlSubscriptionAssertion[];
    expect(newAssertions).toHaveLength(1);
    expect(newAssertions[0].jsonPath).toBe('$');
  });

  it('renders assertion rows for each assertion', () => {
    const assertions = [makeAssertion({ id: 'a1' }), makeAssertion({ id: 'a2' })];
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={() => {}} />);
    const rows = screen.getAllByTestId('gql-assertion-row');
    expect(rows).toHaveLength(2);
  });

  it('shows JSONPath input in each row', () => {
    const assertions = [makeAssertion({ jsonPath: '$.status' })];
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={() => {}} />);
    const input = screen.getByTestId('gql-assertion-jsonpath');
    expect(input).toHaveValue('$.status');
  });

  it('shows operator select in each row', () => {
    const assertions = [makeAssertion({ operator: 'contains' })];
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={() => {}} />);
    expect(getCustomSelectValue(screen.getByTestId('gql-assertion-operator'))).toBe('contains');
  });

  it('shows expected value input for value-operators', () => {
    const assertions = [makeAssertion({ operator: 'equals', expected: 'Bob' })];
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={() => {}} />);
    const input = screen.getByTestId('gql-assertion-expected');
    expect(input).toHaveValue('Bob');
  });

  it('hides expected value input for no-value operators (is_null)', () => {
    const assertions = [makeAssertion({ operator: 'is_null' })];
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={() => {}} />);
    expect(screen.queryByTestId('gql-assertion-expected')).not.toBeInTheDocument();
  });

  it('calls onChange with updated assertions when Delete is clicked', () => {
    const assertions = [makeAssertion({ id: 'a1' }), makeAssertion({ id: 'a2' })];
    const onChange = vi.fn();
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={onChange} />);
    const deleteButtons = screen.getAllByTestId('gql-assertion-delete');
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });

  it('calls onChange with updated jsonPath when input changes', () => {
    const assertions = [makeAssertion({ jsonPath: '$.x' })];
    const onChange = vi.fn();
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={onChange} />);
    const input = screen.getByTestId('gql-assertion-jsonpath');
    fireEvent.change(input, { target: { value: '$.y' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].jsonPath).toBe('$.y');
  });

  it('collapses the body when toggle is clicked', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    const toggle = screen.getByTestId('gql-assertion-toggle');
    // Initially expanded — aria-expanded is true
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Click to collapse
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Body div stays in DOM (hidden attribute) so aria-controls resolves
    const body = document.getElementById('gql-assertion-body');
    expect(body).toBeInTheDocument();
    expect(body).toHaveAttribute('hidden');
  });

  it('expands the body when collapsed toggle is clicked again', () => {
    render(<GraphqlSubscriptionAssertionPanel assertions={[]} onChange={() => {}} />);
    const toggle = screen.getByTestId('gql-assertion-toggle');
    fireEvent.click(toggle); // collapse
    fireEvent.click(toggle); // expand
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById('gql-assertion-body');
    expect(body).not.toHaveAttribute('hidden');
  });

  it('calls onChange with updated operator when select changes', () => {
    const assertions = [makeAssertion({ operator: 'equals' })];
    const onChange = vi.fn();
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={onChange} />);
    selectOption(screen.getByTestId('gql-assertion-operator'), 'contains');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].operator).toBe('contains');
  });

  it('calls onChange with updated expected value when input changes', () => {
    const assertions = [makeAssertion({ operator: 'equals', expected: 'Alice' })];
    const onChange = vi.fn();
    render(<GraphqlSubscriptionAssertionPanel assertions={assertions} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('gql-assertion-expected'), { target: { value: 'Bob' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].expected).toBe('Bob');
  });

  it('shows String(expected) when expected is a number (line 98 cond-expr false + binary-expr true)', () => {
    // When assertion.expected is not a string, String() is called
    const assertion = {
      id: 'a1', messageIndex: 0, jsonPath: '$.count',
      operator: 'eq' as const,
      expected: 42,
    };
    render(<GraphqlSubscriptionAssertionPanel assertions={[assertion]} onChange={() => {}} />);
    const input = screen.getByTestId('gql-assertion-expected') as HTMLInputElement;
    // String(42) = '42'
    expect(input.value).toBe('42');
  });

  it('shows empty string when expected is undefined (line 98 ??empty false branch)', () => {
    const assertion = {
      id: 'a2', messageIndex: 0, jsonPath: '$.count',
      operator: 'eq' as const,
      expected: undefined,
    };
    render(<GraphqlSubscriptionAssertionPanel assertions={[assertion]} onChange={() => {}} />);
    const input = screen.getByTestId('gql-assertion-expected') as HTMLInputElement;
    expect(input.value).toBe('');
  });
});
