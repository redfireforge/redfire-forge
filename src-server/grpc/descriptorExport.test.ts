/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { parseProtoFiles, parseProtosetBase64 } from './protoDescriptorParser.js';
import { encodeRootAsProtosetBase64 } from './protoDescriptorParser.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import { clearDescriptorRootCache, getDescriptorRootCache, setDescriptorRootCache } from './descriptorRootCache.js';
import { clearGrpcDescriptorStore } from './descriptorStore.js';

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

describe('descriptorRootCache + export protoset', () => {
  it('round-trips protoset through root cache', () => {
    clearGrpcDescriptorStore();
    clearDescriptorRootCache();

    const root = parseProtoFiles([{ path: 'demo.proto', content: MAP_ONEOF_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'demo-key');
    setDescriptorRootCache(descriptor.key, root);

    const cached = getDescriptorRootCache(descriptor.key);
    expect(cached).toBe(root);

    const protosetBase64 = encodeRootAsProtosetBase64(root);
    const reparsed = parseProtosetBase64(protosetBase64);
    const roundTrip = normalizeRootToDescriptor(reparsed, 'protoset', 'round-trip');
    expect(roundTrip.services[0]?.methods.map((method) => method.name).sort()).toEqual(['MapRpc', 'OneofRpc']);
  });

  it('normalizes map and oneof field metadata', () => {
    const root = parseProtoFiles([{ path: 'demo.proto', content: MAP_ONEOF_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'demo-key');
    const mapRequest = descriptor.messageTypes?.find((entry) => entry.typeName === 'demo.MapRequest');
    const oneofRequest = descriptor.messageTypes?.find((entry) => entry.typeName === 'demo.OneofRequest');

    expect(mapRequest?.fields[0]).toMatchObject({
      name: 'counts',
      isMap: true,
      mapKeyType: 'string',
      type: 'int32',
    });
    expect(oneofRequest?.fields.filter((field) => field.isOneofMember)).toHaveLength(2);
    expect(oneofRequest?.fields.find((field) => field.name === 'name')).toMatchObject({
      isOneofMember: true,
      oneofName: 'payload',
    });
  });
});
