/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  assertProtoFileImportsResolvable,
  buildProtoFileMap,
  buildProtoResolvePath,
  classifyProtoParseFailure,
  normalizeProtoPath,
  normalizeResolvedProtoPath,
  ProtoImportResolutionError,
  resolveProtoImportPath,
} from './protoImportResolver.js';
import { PROTO_WKT_BUNDLE } from './protoWktBundle.js';

describe('protoImportResolver', () => {
  it('normalizes proto paths with backslashes and duplicate slashes', () => {
    expect(normalizeProtoPath('foo\\\\bar//baz.proto')).toBe('foo/bar/baz.proto');
  });

  it('buildProtoFileMap includes bundled WKT entries', () => {
    const map = buildProtoFileMap({ protoFiles: [], includeWktBundle: true });
    expect(map.has('google/protobuf/timestamp.proto')).toBe(true);
    expect(map.get('google/protobuf/timestamp.proto')).toBe(
      PROTO_WKT_BUNDLE['google/protobuf/timestamp.proto'],
    );
  });

  it('rejects duplicate user proto paths', () => {
    expect(() => buildProtoFileMap({
      protoFiles: [
        { path: 'a.proto', content: 'syntax = "proto3";' },
        { path: 'a.proto', content: 'syntax = "proto3";' },
      ],
    })).toThrow(/Duplicate proto file path/);
  });

  it('resolveProtoImportPath resolves relative imports from origin file', () => {
    const map = buildProtoFileMap({
      protoFiles: [
        { path: 'common/types.proto', content: 'syntax = "proto3"; package common;' },
        { path: 'api/service.proto', content: 'syntax = "proto3"; import "common/types.proto";' },
      ],
    });
    const resolved = resolveProtoImportPath('api/service.proto', 'common/types.proto', map, []);
    expect(resolved).toBe('common/types.proto');
  });

  it('resolveProtoImportPath resolves via importPaths roots', () => {
    const map = buildProtoFileMap({
      protoFiles: [
        { path: 'shared/common.proto', content: 'syntax = "proto3"; package common;' },
      ],
      importPaths: ['shared'],
    });
    const resolved = resolveProtoImportPath('api/service.proto', 'common.proto', map, ['shared']);
    expect(resolved).toBe('shared/common.proto');
  });

  it('resolveProtoImportPath falls back to unique basename when dropped files are flattened', () => {
    const map = buildProtoFileMap({
      protoFiles: [
        { path: 'service.proto', content: 'syntax = "proto3"; import "shared/common.proto";' },
        { path: 'common.proto', content: 'syntax = "proto3"; package common;' },
      ],
    });
    const resolved = resolveProtoImportPath('service.proto', 'shared/common.proto', map, []);
    expect(resolved).toBe('common.proto');
  });

  it('resolveProtoImportPath keeps failing on ambiguous basename fallback', () => {
    const map = buildProtoFileMap({
      protoFiles: [
        { path: 'shared/common.proto', content: 'syntax = "proto3"; package a;' },
        { path: 'vendor/common.proto', content: 'syntax = "proto3"; package b;' },
      ],
    });
    const resolved = resolveProtoImportPath('api/service.proto', 'acme/common.proto', map, []);
    expect(resolved).toBeNull();
  });

  it('normalizeResolvedProtoPath collapses parent-directory segments', () => {
    expect(normalizeResolvedProtoPath('api/../common/types.proto')).toBe('common/types.proto');
  });

  it('resolveProtoImportPath resolves parent-directory relative imports', () => {
    const map = buildProtoFileMap({
      protoFiles: [
        { path: 'common/types.proto', content: 'syntax = "proto3"; package common;' },
        { path: 'api/service.proto', content: 'syntax = "proto3"; import "../common/types.proto";' },
      ],
    });
    const resolved = resolveProtoImportPath('api/service.proto', '../common/types.proto', map, []);
    expect(resolved).toBe('common/types.proto');
  });

  it('resolveProtoImportPath resolves bundled WKT imports', () => {
    const map = buildProtoFileMap({ protoFiles: [], includeWktBundle: true });
    const resolvePath = buildProtoResolvePath(map, []);
    expect(resolvePath('event.proto', 'google/protobuf/timestamp.proto')).toBe(
      'google/protobuf/timestamp.proto',
    );
  });

  it('classifyProtoParseFailure maps protobuf import errors', () => {
    const error = classifyProtoParseFailure(
      new Error('import "missing/vendor.proto" not found'),
      'api/service.proto',
      ['vendor'],
    );
    expect(error).toBeInstanceOf(ProtoImportResolutionError);
    expect(error?.message).toContain('missing/vendor.proto');
    expect(error?.message).toContain('api/service.proto');
  });

  it('assertProtoFileImportsResolvable throws for missing imports', () => {
    const map = buildProtoFileMap({
      protoFiles: [{
        path: 'broken.proto',
        content: 'syntax = "proto3"; import "missing/vendor.proto"; message Empty {}',
      }],
    });
    expect(() => assertProtoFileImportsResolvable(
      'broken.proto',
      map.get('broken.proto')!,
      map,
      [],
    )).toThrow(ProtoImportResolutionError);
  });

  it('assertProtoFileImportsResolvable skips optional weak imports', () => {
    const map = buildProtoFileMap({
      protoFiles: [{
        path: 'optional.proto',
        content: 'syntax = "proto3"; import weak "missing/optional.proto"; message Empty {}',
      }],
    });
    expect(() => assertProtoFileImportsResolvable(
      'optional.proto',
      map.get('optional.proto')!,
      map,
      [],
    )).not.toThrow();
  });
});
