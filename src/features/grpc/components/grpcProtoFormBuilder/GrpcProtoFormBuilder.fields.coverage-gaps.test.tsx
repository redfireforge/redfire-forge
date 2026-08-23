/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getCustomSelectValue, selectOption } from '@test-utils/customSelectHelper';
import { GrpcProtoFormBuilder } from '../GrpcProtoFormBuilder';
import {
  ENUM_BOOL_SCHEMA,
  MAP_SCHEMA,
  ONEOF_SCHEMA,
  REPEATED_MESSAGE_SCHEMA,
} from './grpcProtoFormBuilderCoverageGaps.testHelpers';

describe('GrpcProtoFormBuilder coverage gaps — fields and validation', () => {
  it('adds and removes repeated message items', () => {
    const onChange = vi.fn();

    function RepeatedMessageHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ items: [{}] });
      return (
        <GrpcProtoFormBuilder
          schema={REPEATED_MESSAGE_SCHEMA}
          body={body}
          onChange={(next) => {
            setBody(next);
            onChange(next);
          }}
        />
      );
    }

    render(<RepeatedMessageHarness />);
    fireEvent.click(screen.getByText('+ Add item'));
    expect(screen.getByTestId('grpc-proto-field-input-items-1')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Remove items item 2'));
    expect(onChange).toHaveBeenLastCalledWith({ items: [{}] });
  });

  it('renders disabled scalar controls without editable inputs', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.Simple',
          fields: [{ name: 'message', number: 1, type: 'string', label: 'optional' }],
        }}
        body={{ message: '' }}
        onChange={vi.fn()}
        disabled
      />,
    );

    const input = screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('renders map fields as editable key/value rows', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={MAP_SCHEMA}
        body={{ labels: { env: 'dev' } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-value-0'), { target: { value: 'prod' } });
    expect(onChange).toHaveBeenCalledWith({ labels: { env: 'prod' } });
  });

  it('switches oneof members and reports validity changes', () => {
    const onValidityChange = vi.fn();
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={ONEOF_SCHEMA}
        body={{ text: 'hello' }}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-proto-oneof-select-payload'), 'count');
    expect(onChange).toHaveBeenCalled();
    expect(onValidityChange).toHaveBeenCalledWith(true);
  });

  it('renders enum and bool controls and validates numeric input', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={ENUM_BOOL_SCHEMA}
        body={{ status: 0, enabled: false, size: 0 }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-proto-field-input-enabled'), 'true');
    selectOption(screen.getByTestId('grpc-proto-field-input-status'), 'OK');
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-size'), { target: { value: 'not-a-number' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
  });

  it('shows nested JSON parse errors', () => {
    render(
      <GrpcProtoFormBuilder
        schema={REPEATED_MESSAGE_SCHEMA}
        body={{ items: [{}] }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-expand-all-items'));
    const editor = screen.getByTestId('grpc-proto-field-input-items-0') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'not-json' } });
    expect(screen.getByTestId('grpc-proto-field-input-items-0-error')).toBeTruthy();
  });

  it('renders empty schema message when no fields exist', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{ typeName: 'demo.Empty', fields: [] }}
        body={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-proto-form-empty')).toBeTruthy();
  });

  it('renders bytes and repeated string scalar fields', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.BytesRepeated',
          fields: [
            { name: 'payload', number: 1, type: 'bytes', label: 'optional' },
            { name: 'tags', number: 2, type: 'string', label: 'repeated' },
          ],
        }}
        body={{ payload: '', tags: ['a'] }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-payload'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('grpc-proto-repeated-token-input-tags'), { target: { value: 'b' } });
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-add-tags'));
    expect(onChange).toHaveBeenCalled();
  });

  it('clears oneof sibling field errors when switching members', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={ONEOF_SCHEMA}
        body={{ count: 'bad' }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: 'not-a-number' } });
    selectOption(screen.getByTestId('grpc-proto-oneof-select-payload'), 'text');
    expect(onValidityChange).toHaveBeenCalledWith(true);
  });

  it('shows map badge labels for message and enum value types', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.MapBadges',
          fields: [
            {
              name: 'payloads',
              number: 1,
              type: 'message',
              label: 'optional',
              isMap: true,
              mapKeyType: 'string',
              messageTypeName: 'demo.Payload',
            },
            {
              name: 'statuses',
              number: 2,
              type: 'enum',
              label: 'optional',
              isMap: true,
              mapKeyType: 'int32',
              enumTypeName: 'demo.Status',
            },
          ],
        }}
        body={{ payloads: {}, statuses: {} }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-proto-field-payloads').textContent).toMatch(/map<string, demo\.Payload>/);
    expect(screen.getByTestId('grpc-proto-field-statuses').textContent).toMatch(/map<int32, demo\.Status>/);
  });

  it('reports nested JSON array values as invalid objects', () => {
    render(
      <GrpcProtoFormBuilder
        schema={REPEATED_MESSAGE_SCHEMA}
        body={{ items: [{}] }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-expand-all-items'));
    const editor = screen.getByTestId('grpc-proto-field-input-items-0') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '[1, 2, 3]' } });
    expect(screen.getByTestId('grpc-proto-field-input-items-0-error').textContent).toMatch(/JSON object/i);
  });

  it('renders repeated enum scalar controls', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.RepeatedEnum',
          fields: [{
            name: 'statuses',
            number: 1,
            type: 'enum',
            label: 'repeated',
            enumTypeName: 'demo.Status',
            enumValues: [{ name: 'UNKNOWN', number: 0 }, { name: 'OK', number: 1 }],
          }],
        }}
        body={{ statuses: [0] }}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-proto-field-input-statuses-0'), 'OK');
    expect(onChange).toHaveBeenCalledWith({ statuses: [1] });
  });

  it('normalizes non-finite numeric seed values to a valid draft', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.Numeric',
          fields: [{ name: 'ratio', number: 1, type: 'double', label: 'optional' }],
        }}
        body={{ ratio: Number.NaN }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    expect(onValidityChange).toHaveBeenCalledWith(true);
  });

  it('reports repeated scalar item validation errors', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.RepeatedInt',
          fields: [{ name: 'counts', number: 1, type: 'int32', label: 'repeated' }],
        }}
        body={{ counts: [1] }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-0'), { target: { value: 'bad' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
  });

  it('uses default string key type in map badge when mapKeyType is omitted', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.IntMap',
          fields: [{
            name: 'counts',
            number: 1,
            type: 'int32',
            label: 'optional',
            isMap: true,
          }],
        }}
        body={{ counts: { a: 1 } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-proto-field-counts').textContent).toMatch(/map<string, int32>/);
  });

  it('coerces non-array repeated values to empty lists', () => {
    function NonArrayHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ tags: 'not-an-array' });
      return (
        <GrpcProtoFormBuilder
          schema={{
            typeName: 'demo.RepeatedString',
            fields: [{ name: 'tags', number: 1, type: 'string', label: 'repeated' }],
          }}
          body={body}
          onChange={setBody}
        />
      );
    }

    render(<NonArrayHarness />);
    fireEvent.change(screen.getByTestId('grpc-proto-repeated-token-input-tags'), { target: { value: 'first' } });
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-add-tags'));
    expect(screen.getByTestId('grpc-proto-field-input-tags-0')).toBeTruthy();
  });

  it('reindexes repeated item errors when removing an earlier row', () => {
    function RepeatedHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ counts: [1, 2] });
      return (
        <GrpcProtoFormBuilder
          schema={{
            typeName: 'demo.RepeatedInt',
            fields: [{ name: 'counts', number: 1, type: 'int32', label: 'repeated' }],
          }}
          body={body}
          onChange={setBody}
          onValidityChange={vi.fn()}
        />
      );
    }

    render(<RepeatedHarness />);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-1'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByLabelText('Remove counts item 1'));
    expect(screen.queryByTestId('grpc-proto-field-input-counts-1')).toBeNull();
  });

  it('clears numeric fields to zero from an empty draft', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.NumericOptional',
          fields: [{ name: 'count', number: 1, type: 'int32', label: 'optional' }],
        }}
        body={{ count: 5 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ count: 0 });
  });

  it('defaults optional enum selects to the first enum value', () => {
    render(
      <GrpcProtoFormBuilder
        schema={ENUM_BOOL_SCHEMA}
        body={{}}
        onChange={vi.fn()}
      />,
    );
    expect(getCustomSelectValue(screen.getByTestId('grpc-proto-field-input-status'))).toBe('UNKNOWN');
  });

  it('renders nested message fields with JSON editors', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.Nested',
          fields: [{
            name: 'payload',
            number: 1,
            type: 'message',
            label: 'optional',
            messageTypeName: 'demo.Payload',
          }],
        }}
        body={{ payload: { id: 1 } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-proto-field-input-payload')).toBeTruthy();
  });

  it('renders bool selects for false values', () => {
    render(
      <GrpcProtoFormBuilder
        schema={ENUM_BOOL_SCHEMA}
        body={{ enabled: false }}
        onChange={vi.fn()}
      />,
    );
    expect(getCustomSelectValue(screen.getByTestId('grpc-proto-field-input-enabled'))).toBe('false');
  });

  it('drops repeated row errors when removing the invalid row itself', () => {
    function RepeatedHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ counts: [1] });
      return (
        <GrpcProtoFormBuilder
          schema={{
            typeName: 'demo.RepeatedInt',
            fields: [{ name: 'counts', number: 1, type: 'int32', label: 'repeated' }],
          }}
          body={body}
          onChange={setBody}
        />
      );
    }

    render(<RepeatedHarness />);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-0'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByLabelText('Remove counts item 1'));
    expect(screen.queryByTestId('grpc-proto-field-input-counts-0')).toBeNull();
  });

  it('shows non-Error JSON parse failures in nested editors', () => {
    const originalParse = JSON.parse;
    JSON.parse = () => {
      throw 'not-an-error-object';
    };
    render(
      <GrpcProtoFormBuilder
        schema={REPEATED_MESSAGE_SCHEMA}
        body={{ items: [{}] }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-expand-all-items'));
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-items-0'), { target: { value: '{' } });
    expect(screen.getByTestId('grpc-proto-field-input-items-0-error').textContent).toMatch(/Invalid JSON/i);
    JSON.parse = originalParse;
  });

  it('commits finite numeric values from repeated scalar rows', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.RepeatedInt',
          fields: [{ name: 'counts', number: 1, type: 'int32', label: 'repeated' }],
        }}
        body={{ counts: [0] }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-0'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith({ counts: [42] });
  });

  it('renders well-known scalar and JSON field types', () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.WktRequest',
          fields: [
            { name: 'createdAt', number: 1, type: 'google.protobuf.Timestamp', label: 'optional' },
            { name: 'ttl', number: 2, type: 'google.protobuf.Duration', label: 'optional' },
            { name: 'flag', number: 3, type: 'google.protobuf.BoolValue', label: 'optional' },
            { name: 'label', number: 4, type: 'google.protobuf.StringValue', label: 'optional' },
            { name: 'count', number: 5, type: 'google.protobuf.Int32Value', label: 'optional' },
            { name: 'bigId', number: 6, type: 'google.protobuf.Int64Value', label: 'optional' },
            { name: 'payload', number: 7, type: 'google.protobuf.Any', label: 'optional' },
            { name: 'meta', number: 8, type: 'google.protobuf.Struct', label: 'optional' },
          ],
        }}
        body={{
          createdAt: '2020-01-01T00:00:00.000Z',
          ttl: '1s',
          flag: { value: false },
          label: { value: 'x' },
          count: { value: 1 },
          bigId: { value: '42' },
          payload: { '@type': 'type.googleapis.com/demo.Payload' },
          meta: { k: 1 },
        }}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />,
    );

    expect(screen.getByTestId('grpc-proto-any-hint')).toBeTruthy();
    selectOption(screen.getByTestId('grpc-proto-field-input-flag'), 'true');
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-label'), { target: { value: 'renamed' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: '9' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-bigId'), { target: { value: 'not-a-number' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and removes map entries including pending keys', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={MAP_SCHEMA}
        body={{ labels: { env: 'dev' } }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('+ Add entry'));
    expect(onChange).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Remove labels entry 1'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('switches oneof members via radio buttons and edits active field', () => {
    const onChange = vi.fn();

    function OneofHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ text: 'hello' });
      return (
        <GrpcProtoFormBuilder
          schema={ONEOF_SCHEMA}
          body={body}
          onChange={(next) => {
            setBody(next);
            onChange(next);
          }}
        />
      );
    }

    render(<OneofHarness />);
    fireEvent.click(screen.getByTestId('grpc-proto-oneof-radio-payload-count'));
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ count: 3 });
  });

  it('validates wide integral scalar fields', () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.WideIntegral',
          fields: [
            { name: 'orderId', number: 1, type: 'int64', label: 'optional' },
            { name: 'token', number: 2, type: 'uint64', label: 'optional' },
          ],
        }}
        body={{ orderId: '42', token: '99' }}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-token'), { target: { value: '-1' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-orderId'), { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith({ orderId: '100', token: '99' });
  });

  it('reindexes map entry validation errors when removing rows', () => {
    function MapHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({
        counts: { a: '1', b: '2' },
      });
      return (
        <GrpcProtoFormBuilder
          schema={{
            typeName: 'demo.Int64Map',
            fields: [{
              name: 'counts',
              number: 1,
              type: 'int64',
              label: 'optional',
              isMap: true,
              mapKeyType: 'string',
            }],
          }}
          body={body}
          onChange={setBody}
          onValidityChange={vi.fn()}
        />
      );
    }

    render(<MapHarness />);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-value-1'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByLabelText('Remove counts entry 1'));
    expect(screen.queryByTestId('grpc-proto-field-input-counts-value-1')).toBeNull();
  });

  it('renders nested messages with schema index for wide-integral validation', () => {
    const innerSchema: GrpcMessageSchema = {
      typeName: 'demo.Payload',
      fields: [{ name: 'token', number: 1, type: 'uint64', label: 'optional' }],
    };
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.Outer',
          fields: [{
            name: 'payload',
            number: 1,
            type: 'message',
            label: 'optional',
            messageTypeName: 'demo.Payload',
          }],
        }}
        body={{ payload: { token: '1' } }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
        messageTypes={[innerSchema]}
      />,
    );
    fireEvent.change(
      screen.getByTestId('grpc-proto-field-input-payload'),
      { target: { value: '{\n  "token": 42\n}' } },
    );
    expect(onValidityChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('grpc-proto-field-input-payload-error').textContent).toMatch(/quoted decimal string/i);
  });

  it('renames map keys and keeps pending keys when key input is cleared', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={MAP_SCHEMA}
        body={{ labels: { env: 'dev' } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-key-0'), { target: { value: 'stage' } });
    expect(onChange).toHaveBeenCalledWith({ labels: { stage: 'dev' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-key-0'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalled();
  });

});
