/**
 * multipartBuilder.test.ts — Unit tests for Sprint 4 2E-2 multipart FormData builder.
 */

import { describe, it, expect } from 'vitest';
import type { FileEntry } from './multipartBuilder';
import { buildMultipartFormData, hasValidFiles } from './multipartBuilder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFile(name: string, type = 'image/png', size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

function makeEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: 'test-id',
    file: makeFile('avatar.png'),
    varPath: 'avatar',
    error: null,
    ...overrides,
  };
}

// ─── hasValidFiles ────────────────────────────────────────────────────────────

describe('hasValidFiles', () => {
  it('returns false for empty array', () => {
    expect(hasValidFiles([])).toBe(false);
  });

  it('returns false when all entries have errors', () => {
    expect(hasValidFiles([makeEntry({ error: 'Too large' })])).toBe(false);
  });

  it('returns false when all entries have empty varPath', () => {
    expect(hasValidFiles([makeEntry({ varPath: '' })])).toBe(false);
  });

  it('returns true when at least one entry is valid', () => {
    expect(hasValidFiles([makeEntry()])).toBe(true);
  });

  it('returns true even if some entries have errors', () => {
    expect(hasValidFiles([
      makeEntry({ error: 'Too large' }),
      makeEntry({ varPath: 'files.1' }),
    ])).toBe(true);
  });
});

// ─── buildMultipartFormData ───────────────────────────────────────────────────

describe('buildMultipartFormData', () => {
  it('includes operations field with query and variables-with-nulls', () => {
    const file = makeFile('test.png');
    const entries: FileEntry[] = [makeEntry({ file, varPath: 'avatar' })];
    const form = buildMultipartFormData('mutation { upload }', {}, entries);

    const ops = JSON.parse(form.get('operations') as string) as Record<string, unknown>;
    expect(ops.query).toBe('mutation { upload }');
    expect((ops.variables as Record<string, unknown>).avatar).toBeNull();
  });

  it('includes map field mapping index to variable path', () => {
    const entries: FileEntry[] = [makeEntry({ varPath: 'avatar' })];
    const form = buildMultipartFormData('mutation { upload }', {}, entries);

    const map = JSON.parse(form.get('map') as string) as Record<string, string[]>;
    expect(map['0']).toEqual(['variables.avatar']);
  });

  it('includes the file at index key "0"', () => {
    const file = makeFile('photo.jpg', 'image/jpeg');
    const entries: FileEntry[] = [makeEntry({ file, varPath: 'photo' })];
    const form = buildMultipartFormData('mutation { upload }', {}, entries);

    const uploadedFile = form.get('0');
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe('photo.jpg');
  });

  it('handles multiple files with correct indices and paths', () => {
    const file0 = makeFile('a.png');
    const file1 = makeFile('b.png');
    const entries: FileEntry[] = [
      makeEntry({ id: '1', file: file0, varPath: 'files.0' }),
      makeEntry({ id: '2', file: file1, varPath: 'files.1' }),
    ];
    const form = buildMultipartFormData('mutation { m }', {}, entries);

    const map = JSON.parse(form.get('map') as string) as Record<string, string[]>;
    expect(map['0']).toEqual(['variables.files.0']);
    expect(map['1']).toEqual(['variables.files.1']);
    expect(form.get('0')).toBeInstanceOf(File);
    expect(form.get('1')).toBeInstanceOf(File);
  });

  it('normalises varPath that already starts with "variables."', () => {
    const entries: FileEntry[] = [makeEntry({ varPath: 'variables.avatar' })];
    const form = buildMultipartFormData('query {}', {}, entries);

    const map = JSON.parse(form.get('map') as string) as Record<string, string[]>;
    expect(map['0']).toEqual(['variables.avatar']);
  });

  it('excludes errored entries from the form', () => {
    const entries: FileEntry[] = [
      makeEntry({ id: 'good', varPath: 'avatar', error: null }),
      makeEntry({ id: 'bad', varPath: 'other', error: 'Too large' }),
    ];
    const form = buildMultipartFormData('query {}', {}, entries);

    const map = JSON.parse(form.get('map') as string) as Record<string, string[]>;
    expect(Object.keys(map)).toHaveLength(1);
    expect(map['0']).toEqual(['variables.avatar']);
    expect(form.has('1')).toBe(false);
  });

  it('excludes entries with empty varPath', () => {
    const entries: FileEntry[] = [
      makeEntry({ varPath: '' }),
    ];
    const form = buildMultipartFormData('query {}', {}, entries);

    const map = JSON.parse(form.get('map') as string) as Record<string, string[]>;
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('preserves existing variables alongside null placeholders', () => {
    const entries: FileEntry[] = [makeEntry({ varPath: 'avatar' })];
    const form = buildMultipartFormData('mutation { m }', { userId: '123', avatar: null }, entries);

    const ops = JSON.parse(form.get('operations') as string) as Record<string, unknown>;
    expect((ops.variables as Record<string, unknown>).userId).toBe('123');
    expect((ops.variables as Record<string, unknown>).avatar).toBeNull();
  });
});
