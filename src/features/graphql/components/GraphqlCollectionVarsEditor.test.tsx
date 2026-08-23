/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CollectionVarsEditor } from './GraphqlCollectionVarsEditor';
import type { GraphqlCollection } from '@shared/types/graphql';

function makeCollection(variables: Record<string, string> = {}): GraphqlCollection {
  return {
    id: 'col-1',
    name: 'Test Collection',
    items: [],
    folders: [],
    variables,
    preRequestScript: '',
    postResponseScript: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('CollectionVarsEditor', () => {
  it('renders the editor container', () => {
    render(<CollectionVarsEditor collection={makeCollection()} onSave={vi.fn()} />);
    expect(screen.getByTestId('gql-col-vars-editor')).toBeInTheDocument();
  });

  it('renders existing variable rows from collection', () => {
    render(
      <CollectionVarsEditor collection={makeCollection({ baseUrl: 'http://api', token: 'abc' })} onSave={vi.fn()} />,
    );
    const keys = screen.getAllByTestId('gql-col-vars-key');
    const values = screen.getAllByTestId('gql-col-vars-value');
    expect(keys).toHaveLength(2);
    expect(keys[0]).toHaveValue('baseUrl');
    expect(values[0]).toHaveValue('http://api');
  });

  it('renders empty state with no rows when collection has no variables', () => {
    render(<CollectionVarsEditor collection={makeCollection()} onSave={vi.fn()} />);
    expect(screen.queryAllByTestId('gql-col-vars-key')).toHaveLength(0);
  });

  it('adds a new empty row when clicking "Add variable"', () => {
    render(<CollectionVarsEditor collection={makeCollection()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('gql-col-vars-add'));
    expect(screen.getAllByTestId('gql-col-vars-key')).toHaveLength(1);
  });

  it('calls onSave when key is changed', () => {
    const onSave = vi.fn();
    render(<CollectionVarsEditor collection={makeCollection({ x: 'y' })} onSave={onSave} />);
    const keyInput = screen.getByTestId('gql-col-vars-key');
    fireEvent.change(keyInput, { target: { value: 'newKey' } });
    expect(onSave).toHaveBeenCalledWith({ newKey: 'y' });
  });

  it('calls onSave when value is changed', () => {
    const onSave = vi.fn();
    render(<CollectionVarsEditor collection={makeCollection({ x: 'y' })} onSave={onSave} />);
    const valInput = screen.getByTestId('gql-col-vars-value');
    fireEvent.change(valInput, { target: { value: 'newValue' } });
    expect(onSave).toHaveBeenCalledWith({ x: 'newValue' });
  });

  it('deletes a row when clicking the delete button', () => {
    const onSave = vi.fn();
    render(<CollectionVarsEditor collection={makeCollection({ x: 'y' })} onSave={onSave} />);
    expect(screen.getAllByTestId('gql-col-vars-key')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('gql-col-vars-del'));
    expect(screen.queryAllByTestId('gql-col-vars-key')).toHaveLength(0);
    expect(onSave).toHaveBeenCalledWith({});
  });

  it('does not include empty-key rows in the onSave output', () => {
    const onSave = vi.fn();
    render(<CollectionVarsEditor collection={makeCollection()} onSave={onSave} />);
    // Add a row but leave the key blank
    fireEvent.click(screen.getByTestId('gql-col-vars-add'));
    const valInput = screen.getByTestId('gql-col-vars-value');
    fireEvent.change(valInput, { target: { value: 'someValue' } });
    // empty key row should be filtered out
    expect(onSave).toHaveBeenCalledWith({});
  });

  it('trims keys before saving', () => {
    const onSave = vi.fn();
    render(<CollectionVarsEditor collection={makeCollection({ x: '1' })} onSave={onSave} />);
    const keyInput = screen.getByTestId('gql-col-vars-key');
    fireEvent.change(keyInput, { target: { value: '  trimmed  ' } });
    expect(onSave).toHaveBeenCalledWith({ trimmed: '1' });
  });

  it('shows correct aria-labels for inputs', () => {
    render(<CollectionVarsEditor collection={makeCollection({ a: 'b' })} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Variable key 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Variable value 1')).toBeInTheDocument();
  });

  it('shows delete button aria-label with key name', () => {
    render(<CollectionVarsEditor collection={makeCollection({ myVar: 'val' })} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Delete variable myVar')).toBeInTheDocument();
  });

  it('handles multiple rows independently', () => {
    const onSave = vi.fn();
    render(
      <CollectionVarsEditor
        collection={makeCollection({ a: '1', b: '2' })}
        onSave={onSave}
      />,
    );
    const keys = screen.getAllByTestId('gql-col-vars-key');
    fireEvent.change(keys[0], { target: { value: 'aPrime' } });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ aPrime: '1' }));
  });

  it('updates value of first row while preserving second row (L33 i !== idx else branch)', () => {
    const onSave = vi.fn();
    render(
      <CollectionVarsEditor
        collection={makeCollection({ first: 'val1', second: 'val2' })}
        onSave={onSave}
      />,
    );
    // Change value of the first row — the second row should stay as-is (i !== idx → r)
    const values = screen.getAllByTestId('gql-col-vars-value');
    fireEvent.change(values[0], { target: { value: 'updated' } });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ second: 'val2' }));
  });
});
