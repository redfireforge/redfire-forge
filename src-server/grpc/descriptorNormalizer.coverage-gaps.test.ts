/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { parseProtoFiles } from './protoDescriptorParser.js';
import {
  mergeProtobufRoots,
  normalizeRootToDescriptor,
} from './descriptorNormalizer.js';

const RICH_PROTO = `syntax = "proto3";
package demo;

enum Status {
  UNKNOWN = 0;
  OK = 1;
}

message Item {
  map<string, int32> counts = 1;
}

message Request {
  oneof payload {
    string name = 1;
    Status status = 2;
  }
  repeated Item items = 3;
}

service DemoService {
  rpc Call(Request) returns (Request);
}`;

const NESTED_PROTO = `syntax = "proto3";
package outer.inner;
message Nested { string id = 1; }
service NestedService { rpc Ping(Nested) returns (Nested); }`;

describe('descriptorNormalizer coverage gaps', () => {
  it('normalizes map, oneof, and enum fields from proto source', () => {
    const root = parseProtoFiles([{ path: 'demo.proto', content: RICH_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'rich-test');
    const item = descriptor.messageTypes?.find((entry) => entry.typeName === 'demo.Item');
    const request = descriptor.messageTypes?.find((entry) => entry.typeName === 'demo.Request');
    expect(item?.fields.some((field) => field.isMap)).toBe(true);
    expect(request?.fields.some((field) => field.isOneofMember)).toBe(true);
    expect(descriptor.enumTypes?.some((entry) => entry.typeName === 'demo.Status')).toBe(true);
  });

  it('walks nested namespaces for services and messages', () => {
    const root = parseProtoFiles([{ path: 'nested.proto', content: NESTED_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'nested-test');
    expect(descriptor.services[0]?.fullName).toBe('outer.inner.NestedService');
    expect(descriptor.messageTypes?.some((entry) => entry.typeName === 'outer.inner.Nested')).toBe(true);
  });

  it('mergeProtobufRoots returns single root unchanged', () => {
    const root = parseProtoFiles([{ path: 'demo.proto', content: RICH_PROTO }]);
    expect(mergeProtobufRoots([root])).toBe(root);
  });

  it('mergeProtobufRoots deduplicates shared proto files across roots', () => {
    const shared = `syntax = "proto3"; package shared; message Shared { string id = 1; }`;
    const svcA = `syntax = "proto3"; package a; import "shared.proto"; message Req { shared.Shared s = 1; } service SvcA { rpc Call(Req) returns (Req); }`;
    const svcB = `syntax = "proto3"; package b; import "shared.proto"; message Req { shared.Shared s = 1; } service SvcB { rpc Call(Req) returns (Req); }`;
    const rootA = parseProtoFiles([
      { path: 'shared.proto', content: shared },
      { path: 'a.proto', content: svcA },
    ]);
    const rootB = parseProtoFiles([
      { path: 'shared.proto', content: shared },
      { path: 'b.proto', content: svcB },
    ]);
    const merged = mergeProtobufRoots([rootA, rootB]);
    expect(merged.lookupService('a.SvcA')).toBeTruthy();
    expect(merged.lookupService('b.SvcB')).toBeTruthy();
  });

  it('mergeProtobufRoots rejects empty input', () => {
    expect(() => mergeProtobufRoots([])).toThrow(/requires at least one root/i);
  });

  it('skips internal google schema types from normalized descriptor output', () => {
    const root = parseProtoFiles([{
      path: 'demo.proto',
      content: `syntax = "proto3";
package demo;
import "google/protobuf/empty.proto";
message Annotated {
  string id = 1;
}
service DemoService { rpc Call(Annotated) returns (Annotated); }`,
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'internal-skip');
    expect(descriptor.messageTypes?.some((entry) => entry.typeName.startsWith('google.protobuf'))).toBe(false);
    expect(descriptor.messageTypes?.find((entry) => entry.typeName === 'demo.Annotated')).toBeDefined();
  });

  it('preserves doc comments on normalized schema entities', () => {
    const commented = `syntax = "proto3";
package demo;
/** Status doc */
enum Status { UNKNOWN = 0; }
/** Item doc */
message Item { string id = 1; }
service DemoService {
  /** Call doc */
  rpc Call(Item) returns (Item);
}`;
    const root = parseProtoFiles([{ path: 'demo.proto', content: commented }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'comments-test');
    expect(descriptor.enumTypes?.[0]?.docComment).toBeTruthy();
    expect(descriptor.messageTypes?.[0]?.docComment).toBeTruthy();
    expect(descriptor.services[0]?.methods[0]?.docComment).toBeTruthy();
  });

  it('throws when method references a missing message type', () => {
    const root = parseProtoFiles([{
      path: 'bad.proto',
      content: `syntax = "proto3";
package bad;
message Present { string id = 1; }
service BadService { rpc Call(Present) returns (Present); }`,
    }]);
    vi.spyOn(root, 'lookupType').mockReturnValue(null as never);
    expect(() => normalizeRootToDescriptor(root, 'proto_files', 'missing-type'))
      .toThrow(/not found in descriptor/i);
  });

  it('normalizes proto2 required fields and map key fallbacks', () => {
    const proto2 = `syntax = "proto2";
package legacy;
message Legacy {
  required string id = 1;
  map<string, bytes> payloads = 2;
}
service LegacyService {
  rpc Call(Legacy) returns (Legacy);
}`;
    const root = parseProtoFiles([{ path: 'legacy.proto', content: proto2 }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'legacy-test');
    const legacy = descriptor.messageTypes?.find((entry) => entry.typeName === 'legacy.Legacy');
    const idField = legacy?.fields.find((field) => field.name === 'id');
    const mapField = legacy?.fields.find((field) => field.isMap);
    expect(idField?.label).toBe('required');
    expect(mapField?.mapKeyType).toBe('string');
  });

  it('maps well-known timestamp fields during normalization', () => {
    const wktProto = `syntax = "proto3";
package wkt;
import "google/protobuf/timestamp.proto";
message Event {
  google.protobuf.Timestamp at = 1;
}
service EventService { rpc Publish(Event) returns (Event); }`;
    const root = parseProtoFiles([{ path: 'event.proto', content: wktProto }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'wkt-test');
    const event = descriptor.messageTypes?.find((entry) => entry.typeName === 'wkt.Event');
    expect(event?.fields.find((field) => field.name === 'at')?.type).toBe('google.protobuf.Timestamp');
  });

  it('falls back to string for unknown field types and map key types', () => {
    const root = parseProtoFiles([{
      path: 'legacy.proto',
      content: `syntax = "proto2";
package legacy;
message Legacy {
  required string id = 1;
  map<string, bytes> payloads = 2;
}
service LegacyService { rpc Call(Legacy) returns (Legacy); }`,
    }]);
    const legacyType = root.lookupType('legacy.Legacy');
    const unknownField = legacyType.fieldsArray.find((field) => field.name === 'id')!;
    Object.defineProperty(unknownField, 'type', { value: 'customtype', configurable: true });
    const mapField = legacyType.fieldsArray.find((field) => field.name === 'payloads')!;
    Object.defineProperty(mapField, 'keyType', { value: 'customkey', configurable: true });

    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'fallback-test');
    const legacy = descriptor.messageTypes?.find((entry) => entry.typeName === 'legacy.Legacy');
    expect(legacy?.fields.find((field) => field.name === 'id')?.type).toBe('string');
    expect(legacy?.fields.find((field) => field.isMap)?.mapKeyType).toBe('string');
  });

  it('collects enum types from nested namespaces with doc comments', () => {
    const enumProto = `syntax = "proto3";
package metrics;
/** Priority doc */
enum Priority { LOW = 10; HIGH = 1; }
message Sample { Priority level = 1; }
service MetricsService { rpc Observe(Sample) returns (Sample); }`;
    const root = parseProtoFiles([{ path: 'metrics.proto', content: enumProto }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'enum-test');
    expect(descriptor.enumTypes?.some((entry) => entry.typeName === 'metrics.Priority')).toBe(true);
    expect(descriptor.enumTypes?.[0]?.docComment).toBeTruthy();
    expect(descriptor.enumTypes?.[0]?.values[0]?.number).toBe(1);
  });

  it('mergeProtobufRoots skips unnamed file descriptors during merge', () => {
    const rootA = parseProtoFiles([{ path: 'demo.proto', content: RICH_PROTO }]);
    const rootB = parseProtoFiles([{ path: 'nested.proto', content: NESTED_PROTO }]);
    vi.spyOn(rootB, 'toDescriptor').mockReturnValue({
      file: [{ name: '', package: 'skip.me', syntax: 'proto3', messageType: [] }],
    });
    const merged = mergeProtobufRoots([rootA, rootB]);
    expect(merged.lookupService('demo.DemoService')).toBeTruthy();
  });
});
