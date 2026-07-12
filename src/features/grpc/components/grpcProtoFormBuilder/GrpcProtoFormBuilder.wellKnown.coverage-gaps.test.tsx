/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcProtoFormBuilder } from '../GrpcProtoFormBuilder';
import {
  MAP_SCHEMA,
  ONEOF_SCHEMA,
} from './grpcProtoFormBuilderCoverageGaps.testHelpers';

describe('GrpcProtoFormBuilder coverage gaps — well-known and guided cards', () => {
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
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-expand-all-items'));
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
    fireEvent.change(screen.getByTestId('grpc-proto-repeated-token-input-pick.tags'), { target: { value: 'b' } });
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-add-pick.tags'));
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

  it('renders guided-cards presentation with core/map/repeated/oneof sections', () => {
    render(
      <GrpcProtoFormBuilder
        presentation="guided-cards"
        schema={{
          typeName: 'demo.Guided',
          fields: [
            { name: 'message', number: 1, type: 'string', label: 'optional' },
            { name: 'labels', number: 2, type: 'string', label: 'optional', isMap: true, mapKeyType: 'string' },
            { name: 'tags', number: 3, type: 'string', label: 'repeated' },
            { name: 'text', number: 4, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payload' },
            { name: 'count', number: 5, type: 'int32', label: 'optional', isOneofMember: true, oneofName: 'payload' },
          ],
        }}
        body={{ message: 'hello', labels: { env: 'dev' }, tags: ['a'], text: 'selected' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-proto-guided-rail').textContent).toContain('Core Message');
    expect(screen.getByTestId('grpc-proto-guided-card-core')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-guided-card-maps')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-guided-card-repeated')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-guided-card-oneof-payload')).toBeTruthy();
  });

  it('uses plural map title in guided-cards when multiple map fields exist', () => {
    render(
      <GrpcProtoFormBuilder
        presentation="guided-cards"
        schema={{
          typeName: 'demo.GuidedMaps',
          fields: [
            { name: 'labels', number: 1, type: 'string', label: 'optional', isMap: true, mapKeyType: 'string' },
            { name: 'attrs', number: 2, type: 'int32', label: 'optional', isMap: true, mapKeyType: 'string' },
          ],
        }}
        body={{ labels: {}, attrs: {} }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-proto-guided-rail').textContent).toContain('Attributes Map');
  });
});
