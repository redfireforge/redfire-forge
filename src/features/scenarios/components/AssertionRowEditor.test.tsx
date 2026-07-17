/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssertionRowEditor from './AssertionRowEditor';
import type { Assertion } from '../../../shared/types';
import { installClipboardReadMock, installEmptyClipboard } from '../../../test-utils/clipboardMock';

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
    resetAllMocks();
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
      fireEvent.click(screen.getByTitle('Pretty Format JSON'));
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

  // ── JsonPath picker + jsonPath onChange coverage ──────────────────────────────

  const pickPath = (idx = 0) => {
    const btns = screen.getAllByTitle('Pick JSON path from sample response');
    fireEvent.click(btns[idx]);
    const items = document.querySelectorAll('.jpp-item');
    fireEvent.click(items[0] as HTMLElement);
  };

  describe('jsonPath input + picker handlers', () => {
    it('regex: updates jsonPath, picks path, updates pattern', () => {
      const a: Assertion = { type: 'regex', jsonPath: '$.name', pattern: '^t' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.name'), { target: { value: '$.id' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.id' });
      pickPath();
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ jsonPath: expect.any(String) }));
      fireEvent.change(screen.getByDisplayValue('^t'), { target: { value: '^x' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { pattern: '^x' });
    });

    it('arrayLength: updates jsonPath, picks path, updates operator and value', () => {
      const a: Assertion = { type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 3 };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.items'), { target: { value: '$.list' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.list' });
      pickPath();
      const opSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === '=');
      fireEvent.change(opSelect!, { target: { value: '>' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: '>' });
      fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '5' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 5 });
    });

    it('numeric: updates jsonPath, picks path, updates operator and value', () => {
      const a: Assertion = { type: 'numeric', jsonPath: '$.price', operator: '>', value: 100 };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.price'), { target: { value: '$.qty' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.qty' });
      pickPath();
      const opSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === '>');
      fireEvent.change(opSelect!, { target: { value: '<' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: '<' });
      fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '200' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 200 });
    });

    it('typeCheck: updates jsonPath, picks path, updates expectedType', () => {
      const a: Assertion = { type: 'typeCheck', jsonPath: '$.id', expectedType: 'number' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.id'), { target: { value: '$.name' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.name' });
      pickPath();
      const typeSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'number');
      fireEvent.change(typeSelect!, { target: { value: 'string' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { expectedType: 'string' });
    });

    it('existence: updates jsonPath, picks path, updates expectExists', () => {
      const a: Assertion = { type: 'existence', jsonPath: '$.field', expectExists: true };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.field'), { target: { value: '$.id' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.id' });
      pickPath();
      const select = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'exists');
      fireEvent.change(select!, { target: { value: 'not_exists' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { expectExists: false });
    });

    it('arrayContains: updates jsonPath, picks path, updates value', () => {
      const a: Assertion = { type: 'arrayContains', jsonPath: '$.items', mode: 'any', value: '"x"' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.items'), { target: { value: '$.list' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.list' });
      pickPath();
      fireEvent.change(screen.getByDisplayValue('"x"'), { target: { value: '"y"' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: '"y"' });
    });

    it('containsSubset: updates jsonPath and picks path', () => {
      const a: Assertion = { type: 'containsSubset', jsonPath: '$', expected: '{}' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$'), { target: { value: '$.data' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.data' });
      pickPath();
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ jsonPath: expect.any(String) }));
    });

    it('each: updates jsonPath, picks both pickers, updates value', () => {
      const a: Assertion = { type: 'each', jsonPath: '$.items', fieldPath: 'status', operator: 'equals', value: 'ok' };
      render(<AssertionRowEditor assertion={a} index={0} sampleJson='{"items":[{"status":"ok"}]}' onUpdate={mockOnUpdate} onRemove={mockOnRemove} onOpenRegexBuilder={mockOnOpenRegexBuilder} />);
      fireEvent.change(screen.getByDisplayValue('$.items'), { target: { value: '$.list' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.list' });
      // first picker (full sample) selects a path
      pickPath(0);
      // second picker (array element schema) selects a field path
      const btns = screen.getAllByTitle('Pick JSON path from sample response');
      fireEvent.click(btns[1]);
      const items = document.querySelectorAll('.jpp-item');
      fireEvent.click(items[0] as HTMLElement);
      fireEvent.change(screen.getByDisplayValue('ok'), { target: { value: 'active' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 'active' });
    });
  });

  // ── header interactions ───────────────────────────────────────────────────────

  describe('header interactions', () => {
    const a: Assertion = { type: 'header', name: 'Content-Type', operator: 'equals', value: 'application/json' };

    it('updates name, operator and value', () => {
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('Content-Type'), { target: { value: 'Accept' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { name: 'Accept' });
      fireEvent.change(screen.getByDisplayValue('equals'), { target: { value: 'contains' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: 'contains' });
      fireEvent.change(screen.getByDisplayValue('application/json'), { target: { value: 'text/html' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 'text/html' });
    });
  });

  // ── date pick button + picker ─────────────────────────────────────────────────

  describe('date extra interactions', () => {
    it('updates jsonPath, picks path, updates operator and clicks fixed pick button', () => {
      const a: Assertion = {
        type: 'date', jsonPath: '$.createdAt', operator: '>',
        reference: { kind: 'fixed', iso: '2024-01-01' },
      };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.createdAt'), { target: { value: '$.updatedAt' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.updatedAt' });
      pickPath();
      const opSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === '>');
      fireEvent.change(opSelect!, { target: { value: '<' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: '<' });
      fireEvent.click(screen.getByTitle('Pick date'));
    });
  });

  // ── datePrecise interactions ──────────────────────────────────────────────────

  describe('datePrecise interactions', () => {
    const a: Assertion = {
      type: 'datePrecise', jsonPath: '$.timestamp', operator: '=',
      reference: '2024-01-01T12:00:00.000Z', precision: 'minute',
    };

    it('updates jsonPath, picks path, operator, reference, precision and clicks pick button', () => {
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('$.timestamp'), { target: { value: '$.ts' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { jsonPath: '$.ts' });
      pickPath();
      const opSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === '=');
      fireEvent.change(opSelect!, { target: { value: '>' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: '>' });
      const dt = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
      fireEvent.change(dt, { target: { value: '2025-06-15T08:30' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ reference: expect.stringContaining('2025') }));
      fireEvent.change(dt, { target: { value: '' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { reference: '' });
      fireEvent.click(screen.getByTitle('Pick date/time'));
      const precisionSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'minute');
      fireEvent.change(precisionSelect!, { target: { value: 'second' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { precision: 'second' });
    });
  });

  // ── custom description ────────────────────────────────────────────────────────

  describe('custom description', () => {
    const a: Assertion = { type: 'custom', expression: '$gt($.x, 0)', description: 'd' };

    it('updates description and clears it to undefined', () => {
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      const descInput = screen.getByLabelText('Custom predicate description');
      fireEvent.change(descInput, { target: { value: 'new desc' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { description: 'new desc' });
      fireEvent.change(descInput, { target: { value: '' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { description: undefined });
    });
  });

  // ── wsField header / jsonpath / operator ──────────────────────────────────────

  describe('wsField extra interactions', () => {
    it('updates ws.header name', () => {
      const a: Assertion = { type: 'wsField', target: 'ws.header.X-Proto', operator: 'equals', value: 'v' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByLabelText('WS header name'), { target: { value: 'X-Other' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'ws.header.X-Other' });
    });

    it('updates ws.$ jsonpath', () => {
      const a: Assertion = { type: 'wsField', target: 'ws.$.data.x', operator: 'equals', value: 'v' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByLabelText('JSONPath within WS body'), { target: { value: 'data.y' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'ws.$.data.y' });
    });

    it('updates operator', () => {
      const a: Assertion = { type: 'wsField', target: 'ws.body', operator: 'contains', value: 'v' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      const opSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'contains');
      fireEvent.change(opSelect!, { target: { value: 'equals' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { operator: 'equals' });
    });
  });

  // ── wsNumericField target ─────────────────────────────────────────────────────

  describe('wsNumericField target', () => {
    it('updates numeric target', () => {
      const a: Assertion = { type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 1 };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByLabelText('WS numeric target'), { target: { value: 'ws.size' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'ws.size' });
    });
  });

  // ── kafkaField target / header / value ────────────────────────────────────────

  describe('kafkaField extra interactions', () => {
    it('updates target select', () => {
      const a: Assertion = { type: 'kafkaField', target: 'kafka.body', operator: 'contains', value: 'v' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByLabelText('Kafka target'), { target: { value: 'kafka.key' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'kafka.key' });
    });

    it('updates kafka header name and value', () => {
      const a: Assertion = { type: 'kafkaField', target: 'kafka.header.X-Id', operator: 'equals', value: '1' };
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.change(screen.getByLabelText('Kafka header name'), { target: { value: 'X-New' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { target: 'kafka.header.X-New' });
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: '2' });
    });
  });

  // ── jsonSchema paste from clipboard ───────────────────────────────────────────

  describe('jsonSchema paste', () => {
    const a: Assertion = { type: 'jsonSchema', schema: '{}' };

    it('pastes schema from clipboard', async () => {
      installClipboardReadMock().mockResolvedValue('{"type":"array"}');
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.click(screen.getByTitle('Paste schema from clipboard'));
      await Promise.resolve();
      await Promise.resolve();
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { schema: '{"type":"array"}' });
    });

    it('handles clipboard read rejection gracefully', async () => {
      const readText = installClipboardReadMock().mockRejectedValue(new Error('denied'));
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.click(screen.getByTitle('Paste schema from clipboard'));
      await Promise.resolve();
      await Promise.resolve();
      expect(readText).toHaveBeenCalled();
    });

    it('no-ops paste when clipboard.readText is unavailable', () => {
      installEmptyClipboard();
      render(<AssertionRowEditor assertion={a} {...baseProps} />);
      fireEvent.click(screen.getByTitle('Paste schema from clipboard'));
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  // ── numeric coercion + nullish fallbacks ──────────────────────────────────────

  describe('numeric coercion and nullish fallbacks', () => {
    it('responseTime coerces invalid number to 0', () => {
      render(<AssertionRowEditor assertion={{ type: 'responseTime', maxMs: 5 }} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('5'), { target: { value: 'abc' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { maxMs: 0 });
    });

    it('arrayLength coerces invalid value to 0', () => {
      render(<AssertionRowEditor assertion={{ type: 'arrayLength', jsonPath: '$.a', operator: '=', value: 3 }} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('3'), { target: { value: 'x' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 0 });
    });

    it('numeric coerces invalid value to 0', () => {
      render(<AssertionRowEditor assertion={{ type: 'numeric', jsonPath: '$.a', operator: '>', value: 1 }} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: 'x' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 0 });
    });

    it('bodySize coerces invalid value to 0', () => {
      render(<AssertionRowEditor assertion={{ type: 'bodySize', operator: '<', value: 10, unit: 'bytes' }} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('10'), { target: { value: 'x' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 0 });
    });

    it('wsNumericField coerces invalid value to 0', () => {
      render(<AssertionRowEditor assertion={{ type: 'wsNumericField', target: 'ws.size', operator: '<', value: 2 }} {...baseProps} />);
      fireEvent.change(screen.getByDisplayValue('2'), { target: { value: 'x' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { value: 0 });
    });

    it('renders header with undefined value (nullish fallback)', () => {
      render(<AssertionRowEditor assertion={{ type: 'header', name: 'X', operator: 'equals' }} {...baseProps} />);
      expect(screen.getByPlaceholderText('Expected value')).toHaveValue('');
    });

    it('renders wsField with undefined value (nullish fallback)', () => {
      render(<AssertionRowEditor assertion={{ type: 'wsField', target: 'ws.body', operator: 'contains' }} {...baseProps} />);
      expect(screen.getByPlaceholderText('Expected value')).toHaveValue('');
    });

    it('renders kafkaField with undefined value (nullish fallback)', () => {
      render(<AssertionRowEditor assertion={{ type: 'kafkaField', target: 'kafka.body', operator: 'contains' }} {...baseProps} />);
      expect(screen.getByPlaceholderText('Expected value')).toHaveValue('');
    });

    it('renders each with undefined value (nullish fallback)', () => {
      render(<AssertionRowEditor assertion={{ type: 'each', jsonPath: '$.a', fieldPath: 'f', operator: 'equals' }} {...baseProps} />);
      expect(screen.getByPlaceholderText('value')).toHaveValue('');
    });

    it('renders existence with expectExists false', () => {
      render(<AssertionRowEditor assertion={{ type: 'existence', jsonPath: '$.a', expectExists: false }} {...baseProps} />);
      const select = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'not_exists');
      expect(select).toBeTruthy();
    });

    it('renders datePrecise with empty reference', () => {
      render(<AssertionRowEditor assertion={{ type: 'datePrecise', jsonPath: '$.a', operator: '=', reference: '', precision: 'minute' }} {...baseProps} />);
      const dt = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
      expect(dt).toHaveValue('');
    });
  });

  // ── each picker fallbacks + date reference cond-expr arms ──────────────────────

  describe('each picker and date reference fallbacks', () => {
    it('each: handles empty sampleJson and empty jsonPath for inner picker', () => {
      render(<AssertionRowEditor assertion={{ type: 'each', jsonPath: '', fieldPath: 'f', operator: 'equals', value: 'v' }} index={0} sampleJson='' onUpdate={mockOnUpdate} onRemove={mockOnRemove} />);
      expect(screen.getByPlaceholderText('field (e.g. rank)')).toBeInTheDocument();
    });

    it('each: uses parsed root when jsonPath is empty', () => {
      render(<AssertionRowEditor assertion={{ type: 'each', jsonPath: '', fieldPath: 'f', operator: 'equals', value: 'v' }} index={0} sampleJson='[{"status":"ok"}]' onUpdate={mockOnUpdate} onRemove={mockOnRemove} />);
      expect(screen.getByPlaceholderText('field (e.g. rank)')).toBeInTheDocument();
    });

    it('date: keeps timezone when switching today→today', () => {
      render(<AssertionRowEditor assertion={{ type: 'date', jsonPath: '$.a', operator: '>', reference: { kind: 'today', timezone: 'local' } }} {...baseProps} />);
      const kindSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'today');
      fireEvent.change(kindSelect!, { target: { value: 'today' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { reference: { kind: 'today', timezone: 'local' } });
    });

    it('date: keeps iso when switching fixed→fixed', () => {
      render(<AssertionRowEditor assertion={{ type: 'date', jsonPath: '$.a', operator: '>', reference: { kind: 'fixed', iso: '2023-05-05' } }} {...baseProps} />);
      const kindSelect = screen.getAllByRole('combobox').find(s => (s as HTMLSelectElement).value === 'fixed');
      fireEvent.change(kindSelect!, { target: { value: 'fixed' } });
      expect(mockOnUpdate).toHaveBeenCalledWith(0, { reference: { kind: 'fixed', iso: '2023-05-05' } });
    });
  });
});
