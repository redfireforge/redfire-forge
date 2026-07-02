/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GrpcFieldSchema, GrpcMessageSchema } from '../../../../shared/grpc/contracts';
import { GRPC_MAP_PENDING_KEY_PREFIX } from '../../utils/grpcProtoFormValues';
import { GrpcProtoMapFieldRow, GrpcProtoRepeatedFieldRow } from './GrpcProtoRepeatedMapRows';

const STRING_FIELD: GrpcFieldSchema = {
  name: 'tags',
  number: 1,
  type: 'string',
  label: 'repeated',
};

const MAP_FIELD: GrpcFieldSchema = {
  name: 'labels',
  number: 2,
  type: 'string',
  label: 'optional',
  isMap: true,
  mapKeyType: 'string',
};

const REPEATED_MESSAGE_FIELD: GrpcFieldSchema = {
  name: 'items',
  number: 3,
  type: 'message',
  label: 'repeated',
  messageTypeName: 'demo.Payload',
};

const PAYLOAD_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.Payload',
  fields: [{ name: 'id', number: 1, type: 'string', label: 'optional' }],
};

describe('GrpcProtoRepeatedMapRows coverage gaps', () => {
  it('coerces non-array repeated values and uses fieldErrorKey test ids', () => {
    const onFieldError = vi.fn();

    function RepeatedHarness() {
      const [value, setValue] = useState<unknown>('not-an-array');
      return (
        <GrpcProtoRepeatedFieldRow
          field={STRING_FIELD}
          value={value}
          onChange={setValue}
          onFieldError={onFieldError}
          fieldErrorKey="pick.tags"
        />
      );
    }

    render(<RepeatedHarness />);
    expect(screen.queryByTestId('grpc-proto-field-input-pick.tags-0')).toBeNull();
    fireEvent.click(screen.getByText('+ Add item'));
    expect(screen.getByTestId('grpc-proto-field-input-pick.tags-0')).toBeTruthy();
    expect(onFieldError).toHaveBeenCalledWith(false);
  });

  it('renders repeated message editors and reports nested validation errors', () => {
    const onFieldError = vi.fn();
    const messageIndex = new Map([['demo.Payload', PAYLOAD_SCHEMA]]);

    render(
      <GrpcProtoRepeatedFieldRow
        field={REPEATED_MESSAGE_FIELD}
        value={[{}]}
        messageIndex={messageIndex}
        onChange={vi.fn()}
        onFieldError={onFieldError}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-items-0'), {
      target: { value: 'not-json' },
    });
    expect(onFieldError).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-items-0'), {
      target: { value: '{\n  "id": "ok"\n}' },
    });
    expect(onFieldError).toHaveBeenLastCalledWith(false);
  });

  it('reindexes repeated item errors when removing an earlier row', () => {
    function RepeatedHarness() {
      const [value, setValue] = useState<unknown>(['a', 'b']);
      return (
        <GrpcProtoRepeatedFieldRow
          field={STRING_FIELD}
          value={value}
          onChange={setValue}
          onFieldError={vi.fn()}
        />
      );
    }

    render(<RepeatedHarness />);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-tags-1'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByLabelText('Remove tags item 1'));
    expect(screen.queryByTestId('grpc-proto-field-input-tags-1')).toBeNull();
  });

  it('drops repeated row errors when removing the invalid row itself', () => {
    function RepeatedHarness() {
      const [value, setValue] = useState<unknown>(['only']);
      return (
        <GrpcProtoRepeatedFieldRow
          field={STRING_FIELD}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<RepeatedHarness />);
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-tags-0'), { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Remove tags item 1'));
    expect(screen.queryByTestId('grpc-proto-field-input-tags-0')).toBeNull();
  });

  it('coerces non-object map values to empty maps', () => {
    function MapHarness() {
      const [value, setValue] = useState<unknown>(['not-a-map']);
      return (
        <GrpcProtoMapFieldRow
          field={MAP_FIELD}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<MapHarness />);
    fireEvent.click(screen.getByText('+ Add entry'));
    expect(screen.getByTestId('grpc-proto-field-input-labels-key-0')).toBeTruthy();
  });

  it('preserves pending map keys and skips blank persisted keys', () => {
    const onChange = vi.fn();
    const pendingKey = `${GRPC_MAP_PENDING_KEY_PREFIX}1_0`;

    render(
      <GrpcProtoMapFieldRow
        field={MAP_FIELD}
        value={{ [pendingKey]: 'draft' }}
        onChange={onChange}
      />,
    );

    const keyInput = screen.getByTestId('grpc-proto-field-input-labels-key-0') as HTMLInputElement;
    expect(keyInput.value).toBe('');
    fireEvent.change(keyInput, { target: { value: '   ' } });
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-value-0'), {
      target: { value: 'kept' },
    });
    expect(onChange).toHaveBeenCalled();
    const lastBody = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(Object.keys(lastBody).some((key) => key.startsWith(GRPC_MAP_PENDING_KEY_PREFIX))).toBe(true);
  });

  it('creates new pending keys when blank keys are edited on non-pending rows', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoMapFieldRow
        field={MAP_FIELD}
        value={{ env: 'dev' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-key-0'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('reindexes map entry errors and avoids duplicate error bookkeeping', () => {
    const onFieldError = vi.fn();

    function MapHarness() {
      const [value, setValue] = useState<unknown>({ a: '1', b: '2' });
      return (
        <GrpcProtoMapFieldRow
          field={{ ...MAP_FIELD, type: 'int32' }}
          value={value}
          onChange={setValue}
          onFieldError={onFieldError}
        />
      );
    }

    render(<MapHarness />);
    const valueInput = screen.getByTestId('grpc-proto-field-input-labels-value-1');
    fireEvent.change(valueInput, { target: { value: 'bad' } });
    fireEvent.change(valueInput, { target: { value: 'still-bad' } });
    expect(onFieldError).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByLabelText('Remove labels entry 1'));
    expect(screen.queryByTestId('grpc-proto-field-input-labels-value-1')).toBeNull();
  });

  it('renames map keys and removes entries', () => {
    const onChange = vi.fn();
    render(
      <GrpcProtoMapFieldRow
        field={MAP_FIELD}
        value={{ env: 'dev', stage: 'qa' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-labels-key-0'), {
      target: { value: 'region' },
    });
    expect(onChange).toHaveBeenCalledWith({ region: 'dev', stage: 'qa' });

    fireEvent.click(screen.getByLabelText('Remove labels entry 2'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
