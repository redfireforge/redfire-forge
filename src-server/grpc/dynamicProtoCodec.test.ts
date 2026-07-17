/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { parseProtoFiles } from './protoDescriptorParser.js';
import { clearProtoFileDescriptorPool } from './protoFileDescriptorPool.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import { setDescriptorRootCache, clearDescriptorRootCache } from './descriptorRootCache.js';
import {
  clearDynamicProtoCodecCache,
  decodeProtoMessage,
  encodeProtoMessage,
} from './dynamicProtoCodec.js';

const MAP_ONEOF_PROTO = `syntax = "proto3";
package demo;

message MapRequest {
  map<string, int32> counts = 1;
}

message OneofRequest {
  oneof payload {
    string name = 1;
    int32 id = 2;
  }
}

service DemoService {
  rpc MapRpc(MapRequest) returns (MapRequest);
  rpc OneofRpc(OneofRequest) returns (OneofRequest);
}`;

describe('dynamicProtoCodec', () => {
  beforeEach(() => {
    clearDynamicProtoCodecCache();
    clearDescriptorRootCache();
    clearProtoFileDescriptorPool();
  });

  it('encodes and decodes echo messages from descriptor schema', () => {
    const encoded = encodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.EchoRequest',
      { message: 'hello' },
    );
    const decoded = decodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.EchoRequest',
      encoded,
    );
    expect(decoded).toEqual({ message: 'hello' });
  });

  it('encodes StreamRequest repeat_count for server streaming', () => {
    const encoded = encodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.StreamRequest',
      { message: 'ping', repeat_count: 3, interval_ms: 0 },
    );
    const decoded = decodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.StreamRequest',
      encoded,
    );
    expect(decoded.repeat_count).toBe(3);
    expect(decoded.interval_ms).toBe(0);
  });

  it('maps snake_case JSON bodies onto camelCase reflection protobuf roots', () => {
    const snakeRoot = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const descriptor = normalizeRootToDescriptor(snakeRoot, 'reflection', 'reflect-camel-test');
    const camelProto = FIXTURE_ECHO_PROTO
      .replace('repeat_count', 'repeatCount')
      .replace('interval_ms', 'intervalMs');
    const camelRoot = parseProtoFiles([{ path: 'echo.proto', content: camelProto }]);
    setDescriptorRootCache(descriptor.key, camelRoot);

    const encoded = encodeProtoMessage(descriptor, 'echo.StreamRequest', {
      message: 'e2e-ss',
      repeat_count: 3,
      interval_ms: 0,
    });
    const decoded = decodeProtoMessage(descriptor, 'echo.StreamRequest', encoded);
    expect(decoded.repeat_count).toBe(3);
    expect(decoded.interval_ms).toBe(0);
  });

  it('throws when type is missing from descriptor', () => {
    expect(() => encodeProtoMessage(
      FIXTURE_DESCRIPTOR,
      'echo.MissingType',
      { message: 'x' },
    )).toThrow(/not found in descriptor/);
  });

  it('encodes and decodes int64 fields from string JSON values (OQ-8)', () => {
    const root = parseProtoFiles([{
      path: 'demo.proto',
      content: `syntax = "proto3";
package demo;
message OrderRequest { int64 order_id = 1; }
service DemoService { rpc Create(OrderRequest) returns (OrderRequest); }`,
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'int64-test');

    const encoded = encodeProtoMessage(descriptor, 'demo.OrderRequest', { order_id: '9007199254740993' });
    const decoded = decodeProtoMessage(descriptor, 'demo.OrderRequest', encoded);
    expect(decoded.order_id).toBe('9007199254740993');
  });

  it('encodes safe numeric int64 literals as Long (OQ-8 fallback)', () => {
    const root = parseProtoFiles([{
      path: 'demo.proto',
      content: `syntax = "proto3";
package demo;
message OrderRequest { int64 order_id = 1; }
service DemoService { rpc Create(OrderRequest) returns (OrderRequest); }`,
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'int64-number-test');

    const encoded = encodeProtoMessage(descriptor, 'demo.OrderRequest', { order_id: 42 });
    const decoded = decodeProtoMessage(descriptor, 'demo.OrderRequest', encoded);
    expect(decoded.order_id).toBe('42');
  });

  it('rejects invalid int64 decimal strings at encode time', () => {
    const root = parseProtoFiles([{
      path: 'demo.proto',
      content: `syntax = "proto3";
package demo;
message OrderRequest { int64 order_id = 1; }
service DemoService { rpc Create(OrderRequest) returns (OrderRequest); }`,
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'int64-invalid-test');

    expect(() => encodeProtoMessage(descriptor, 'demo.OrderRequest', { order_id: 'not-a-number' }))
      .toThrow(/Invalid 64-bit integer/i);
  });

  it('encodes nested int64 fields inside messages (OQ-8)', () => {
    const root = parseProtoFiles([{
      path: 'demo.proto',
      content: `syntax = "proto3";
package demo;
message Inner { int64 id = 1; }
message Outer { Inner inner = 1; map<string, int64> counts = 2; }
service DemoService { rpc Call(Outer) returns (Outer); }`,
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'nested-int64-test');

    const encoded = encodeProtoMessage(descriptor, 'demo.Outer', {
      inner: { id: '9007199254740993' },
      counts: { alpha: '42' },
    });
    const decoded = decodeProtoMessage(descriptor, 'demo.Outer', encoded);
    expect(decoded.inner).toEqual({ id: '9007199254740993' });
    expect(decoded.counts).toEqual({ alpha: '42' });
  });

  it('encodes map fields from synthesized schema when root cache is absent', () => {
    const root = parseProtoFiles([{ path: 'demo.proto', content: MAP_ONEOF_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'map-test');

    const encoded = encodeProtoMessage(descriptor, 'demo.MapRequest', { counts: { alpha: 1, beta: 2 } });
    const decoded = decodeProtoMessage(descriptor, 'demo.MapRequest', encoded);
    expect(decoded.counts).toEqual({ alpha: 1, beta: 2 });
  });

  it('encodes oneof fields from synthesized schema when root cache is absent', () => {
    const root = parseProtoFiles([{ path: 'demo.proto', content: MAP_ONEOF_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'oneof-test');

    const encoded = encodeProtoMessage(descriptor, 'demo.OneofRequest', { name: 'alice' });
    const decoded = decodeProtoMessage(descriptor, 'demo.OneofRequest', encoded);
    expect(decoded.name).toBe('alice');
    expect(decoded.id).toBeUndefined();
  });

  it('prefers cached protobuf root over synthesized schema', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'root-pref-test');
    setDescriptorRootCache(descriptor.key, root);

    const encoded = encodeProtoMessage(descriptor, 'echo.EchoRequest', { message: 'cached-root' });
    const decoded = decodeProtoMessage(descriptor, 'echo.EchoResponse', encoded);
    expect(decoded.message).toBe('cached-root');
  });

  it('encodes nested messages from synthesized schema when root cache is absent', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload { string label = 1; }
message NestedRequest { Payload payload = 1; }
service DemoService { rpc Call(NestedRequest) returns (NestedRequest); }`,
      }]),
      'proto_files',
      'nested-synth-test',
    );

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.NestedRequest', { payload: { label: 'nested' } });
    const decoded = decodeProtoMessage(descriptor, 'demo.NestedRequest', encoded);
    expect(decoded.payload).toEqual({ label: 'nested' });
  });

  it('encodes enum fields from synthesized schema when root cache is absent', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
enum Status { UNKNOWN = 0; OK = 1; }
message EnumRequest { Status status = 1; }
service DemoService { rpc Call(EnumRequest) returns (EnumRequest); }`,
      }]),
      'proto_files',
      'enum-synth-test',
    );

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.EnumRequest', { status: 1 });
    const decoded = decodeProtoMessage(descriptor, 'demo.EnumRequest', encoded);
    expect(decoded.status).toBe('OK');
  });

  it('encodes multi-package messages from synthesized schema when root cache is absent', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([
        {
          path: 'common/types.proto',
          content: `syntax = "proto3";
package common;
message Shared { string id = 1; }`,
        },
        {
          path: 'api/request.proto',
          content: `syntax = "proto3";
package api;
import "common/types.proto";
message Request { common.Shared shared = 1; }
service ApiService { rpc Call(Request) returns (Request); }`,
        },
      ], ['.']),
      'proto_files',
      'multi-package-synth-test',
    );

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'api.Request', { shared: { id: 'abc' } });
    const decoded = decodeProtoMessage(descriptor, 'api.Request', encoded);
    expect(decoded.shared).toEqual({ id: 'abc' });
  });

  it('encodes well-known timestamp fields from synthesized schema when root cache is absent', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/timestamp.proto";
message TimeRequest { google.protobuf.Timestamp created_at = 1; }
service DemoService { rpc Call(TimeRequest) returns (TimeRequest); }`,
      }]),
      'proto_files',
      'wkt-synth-test',
    );

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.TimeRequest', {
      created_at: { seconds: 1700000000, nanos: 0 },
    });
    const decoded = decodeProtoMessage(descriptor, 'demo.TimeRequest', encoded);
    // Timestamp decodes as an RFC3339/ISO8601 string to match the Proto Form Builder's
    // plain-text-input contract (see `GrpcProtoWktRows.tsx`).
    expect(decoded.created_at).toBe(new Date(1700000000 * 1000).toISOString());
  });
});
