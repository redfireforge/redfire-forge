/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssertionRowEditor from './AssertionRowEditor';
import type { Assertion } from '../../../shared/types';

const mockOnUpdate = vi.fn();
const mockOnRemove = vi.fn();
const mockOnOpenRegexBuilder = vi.fn();

const baseProps = {
  index: 0,
  sampleJson: '{"id": 1, "name": "test"}',
  onUpdate: mockOnUpdate,
  onRemove: mockOnRemove,
  onOpenRegexBuilder: mockOnOpenRegexBuilder,
};

describe('AssertionRowEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('status assertion', () => {
    const statusAssertion: Assertion = { type: 'status', expected: '200' };

    it('renders status assertion with expected input', () => {
      render(<AssertionRowEditor assertion={statusAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('200')).toBeInTheDocument();
      expect(screen.getByText('STATUS')).toBeInTheDocument();
    });

    it('calls onUpdate when expected value changes', () => {
      render(<AssertionRowEditor assertion={statusAssertion} {...baseProps} />);
      const input = screen.getByDisplayValue('200');
      fireEvent.change(input, { target: { value: '201' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { expected: '201' });
    });
  });

  describe('responseTime assertion', () => {
    const responseTimeAssertion: Assertion = { type: 'responseTime', maxMs: 500 };

    it('renders responseTime assertion with max input', () => {
      render(<AssertionRowEditor assertion={responseTimeAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
      expect(screen.getByText('TIME')).toBeInTheDocument();
      expect(screen.getByText('ms')).toBeInTheDocument();
    });

    it('calls onUpdate when maxMs changes', () => {
      render(<AssertionRowEditor assertion={responseTimeAssertion} {...baseProps} />);
      const input = screen.getByDisplayValue('500');
      fireEvent.change(input, { target: { value: '1000' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { maxMs: 1000 });
    });
  });

  describe('header assertion', () => {
    const headerAssertion: Assertion = { type: 'header', name: 'Content-Type', operator: 'equals', value: 'application/json' };

    it('renders header assertion with all fields', () => {
      render(<AssertionRowEditor assertion={headerAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('Content-Type')).toBeInTheDocument();
      expect(screen.getByDisplayValue('application/json')).toBeInTheDocument();
      expect(screen.getByText('HEADER')).toBeInTheDocument();
    });

    it('hides value input when operator is exists', () => {
      const existsAssertion: Assertion = { type: 'header', name: 'X-Custom', operator: 'exists' };
      render(<AssertionRowEditor assertion={existsAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('X-Custom')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Expected value')).not.toBeInTheDocument();
    });
  });

  describe('regex assertion', () => {
    const regexAssertion: Assertion = { type: 'regex', jsonPath: '$.name', pattern: '^test' };

    it('renders regex assertion with path and pattern', () => {
      render(<AssertionRowEditor assertion={regexAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('^test')).toBeInTheDocument();
      expect(screen.getByText('REGEX')).toBeInTheDocument();
    });

    it('opens regex builder when button is clicked', () => {
      render(<AssertionRowEditor assertion={regexAssertion} {...baseProps} />);
      const builderBtn = screen.getByRole('button', { name: /builder/i });
      fireEvent.click(builderBtn);
      expect(mockOnOpenRegexBuilder).toHaveBeenCalledWith(0);
    });
  });

  describe('arrayLength assertion', () => {
    const arrayLengthAssertion: Assertion = { type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 3 };

    it('renders arrayLength assertion', () => {
      render(<AssertionRowEditor assertion={arrayLengthAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.items')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByText('ARRAY')).toBeInTheDocument();
    });
  });

  describe('numeric assertion', () => {
    const numericAssertion: Assertion = { type: 'numeric', jsonPath: '$.price', operator: '>', value: 100 };

    it('renders numeric assertion', () => {
      render(<AssertionRowEditor assertion={numericAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.price')).toBeInTheDocument();
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
      expect(screen.getByText('NUMBER')).toBeInTheDocument();
    });
  });

  describe('typeCheck assertion', () => {
    const typeCheckAssertion: Assertion = { type: 'typeCheck', jsonPath: '$.id', expectedType: 'number' };

    it('renders typeCheck assertion', () => {
      render(<AssertionRowEditor assertion={typeCheckAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.id')).toBeInTheDocument();
      expect(screen.getByText('TYPE')).toBeInTheDocument();
    });
  });

  describe('existence assertion', () => {
    const existenceAssertion: Assertion = { type: 'existence', jsonPath: '$.field', expectExists: true };

    it('renders existence assertion', () => {
      render(<AssertionRowEditor assertion={existenceAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.field')).toBeInTheDocument();
      expect(screen.getByText('EXISTS')).toBeInTheDocument();
    });
  });

  describe('custom assertion', () => {
    const customAssertion: Assertion = { type: 'custom', expression: '$gt($.body.count, 0)' };

    it('renders custom assertion with expression', () => {
      render(<AssertionRowEditor assertion={customAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$gt($.body.count, 0)')).toBeInTheDocument();
      expect(screen.getByText('CUSTOM')).toBeInTheDocument();
    });
  });

  describe('negate toggle', () => {
    it('renders NOT toggle button', () => {
      const assertion: Assertion = { type: 'status', expected: '200' };
      render(<AssertionRowEditor assertion={assertion} {...baseProps} />);
      expect(screen.getByRole('button', { name: /negate/i })).toBeInTheDocument();
    });

    it('toggles negate state when clicked', () => {
      const assertion: Assertion = { type: 'status', expected: '200' };
      render(<AssertionRowEditor assertion={assertion} {...baseProps} />);
      const negateBtn = screen.getByRole('button', { name: /negate/i });
      fireEvent.click(negateBtn);
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { negate: true });
    });

    it('removes negate when already negated', () => {
      const assertion: Assertion = { type: 'status', expected: '200', negate: true };
      render(<AssertionRowEditor assertion={assertion} {...baseProps} />);
      const negateBtn = screen.getByRole('button', { name: /remove negation/i });
      fireEvent.click(negateBtn);
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { negate: undefined });
    });
  });

  describe('remove button', () => {
    it('calls onRemove when clicked', () => {
      const assertion: Assertion = { type: 'status', expected: '200' };
      render(<AssertionRowEditor assertion={assertion} {...baseProps} />);
      const removeBtn = screen.getByTitle('Remove assertion');
      fireEvent.click(removeBtn);
      expect(mockOnRemove).toHaveBeenCalledWith(0);
    });
  });

  describe('date assertion', () => {
    const dateAssertion: Assertion = {
      type: 'date',
      jsonPath: '$.createdAt',
      operator: '>',
      reference: { kind: 'today', timezone: 'utc' },
    };

    it('renders date assertion with today reference', () => {
      render(<AssertionRowEditor assertion={dateAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.createdAt')).toBeInTheDocument();
      expect(screen.getByText('DATE')).toBeInTheDocument();
    });

    it('shows timezone select for today reference', () => {
      render(<AssertionRowEditor assertion={dateAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
    });

    it('shows date input for fixed reference', () => {
      const fixedDateAssertion: Assertion = {
        type: 'date',
        jsonPath: '$.createdAt',
        operator: '=',
        reference: { kind: 'fixed', iso: '2024-01-01' },
      };
      render(<AssertionRowEditor assertion={fixedDateAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
    });
  });

  describe('bodySize assertion', () => {
    const bodySizeAssertion: Assertion = { type: 'bodySize', operator: '<', value: 1024, unit: 'bytes' };

    it('renders bodySize assertion', () => {
      render(<AssertionRowEditor assertion={bodySizeAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('1024')).toBeInTheDocument();
      expect(screen.getByText('SIZE')).toBeInTheDocument();
    });
  });

  describe('jsonSchema assertion', () => {
    const jsonSchemaAssertion: Assertion = { type: 'jsonSchema', schema: '{"type": "object"}' };

    it('renders jsonSchema assertion with textarea', () => {
      render(<AssertionRowEditor assertion={jsonSchemaAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('{"type": "object"}')).toBeInTheDocument();
      expect(screen.getByText('SCHEMA')).toBeInTheDocument();
    });

    it('shows Generate from Response button when sample JSON exists', () => {
      render(<AssertionRowEditor assertion={jsonSchemaAssertion} {...baseProps} />);
      expect(screen.getByRole('button', { name: /generate from response/i })).toBeInTheDocument();
    });
  });

  describe('containsSubset assertion', () => {
    const containsSubsetAssertion: Assertion = { type: 'containsSubset', jsonPath: '$', expected: '{"key": "value"}' };

    it('renders containsSubset assertion', () => {
      render(<AssertionRowEditor assertion={containsSubsetAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$')).toBeInTheDocument();
      expect(screen.getByDisplayValue('{"key": "value"}')).toBeInTheDocument();
      expect(screen.getByText('SUBSET')).toBeInTheDocument();
    });
  });

  describe('arrayContains assertion', () => {
    const arrayContainsAssertion: Assertion = { type: 'arrayContains', jsonPath: '$.items', mode: 'any', value: '"test"' };

    it('renders arrayContains assertion', () => {
      render(<AssertionRowEditor assertion={arrayContainsAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.items')).toBeInTheDocument();
      expect(screen.getByText('CONTAINS')).toBeInTheDocument();
    });
  });

  describe('each assertion', () => {
    const eachAssertion: Assertion = { type: 'each', jsonPath: '$.items', fieldPath: 'status', operator: 'equals', value: 'active' };

    it('renders each assertion with all fields', () => {
      render(<AssertionRowEditor assertion={eachAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.items')).toBeInTheDocument();
      expect(screen.getByDisplayValue('status')).toBeInTheDocument();
      expect(screen.getByText('EACH')).toBeInTheDocument();
    });

    it('hides value input for no-value operators', () => {
      const eachNoValueAssertion: Assertion = { type: 'each', jsonPath: '$.items', fieldPath: 'active', operator: 'is_true' };
      render(<AssertionRowEditor assertion={eachNoValueAssertion} {...baseProps} />);
      expect(screen.queryByPlaceholderText('value')).not.toBeInTheDocument();
    });
  });

  describe('datePrecise assertion', () => {
    const datePreciseAssertion: Assertion = {
      type: 'datePrecise',
      jsonPath: '$.timestamp',
      operator: '=',
      reference: '2024-01-01T12:00:00.000Z',
      precision: 'minute',
    };

    it('renders datePrecise assertion', () => {
      render(<AssertionRowEditor assertion={datePreciseAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('$.timestamp')).toBeInTheDocument();
      expect(screen.getByText('DATE⁺')).toBeInTheDocument();
    });
  });
});
