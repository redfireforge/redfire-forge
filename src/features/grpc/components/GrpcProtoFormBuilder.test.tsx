/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOption } from '@test-utils/customSelectHelper';
import { useState } from 'react';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import type { GrpcMessageSchema } from '@shared/grpc/contracts';
import { GrpcProtoFormBuilder } from './GrpcProtoFormBuilder';

const NESTED_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.NestedRequest',
  fields: [
    {
      name: 'payload',
      number: 1,
      type: 'message',
      label: 'optional',
      messageTypeName: 'demo.Payload',
    },
  ],
};

const REPEATED_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.RepeatedRequest',
  fields: [
    { name: 'tags', number: 1, type: 'string', label: 'repeated' },
  ],
};

const NUMERIC_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.NumericRequest',
  fields: [
    { name: 'quantity', number: 1, type: 'int32', label: 'optional' },
  ],
};

describe('GrpcProtoFormBuilder (Phase 1F)', () => {
  const schema = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.requestSchema;

  it('renders schema fields and emits body updates', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ message: '' }}
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello grpc' } });

    expect(onChange).toHaveBeenCalledWith({ message: 'hello grpc' });
  });

  it('keeps nested message draft editable while JSON is temporarily invalid', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={NESTED_SCHEMA}
        body={{ payload: {} }}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId('grpc-proto-field-input-payload') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{ "name": "partial' } });

    expect(textarea.value).toContain('partial');
    expect(screen.getByTestId('grpc-proto-field-input-payload-error')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: '{ "name": "done" }' } });
    expect(onChange).toHaveBeenCalledWith({ payload: { name: 'done' } });
  });

  it('reports invalid nested JSON through onValidityChange', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={NESTED_SCHEMA}
        body={{ payload: {} }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );

    const textarea = screen.getByTestId('grpc-proto-field-input-payload') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{ invalid' } });
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(textarea, { target: { value: '{ "name": "ok" }' } });
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('supports repeated scalar fields with stable validity reporting', () => {
    const onValidityChange = vi.fn();

    function StatefulRepeatedForm() {
      const [body, setBody] = useState<Record<string, unknown>>({ tags: ['alpha'] });
      return (
        <GrpcProtoFormBuilder
          schema={REPEATED_SCHEMA}
          body={body}
          onChange={setBody}
          onValidityChange={onValidityChange}
        />
      );
    }

    render(<StatefulRepeatedForm />);

    expect(screen.getByTestId('grpc-proto-field-input-tags-0')).toBeTruthy();
    fireEvent.change(screen.getByTestId('grpc-proto-repeated-token-input-tags'), {
      target: { value: 'beta' },
    });
    fireEvent.click(screen.getByTestId('grpc-proto-repeated-add-tags'));

    expect(screen.getByTestId('grpc-proto-field-input-tags-1')).toBeTruthy();
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('reports invalid numeric input through onValidityChange', () => {
    const onValidityChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={NUMERIC_SCHEMA}
        body={{ quantity: 0 }}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );

    const input = screen.getByTestId('grpc-proto-field-input-quantity') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-a-number' } });
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('renders oneof group and switches active member', () => {
    const onChange = vi.fn();
    const schema: GrpcMessageSchema = {
      typeName: 'demo.OneofRequest',
      fields: [
        { name: 'name', number: 1, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payload' },
        { name: 'id', number: 2, type: 'int32', label: 'optional', isOneofMember: true, oneofName: 'payload' },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ name: 'alice' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId('grpc-proto-oneof-payload')).toBeTruthy();
    selectOption(screen.getByTestId('grpc-proto-oneof-select-payload'), 'id');
    expect(onChange).toHaveBeenCalledWith({ id: 0 });
  });

  it('clears oneof member field errors when switching active member', () => {
    const onValidityChange = vi.fn();
    const schema: GrpcMessageSchema = {
      typeName: 'demo.OneofRequest',
      fields: [
        { name: 'name', number: 1, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payload' },
        { name: 'id', number: 2, type: 'int32', label: 'optional', isOneofMember: true, oneofName: 'payload' },
      ],
    };

    function OneofValidityHarness() {
      const [body, setBody] = useState<Record<string, unknown>>({ id: 0 });
      return (
        <GrpcProtoFormBuilder
          schema={schema}
          body={body}
          onChange={setBody}
          onValidityChange={onValidityChange}
        />
      );
    }

    render(<OneofValidityHarness />);

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-id'), { target: { value: 'not-a-number' } });
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    selectOption(screen.getByTestId('grpc-proto-oneof-select-payload'), 'name');
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('renders map field with editable key/value rows', () => {
    const onChange = vi.fn();
    const schema: GrpcMessageSchema = {
      typeName: 'demo.MapRequest',
      fields: [
        { name: 'counts', number: 1, type: 'int32', label: 'optional', isMap: true, mapKeyType: 'string' },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ counts: { a: 1 } }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-value-0'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ counts: { a: 2 } });
  });

  it('keeps pending map row when value changes before key is entered', () => {
    const onChange = vi.fn();
    const schema: GrpcMessageSchema = {
      typeName: 'demo.MapRequest',
      fields: [
        { name: 'counts', number: 1, type: 'int32', label: 'optional', isMap: true, mapKeyType: 'string' },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ counts: {} }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Add entry' }));
    const pendingPatch = onChange.mock.calls.at(-1)?.[0] as { counts: Record<string, unknown> };
    const pendingKey = Object.keys(pendingPatch.counts)[0]!;
    expect(pendingKey).toMatch(/^__grpc_map_pending__/);

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ counts: pendingPatch.counts }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-counts-value-0'), { target: { value: '7' } });
    const valuePatch = onChange.mock.calls.at(-1)?.[0] as { counts: Record<string, unknown> };
    expect(Object.keys(valuePatch.counts)).toContain(pendingKey);
    expect(valuePatch.counts[pendingKey]).toBe(7);
  });

  it('renders Timestamp WKT field with RFC3339 input', () => {
    const onChange = vi.fn();
    const schema: GrpcMessageSchema = {
      typeName: 'demo.TimeRequest',
      fields: [
        { name: 'requested_at', number: 1, type: 'google.protobuf.Timestamp', label: 'optional' },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ requested_at: '2026-06-28T10:00:00Z' }}
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId('grpc-proto-field-input-requested_at') as HTMLInputElement;
    expect(input.value).toBe('2026-06-28T10:00:00Z');
    fireEvent.change(input, { target: { value: '2026-07-01T12:00:00Z' } });
    expect(onChange).toHaveBeenCalledWith({ requested_at: '2026-07-01T12:00:00Z' });
  });

  it('renders google.protobuf.Any with type URL hint (OQ-7)', () => {
    const schema: GrpcMessageSchema = {
      typeName: 'demo.AnyRequest',
      fields: [
        { name: 'payload', number: 1, type: 'google.protobuf.Any', label: 'optional' },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ payload: { '@type': 'type.googleapis.com/demo.Message' } }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-proto-any-hint')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-field-input-payload')).toBeTruthy();
  });

  it('stores int64 field edits as decimal strings (OQ-8)', () => {
    const onChange = vi.fn();
    const schema: GrpcMessageSchema = {
      typeName: 'demo.OrderRequest',
      fields: [
        { name: 'orderId', number: 1, type: 'int64', label: 'optional' },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={schema}
        body={{ orderId: '0' }}
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId('grpc-proto-field-input-orderId') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9007199254740993' } });
    expect(onChange).toHaveBeenCalledWith({ orderId: '9007199254740993' });
  });

  it('rejects numeric int64 literals in nested message JSON editors (OQ-8)', () => {
    const innerSchema = {
      typeName: 'demo.Inner',
      fields: [
        { name: 'id', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };
    const outerSchema = {
      typeName: 'demo.Outer',
      fields: [
        {
          name: 'inner',
          number: 1,
          type: 'message' as const,
          label: 'optional' as const,
          messageTypeName: 'demo.Inner',
        },
      ],
    };

    render(
      <GrpcProtoFormBuilder
        schema={outerSchema}
        messageTypes={[innerSchema, outerSchema]}
        body={{ inner: { id: '0' } }}
        onChange={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId('grpc-proto-field-input-inner') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{ "id": 9007199254740993 }' } });
    expect(screen.getByTestId('grpc-proto-field-input-inner-error')).toBeTruthy();
  });

  it('accumulates rapid sequential field edits without stale body closure', () => {
    const streamSchema = FIXTURE_DESCRIPTOR.services[0]!.methods.find(
      (method) => method.name === 'ServerStream',
    )!.requestSchema;
    const onChange = vi.fn();
    render(
      <GrpcProtoFormBuilder
        schema={streamSchema}
        body={{ message: '', repeat_count: 0, interval_ms: 0 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-message'), {
      target: { value: 'e2e-ss' },
    });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-repeat_count'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-interval_ms'), {
      target: { value: '0' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      message: 'e2e-ss',
      repeat_count: 3,
      interval_ms: 0,
    });
  });
});
