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

  describe('wsField assertion', () => {
    const wsFieldAssertion: Assertion = { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'hello' };

    it('renders wsField assertion with badge', () => {
      render(<AssertionRowEditor assertion={wsFieldAssertion} {...baseProps} />);
      expect(screen.getByText('WS')).toBeInTheDocument();
      expect(screen.getByLabelText('WS target')).toHaveValue('ws.body');
    });

    it('shows value input for non-exists operator', () => {
      render(<AssertionRowEditor assertion={wsFieldAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    });

    it('hides value input for exists operator', () => {
      const existsAssertion: Assertion = { type: 'wsField', target: 'ws.type', operator: 'exists' };
      render(<AssertionRowEditor assertion={existsAssertion} {...baseProps} />);
      expect(screen.queryByPlaceholderText('Expected value')).not.toBeInTheDocument();
    });

    it('shows JSONPath input for ws.$.path targets', () => {
      const jsonPathAssertion: Assertion = { type: 'wsField', target: 'ws.$.data.status', operator: 'equals', value: 'active' };
      render(<AssertionRowEditor assertion={jsonPathAssertion} {...baseProps} />);
      expect(screen.getByLabelText('JSONPath within WS body')).toHaveValue('data.status');
    });

    it('shows header name input for ws.header.* targets', () => {
      const headerAssertion: Assertion = { type: 'wsField', target: 'ws.header.Sec-WebSocket-Protocol', operator: 'equals', value: 'graphql-ws' };
      render(<AssertionRowEditor assertion={headerAssertion} {...baseProps} />);
      expect(screen.getByLabelText('WS header name')).toHaveValue('Sec-WebSocket-Protocol');
    });

    it('calls onUpdate when target changes', () => {
      render(<AssertionRowEditor assertion={wsFieldAssertion} {...baseProps} />);
      fireEvent.change(screen.getByLabelText('WS target'), { target: { value: 'ws.type' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'ws.type' });
    });
  });

  describe('wsNumericField assertion', () => {
    const wsNumAssertion: Assertion = { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 500 };

    it('renders wsNumericField assertion with badge', () => {
      render(<AssertionRowEditor assertion={wsNumAssertion} {...baseProps} />);
      expect(screen.getByText('WS#')).toBeInTheDocument();
      expect(screen.getByLabelText('WS numeric target')).toHaveValue('ws.latencyMs');
    });

    it('renders numeric value input', () => {
      render(<AssertionRowEditor assertion={wsNumAssertion} {...baseProps} />);
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    it('calls onUpdate when value changes', () => {
      render(<AssertionRowEditor assertion={wsNumAssertion} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '1000' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 1000 });
    });
  });

  describe('kafkaField assertion', () => {
    const kafkaAssertion: Assertion = { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: 'test' };

    it('renders kafkaField assertion with badge', () => {
      render(<AssertionRowEditor assertion={kafkaAssertion} {...baseProps} />);
      expect(screen.getByText('KAFKA')).toBeInTheDocument();
      expect(screen.getByLabelText('Kafka target')).toHaveValue('kafka.body');
    });

    it('shows header name input for kafka.header.* targets', () => {
      const headerAssertion: Assertion = { type: 'kafkaField', target: 'kafka.header.X-Request-Id', operator: 'equals', value: '123' };
      render(<AssertionRowEditor assertion={headerAssertion} {...baseProps} />);
      expect(screen.getByLabelText('Kafka header name')).toHaveValue('X-Request-Id');
    });

    it('calls onUpdate when operator changes', () => {
      render(<AssertionRowEditor assertion={kafkaAssertion} {...baseProps} />);
      const selects = screen.getAllByRole('combobox');
      const operatorSelect = selects.find(s => (s as HTMLSelectElement).value === 'contains');
      expect(operatorSelect).toBeTruthy();
      fireEvent.change(operatorSelect!, { target: { value: 'equals' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: 'equals' });
    });
  });

  // ── jsonSchema toolbar ────────────────────────────────────────────────────────

  describe('jsonSchema toolbar', () => {
    const schemaAssertion: Assertion = { type: 'jsonSchema', schema: '{"type":"object"}' };

    it('pretty formats schema', () => {
      render(<AssertionRowEditor assertion={schemaAssertion} {...baseProps} />);
      fireEvent.click(screen.getByTitle('Format JSON with indentation'));
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ schema: expect.stringContaining('{\n') }));
    });

    it('minifies schema', () => {
      const prettySchema: Assertion = { type: 'jsonSchema', schema: '{\n  "type": "object"\n}' };
      render(<AssertionRowEditor assertion={prettySchema} {...baseProps} />);
      fireEvent.click(screen.getByTitle('Minify JSON (remove whitespace)'));
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { schema: '{"type":"object"}' });
    });

    it('ignores minify on invalid JSON', () => {
      const badSchema: Assertion = { type: 'jsonSchema', schema: 'not-json' };
      render(<AssertionRowEditor assertion={badSchema} {...baseProps} />);
      fireEvent.click(screen.getByTitle('Minify JSON (remove whitespace)'));
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('generates schema from sample response', () => {
      const props = { ...baseProps, sampleJson: '{"id":1,"name":"test"}' };
      render(<AssertionRowEditor assertion={schemaAssertion} index={0} {...props} />);
      fireEvent.click(screen.getByText('Generate from Response'));
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ schema: expect.stringContaining('"type"') }));
    });

    it('shows error for invalid schema JSON', () => {
      const badSchema: Assertion = { type: 'jsonSchema', schema: '{bad' };
      render(<AssertionRowEditor assertion={badSchema} {...baseProps} />);
      expect(screen.getByText(/Expected property name|Unexpected/i)).toBeInTheDocument();
    });

    it('updates schema from textarea', () => {
      render(<AssertionRowEditor assertion={schemaAssertion} {...baseProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '{"type":"array"}' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { schema: '{"type":"array"}' });
    });
  });

  // ── date assertion interactions ───────────────────────────────────────────────

  describe('date assertion interactions', () => {
    const dateAssertion: Assertion = {
      type: 'date',
      jsonPath: '$.expiresAt',
      operator: '>',
      reference: { kind: 'today', timezone: 'utc' },
    };

    it('switches reference kind to fixed', () => {
      render(<AssertionRowEditor assertion={dateAssertion} {...baseProps} />);
      const selects = screen.getAllByRole('combobox');
      const kindSelect = selects.find(s => (s as HTMLSelectElement).value === 'today');
      expect(kindSelect).toBeTruthy();
      fireEvent.change(kindSelect!, { target: { value: 'fixed' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
        reference: expect.objectContaining({ kind: 'fixed' }),
      }));
    });

    it('switches reference kind from fixed to today', () => {
      const fixedAssertion: Assertion = {
        type: 'date',
        jsonPath: '$.expiresAt',
        operator: '>',
        reference: { kind: 'fixed', iso: '2024-01-01' },
      };
      render(<AssertionRowEditor assertion={fixedAssertion} {...baseProps} />);
      const selects = screen.getAllByRole('combobox');
      const kindSelect = selects.find(s => (s as HTMLSelectElement).value === 'fixed');
      fireEvent.change(kindSelect!, { target: { value: 'today' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
        reference: expect.objectContaining({ kind: 'today', timezone: 'utc' }),
      }));
    });

    it('updates fixed date value', () => {
      const fixedAssertion: Assertion = {
        type: 'date',
        jsonPath: '$.expiresAt',
        operator: '>',
        reference: { kind: 'fixed', iso: '2024-01-01' },
      };
      render(<AssertionRowEditor assertion={fixedAssertion} {...baseProps} />);
      const dateInput = screen.getByDisplayValue('2024-01-01');
      fireEvent.change(dateInput, { target: { value: '2025-06-15' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, {
        reference: { kind: 'fixed', iso: '2025-06-15' },
      });
    });

    it('updates timezone for today reference', () => {
      render(<AssertionRowEditor assertion={dateAssertion} {...baseProps} />);
      const tzSelect = screen.getByDisplayValue('UTC');
      fireEvent.change(tzSelect, { target: { value: 'local' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, {
        reference: { kind: 'today', timezone: 'local' },
      });
    });
  });

  // ── bodySize interactions ─────────────────────────────────────────────────────

  describe('bodySize interactions', () => {
    const bodySizeAssertion: Assertion = { type: 'bodySize', operator: '<', value: 1024, unit: 'bytes' };

    it('updates unit', () => {
      render(<AssertionRowEditor assertion={bodySizeAssertion} {...baseProps} />);
      const unitSelect = screen.getByDisplayValue('Bytes');
      fireEvent.change(unitSelect, { target: { value: 'kb' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { unit: 'kb' });
    });

    it('updates value', () => {
      render(<AssertionRowEditor assertion={bodySizeAssertion} {...baseProps} />);
      const input = screen.getByDisplayValue('1024');
      fireEvent.change(input, { target: { value: '2048' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 2048 });
    });

    it('updates operator', () => {
      render(<AssertionRowEditor assertion={bodySizeAssertion} {...baseProps} />);
      const opSelect = screen.getByDisplayValue('less than');
      fireEvent.change(opSelect, { target: { value: '>=' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: '>=' });
    });
  });

  // ── custom assertion interactions ─────────────────────────────────────────────

  describe('custom assertion interactions', () => {
    const customAssertion: Assertion = { type: 'custom', expression: 'response.status === 200' };

    it('updates expression', () => {
      render(<AssertionRowEditor assertion={customAssertion} {...baseProps} />);
      const textarea = screen.getByDisplayValue('response.status === 200');
      fireEvent.change(textarea, { target: { value: 'response.body.ok' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { expression: 'response.body.ok' });
    });
  });

  // ── wsField interactions ──────────────────────────────────────────────────────

  describe('wsField interactions', () => {
    const wsAssertion: Assertion = { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'test' };

    it('updates value for non-exists operator', () => {
      render(<AssertionRowEditor assertion={wsAssertion} {...baseProps} />);
      const input = screen.getByDisplayValue('test');
      fireEvent.change(input, { target: { value: 'new-value' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 'new-value' });
    });

    it('updates ws target', () => {
      render(<AssertionRowEditor assertion={wsAssertion} {...baseProps} />);
      const select = screen.getByLabelText('WS target');
      fireEvent.change(select, { target: { value: 'ws.type' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'ws.type' });
    });
  });

  // ── wsNumericField interactions ───────────────────────────────────────────────

  describe('wsNumericField interactions', () => {
    const wsNumericAssertion: Assertion = { type: 'wsNumericField', target: 'ws.messageSize', operator: '<', value: 1024 };

    it('updates operator', () => {
      render(<AssertionRowEditor assertion={wsNumericAssertion} {...baseProps} />);
      const selects = screen.getAllByRole('combobox');
      const opSelect = selects.find(s => (s as HTMLSelectElement).value === '<');
      fireEvent.change(opSelect!, { target: { value: '>=' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: '>=' });
    });
  });

  // ── each assertion interactions ───────────────────────────────────────────────

  describe('each assertion interactions', () => {
    const eachAssertion: Assertion = { type: 'each', jsonPath: '$.items', fieldPath: 'name', operator: 'equals', value: 'test' };

    it('updates fieldPath', () => {
      render(<AssertionRowEditor assertion={eachAssertion} {...baseProps} />);
      const input = screen.getByDisplayValue('name');
      fireEvent.change(input, { target: { value: 'title' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { fieldPath: 'title' });
    });

    it('updates operator to no-value type', () => {
      render(<AssertionRowEditor assertion={eachAssertion} {...baseProps} />);
      const selects = screen.getAllByRole('combobox');
      const opSelect = selects.find(s => (s as HTMLSelectElement).value === 'equals');
      fireEvent.change(opSelect!, { target: { value: 'is_true' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: 'is_true' });
    });
  });

  // ── arrayContains interactions ────────────────────────────────────────────────

  describe('arrayContains interactions', () => {
    const arrayAssertion: Assertion = { type: 'arrayContains', jsonPath: '$.items', mode: 'any', value: '"test"' };

    it('updates mode', () => {
      render(<AssertionRowEditor assertion={arrayAssertion} {...baseProps} />);
      const selects = screen.getAllByRole('combobox');
      const modeSelect = selects.find(s => (s as HTMLSelectElement).value === 'any');
      fireEvent.change(modeSelect!, { target: { value: 'all' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { mode: 'all' });
    });
  });

  // ── containsSubset interactions ───────────────────────────────────────────────

  describe('containsSubset interactions', () => {
    const subsetAssertion: Assertion = { type: 'containsSubset', jsonPath: '$', expected: '{"status":"ok"}' };

    it('updates expected', () => {
      render(<AssertionRowEditor assertion={subsetAssertion} {...baseProps} />);
      const textarea = screen.getByDisplayValue('{"status":"ok"}');
      fireEvent.change(textarea, { target: { value: '{"key":"val"}' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { expected: '{"key":"val"}' });
    });
  });
});
