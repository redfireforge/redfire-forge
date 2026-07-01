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
});
