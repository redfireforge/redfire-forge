/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { mergeProtoFileDrafts, normalizeImportRoot, normalizeUploadedProtoPath } from './grpcProtoIngestUtils';

describe('grpcProtoIngestUtils', () => {
  it('mergeProtoFileDrafts upserts by path and sorts', () => {
    const merged = mergeProtoFileDrafts(
      [{ path: 'b.proto', content: 'old-b', sizeBytes: 4 }],
      [
        { path: 'a.proto', content: 'a', sizeBytes: 1 },
        { path: 'b.proto', content: 'new-b', sizeBytes: 5 },
      ],
    );
    expect(merged.map((file) => file.path)).toEqual(['a.proto', 'b.proto']);
    expect(merged.find((file) => file.path === 'b.proto')?.content).toBe('new-b');
  });

  it('normalizeImportRoot trims, collapses slashes, and converts backslashes', () => {
    expect(normalizeImportRoot('  foo//bar\\baz  ')).toBe('foo/bar/baz');
    expect(normalizeImportRoot('/')).toBe('');
    expect(normalizeImportRoot('')).toBe('');
  });

  it('normalizeUploadedProtoPath aligns with server path normalization', () => {
    const file = new File([''], 'service.proto', { type: 'text/plain' });
    Object.defineProperty(file, 'webkitRelativePath', { value: '.\\api\\\\service.proto' });
    expect(normalizeUploadedProtoPath(file)).toBe('api/service.proto');
    expect(normalizeUploadedProtoPath(new File([''], '.\\echo.proto', { type: 'text/plain' })))
      .toBe('echo.proto');
  });
});
