/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { readStructuredFile } from './fileParsing';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

describe('readStructuredFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses JSON files', () => {
    mockReadFileSync.mockReturnValue('{"name":"test","value":42}');

    const result = readStructuredFile('/path/to/data.json');

    expect(result).toEqual({ name: 'test', value: 42 });
    expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/data.json', 'utf-8');
  });

  it('parses YAML files with .yaml extension', () => {
    mockReadFileSync.mockReturnValue('name: test\nvalue: 42');

    const result = readStructuredFile('/path/to/data.yaml');

    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('parses YAML files with .yml extension', () => {
    mockReadFileSync.mockReturnValue('name: test\nitems:\n  - a\n  - b');

    const result = readStructuredFile('/path/to/data.yml');

    expect(result).toEqual({ name: 'test', items: ['a', 'b'] });
  });

  it('throws on invalid JSON', () => {
    mockReadFileSync.mockReturnValue('{ invalid json }');

    expect(() => readStructuredFile('/path/to/bad.json')).toThrow(SyntaxError);
  });
});
