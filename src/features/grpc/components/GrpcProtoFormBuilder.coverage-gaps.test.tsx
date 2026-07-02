/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GrpcMessageSchema } from '../../../shared/grpc/contracts';
import { GrpcProtoFormBuilder } from './GrpcProtoFormBuilder';

const REPEATED_MESSAGE_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.RepeatedNestedRequest',
  fields: [
    {
      name: 'items',
      number: 1,
      type: 'message',
      label: 'repeated',
      messageTypeName: 'demo.Payload',
    },
  ],
};

const MAP_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.MapRequest',
  fields: [{
    name: 'labels',
    number: 1,
    type: 'string',
    label: 'optional',
    isMap: true,
    mapKeyType: 'string',
  }],
};

const ONEOF_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.OneofRequest',
  fields: [
    { name: 'text', number: 1, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payload' },
    { name: 'count', number: 2, type: 'int32', label: 'optional', isOneofMember: true, oneofName: 'payload' },
  ],
};

const ENUM_BOOL_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.EnumBoolRequest',
  fields: [
    {
      name: 'status',
      number: 1,
      type: 'enum',
      label: 'optional',
      enumTypeName: 'demo.Status',
      enumValues: [{ name: 'UNKNOWN', number: 0 }, { name: 'OK', number: 1 }],
    },
    { name: 'enabled', number: 2, type: 'bool', label: 'optional' },
    { name: 'size', number: 3, type: 'int32', label: 'optional' },
  ],
};

describe('GrpcProtoFormBuilder coverage gaps', () => {
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
    fireEvent.change(screen.getByTestId('grpc-proto-oneof-select-payload'), { target: { value: 'count' } });
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
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-enabled'), { target: { value: 'true' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-status'), { target: { value: '1' } });
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
    fireEvent.click(screen.getByText('+ Add item'));
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
    fireEvent.change(screen.getByTestId('grpc-proto-oneof-select-payload'), { target: { value: 'text' } });
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
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-statuses-0'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith({ statuses: [1] });
  });

  it('flags non-finite numeric values when draft is cleared', () => {
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
    expect(onValidityChange).toHaveBeenCalledWith(false);
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
    fireEvent.click(screen.getByText('+ Add item'));
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
    expect((screen.getByTestId('grpc-proto-field-input-status') as HTMLSelectElement).value).toBe('0');
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
    expect((screen.getByTestId('grpc-proto-field-input-enabled') as HTMLSelectElement).value).toBe('false');
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
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-flag'), { target: { value: 'true' } });
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

  it('renders repeated bool items and float scalar fields', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.MixedScalars',
          fields: [
            { name: 'flags', number: 1, type: 'bool', label: 'repeated' },
            { name: 'ratio', number: 2, type: 'double', label: 'optional' },
          ],
        }}
        body={{ flags: [false], ratio: 1.5 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-flags-0'), { target: { value: 'true' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-ratio'), { target: { value: '2.5' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('clears field-level validation errors after valid input', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.Numeric',
          fields: [{ name: 'count', number: 1, type: 'int32', label: 'optional' }],
        }}
        body={{ count: 0 }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: '7' } });
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('renders repeated nested messages when message types are provided', () => {
    const payloadSchema: GrpcMessageSchema = {
      typeName: 'demo.Payload',
      fields: [{ name: 'id', number: 1, type: 'string', label: 'optional' }],
    };
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.RepeatedNested',
          fields: [{
            name: 'items',
            number: 1,
            type: 'message',
            label: 'repeated',
            messageTypeName: 'demo.Payload',
          }],
        }}
        body={{ items: [{ id: 'a' }] }}
        onChange={onChange}
        messageTypes={[payloadSchema]}
      />,
    );
    fireEvent.change(
      screen.getByTestId('grpc-proto-field-input-items-0'),
      { target: { value: '{\n  "id": "updated"\n}' } },
    );
    expect(onChange).toHaveBeenCalledWith({ items: [{ id: 'updated' }] });
  });

  it('renders oneof repeated members with scoped field error keys', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.OneofRepeated',
          fields: [
            { name: 'tags', number: 1, type: 'string', label: 'repeated', isOneofMember: true, oneofName: 'pick' },
            { name: 'count', number: 2, type: 'int32', label: 'optional', isOneofMember: true, oneofName: 'pick' },
          ],
        }}
        body={{ tags: ['a'] }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('grpc-proto-field-input-pick.tags-0')).toBeTruthy();
    fireEvent.click(screen.getByText('+ Add item'));
    expect(onChange).toHaveBeenCalled();
  });

  it('preserves pending map keys when a new entry key is left blank', () => {
    function MapHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ labels: {} });
      return (
        <GrpcProtoFormBuilder
          schema={MAP_SCHEMA}
          body={body}
          onChange={setBody}
        />
      );
    }

    render(<MapHarness />);
    fireEvent.click(screen.getByText('+ Add entry'));
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-key-0'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-value-0'), { target: { value: 'pending' } });
    expect(screen.getByTestId('grpc-proto-field-input-labels-value-0')).toBeTruthy();
  });

  it('renders enum badge labels and optional field notes on scalar rows', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.EnumNote',
          fields: [{
            name: 'mode',
            number: 3,
            type: 'enum',
            label: 'optional',
            enumTypeName: 'demo.Mode',
            enumValues: [{ name: 'UNKNOWN', number: 0 }],
          }],
        }}
        body={{ mode: 0 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-proto-field-mode').textContent).toMatch(/enum/);
    expect(screen.getByTestId('grpc-proto-field-mode').textContent).toMatch(/#3 optional/);
  });

  it('validates wide integral defaults on mount and clears repeated item errors', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.RepeatedOnly',
          fields: [{ name: 'counts', number: 1, type: 'int32', label: 'repeated' }],
        }}
        body={{ counts: [1] }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-0'), { target: { value: 'bad' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-0'), { target: { value: '2' } });
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('omits blank map keys from persisted map bodies', () => {
    function MapHarness() {
      const [body, setBody] = useState< Record<string, unknown>>({ labels: {} });
      return (
        <GrpcProtoFormBuilder
          schema={MAP_SCHEMA}
          body={body}
          onChange={setBody}
        />
      );
    }

    render(<MapHarness />);
    fireEvent.click(screen.getByText('+ Add entry'));
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-value-0'), { target: { value: 'only-value' } });
    expect(screen.getByTestId('grpc-proto-field-input-labels-value-0')).toBeTruthy();
  });

  it('avoids duplicate field error state updates for repeated invalid edits', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.DuplicateErrors',
          fields: [{ name: 'count', number: 1, type: 'int32', label: 'optional' }],
        }}
        body={{ count: 0 }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    const input = screen.getByTestId('grpc-proto-field-input-count');
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.change(input, { target: { value: 'worse' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
  });

  it('flags invalid wide integral values on mount before editing', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.InvalidWide',
          fields: [{ name: 'orderId', number: 1, type: 'int64', label: 'optional' }],
        }}
        body={{ orderId: 'not-a-number' }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    expect(onValidityChange).toHaveBeenCalledWith(false);
  });

  it('renders bytes placeholders and nested messages without a schema index', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.BytesNested',
          fields: [
            { name: 'payload', number: 1, type: 'bytes', label: 'optional' },
            { name: 'child', number: 2, type: 'message', label: 'optional', messageTypeName: 'demo.Child' },
          ],
        }}
        body={{ payload: '', child: {} }}
        onChange={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-proto-field-input-payload') as HTMLInputElement).placeholder)
      .toMatch(/base64/i);
    expect(screen.getByTestId('grpc-proto-field-input-child')).toBeTruthy();
  });

  it('renders Any type picker from message types and writes @type on selection', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [
            { name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' },
          ],
        }}
        body={{ payload: {} }}
        onChange={onChange}
        messageTypes={[
          { typeName: 'demo.OrderCreated', fields: [] },
          { typeName: 'demo.OrderCancelled', fields: [] },
        ]}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-any-type-select-payload'), {
      target: { value: 'demo.OrderCreated' },
    });
    expect(onChange).toHaveBeenCalledWith({
      payload: {
        '@type': 'type.googleapis.com/demo.OrderCreated',
      },
    });
  });

  it('shows custom Any type note when current @type is not in loaded schema list', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [
            { name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' },
          ],
        }}
        body={{
          payload: {
            '@type': 'type.googleapis.com/demo.ExternalMessage',
            id: 'x',
          },
        }}
        onChange={vi.fn()}
        messageTypes={[
          { typeName: 'demo.OrderCreated', fields: [] },
        ]}
      />,
    );

    expect(screen.getByTestId('grpc-proto-any-type-unsupported-payload').textContent)
      .toMatch(/demo\.ExternalMessage/);
  });

  it('switches oneof members without clearing sibling errors when none exist', () => {
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
    fireEvent.change(screen.getByTestId('grpc-proto-oneof-select-payload'), { target: { value: 'count' } });
    expect(onChange).toHaveBeenCalledWith({ count: 0 });
  });

  it('keeps pending map storage keys when blank keys are edited', () => {
    function MapHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ labels: {} });
      return (
        <GrpcProtoFormBuilder
          schema={MAP_SCHEMA}
          body={body}
          onChange={setBody}
        />
      );
    }
    render(<MapHarness />);
    fireEvent.click(screen.getByText('+ Add entry'));
    const keyInput = screen.getByTestId('grpc-proto-field-input-labels-key-0') as HTMLInputElement;
    expect(keyInput.value).toBe('');
    fireEvent.change(keyInput, { target: { value: '   ' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-value-0'), { target: { value: 'v' } });
    expect(screen.getByTestId('grpc-proto-field-input-labels-value-0')).toBeTruthy();
  });

  it('ignores unknown oneof select values', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={ONEOF_SCHEMA}
        body={{ text: 'hello' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-oneof-select-payload'), { target: { value: 'missing-member' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits valid wide integral strings and clears them back to zero', () => {
    const onChange = vi.fn();
    function WideHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ orderId: '' });
      return (
        <GrpcProtoFormBuilder
          schema={{
            typeName: 'demo.WideIntegralCommit',
            fields: [{ name: 'orderId', number: 1, type: 'int64', label: 'optional' }],
          }}
          body={body}
          onChange={(next) => {
            setBody(next);
            onChange(next);
          }}
        />
      );
    }
    render(<WideHarness />);
    const input = screen.getByTestId('grpc-proto-field-input-orderId');
    fireEvent.change(input, { target: { value: '9007199254740993' } });
    expect(onChange).toHaveBeenCalledWith({ orderId: '9007199254740993' });
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ orderId: '0' });
  });

  it('skips repeated row error bookkeeping when the same row stays invalid', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.RepeatedInvalid',
          fields: [{ name: 'counts', number: 1, type: 'int32', label: 'repeated' }],
        }}
        body={{ counts: [0] }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );
    const input = screen.getByTestId('grpc-proto-field-input-counts-0');
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.change(input, { target: { value: 'still-bad' } });
    expect(onValidityChange).toHaveBeenCalledWith(false);
  });

  it('renders float and bytes fields with valid edits', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.PrimitiveRequest',
          fields: [
            { name: 'ratio', number: 1, type: 'float', label: 'optional' },
            { name: 'payload', number: 2, type: 'bytes', label: 'optional' },
          ],
        }}
        body={{ ratio: 0, payload: '' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-ratio'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-payload'), { target: { value: 'aGVsbG8=' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders double and unsigned integral fields', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.WideNumericRequest',
          fields: [
            { name: 'amount', number: 1, type: 'double', label: 'optional' },
            { name: 'count', number: 2, type: 'uint32', label: 'optional' },
            { name: 'tag', number: 3, type: 'fixed32', label: 'optional' },
          ],
        }}
        body={{ amount: 0, count: 0, tag: 0 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-amount'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: '42' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-tag'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('defaults google.protobuf.Int32Value wrapper edits to zero for invalid numbers', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.WrapperRequest',
          fields: [{ name: 'count', number: 1, type: 'google.protobuf.Int32Value', label: 'optional' }],
        }}
        body={{ count: { value: 1 } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: 'not-a-number' } });
    expect(onChange).toHaveBeenCalledWith({ count: { value: 0 } });
  });

  it('writes slash-containing Any type selections without adding a second prefix', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }],
        }}
        body={{ payload: {} }}
        onChange={onChange}
        messageTypes={[
          { typeName: 'custom.example.com/demo.ExternalMessage', fields: [] },
        ]}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-any-type-select-payload'), {
      target: { value: 'custom.example.com/demo.ExternalMessage' },
    });
    expect(onChange).toHaveBeenCalledWith({
      payload: {
        '@type': 'custom.example.com/demo.ExternalMessage',
      },
    });
  });

  it('ignores blank Any type selections', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }],
        }}
        body={{
          payload: { '@type': 'type.googleapis.com/demo.OrderCreated' },
        }}
        onChange={onChange}
        messageTypes={[
          { typeName: 'demo.OrderCreated', fields: [] },
          { typeName: 'demo.OrderCancelled', fields: [] },
        ]}
      />,
    );
    onChange.mockClear();
    fireEvent.change(screen.getByTestId('grpc-proto-any-type-select-payload'), { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders message map field badges', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.MessageMapRequest',
          fields: [{
            name: 'payloads',
            number: 1,
            type: 'message',
            label: 'optional',
            isMap: true,
            mapKeyType: 'string',
            messageTypeName: 'demo.Payload',
          }],
        }}
        body={{ payloads: {} }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/map<string, demo.Payload>/)).toBeTruthy();
  });

  it('updates google.protobuf.StringValue wrappers from scalar edits', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.StringWrapperRequest',
          fields: [{ name: 'label', number: 1, type: 'google.protobuf.StringValue', label: 'optional' }],
        }}
        body={{ label: { value: 'hello' } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-label'), { target: { value: 'updated' } });
    expect(onChange).toHaveBeenCalledWith({ label: { value: 'updated' } });
  });

  it('parses Any bodies with slash-delimited and plain type URLs', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }],
        }}
        body={{ payload: { '@type': 'custom.example.com/demo.ExternalMessage', id: 'x' } }}
        onChange={vi.fn()}
        messageTypes={[{ typeName: 'demo.OtherMessage', fields: [] }]}
      />,
    );
    expect(screen.getByTestId('grpc-proto-any-type-unsupported-payload').textContent)
      .toMatch(/ExternalMessage/);
  });

  it('ignores Any payloads with non-string or empty @type values', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }],
        }}
        body={{ payload: { '@type': 123 } }}
        onChange={vi.fn()}
        messageTypes={[{ typeName: 'demo.Message', fields: [] }]}
      />,
    );
    expect(screen.getByTestId('grpc-proto-any-type-select-payload')).toBeTruthy();
    expect(screen.queryByTestId('grpc-proto-any-type-unsupported-payload')).toBeNull();
  });

  it('renders plain Any type names without a type.googleapis.com prefix', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }],
        }}
        body={{ payload: { '@type': 'PlainMessageName' } }}
        onChange={vi.fn()}
        messageTypes={[{ typeName: 'demo.OtherMessage', fields: [] }]}
      />,
    );
    expect(screen.getByTestId('grpc-proto-any-type-unsupported-payload').textContent)
      .toMatch(/PlainMessageName/);
  });

  it('updates google.protobuf.BoolValue wrappers from select edits', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.BoolWrapperRequest',
          fields: [{ name: 'enabled', number: 1, type: 'google.protobuf.BoolValue', label: 'optional' }],
        }}
        body={{ enabled: { value: false } }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-enabled'), { target: { value: 'true' } });
    expect(onChange).toHaveBeenCalledWith({ enabled: { value: true } });
  });

  it('ignores Any payloads with whitespace-only @type values', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.AnyRequest',
          fields: [{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }],
        }}
        body={{ payload: { '@type': '   ' } }}
        onChange={vi.fn()}
        messageTypes={[{ typeName: 'demo.Message', fields: [] }]}
      />,
    );
    expect(screen.queryByTestId('grpc-proto-any-type-unsupported-payload')).toBeNull();
  });

  it('renders generic map badges for scalar value types', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{
          typeName: 'demo.ScalarMapRequest',
          fields: [{
            name: 'counts',
            number: 1,
            type: 'int32',
            label: 'optional',
            isMap: true,
            mapKeyType: 'string',
          }],
        }}
        body={{ counts: {} }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-proto-field-counts').textContent).toMatch(/map<string, int32>/);
  });
});
