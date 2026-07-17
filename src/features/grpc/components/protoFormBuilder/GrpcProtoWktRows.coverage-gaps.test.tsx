/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GrpcFieldSchema, GrpcMessageSchema } from '../../../../shared/grpc/contracts';
import {
  GrpcProtoAnyFieldRow,
  GrpcProtoNestedMessageFieldRow,
  GrpcProtoWktJsonFieldRow,
  GrpcProtoWktScalarFieldRow,
} from './GrpcProtoWktRows';

describe('GrpcProtoWktRows coverage gaps', () => {
  it('renders non-wrapper timestamp and duration placeholders', () => {
    const onChange = vi.fn();
    render(
      <>
        <GrpcProtoWktScalarFieldRow
          field={{ name: 'createdAt', number: 1, type: 'google.protobuf.Timestamp', label: 'optional' }}
          value="2020-01-01T00:00:00.000Z"
          onChange={onChange}
        />
        <GrpcProtoWktScalarFieldRow
          field={{ name: 'ttl', number: 2, type: 'google.protobuf.Duration', label: 'optional' }}
          value="1s"
          onChange={onChange}
        />
      </>,
    );

    expect((screen.getByTestId('grpc-proto-field-input-createdAt') as HTMLInputElement).placeholder)
      .toMatch(/RFC3339/i);
    expect((screen.getByTestId('grpc-proto-field-input-ttl') as HTMLInputElement).placeholder)
      .toMatch(/1\.5s/);

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-createdAt'), {
      target: { value: '2021-01-01T00:00:00.000Z' },
    });
    expect(onChange).toHaveBeenCalledWith('2021-01-01T00:00:00.000Z');
  });

  it('handles wrapper scalars including bool, int32, int64, and string branches', () => {
    const onChange = vi.fn();
    const onFieldError = vi.fn();

    render(
      <>
        <GrpcProtoWktScalarFieldRow
          field={{ name: 'flag', number: 1, type: 'google.protobuf.BoolValue', label: 'optional' }}
          value={{ value: false }}
          onChange={onChange}
        />
        <GrpcProtoWktScalarFieldRow
          field={{ name: 'count', number: 2, type: 'google.protobuf.Int32Value', label: 'optional' }}
          value={{ value: 3 }}
          onChange={onChange}
        />
        <GrpcProtoWktScalarFieldRow
          field={{ name: 'bigId', number: 3, type: 'google.protobuf.Int64Value', label: 'optional' }}
          value={{ value: '42' }}
          onChange={onChange}
          onFieldError={onFieldError}
        />
        <GrpcProtoWktScalarFieldRow
          field={{ name: 'label', number: 4, type: 'google.protobuf.StringValue', label: 'optional' }}
          value={{ value: 'hello' }}
          onChange={onChange}
        />
      </>,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-flag'), { target: { value: 'true' } });
    expect(onChange).toHaveBeenCalledWith({ value: true });

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-count'), { target: { value: 'not-a-number' } });
    expect(onChange).toHaveBeenCalledWith({ value: 0 });

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-bigId'), { target: { value: 'not-a-number' } });
    expect(onFieldError).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-bigId'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ value: '0' });

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-label'), { target: { value: 'updated' } });
    expect(onChange).toHaveBeenCalledWith({ value: 'updated' });
  });

  it('validates int64 wrappers on mount without an onFieldError callback', () => {
    render(
      <GrpcProtoWktScalarFieldRow
        field={{ name: 'bigId', number: 1, type: 'google.protobuf.Int64Value', label: 'optional' }}
        value={{ value: '9007199254740993' }}
        onChange={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-proto-field-input-bigId') as HTMLInputElement).value).toBe('9007199254740993');
  });

  it('renders Any picker branches and ignores blank selections', () => {
    const onChange = vi.fn();
    const onFieldError = vi.fn();
    const messageIndex = new Map<string, GrpcMessageSchema>([
      ['demo.OrderCreated', { typeName: 'demo.OrderCreated', fields: [] }],
      ['google.protobuf.Any', { typeName: 'google.protobuf.Any', fields: [] }],
    ]);

    const { rerender } = render(
      <GrpcProtoAnyFieldRow
        field={{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }}
        value={{}}
        messageIndex={messageIndex}
        onChange={onChange}
        onFieldError={onFieldError}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-any-type-select-payload'), {
      target: { value: 'demo.OrderCreated' },
    });
    expect(onChange).toHaveBeenCalledWith({
      '@type': 'type.googleapis.com/demo.OrderCreated',
    });
    expect(onFieldError).toHaveBeenCalledWith(false);

    onChange.mockClear();
    fireEvent.change(screen.getByTestId('grpc-proto-any-type-select-payload'), { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <GrpcProtoAnyFieldRow
        field={{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }}
        value={{ '@type': 'type.googleapis.com/demo.ExternalMessage', id: 'x' }}
        messageIndex={messageIndex}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('grpc-proto-any-type-unsupported-payload').textContent)
      .toMatch(/demo\.ExternalMessage/);
  });

  it('omits Any type picker when message index is empty', () => {
    render(
      <GrpcProtoAnyFieldRow
        field={{ name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' }}
        value={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grpc-proto-any-type-select-payload')).toBeNull();
    expect(screen.getByTestId('grpc-proto-any-hint')).toBeTruthy();
  });

  it('renders JSON and nested message editors', () => {
    const onChange = vi.fn();
    const onFieldError = vi.fn();
    const messageSchema: GrpcMessageSchema = {
      typeName: 'demo.Payload',
      fields: [{ name: 'id', number: 1, type: 'string', label: 'optional' }],
    };

    render(
      <>
        <GrpcProtoWktJsonFieldRow
          field={{ name: 'meta', number: 1, type: 'google.protobuf.Struct', label: 'optional' }}
          value={{ k: 1 }}
          onChange={onChange}
          onFieldError={onFieldError}
        />
        <GrpcProtoNestedMessageFieldRow
          field={{
            name: 'child',
            number: 2,
            type: 'message',
            label: 'optional',
            messageTypeName: 'demo.Payload',
          } as GrpcFieldSchema}
          value={{ id: 'a' }}
          messageSchema={messageSchema}
          onChange={onChange}
          onFieldError={onFieldError}
        />
      </>,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-meta'), {
      target: { value: '{\n  "k": 2\n}' },
    });
    expect(onChange).toHaveBeenCalledWith({ k: 2 });
    expect(screen.getByTestId('grpc-proto-field-input-child')).toBeTruthy();
  });
});
