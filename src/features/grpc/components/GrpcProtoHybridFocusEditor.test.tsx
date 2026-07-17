/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GrpcMessageSchema } from '../../../shared/grpc/contracts';
import { GrpcProtoHybridFocusEditor } from './GrpcProtoHybridFocusEditor';

vi.mock('./protoFormBuilder/GrpcProtoFieldRow', () => ({
  GrpcProtoFieldRow: ({ onChange, onFieldError }: { onChange: (next: unknown) => void; onFieldError: (hasError: boolean) => void }) => (
    <button
      data-testid="mock-proto-field-row"
      type="button"
      onClick={() => {
        onFieldError(true);
        onChange('42');
      }}
    >
      field
    </button>
  ),
}));

vi.mock('./protoFormBuilder/GrpcProtoOneofGroupRow', () => ({
  GrpcProtoOneofGroupRow: ({ members, onSelectMember, onFieldError }: {
    members: Array<{ name: string }>;
    onSelectMember: (member: { name: string }, nextValue: unknown) => void;
    onFieldError: (memberName: string, hasError: boolean) => void;
  }) => (
    <button
      data-testid="mock-oneof-row"
      type="button"
      onClick={() => {
        const member = members[0]!;
        onFieldError(member.name, true);
        onSelectMember(member, 'x');
      }}
    >
      oneof
    </button>
  ),
}));

const SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.Request',
  fields: [
    { name: 'id', number: 1, type: 'int32', label: 'optional' },
    { name: 'card', number: 2, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payment' },
    { name: 'cash', number: 3, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payment' },
  ],
};

describe('GrpcProtoHybridFocusEditor', () => {
  it('renders empty state when no path is selected', () => {
    render(
      <GrpcProtoHybridFocusEditor
        schema={SCHEMA}
        body={{ id: 1 }}
        selectedPath={null}
        onPatchBody={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-focus-editor').textContent).toContain('Select a field from the navigator');
  });

  it('renders not-found states for missing field and oneof paths', () => {
    const { rerender } = render(
      <GrpcProtoHybridFocusEditor
        schema={SCHEMA}
        body={{ id: 1 }}
        selectedPath="field:missing"
        onPatchBody={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-focus-editor').textContent).toContain('Selected field is no longer available');

    rerender(
      <GrpcProtoHybridFocusEditor
        schema={SCHEMA}
        body={{ id: 1 }}
        selectedPath="oneof:missing"
        onPatchBody={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-focus-editor').textContent).toContain('Selected oneof group is no longer available');
  });

  it('returns unknown path message for unsupported selection path', () => {
    render(
      <GrpcProtoHybridFocusEditor
        schema={SCHEMA}
        body={{ id: 1 }}
        selectedPath="unknown:path"
        onPatchBody={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-focus-editor').textContent).toContain('Unknown selection path');
  });

  it('patches body and reports validity changes for field and oneof edits', () => {
    const onPatchBody = vi.fn();
    const onValidityChange = vi.fn();
    const { rerender } = render(
      <GrpcProtoHybridFocusEditor
        schema={SCHEMA}
        body={{ id: 1, card: 'old' }}
        selectedPath="field:id"
        onPatchBody={onPatchBody}
        onValidityChange={onValidityChange}
      />,
    );

    fireEvent.click(screen.getByTestId('mock-proto-field-row'));
    expect(onPatchBody).toHaveBeenCalledTimes(1);

    rerender(
      <GrpcProtoHybridFocusEditor
        schema={SCHEMA}
        body={{ id: 1, card: 'old' }}
        selectedPath="oneof:payment"
        onPatchBody={onPatchBody}
        onValidityChange={onValidityChange}
      />,
    );

    fireEvent.click(screen.getByTestId('mock-oneof-row'));
    expect(onPatchBody).toHaveBeenCalledTimes(2);
    expect(onValidityChange).toHaveBeenCalled();
  });
});
