/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { descriptorServiceSignatures } from './descriptorNormalizer.js';
import { clearProtoFileDescriptorPool } from './protoFileDescriptorPool.js';
import {
  encodeRootAsProtosetBase64,
  normalizeDescribeProtoFilesInput,
  parseDescribeRequestSource,
  parseProtoFiles,
  parseProtosetBase64,
  ProtoImportResolutionError,
} from './protoDescriptorParser.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';

describe('protoDescriptorParser', () => {
  beforeEach(() => {
    clearProtoFileDescriptorPool();
  });

  it('parses proto_files source', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    expect(root.lookupService('echo.EchoService')?.name).toBe('EchoService');
  });

  it('normalizes protoRoots into canonical protoFiles + importPaths', () => {
    const normalized = normalizeDescribeProtoFilesInput({
      protoRoots: [
        {
          id: 'shared-root',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
        {
          id: 'api-root',
          mountPath: 'api',
          files: [{ path: 'service.proto', content: 'syntax = "proto3";' }],
        },
      ],
    });
    expect(normalized.protoFiles.map((file) => file.path).sort()).toEqual([
      'api/service.proto',
      'shared/common.proto',
    ]);
    expect(normalized.importPaths).toEqual(['shared', 'api']);
  });

  it('round-trips protoset base64', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    const decoded = parseProtosetBase64(protosetBase64);
    expect(decoded.lookupService('echo.EchoService')?.name).toBe('EchoService');
  });

  it('accepts protoset payloads with whitespace and wrapped lines', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    const wrapped = `${protosetBase64.slice(0, 30)}\n${protosetBase64.slice(30, 80)}\n${protosetBase64.slice(80)}`;
    const decoded = parseProtosetBase64(wrapped);
    expect(decoded.lookupService('echo.EchoService')?.name).toBe('EchoService');
  });

  it('accepts protoset payloads with data-uri prefix and base64url alphabet', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const payload = `data:application/octet-stream;base64,${protosetBase64}`;
    const decoded = parseProtosetBase64(payload);
    expect(decoded.lookupService('echo.EchoService')?.name).toBe('EchoService');
  });

  it('produces equivalent signatures for proto_files and protoset sources', () => {
    const protoRoot = parseDescribeRequestSource({
      source: 'proto_files',
      protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }] }],
    });
    const protosetBase64 = encodeRootAsProtosetBase64(protoRoot);
    const protosetRoot = parseDescribeRequestSource({
      source: 'protoset',
      protosetBase64,
    });
    const protoDescriptor = normalizeRootToDescriptor(protoRoot, 'proto_files', 'a');
    const protosetDescriptor = normalizeRootToDescriptor(protosetRoot, 'protoset', 'b');
    expect(descriptorServiceSignatures(protoDescriptor)).toBe(
      descriptorServiceSignatures(protosetDescriptor),
    );
  });

  it('parses proto_files source from protoRoots input', () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "common.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const root = parseDescribeRequestSource({
      source: 'proto_files',
      protoRoots: [
        {
          id: 'shared-root',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: commonProto }],
        },
        {
          id: 'api-root',
          mountPath: 'api',
          files: [{ path: 'service.proto', content: apiProto }],
        },
      ],
    });
    expect(root.lookupService('api.ApiService')?.name).toBe('ApiService');
  });

  it('throws for invalid protoset base64', () => {
    expect(() => parseProtosetBase64('!!!')).toThrow(/Invalid protosetBase64|Failed to decode protoset|empty buffer/);
  });

  it('throws for duplicate proto file paths', () => {
    expect(() => parseProtoFiles([
      { path: 'echo.proto', content: FIXTURE_ECHO_PROTO },
      { path: 'echo.proto', content: FIXTURE_ECHO_PROTO },
    ])).toThrow(/Duplicate proto file path: echo\.proto/);
  });

  it('resolves cross-file proto imports within uploaded files', () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "common/types.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const root = parseProtoFiles([
      { path: 'common/types.proto', content: commonProto },
      { path: 'api/service.proto', content: apiProto },
    ]);
    expect(root.lookupService('api.ApiService')?.name).toBe('ApiService');
    const requestType = root.lookupType('api.Request');
    expect(requestType.fieldsArray[0]?.resolvedType?.fullName).toBe('.common.Shared');
  });

  it('resolves proto imports via importPaths when files use short paths', () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "common.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const root = parseProtoFiles(
      [
        { path: 'shared/common.proto', content: commonProto },
        { path: 'api/service.proto', content: apiProto },
      ],
      ['shared'],
    );
    expect(root.lookupService('api.ApiService')?.name).toBe('ApiService');
    expect(root.lookupType('common.Shared')?.name).toBe('Shared');
  });

  it('resolves nested import targets when drag/drop flattens uploaded file paths', () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "shared/common.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const root = parseProtoFiles([
      { path: 'service.proto', content: apiProto },
      { path: 'common.proto', content: commonProto },
    ]);
    expect(root.lookupService('api.ApiService')?.name).toBe('ApiService');
    expect(root.lookupType('api.Request')?.fieldsArray[0]?.resolvedType?.fullName).toBe('.common.Shared');
  });

  it('resolves parent-directory relative imports across uploaded files', () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "../common/types.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const root = parseProtoFiles([
      { path: 'common/types.proto', content: commonProto },
      { path: 'api/service.proto', content: apiProto },
    ]);
    expect(root.lookupService('api.ApiService')?.name).toBe('ApiService');
  });

  it('resolves transitive imports across nested proto trees', () => {
    const baseProto = `syntax = "proto3";
package base;
message BaseId { string id = 1; }`;
    const commonProto = `syntax = "proto3";
package common;
import "base/ids.proto";
message Shared { base.BaseId ref = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "common/types.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const root = parseProtoFiles([
      { path: 'base/ids.proto', content: baseProto },
      { path: 'common/types.proto', content: commonProto },
      { path: 'api/service.proto', content: apiProto },
    ]);
    expect(root.lookupService('api.ApiService')?.name).toBe('ApiService');
    expect(root.lookupType('api.Request')?.fieldsArray[0]?.resolvedType?.fullName).toBe('.common.Shared');
  });

  it('resolves google/protobuf/timestamp.proto via bundled WKT', () => {
    const proto = `syntax = "proto3";
package wkttest;
import "google/protobuf/timestamp.proto";
message Event { google.protobuf.Timestamp at = 1; }
message Empty {}
service WktService { rpc Ping(Empty) returns (Empty); }`;

    const root = parseProtoFiles([{ path: 'event.proto', content: proto }]);
    expect(root.lookupService('wkttest.WktService')?.name).toBe('WktService');
    expect(root.lookupType('wkttest.Event')?.fieldsArray[0]?.resolvedType?.fullName)
      .toBe('.google.protobuf.Timestamp');
  });

  it('throws ProtoImportResolutionError for unresolved imports', () => {
    const proto = `syntax = "proto3";
package broken;
import "missing/vendor.proto";
message Empty {}
service Broken { rpc Ping(Empty) returns (Empty); }`;

    expect(() => parseProtoFiles([{ path: 'broken.proto', content: proto }]))
      .toThrow(ProtoImportResolutionError);
  });

  it('allows missing weak imports without failing pre-validation', () => {
    const proto = `syntax = "proto3";
package optional;
import weak "missing/optional.proto";
message Empty {}
service OptionalService { rpc Ping(Empty) returns (Empty); }`;

    const root = parseProtoFiles([{ path: 'optional.proto', content: proto }]);
    expect(root.lookupService('optional.OptionalService')?.name).toBe('OptionalService');
  });

  it('resolves google/api/annotations.proto via bundled stubs', () => {
    const proto = `syntax = "proto3";
package api;
import "google/api/annotations.proto";
import "google/protobuf/empty.proto";
message Request {}
message Response {}
service AnnotatedService {
  rpc Call(Request) returns (Response) {
    option (google.api.http) = { get: "/v1/call" };
  }
}`;

    const root = parseProtoFiles([{ path: 'api/service.proto', content: proto }]);
    expect(root.lookupService('api.AnnotatedService')?.name).toBe('AnnotatedService');
  });

  it('parses user protos under google/ paths without double-parsing bundled WKT', () => {
    const proto = `syntax = "proto3";
package google.custom;
message Custom {}
service CustomService { rpc Ping(Custom) returns (Custom); }`;

    const root = parseProtoFiles([{ path: 'google/custom/service.proto', content: proto }]);
    expect(root.lookupService('google.custom.CustomService')?.name).toBe('CustomService');
  });
});
