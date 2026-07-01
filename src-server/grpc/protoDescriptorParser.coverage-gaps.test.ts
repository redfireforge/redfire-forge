/**
 * @vitest-environment node
 */
import descriptor from 'protobufjs/ext/descriptor/index.js';
import protobuf from 'protobufjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as protoImportResolver from './protoImportResolver.js';
import * as protoFileDescriptorPool from './protoFileDescriptorPool.js';
import { clearProtoFileDescriptorPool } from './protoFileDescriptorPool.js';
import {
  parseDescribeRequestSource,
  parseProtoFiles,
  parseProtosetBase64,
} from './protoDescriptorParser.js';

describe('protoDescriptorParser coverage gaps', () => {
  beforeEach(() => {
    clearProtoFileDescriptorPool();
  });

  it('parseProtoFiles rejects empty ingest', () => {
    expect(() => parseProtoFiles([])).toThrow(/at least one file/i);
  });

  it('parseProtosetBase64 rejects empty decoded buffers', () => {
    expect(() => parseProtosetBase64('')).toThrow(/empty buffer/i);
  });

  it('parseDescribeRequestSource validates protoset source', () => {
    expect(() => parseDescribeRequestSource({
      source: 'protoset',
      protosetBase64: '   ',
    })).toThrow(/protosetBase64 is required/i);
  });

  it('parseDescribeRequestSource rejects unsupported sources', () => {
    expect(() => parseDescribeRequestSource({
      source: 'url_proto',
    } as never)).toThrow(/Unsupported describe source/);
  });

  it('parseProtosetBase64 rejects descriptor sets with no files', () => {
    vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockReturnValue({ file: [] });
    expect(() => parseProtosetBase64('YWJj')).toThrow(/no file descriptors/i);
    vi.restoreAllMocks();
  });

  it('parseProtosetBase64 rejects corrupt descriptor payloads', () => {
    expect(() => parseProtosetBase64('!!!not-base64!!!')).toThrow(/Failed to decode protoset/i);
  });

  it('parseProtosetBase64 rejects decode failures', () => {
    vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockImplementation(() => {
      throw new Error('corrupt descriptor');
    });
    expect(() => parseProtosetBase64('YWJj')).toThrow(/Failed to decode protoset/i);
    vi.restoreAllMocks();
  });

  it('parseProtosetBase64 rejects fromDescriptor failures', () => {
    vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockReturnValue({
      file: [{ name: 'broken.proto' }],
    });
    vi.spyOn(protobuf.Root, 'fromDescriptor').mockImplementation(() => {
      throw new Error('bad root');
    });
    expect(() => parseProtosetBase64('YWJj')).toThrow(/Failed to load protoset descriptor/i);
    vi.restoreAllMocks();
  });

  it('parseProtoFiles wraps non-import parse failures', () => {
    expect(() => parseProtoFiles([
      { path: 'bad.proto', content: 'this is not valid proto syntax {{' },
    ])).toThrow(/Failed to parse bad.proto/i);
  });

  it('parseProtoFiles surfaces import resolution failures for user protos', () => {
    expect(() => parseProtoFiles([
      {
        path: 'service.proto',
        content: 'syntax = "proto3"; import "missing/other.proto"; message Empty {}',
      },
    ])).toThrow(/missing\/other.proto/i);
  });

  it('parseProtoFiles wraps bundled WKT seed failures', () => {
    vi.spyOn(protoFileDescriptorPool, 'createRootWithBundledWkt').mockImplementation(() => {
      throw new Error('broken bundled wkt');
    });
    expect(() => parseProtoFiles([
      { path: 'user.proto', content: 'syntax = "proto3"; message User { string id = 1; }' },
    ])).toThrow(/broken bundled wkt/i);
    vi.restoreAllMocks();
  });

  it('parseProtoFiles maps user import failures through classifyProtoParseFailure', () => {
    const original = protobuf.parse.bind(protobuf);
    vi.spyOn(protobuf, 'parse').mockImplementation((...args) => {
      const options = args[2] as { filename?: string } | undefined;
      if (options?.filename === 'user.proto') {
        throw new Error('import "missing/wkt.proto" not found');
      }
      return original(...args);
    });
    expect(() => parseProtoFiles([
      { path: 'user.proto', content: 'syntax = "proto3"; message User { string id = 1; }' },
    ])).toThrow(/Unresolved import/i);
    vi.restoreAllMocks();
  });

  it('parseProtoFiles throws when user proto path is missing from ingest map', () => {
    vi.spyOn(protoImportResolver, 'buildProtoFileMap').mockReturnValue(new Map([
      ['google/protobuf/timestamp.proto', 'syntax = "proto3";'],
    ]));
    expect(() => parseProtoFiles([
      { path: 'missing.proto', content: 'syntax = "proto3"; message X {}' },
    ])).toThrow(/Proto file not found in ingest map/i);
    vi.restoreAllMocks();
  });

  it('parseProtoFiles wraps non-Error bundled parse failures', () => {
    vi.spyOn(protobuf, 'parse').mockImplementationOnce(() => {
      throw 'bundle-string-error';
    });
    expect(() => parseProtoFiles([
      { path: 'user.proto', content: 'syntax = "proto3"; message User { string id = 1; }' },
    ])).toThrow(/bundle-string-error/i);
    vi.restoreAllMocks();
  });

  it('parseProtoFiles wraps non-Error user parse failures', () => {
    vi.spyOn(protobuf, 'parse').mockImplementation((_content, _root, opts) => {
      if (opts?.filename === 'user.proto') {
        throw 'user-string-error';
      }
      return { root: new protobuf.Root() };
    });
    expect(() => parseProtoFiles([
      { path: 'user.proto', content: 'syntax = "proto3"; message User { string id = 1; }' },
    ])).toThrow(/Failed to parse user.proto: user-string-error/i);
    vi.restoreAllMocks();
  });

  it('parseProtosetBase64 wraps non-Error base64 decode failures', () => {
    vi.spyOn(Buffer, 'from').mockImplementationOnce(() => {
      throw 'bad-base64';
    });
    expect(() => parseProtosetBase64('abc')).toThrow(/Invalid protosetBase64: bad-base64/);
    vi.restoreAllMocks();
  });

  it('parseProtosetBase64 wraps non-Error fromDescriptor failures', () => {
    vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockReturnValue({
      file: [{ name: 'x.proto' }],
    });
    vi.spyOn(protobuf.Root, 'fromDescriptor').mockImplementationOnce(() => {
      throw 'bad-root';
    });
    expect(() => parseProtosetBase64('YWJj')).toThrow(/Failed to load protoset descriptor: bad-root/);
    vi.restoreAllMocks();
  });

  it('parseProtosetBase64 wraps non-Error descriptor decode failures', () => {
    vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockImplementationOnce(() => {
      throw 'bad-decode';
    });
    expect(() => parseProtosetBase64('YWJj')).toThrow(/Failed to decode protoset: bad-decode/);
    vi.restoreAllMocks();
  });

  it('parseDescribeRequestSource accepts proto_files with omitted optional fields', () => {
    expect(() => parseDescribeRequestSource({
      source: 'proto_files',
      protoFiles: [{ path: 'x.proto', content: 'syntax = "proto3"; message X { string id = 1; } service S { rpc F(X) returns (X); }' }],
    })).not.toThrow();
  });
});
