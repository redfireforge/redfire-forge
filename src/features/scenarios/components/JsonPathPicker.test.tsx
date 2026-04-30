/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JsonPathPicker, { extractJsonPaths } from './JsonPathPicker';

describe('extractJsonPaths', () => {
  it('returns empty array for invalid JSON', () => {
    expect(extractJsonPaths('not json')).toEqual([]);
    expect(extractJsonPaths('')).toEqual([]);
  });

  it('extracts paths from flat object', () => {
    const paths = extractJsonPaths('{"name":"Alice","age":30,"active":true}');
    expect(paths).toEqual([
      { path: '$', type: 'object', preview: '{3 keys}' },
      { path: '$.name', type: 'string', preview: '"Alice"' },
      { path: '$.age', type: 'number', preview: '30' },
      { path: '$.active', type: 'boolean', preview: 'true' },
    ]);
  });

  it('extracts paths from nested object', () => {
    const paths = extractJsonPaths('{"user":{"id":1,"email":"a@b.c"}}');
    const pathNames = paths.map(p => p.path);
    expect(pathNames).toContain('$');
    expect(pathNames).toContain('$.user');
    expect(pathNames).toContain('$.user.id');
    expect(pathNames).toContain('$.user.email');
  });

  it('handles arrays by traversing first element', () => {
    const paths = extractJsonPaths('{"items":[{"id":1},{"id":2}]}');
    const pathNames = paths.map(p => p.path);
    expect(pathNames).toContain('$.items');
    expect(pathNames).toContain('$.items[0]');
    expect(pathNames).toContain('$.items[0].id');
    // Does not traverse second element (just first as sample)
    expect(pathNames).not.toContain('$.items[1]');
  });

  it('handles null values', () => {
    const paths = extractJsonPaths('{"val":null}');
    expect(paths).toContainEqual({ path: '$.val', type: 'null', preview: 'null' });
  });

  it('truncates long strings in preview', () => {
    const long = 'x'.repeat(50);
    const paths = extractJsonPaths(`{"s":"${long}"}`);
    const sEntry = paths.find(p => p.path === '$.s');
    expect(sEntry?.preview).toContain('…');
    expect(sEntry!.preview.length).toBeLessThan(40);
  });
});

describe('JsonPathPicker component', () => {
  const sampleJson = '{"name":"Alice","items":[{"id":1}],"count":5}';

  it('renders disabled button when sampleJson is empty', () => {
    render(<JsonPathPicker sampleJson="" onSelect={() => {}} />);
    const btn = screen.getByTitle('Fetch a sample response first');
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders enabled button when sampleJson is valid', () => {
    render(<JsonPathPicker sampleJson={sampleJson} onSelect={() => {}} />);
    const btn = screen.getByTitle('Pick JSON path from sample response');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('opens popover on click and shows paths', () => {
    render(<JsonPathPicker sampleJson={sampleJson} onSelect={() => {}} />);
    fireEvent.click(screen.getByTitle('Pick JSON path from sample response'));
    expect(screen.getByPlaceholderText('Filter paths…')).toBeDefined();
    // Should see path entries
    expect(screen.getByText('$.name')).toBeDefined();
    expect(screen.getByText('$.count')).toBeDefined();
    expect(screen.getByText('$.items')).toBeDefined();
  });

  it('filters paths by search term', () => {
    render(<JsonPathPicker sampleJson={sampleJson} onSelect={() => {}} />);
    fireEvent.click(screen.getByTitle('Pick JSON path from sample response'));
    const search = screen.getByPlaceholderText('Filter paths…');
    fireEvent.change(search, { target: { value: 'count' } });
    expect(screen.getByText('$.count')).toBeDefined();
    expect(screen.queryByText('$.name')).toBeNull();
  });

  it('calls onSelect and closes menu when path clicked', () => {
    const onSelect = vi.fn();
    render(<JsonPathPicker sampleJson={sampleJson} onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle('Pick JSON path from sample response'));
    fireEvent.click(screen.getByText('$.name'));
    expect(onSelect).toHaveBeenCalledWith('$.name');
    // Menu should close
    expect(screen.queryByPlaceholderText('Filter paths…')).toBeNull();
  });

  it('shows "No matching paths" when filter has no results', () => {
    render(<JsonPathPicker sampleJson={sampleJson} onSelect={() => {}} />);
    fireEvent.click(screen.getByTitle('Pick JSON path from sample response'));
    fireEvent.change(screen.getByPlaceholderText('Filter paths…'), { target: { value: 'zzzzz' } });
    expect(screen.getByText('No matching paths')).toBeDefined();
  });

  it('closes on click outside', () => {
    render(<div data-testid="outside"><JsonPathPicker sampleJson={sampleJson} onSelect={() => {}} /></div>);
    fireEvent.click(screen.getByTitle('Pick JSON path from sample response'));
    expect(screen.getByPlaceholderText('Filter paths…')).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByPlaceholderText('Filter paths…')).toBeNull();
  });
});
