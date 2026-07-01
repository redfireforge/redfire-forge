/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GrpcMetadataEditor } from './GrpcMetadataEditor';

function StatefulMetadataEditor({
  initialMetadata = {},
}: {
  initialMetadata?: Record<string, string>;
}) {
  const [metadata, setMetadata] = useState(initialMetadata);
  return (
    <GrpcMetadataEditor
      metadata={metadata}
      onChange={setMetadata}
    />
  );
}

describe('GrpcMetadataEditor (Phase 1F)', () => {
  it('keeps a newly added empty metadata row visible while the user edits', () => {
    render(<StatefulMetadataEditor />);

    fireEvent.click(screen.getByText('+ Add'));

    expect(screen.getAllByPlaceholderText('Key')).toHaveLength(1);
    expect(screen.getAllByPlaceholderText('Value')).toHaveLength(1);
  });

  it('persists completed rows to tab metadata while preserving in-progress empty-key rows', () => {
    const onChange = vi.fn();
    render(<GrpcMetadataEditor metadata={{}} onChange={onChange} />);

    fireEvent.click(screen.getByText('+ Add'));
    const [keyInput, _valueInput] = screen.getAllByPlaceholderText('Key');
    fireEvent.change(keyInput!, { target: { value: 'trace-id' } });
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0]!, { target: { value: 'abc' } });

    expect(onChange).toHaveBeenLastCalledWith({ 'trace-id': 'abc' });
    expect(screen.getByDisplayValue('trace-id')).toBeTruthy();
    expect(screen.getByDisplayValue('abc')).toBeTruthy();
  });

  it('resets editor rows when metadata changes externally', () => {
    const { rerender } = render(
      <GrpcMetadataEditor metadata={{ 'trace-id': '1' }} onChange={vi.fn()} />,
    );

    expect(screen.getByDisplayValue('trace-id')).toBeTruthy();

    rerender(<GrpcMetadataEditor metadata={{}} onChange={vi.fn()} />);

    expect(screen.queryByDisplayValue('trace-id')).toBeNull();
    expect(screen.queryByPlaceholderText('Key')).toBeNull();
  });

  it('shows validation error for value-only row without a key', () => {
    render(<StatefulMetadataEditor />);

    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0]!, {
      target: { value: 'orphan-value' },
    });

    expect(screen.getByTestId('grpc-metadata-validation-error')).toBeTruthy();
  });

  it('reports validation changes through onValidationChange', () => {
    const onValidationChange = vi.fn();
    render(
      <GrpcMetadataEditor
        metadata={{}}
        onChange={vi.fn()}
        onValidationChange={onValidationChange}
      />,
    );

    expect(onValidationChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0]!, {
      target: { value: 'orphan-value' },
    });

    expect(onValidationChange).toHaveBeenLastCalledWith(false);
  });
});
