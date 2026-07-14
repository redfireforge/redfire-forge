/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { FIXTURE_COMPLEX_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { encodeRootAsProtosetBase64, parseProtoFiles } from './protoDescriptorParser.js';
import { clearProtoFileDescriptorPool } from './protoFileDescriptorPool.js';
import {
  normalizeFileDescriptorSetForProst,
  type FileDescriptorSetLike,
} from './prostDescriptorNormalizer.js';

describe('normalizeFileDescriptorSetForProst', () => {
  it('reconstructs dependency arrays from cross-file type references', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          dependency: [],
          messageType: [
            {
              name: 'ComplexEchoRequest',
              field: [
                { typeName: 'google.protobuf.Timestamp' },
              ],
            },
          ],
        },
        {
          name: 'google/protobuf/timestamp.proto',
          package: 'google.protobuf',
          messageType: [{ name: 'Timestamp' }],
        },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    const echo = set.file!.find((f) => f.name === 'echo.proto')!;
    expect(echo.dependency).toContain('google/protobuf/timestamp.proto');
  });

  it('rewrites type references to be fully-qualified with a leading dot', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          messageType: [
            { name: 'ComplexEchoRequest', field: [{ typeName: 'google.protobuf.Timestamp' }] },
          ],
          service: [
            {
              method: [
                { inputType: 'echo.ComplexEchoRequest', outputType: 'echo.ComplexEchoRequest' },
              ],
            },
          ],
        },
        { name: 'google/protobuf/timestamp.proto', package: 'google.protobuf', messageType: [{ name: 'Timestamp' }] },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    const echo = set.file!.find((f) => f.name === 'echo.proto')!;
    expect(echo.messageType![0].field![0].typeName).toBe('.google.protobuf.Timestamp');
    expect(echo.service![0].method![0].inputType).toBe('.echo.ComplexEchoRequest');
    expect(echo.service![0].method![0].outputType).toBe('.echo.ComplexEchoRequest');
  });

  it('resolves relative nested (map-entry) references to fully-qualified names', () => {
    // protobufjs emits `map<string,string> attributes` as a nested map-entry type
    // referenced by the relative name `Attributes` (no leading dot, no package).
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          messageType: [
            {
              name: 'ComplexEchoRequest',
              field: [{ typeName: 'Attributes' }],
              nestedType: [{ name: 'Attributes' }],
            },
          ],
        },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    const field = set.file![0].messageType![0].field![0];
    // Must NOT become the (wrong) absolute `.Attributes`.
    expect(field.typeName).toBe('.echo.ComplexEchoRequest.Attributes');
    // A same-file reference must not create a self-dependency.
    expect(set.file![0].dependency).toEqual([]);
  });

  it('leaves unknown references unchanged instead of corrupting them', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          messageType: [{ name: 'EchoRequest', field: [{ typeName: 'some.unknown.Type' }] }],
        },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    expect(set.file![0].messageType![0].field![0].typeName).toBe('some.unknown.Type');
  });

  it('topologically sorts files so dependencies precede dependents', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          messageType: [{ name: 'ComplexEchoRequest', field: [{ typeName: 'google.protobuf.Timestamp' }] }],
        },
        { name: 'google/protobuf/timestamp.proto', package: 'google.protobuf', messageType: [{ name: 'Timestamp' }] },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    const order = set.file!.map((f) => f.name);
    expect(order.indexOf('google/protobuf/timestamp.proto')).toBeLessThan(order.indexOf('echo.proto'));
  });

  it('drops declared dependencies that are not present in the set', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          dependency: ['google/protobuf/timestamp.proto'],
          messageType: [{ name: 'EchoRequest' }],
        },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    expect(set.file![0].dependency).toEqual([]);
  });

  it('is a no-op for an empty set', () => {
    const set: FileDescriptorSetLike = { file: [] };
    expect(() => normalizeFileDescriptorSetForProst(set)).not.toThrow();
    expect(set.file).toEqual([]);
  });
});

describe('encodeRootAsProtosetBase64 (WKT-aware)', () => {
  beforeEach(() => {
    clearProtoFileDescriptorPool();
  });

  it('produces a protoset whose WKT-referencing file declares the timestamp dependency', () => {
    const root = parseProtoFiles([{ path: 'complex_echo.proto', content: FIXTURE_COMPLEX_ECHO_PROTO }]);
    const base64 = encodeRootAsProtosetBase64(root);
    const fds = descriptor.FileDescriptorSet.decode(Buffer.from(base64, 'base64')) as unknown as FileDescriptorSetLike;

    const files = fds.file ?? [];
    const timestampFile = files.find((f) =>
      (f.messageType ?? []).some((m) => m.name === 'Timestamp') && f.package === 'google.protobuf',
    );
    expect(timestampFile).toBeDefined();

    const echoFile = files.find((f) => (f.messageType ?? []).some((m) => m.name === 'ComplexEchoRequest'));
    expect(echoFile).toBeDefined();
    expect(echoFile!.dependency).toContain(timestampFile!.name);

    // Every cross-file type reference must be fully qualified with a leading dot.
    for (const file of files) {
      for (const message of file.messageType ?? []) {
        for (const field of message.field ?? []) {
          if (field.typeName) expect(field.typeName.startsWith('.')).toBe(true);
        }
      }
    }

    // Dependency precedes dependent.
    const order = files.map((f) => f.name);
    expect(order.indexOf(timestampFile!.name)).toBeLessThan(order.indexOf(echoFile!.name));
  });
});
