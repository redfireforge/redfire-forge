/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import protobuf from 'protobufjs';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import { parseProtoFiles } from './protoDescriptorParser.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import { clearDescriptorRootCache, setDescriptorRootCache } from './descriptorRootCache.js';
import {
  clearDynamicProtoCodecCache,
  decodeProtoMessage,
  encodeProtoMessage,
} from './dynamicProtoCodec.js';

const MULTI_PACKAGE_PROTO = [
  {
    path: 'common/types.proto',
    content: `syntax = "proto3";
package common;
enum Status { UNKNOWN = 0; ACTIVE = 1; }
message Shared { string id = 1; Status status = 2; }`,
  },
  {
    path: 'api/request.proto',
    content: `syntax = "proto3";
package api;
import "common/types.proto";
message Request { common.Shared shared = 1; }
service ApiService { rpc Call(Request) returns (Request); }`,
  },
];

describe('dynamicProtoCodec coverage gaps', () => {
  beforeEach(() => {
    clearDynamicProtoCodecCache();
    clearDescriptorRootCache();
  });

  it('throws when synthesized schema is invalid', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [],
    };

    expect(() => encodeProtoMessage(descriptor, 'broken.MissingType', { missing: 'x' }))
      .toThrow(/not found in descriptor/i);
  });

  it('uses multi-section synthesized schema for enums and nested packages', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles(MULTI_PACKAGE_PROTO, ['.']),
      'proto_files',
      'multi-section-synth',
    );

    const encoded = encodeProtoMessage(descriptor, 'api.Request', {
      shared: { id: 'abc', status: 1 },
    });
    const decoded = decodeProtoMessage(descriptor, 'api.Request', encoded);
    expect(decoded.shared).toEqual({ id: 'abc', status: 'ACTIVE' });
  });

  it('encodes well-known timestamp fields via synthesized WKT stubs', () => {
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
      'wkt-gap-test',
    );

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.TimeRequest', {
      created_at: { seconds: 1700000000, nanos: 0 },
    });
    expect(decodeProtoMessage(descriptor, 'demo.TimeRequest', encoded).created_at)
      .toMatchObject({ nanos: 0 });
  });

  it('wraps parseDescriptorRoot failures with descriptor key context', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'demo.Broken',
        fields: [{ name: 'value', type: 'string', number: 1, label: 'optional' as const }],
      }],
    };
    vi.spyOn(protobuf, 'parse').mockImplementation(() => {
      throw new Error('invalid proto section');
    });
    expect(() => encodeProtoMessage(descriptor, 'demo.Broken', { value: 'x' }))
      .toThrow(/Invalid descriptor schema for key/i);
    vi.restoreAllMocks();
  });

  it('synthesizes map and oneof fields from descriptor schema', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
enum Mode { UNKNOWN = 0; FAST = 1; }
message Payload {
  map<string, int32> counts = 1;
  oneof choice { string name = 2; Mode mode = 3; }
}
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'map-oneof-gap',
    );

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      counts: { alpha: 1 },
      name: 'demo',
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      counts: { alpha: 1 },
      name: 'demo',
    });
  });

  it('uses packageForTypeName fallback for unqualified message types', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{ name: 'DemoService', fullName: 'demo.DemoService', methods: [] }],
      messageTypes: [{
        typeName: 'Payload',
        fields: [{ name: 'value', type: 'string', number: 1, label: 'optional' as const }],
      }],
    };
    expect(() => encodeProtoMessage(descriptor, 'Payload', { value: 'x' })).not.toThrow();
  });

  it('encodes descriptors without well-known types using a single proto source section', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'plain.proto',
        content: `syntax = "proto3";
package plain;
message Plain { string value = 1; }
service PlainService { rpc Call(Plain) returns (Plain); }`,
      }]),
      'proto_files',
      'no-wkt-section',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    const encoded = encodeProtoMessage(descriptor, 'plain.Plain', { value: 'hello' });
    expect(decodeProtoMessage(descriptor, 'plain.Plain', encoded)).toEqual({ value: 'hello' });
  });

  it('synthesizes google.protobuf.StringValue WKT stubs', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'wrap.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/wrappers.proto";
message WrapRequest { google.protobuf.StringValue label = 1; }
service DemoService { rpc Call(WrapRequest) returns (WrapRequest); }`,
      }]),
      'proto_files',
      'string-value-wkt-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    const encoded = encodeProtoMessage(descriptor, 'demo.WrapRequest', {
      label: { value: 'demo' },
    });
    expect(decodeProtoMessage(descriptor, 'demo.WrapRequest', encoded).label)
      .toEqual({ value: 'demo' });
  });

  it('throws when request body fails protobuf verification', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message CountRequest { int32 count = 1; }
service DemoService { rpc Call(CountRequest) returns (CountRequest); }`,
      }]),
      'proto_files',
      'verify-gap-test',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    expect(() => encodeProtoMessage(descriptor, 'demo.CountRequest', { count: 'not-a-number' }))
      .toThrow(/Invalid request body for demo\.CountRequest/i);
  });

  it('uses descriptor root cache when a parsed root is already registered', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'plain.proto',
        content: `syntax = "proto3";
package plain;
message Plain { string value = 1; }
service PlainService { rpc Call(Plain) returns (Plain); }`,
      }]),
      'proto_files',
      'cached-root-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const root = new protobuf.Root();
    protobuf.parse(`syntax = "proto3";
package plain;
message Plain { string value = 1; }`, root, { keepCase: true });
    root.resolveAll();
    setDescriptorRootCache(descriptor.key, root);

    const encoded = encodeProtoMessage(descriptor, 'plain.Plain', { value: 'cached' });
    expect(decodeProtoMessage(descriptor, 'plain.Plain', encoded)).toEqual({ value: 'cached' });
  });

  it('resolves message types via dotted lookup candidates', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload { string value = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'dot-lookup-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    expect(() => encodeProtoMessage(descriptor, '.demo.Payload', { value: 'x' })).not.toThrow();
  });

  it('synthesizes cross-package enum and message field references', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        name: 'DemoService',
        fullName: 'demo.DemoService',
        methods: [{
          name: 'Call',
          callType: 'unary' as const,
          requestTypeName: 'demo.Request',
          responseTypeName: 'demo.Request',
          requestSchema: {
            typeName: 'demo.Request',
            fields: [{
              name: 'status',
              number: 1,
              type: 'enum' as const,
              label: 'optional' as const,
              enumTypeName: 'other.Status',
              enumValues: [{ name: 'OK', number: 0 }],
            }, {
              name: 'nested',
              number: 2,
              type: 'message' as const,
              label: 'optional' as const,
              messageTypeName: 'other.Nested',
            }],
          },
          responseSchema: {
            typeName: 'demo.Request',
            fields: [],
          },
        }],
      }],
      messageTypes: [{
        typeName: 'demo.Request',
        fields: [{
          name: 'status',
          number: 1,
          type: 'enum' as const,
          label: 'optional' as const,
          enumTypeName: 'other.Status',
          enumValues: [{ name: 'OK', number: 0 }],
        }, {
          name: 'nested',
          number: 2,
          type: 'message' as const,
          label: 'optional' as const,
          messageTypeName: 'other.Nested',
        }],
      }, {
        typeName: 'other.Nested',
        fields: [{ name: 'value', number: 1, type: 'string' as const, label: 'optional' as const }],
      }],
      enumTypes: [{
        typeName: 'other.Status',
        values: [{ name: 'OK', number: 0 }],
      }],
    };

    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    expect(() => encodeProtoMessage(descriptor, 'demo.Request', {
      status: 0,
      nested: { value: 'x' },
    })).not.toThrow();
  });

  it('synthesizes additional well-known types and enum-only packages', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/any.proto";
enum LocalMode { UNKNOWN = 0; READY = 1; }
message Payload {
  google.protobuf.Any payload = 1;
  LocalMode mode = 2;
}
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'any-enum-package-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      payload: { type_url: 'type.googleapis.com/demo.Payload', value: 'abc' },
      mode: 1,
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      mode: 'READY',
    });
  });

  it('uses fallback grpcstudio package when descriptor has no services', () => {
    const descriptor = {
      key: 'no-services-gap',
      contentSha256: 'no-services-gap',
      services: [],
      messageTypes: [{
        typeName: 'Payload',
        fields: [{ name: 'value', type: 'string' as const, number: 1, label: 'optional' as const }],
      }],
    };
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    expect(() => encodeProtoMessage(descriptor, 'Payload', { value: 'x' })).not.toThrow();
  });

  it('synthesizes map fields with enum value types', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
enum Mode { UNKNOWN = 0; READY = 1; }
message Payload { map<string, Mode> modes = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'map-enum-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      modes: { alpha: 1 },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      modes: { alpha: 'READY' },
    });
  });

  it('synthesizes message fields without explicit messageTypeName', () => {
    const descriptor = {
      key: 'message-without-type-name-gap',
      contentSha256: 'message-without-type-name-gap',
      services: [{
        name: 'DemoService',
        fullName: 'demo.DemoService',
        methods: [{
          name: 'Call',
          callType: 'unary' as const,
          requestTypeName: 'demo.Payload',
          responseTypeName: 'demo.Payload',
          requestSchema: {
            typeName: 'demo.Payload',
            fields: [{ name: 'opaque', number: 1, type: 'message' as const, label: 'optional' as const }],
          },
          responseSchema: { typeName: 'demo.Payload', fields: [] },
        }],
      }],
      messageTypes: [{
        typeName: 'demo.Payload',
        fields: [{ name: 'opaque', number: 1, type: 'message' as const, label: 'optional' as const }],
      }],
    };
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    expect(() => encodeProtoMessage(descriptor, 'demo.Payload', { opaque: {} })).not.toThrow();
  });

  it('builds enum-only proto sections for packages without messages', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([
        {
          path: 'enums/status.proto',
          content: `syntax = "proto3";
package enums;
enum Status { UNKNOWN = 0; READY = 1; }`,
        },
        {
          path: 'api/request.proto',
          content: `syntax = "proto3";
package api;
import "enums/status.proto";
message Request { enums.Status status = 1; }
service ApiService { rpc Call(Request) returns (Request); }`,
        },
      ], ['.']),
      'proto_files',
      'enum-only-package-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'api.Request', { status: 1 });
    expect(decodeProtoMessage(descriptor, 'api.Request', encoded)).toMatchObject({ status: 'READY' });
  });

  it('synthesizes oneof-only messages and bool wrapper well-known types', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/wrappers.proto";
message Choice {
  oneof pick { google.protobuf.BoolValue enabled = 1; string name = 2; }
}
service DemoService { rpc Call(Choice) returns (Choice); }`,
      }]),
      'proto_files',
      'oneof-bool-wkt-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Choice', {
      enabled: { value: true },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Choice', encoded)).toMatchObject({
      enabled: { value: true },
    });
  });

  it('synthesizes same-package message references with short type names', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Child { string value = 1; }
message Parent { Child child = 1; repeated string tags = 2; }
service DemoService { rpc Call(Parent) returns (Parent); }`,
      }]),
      'proto_files',
      'same-package-short-name-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Parent', {
      child: { value: 'nested' },
      tags: ['a'],
    });
    expect(decodeProtoMessage(descriptor, 'demo.Parent', encoded)).toMatchObject({
      child: { value: 'nested' },
      tags: ['a'],
    });
  });

  it('synthesizes same-package enum references and duration well-known fields', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/duration.proto";
enum Mode { UNKNOWN = 0; READY = 1; }
message Payload { Mode mode = 1; google.protobuf.Duration ttl = 2; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'same-package-enum-duration-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      mode: 1,
      ttl: { seconds: 5, nanos: 0 },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      mode: 'READY',
      ttl: { seconds: '5', nanos: 0 },
    });
  });

  it('retries message lookup candidates when the first lookup fails', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload { string value = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'lookup-retry-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const lookupSpy = vi.spyOn(protobuf.Root.prototype, 'lookupType')
      .mockImplementationOnce(function lookupOnce(this: protobuf.Root, name: string) {
        if (name === 'demo.Payload') {
          throw new Error('miss first candidate');
        }
        return lookupSpy.mock.originalImplementation!.call(this, name);
      });

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', { value: 'retry' });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toEqual({ value: 'retry' });
    lookupSpy.mockRestore();
  });

  it('synthesizes map fields with cross-package message values', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([
        {
          path: 'other/label.proto',
          content: `syntax = "proto3";
package other;
message Label { string value = 1; }`,
        },
        {
          path: 'demo.proto',
          content: `syntax = "proto3";
package demo;
import "other/label.proto";
message Payload { map<string, other.Label> labels = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
        },
      ], ['.']),
      'proto_files',
      'map-cross-package-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      labels: { alpha: { value: 'one' } },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      labels: { alpha: { value: 'one' } },
    });
  });

  it('skips duplicate lookup candidates before failing', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload { string value = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'lookup-duplicate-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const lookupSpy = vi.spyOn(protobuf.Root.prototype, 'lookupType')
      .mockImplementation(() => {
        throw new Error('always miss');
      });

    expect(() => encodeProtoMessage(descriptor, 'Payload', { value: 'x' }))
      .toThrow(/not found in descriptor/i);
    lookupSpy.mockRestore();
  });

  it('defaults map key types when mapKeyType is omitted', () => {
    const descriptor = {
      key: 'default-map-key-gap',
      contentSha256: 'default-map-key-gap',
      services: [{ name: 'DemoService', fullName: 'demo.DemoService', methods: [] }],
      messageTypes: [{
        typeName: 'demo.Payload',
        fields: [{
          name: 'counts',
          number: 1,
          type: 'int32' as const,
          label: 'optional' as const,
          isMap: true,
        }],
      }],
    };
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    expect(() => encodeProtoMessage(descriptor, 'demo.Payload', { counts: { a: 1 } })).not.toThrow();
  });

  it('reuses dynamic codec root cache across calls for the same descriptor key', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'plain.proto',
        content: `syntax = "proto3";
package plain;
message Plain { string value = 1; }
service PlainService { rpc Call(Plain) returns (Plain); }`,
      }]),
      'proto_files',
      'local-root-cache-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    encodeProtoMessage(descriptor, 'plain.Plain', { value: 'first' });
    clearDescriptorRootCache();
    const encoded = encodeProtoMessage(descriptor, 'plain.Plain', { value: 'second' });
    expect(decodeProtoMessage(descriptor, 'plain.Plain', encoded)).toEqual({ value: 'second' });
  });

  it('wraps parseDescriptorRoot failures for non-Error throws', () => {
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      messageTypes: [{
        typeName: 'demo.Broken',
        fields: [{ name: 'value', type: 'string', number: 1, label: 'optional' as const }],
      }],
    };
    vi.spyOn(protobuf, 'parse').mockImplementation(() => {
      throw 'invalid proto section';
    });
    expect(() => encodeProtoMessage(descriptor, 'demo.Broken', { value: 'x' }))
      .toThrow(/Invalid descriptor schema for key/i);
    vi.restoreAllMocks();
  });

  it('synthesizes repeated fields and well-known type fields', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/timestamp.proto";
message Payload {
  repeated string tags = 1;
  google.protobuf.Timestamp created_at = 2;
}
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'repeated-wkt-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      tags: ['a', 'b'],
      created_at: { seconds: 1, nanos: 0 },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      tags: ['a', 'b'],
    });
  });

  it('synthesizes multiple well-known types in one stub section', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/timestamp.proto";
import "google/protobuf/duration.proto";
message MixedRequest {
  google.protobuf.Timestamp created_at = 1;
  google.protobuf.Duration ttl = 2;
}
service DemoService { rpc Call(MixedRequest) returns (MixedRequest); }`,
      }]),
      'proto_files',
      'multi-wkt-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.MixedRequest', {
      created_at: { seconds: 1, nanos: 0 },
      ttl: { seconds: 30, nanos: 0 },
    });
    expect(decodeProtoMessage(descriptor, 'demo.MixedRequest', encoded)).toMatchObject({
      created_at: { seconds: '1', nanos: 0 },
      ttl: { seconds: '30', nanos: 0 },
    });
  });

  it('normalizes wide integral map and repeated fields from decimal strings', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload {
  map<string, int64> ids = 1;
  repeated uint64 tokens = 2;
}
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'wide-integral-normalize-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      ids: { alpha: '42' },
      tokens: ['9007199254740993'],
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      ids: { alpha: '42' },
      tokens: ['9007199254740993'],
    });
  });

  it('throws when wide integral decimal strings are invalid', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload { uint64 token = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'invalid-wide-integral-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    expect(() => encodeProtoMessage(descriptor, 'demo.Payload', { token: 'not-a-number' }))
      .toThrow(/Invalid (64-bit integer|request body)/i);
  });

  it('synthesizes google.protobuf.Int32Value in mixed WKT payloads', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
import "google/protobuf/wrappers.proto";
message Payload { google.protobuf.Int32Value count = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'int32-value-wkt-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      count: { value: 7 },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      count: { value: 7 },
    });
  });

  it('synthesizes cross-package message references with fully qualified proto types', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([
        {
          path: 'other/label.proto',
          content: `syntax = "proto3";
package other;
message Label { string value = 1; }`,
        },
        {
          path: 'demo.proto',
          content: `syntax = "proto3";
package demo;
import "other/label.proto";
message Payload { other.Label label = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
        },
      ], ['.']),
      'proto_files',
      'cross-package-message-line-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Payload', {
      label: { value: 'remote' },
    });
    expect(decodeProtoMessage(descriptor, 'demo.Payload', encoded)).toMatchObject({
      label: { value: 'remote' },
    });
  });

  it('normalizes repeated nested message bodies before encode', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Child { string value = 1; }
message Parent { repeated Child children = 1; }
service DemoService { rpc Call(Parent) returns (Parent); }`,
      }]),
      'proto_files',
      'repeated-nested-normalize-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const encoded = encodeProtoMessage(descriptor, 'demo.Parent', {
      children: [{ value: 'a' }, { value: 'b' }],
    });
    expect(decodeProtoMessage(descriptor, 'demo.Parent', encoded)).toMatchObject({
      children: [{ value: 'a' }, { value: 'b' }],
    });
  });

  it('wraps non-Error long parsing failures when coercing decimal strings', () => {
    const descriptor = normalizeRootToDescriptor(
      parseProtoFiles([{
        path: 'demo.proto',
        content: `syntax = "proto3";
package demo;
message Payload { int64 id = 1; }
service DemoService { rpc Call(Payload) returns (Payload); }`,
      }]),
      'proto_files',
      'long-parse-gap',
    );
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();

    const fromString = vi.spyOn(protobuf.util.Long, 'fromString').mockImplementation(() => {
      throw 'bad-long';
    });
    expect(() => encodeProtoMessage(descriptor, 'demo.Payload', { id: '42' }))
      .toThrow(/Invalid 64-bit integer "42": bad-long/i);
    fromString.mockRestore();
  });
});
