/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GrpcMessageSchema } from '@shared/grpc/contracts';
import { GrpcProtoJsonObjectEditor } from './GrpcProtoJsonObjectEditor';

const PAYLOAD_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.Payload',
  fields: [{ name: 'token', number: 1, type: 'uint64', label: 'optional' }],
};

describe('GrpcProtoJsonObjectEditor coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('commits valid JSON objects without a schema', () => {
    const onChange = vi.fn();
    const onErrorChange = vi.fn();

    render(
      <GrpcProtoJsonObjectEditor
        testId="grpc-proto-json-editor"
        value={{ id: 'a' }}
        onChange={onChange}
        onErrorChange={onErrorChange}
        placeholder="enter json"
        rows={6}
      />,
    );

    const editor = screen.getByTestId('grpc-proto-json-editor') as HTMLTextAreaElement;
    expect(editor.placeholder).toBe('enter json');
    expect(editor.rows).toBe(6);

    fireEvent.change(editor, { target: { value: '{\n  "id": "updated"\n}' } });
    expect(onChange).toHaveBeenCalledWith({ id: 'updated' });
    expect(onErrorChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId('grpc-proto-json-editor-error')).toBeNull();
  });

  it('flags arrays, null bodies, and parse failures', () => {
    const onErrorChange = vi.fn();
    render(
      <GrpcProtoJsonObjectEditor
        testId="grpc-proto-json-editor"
        value={{}}
        onChange={vi.fn()}
        onErrorChange={onErrorChange}
      />,
    );

    const editor = screen.getByTestId('grpc-proto-json-editor');
    fireEvent.change(editor, { target: { value: '[1, 2, 3]' } });
    expect(screen.getByTestId('grpc-proto-json-editor-error').textContent).toMatch(/JSON object/i);

    fireEvent.change(editor, { target: { value: 'null' } });
    expect(screen.getByTestId('grpc-proto-json-editor-error').textContent).toMatch(/JSON object/i);

    const originalParse = JSON.parse;
    JSON.parse = () => {
      throw 'not-an-error-object';
    };
    fireEvent.change(editor, { target: { value: '{' } });
    expect(screen.getByTestId('grpc-proto-json-editor-error').textContent).toMatch(/Invalid JSON/i);
    JSON.parse = originalParse;
    expect(onErrorChange).toHaveBeenCalledWith(true);
  });

  it('validates wide integral fields when a message schema is provided', () => {
    const onChange = vi.fn();
    const onErrorChange = vi.fn();

    render(
      <GrpcProtoJsonObjectEditor
        testId="grpc-proto-json-editor"
        value={{ token: '1' }}
        messageSchema={PAYLOAD_SCHEMA}
        onChange={onChange}
        onErrorChange={onErrorChange}
      />,
    );

    const editor = screen.getByTestId('grpc-proto-json-editor');
    fireEvent.change(editor, { target: { value: '{\n  "token": 42\n}' } });
    expect(screen.getByTestId('grpc-proto-json-editor-error').textContent).toMatch(/quoted decimal string/i);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(editor, { target: { value: '{\n  "token": "42"\n}' } });
    expect(onChange).toHaveBeenCalledWith({ token: '42' });
    expect(onErrorChange).toHaveBeenLastCalledWith(false);
  });

  it('resets draft and clears errors when the canonical value changes', () => {
    function EditorHarness() {
      const [value, setValue] = useState<Record<string, unknown>>({ id: 'a' });
      return (
        <>
          <GrpcProtoJsonObjectEditor
            testId="grpc-proto-json-editor"
            value={value}
            onChange={setValue}
            onErrorChange={vi.fn()}
          />
          <button type="button" data-testid="reset-value" onClick={() => setValue({ id: 'b' })}>
            reset
          </button>
        </>
      );
    }

    render(<EditorHarness />);
    const editor = screen.getByTestId('grpc-proto-json-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'not-json' } });
    expect(screen.getByTestId('grpc-proto-json-editor-error')).toBeTruthy();

    fireEvent.click(screen.getByTestId('reset-value'));
    expect(editor.value).toContain('"id": "b"');
    expect(screen.queryByTestId('grpc-proto-json-editor-error')).toBeNull();
  });

  it('honors disabled state and nullish values', () => {
    render(
      <GrpcProtoJsonObjectEditor
        testId="grpc-proto-json-editor"
        value={null}
        disabled
        onChange={vi.fn()}
      />,
    );

    const editor = screen.getByTestId('grpc-proto-json-editor') as HTMLTextAreaElement;
    expect(editor.disabled).toBe(true);
    expect(editor.value).toBe('{}');
  });
});
