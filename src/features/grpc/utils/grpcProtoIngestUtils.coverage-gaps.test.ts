/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
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
});
