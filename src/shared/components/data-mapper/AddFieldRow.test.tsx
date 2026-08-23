/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '@test-utils/customSelectHelper';
import AddFieldRow from './AddFieldRow';

function renderRow(overrides?: Partial<Parameters<typeof AddFieldRow>[0]>) {
  const defaults = {
    existingPaths: new Set<string>(),
    onAdd: vi.fn(),
  };
  return { ...render(<AddFieldRow {...defaults} {...overrides} />), onAdd: overrides?.onAdd ?? defaults.onAdd };
}

describe('AddFieldRow', () => {
  it('shows "+ Add Field" button initially', () => {
    renderRow();
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('opens inline form on button click', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    expect(screen.getByLabelText('Field name')).toBeTruthy();
    expect(screen.getByLabelText('Field type')).toBeTruthy();
  });

  it('calls onAdd with correct field on Enter', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    const input = screen.getByLabelText('Field name');
    fireEvent.change(input, { target: { value: 'myField' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'myField',
      label: 'myField',
      type: 'string',
      origin: 'custom',
    }));
  });

  it('calls onAdd on confirm button click', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'testField' } });
    fireEvent.click(screen.getByLabelText('Confirm add field'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Escape' });
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('cancels on cancel button click', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.click(screen.getByLabelText('Cancel add field'));
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('shows error for empty name', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Field name cannot be empty')).toBeTruthy();
  });

  it('shows error for name with spaces', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'has space' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByText('Field name cannot contain spaces')).toBeTruthy();
  });

  it('shows error for duplicate path', () => {
    renderRow({ existingPaths: new Set(['existingField']) });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'existingField' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByText('Field already exists')).toBeTruthy();
  });

  it('supports nested dot-notation names', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'user.name' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'user.name',
      label: 'name',
      origin: 'custom',
    }));
  });

  it('allows changing field type', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'count' } });
    selectOption(screen.getByLabelText('Field type').closest('.cs-wrapper')!, 'number');
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'count',
      type: 'number',
    }));
  });

  it('resets form after successful add', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'field1' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('clears error when user types', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'a' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects names that collide with typed type::name paths', () => {
    renderRow({ existingPaths: new Set(['body::aaaa']) });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'aaaa' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toMatch(/already exists/i);
  });
});

describe('AddFieldRow – drag-and-drop auto-create', () => {
  function makeDt(payload: Record<string, unknown>) {
    const json = JSON.stringify(payload);
    return {
      getData: (type: string) =>
        type === 'application/mapper-source' ? json : type === 'text/plain' ? `mapper-source:${json}` : '',
      dropEffect: 'none' as string,
    };
  }

  it('creates field with source type from drag payload', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    const btn = screen.getByText('+ Add Field');
    fireEvent.drop(btn, { dataTransfer: makeDt({ path: 'offers[0].duration.value', sourceId: 's1', type: 'number' }) });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'value',
      type: 'number',
      origin: 'custom',
    }));
    expect(onDrop).toHaveBeenCalledWith('value', 'offers[0].duration.value', 's1');
  });

  it('creates field with type "string" when drag payload has type "string"', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'name', sourceId: 's1', type: 'string' }),
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'string' }));
  });

  it('creates field with type "boolean" from drag payload', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'isActive', sourceId: 's1', type: 'boolean' }),
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'boolean' }));
  });

  it('falls back to getDraggedSource ref with type', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    const getDraggedSource = vi.fn().mockReturnValue({ path: 'count', sourceId: 's1', type: 'number' });
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
        getDraggedSource={getDraggedSource}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: { getData: () => '', dropEffect: 'none' },
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'count',
      type: 'number',
    }));
  });

  it('defaults to "string" when neither payload nor ref has type', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    const getDraggedSource = vi.fn().mockReturnValue({ path: 'field', sourceId: 's1' });
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
        getDraggedSource={getDraggedSource}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: { getData: () => '', dropEffect: 'none' },
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'string' }));
  });

  it('deduplicates field name when path already exists', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set(['value'])}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'offers[0].duration.value', sourceId: 's1', type: 'number' }),
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'value_2',
      type: 'number',
    }));
  });

  it('shows drag-over state and reverts on drag leave', () => {
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={vi.fn()}
        onDrop={onDrop}
      />,
    );
    const btn = screen.getByText('+ Add Field');
    fireEvent.dragOver(btn, { dataTransfer: { dropEffect: 'none' } });
    expect(screen.getByText('Drop to create field & map')).toBeTruthy();
    fireEvent.dragLeave(btn);
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('does nothing on drop when onDrop is not provided', () => {
    const onAdd = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'x', sourceId: 's1', type: 'number' }),
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('parses drag payload with mapper-source prefix on application/mapper-source', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    const raw = 'mapper-source:' + JSON.stringify({ path: 'a.b', sourceId: 's9', type: 'number' });
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: {
        getData: (type: string) => (type === 'application/mapper-source' ? raw : ''),
        dropEffect: 'none',
      },
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ path: 'b', type: 'number' }));
  });

  it('uses non-string type in payload as default string field type', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    const json = JSON.stringify({ path: 'x', sourceId: 's1', type: 99 });
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: {
        getData: (type: string) => (type === 'application/mapper-source' ? json : ''),
        dropEffect: 'none',
      },
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'string' }));
  });

  it('falls through to text/plain when application payload is invalid JSON', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    const plain = JSON.stringify({ path: 'ok.plain', sourceId: 's2' });
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: {
        getData: (type: string) => {
          if (type === 'application/mapper-source') return '{bad json';
          if (type === 'text/plain') return plain;
          return '';
        },
        dropEffect: 'none',
      },
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ path: 'plain' }));
    expect(onDrop).toHaveBeenCalled();
  });

  it('returns null from parse when JSON has wrong path types', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: {
        getData: (type: string) => (type === 'application/mapper-source'
          ? JSON.stringify({ path: 1, sourceId: 's1' })
          : ''),
        dropEffect: 'none',
      },
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('uses base name field when last path segment is empty', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>(['field'])}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'foo.', sourceId: 's1', type: 'string' }),
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ path: 'field_2' }));
  });

  it('increments suffix until path is unique', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set(['v', 'v_2'])}
        onAdd={onAdd}
        onDrop={onDrop}
      />,
    );
    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'arr.v', sourceId: 's1' }),
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ path: 'v_3' }));
  });

  it('does not set drag-over styling when onDrop is absent', () => {
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={vi.fn()}
      />,
    );
    const btn = screen.getByText('+ Add Field');
    fireEvent.dragOver(btn, { dataTransfer: { dropEffect: 'none' } });
    expect(screen.queryByText('Drop to create field & map')).toBeNull();
  });

  it('includes location on manual add and on drop', () => {
    const onAdd = vi.fn();
    const onDrop = vi.fn();
    render(
      <AddFieldRow
        existingPaths={new Set<string>()}
        onAdd={onAdd}
        onDrop={onDrop}
        location="body"
      />,
    );
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'solo' } });
    fireEvent.click(screen.getByLabelText('Confirm add field'));
    expect(onAdd).toHaveBeenLastCalledWith(expect.objectContaining({ location: 'body', path: 'solo' }));

    fireEvent.drop(screen.getByText('+ Add Field'), {
      dataTransfer: makeDt({ path: 'z.final', sourceId: 's1' }),
    });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ location: 'body', path: 'final' }));
  });
});
