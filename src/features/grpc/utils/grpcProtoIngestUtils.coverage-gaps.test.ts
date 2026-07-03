/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  computeCanonicalProtoPath,
  detectProtoRootCollisions,
  formatProtoFileSize,
  readProtoFilesFromFileList,
  readProtosetBase64FromFile,
} from './grpcProtoIngestUtils';

describe('grpcProtoIngestUtils coverage gaps', () => {
  it('formats file sizes across byte, kilobyte, and megabyte ranges', () => {
    expect(formatProtoFileSize(512)).toBe('512 B');
    expect(formatProtoFileSize(2048)).toBe('2.0 KB');
    expect(formatProtoFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('reads proto files from a file list', async () => {
    const file = new File(['syntax = "proto3";'], 'echo.proto', { type: 'text/plain' });
    const drafts = await readProtoFilesFromFileList([file]);
    expect(drafts).toEqual([{
      path: 'echo.proto',
      content: 'syntax = "proto3";',
      sizeBytes: file.size,
    }]);
  });

  it('rejects empty proto file selections', async () => {
    const txt = new File(['nope'], 'readme.txt', { type: 'text/plain' });
    await expect(readProtoFilesFromFileList([txt])).rejects.toThrow(/at least one \.proto/i);
  });

  it('reads protoset base64 from valid files', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const file = new File([bytes], 'schema.pb', { type: 'application/octet-stream' });
    const result = await readProtosetBase64FromFile(file);
    expect(result.fileName).toBe('schema.pb');
    expect(atob(result.base64)).toHaveLength(3);
  });

  it('rejects invalid protoset extensions and empty payloads', async () => {
    const badExt = new File(['x'], 'schema.bin', { type: 'application/octet-stream' });
    await expect(readProtosetBase64FromFile(badExt)).rejects.toThrow(/\.pb or \.protoset/i);

    const empty = new File([], 'schema.pb', { type: 'application/octet-stream' });
    await expect(readProtosetBase64FromFile(empty)).rejects.toThrow(/empty/i);
  });

  it('computeCanonicalProtoPath normalizes mount and file paths', () => {
    expect(computeCanonicalProtoPath('shared', 'common.proto')).toBe('shared/common.proto');
    expect(computeCanonicalProtoPath('vendor/acme', 'types/user.proto')).toBe('vendor/acme/types/user.proto');
    expect(computeCanonicalProtoPath('', 'root.proto')).toBe('root.proto');
  });

  it('computeCanonicalProtoPath handles whitespace and slashes', () => {
    expect(computeCanonicalProtoPath('  shared/  ', '  /common.proto  ')).toBe('shared/common.proto');
    expect(computeCanonicalProtoPath('root/', '/echo.proto')).toBe('root/echo.proto');
  });

  it('detectProtoRootCollisions finds basename collisions in different roots', () => {
    const roots = [
      {
        id: 'r1',
        mountPath: 'shared',
        files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
      },
      {
        id: 'r2',
        mountPath: 'api',
        files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
      },
    ];
    const diagnostics = detectProtoRootCollisions(roots);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        type: 'basename_collision',
        message: expect.stringContaining('common.proto'),
      }),
    );
  });

  it('detectProtoRootCollisions finds canonical path collisions', () => {
    const roots = [
      {
        id: 'r1',
        mountPath: 'shared',
        files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
      },
      {
        id: 'r2',
        mountPath: 'shared',
        files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
      },
    ];
    const diagnostics = detectProtoRootCollisions(roots);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        type: 'path_collision',
        message: expect.stringContaining('shared/common.proto'),
      }),
    );
  });

  it('detectProtoRootCollisions does not warn on same basename in same root', () => {
    const roots = [
      {
        id: 'r1',
        mountPath: 'shared',
        files: [
          { path: 'common.proto', content: 'syntax = "proto3";' },
          { path: 'types/common.proto', content: 'syntax = "proto3";' },
        ],
      },
    ];
    const diagnostics = detectProtoRootCollisions(roots);
    expect(diagnostics.filter((d) => d.type === 'basename_collision')).toHaveLength(0);
  });

  it('detectProtoRootCollisions returns empty list for clean roots', () => {
    const roots = [
      {
        id: 'r1',
        mountPath: 'shared',
        files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
      },
      {
        id: 'r2',
        mountPath: 'api',
        files: [{ path: 'service.proto', content: 'syntax = "proto3";' }],
      },
    ];
    const diagnostics = detectProtoRootCollisions(roots);
    expect(diagnostics).toHaveLength(0);
  });
});
