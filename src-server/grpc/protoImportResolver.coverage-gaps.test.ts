/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  assertProtoFileImportsResolvable,
  classifyProtoParseFailure,
  extractProtoImportRefs,
  extractProtoImports,
  formatImportResolutionMessage,
  normalizeResolvedProtoPath,
  ProtoImportResolutionError,
  resolveProtoImportPath,
  buildProtoFileMap,
} from './protoImportResolver.js';

describe('protoImportResolver coverage gaps', () => {
  it('extractProtoImportRefs preserves public import modifiers', () => {
    const refs = extractProtoImportRefs('syntax = "proto3"; import public "google/protobuf/empty.proto";');
    expect(refs).toEqual([{ target: 'google/protobuf/empty.proto', modifier: 'public' }]);
  });

  it('resolveProtoImportPath resolves imports from empty import root entries', () => {
    const map = buildProtoFileMap({
      protoFiles: [{ path: 'root.proto', content: 'syntax = "proto3";' }],
    });
    const resolved = resolveProtoImportPath('nested/service.proto', 'root.proto', map, ['']);
    expect(resolved).toBe('root.proto');
  });

  it('resolveProtoImportPath returns null when import cannot be resolved', () => {
    const map = buildProtoFileMap({
      protoFiles: [{ path: 'solo.proto', content: 'syntax = "proto3";' }],
    });
    expect(resolveProtoImportPath('solo.proto', 'missing.proto', map, [])).toBeNull();
  });

  it('extractProtoImports returns import targets only', () => {
    expect(extractProtoImports('syntax = "proto3"; import "google/protobuf/empty.proto";'))
      .toEqual(['google/protobuf/empty.proto']);
  });

  it('assertProtoFileImportsResolvable skips weak imports', () => {
    const map = buildProtoFileMap({
      protoFiles: [{ path: 'solo.proto', content: 'syntax = "proto3";' }],
    });
    expect(() => assertProtoFileImportsResolvable(
      'solo.proto',
      'syntax = "proto3"; import weak "missing.proto";',
      map,
      [],
    )).not.toThrow();
  });

  it('buildProtoFileMap rejects empty paths and duplicate entries', () => {
    expect(() => buildProtoFileMap({
      protoFiles: [{ path: '   ', content: 'syntax = "proto3";' }],
    })).toThrow(/non-empty path/i);
    expect(() => buildProtoFileMap({
      protoFiles: [
        { path: 'dup.proto', content: 'syntax = "proto3";' },
        { path: 'dup.proto', content: 'syntax = "proto3";' },
      ],
    })).toThrow(/Duplicate proto file path/i);
  });

  it('normalizeResolvedProtoPath collapses parent directory segments', () => {
    expect(normalizeResolvedProtoPath('vendor/../common/shared.proto')).toBe('common/shared.proto');
  });

  it('classifyProtoParseFailure maps protobuf import errors', () => {
    const error = classifyProtoParseFailure(
      new Error('import "vendor/missing.proto" not found'),
      'api/service.proto',
      ['vendor'],
    );
    expect(error).toBeInstanceOf(ProtoImportResolutionError);
  });

  it('formatImportResolutionMessage omits fromFile when absent', () => {
    expect(formatImportResolutionMessage({ unresolvedImport: 'x.proto', searchedPaths: [] }))
      .toBe('Unresolved import "x.proto"');
  });
});
