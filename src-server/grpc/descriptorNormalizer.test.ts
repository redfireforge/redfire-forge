/**
 * @vitest-environment node
 */
import protobuf from 'protobufjs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import {
  descriptorServiceSignatures,
  mergeProtobufRoots,
  normalizeRootToDescriptor,
} from './descriptorNormalizer.js';
import { parseProtoFiles } from './protoDescriptorParser.js';

describe('descriptorNormalizer', () => {
  it('normalizes echo proto into stable service signatures', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'test-key');
    expect(descriptor.services).toHaveLength(1);
    expect(descriptor.services[0]?.fullName).toBe('echo.EchoService');
    expect(descriptor.services[0]?.methods.find((m) => m.name === 'Echo')).toMatchObject({
      name: 'Echo',
      callType: 'unary',
      requestTypeName: 'echo.EchoRequest',
      responseTypeName: 'echo.EchoResponse',
    });
    expect(descriptor.services[0]?.methods.find((m) => m.name === 'Echo')?.requestSchema.fields[0]).toMatchObject({
      name: 'message',
      type: 'string',
      label: 'optional',
    });
    expect(descriptor.messageTypes?.map((entry) => entry.typeName).sort()).toEqual([
      'echo.EchoRequest',
      'echo.EchoResponse',
      'echo.StreamRequest',
    ]);
    expect(descriptor.messageTypes?.every((entry) => !entry.typeName.startsWith('google.protobuf.'))).toBe(true);
  });

  it('matches fixture service signatures for echo proto', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const normalized = normalizeRootToDescriptor(root, 'proto_files', 'test-key');
    expect(descriptorServiceSignatures(normalized)).toBe(
      descriptorServiceSignatures(FIXTURE_DESCRIPTOR),
    );
  });

  it('throws when no services are present', () => {
    const root = protobuf.parse('syntax = "proto3"; message OnlyMessage { string id = 1; }').root;
    expect(() => normalizeRootToDescriptor(root, 'proto_files', 'empty')).toThrow(/No gRPC services/);
  });

  it('merges reflection roots that share imported proto files', () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const svc1Proto = `syntax = "proto3";
package a;
import "common.proto";
message Req1 { common.Shared s = 1; }
message Res1 { string ok = 1; }
service Svc1 { rpc Call(Req1) returns (Res1); }`;
    const svc2Proto = `syntax = "proto3";
package b;
import "common.proto";
message Req2 { common.Shared s = 1; }
message Res2 { string ok = 1; }
service Svc2 { rpc Call(Req2) returns (Res2); }`;

    const root1 = parseProtoFiles([
      { path: 'common.proto', content: commonProto },
      { path: 'a.proto', content: svc1Proto },
    ]);
    const root2 = parseProtoFiles([
      { path: 'common.proto', content: commonProto },
      { path: 'b.proto', content: svc2Proto },
    ]);

    const merged = mergeProtobufRoots([root1, root2]);
    expect(merged.lookupService('a.Svc1')?.name).toBe('Svc1');
    expect(merged.lookupService('b.Svc2')?.name).toBe('Svc2');
    expect(merged.lookupType('common.Shared')?.name).toBe('Shared');

    const descriptor = normalizeRootToDescriptor(merged, 'reflection', 'merged-key');
    expect(descriptor.services.map((service) => service.fullName).sort()).toEqual(['a.Svc1', 'b.Svc2']);
  });
});
