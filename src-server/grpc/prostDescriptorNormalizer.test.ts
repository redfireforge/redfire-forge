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

  it('covers unnamed files/messages, already-qualified refs, extendee, and empty fields', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: '',
          package: '',
          messageType: [{ name: undefined, field: [{ typeName: null }] }],
        },
        {
          name: null,
          package: null,
          messageType: [{ name: 'Anon', field: [{ typeName: null, extendee: null }] }],
        },
        {
          // Named file with no package — exercises empty package prefix branches
          name: 'nopkg.proto',
          messageType: [{ name: 'Bare', field: [{ typeName: 'Bare' }] }],
        },
        {
          name: 'ext.proto',
          package: 'ext',
          messageType: [
            {
              name: 'Host',
              field: [{ typeName: '.ext.Host' }, { typeName: undefined }],
              extension: [{ extendee: 'google.protobuf.Timestamp' }, { extendee: undefined }],
              nestedType: [{ name: undefined, field: null, enumType: null }],
              enumType: [{ name: undefined }, { name: 'Kind' }],
            },
          ],
          enumType: [{ name: undefined }, { name: 'Top' }],
          extension: [{ extendee: '.ext.Host' }],
          service: [
            { method: null },
            {},
            { method: [{ inputType: null, outputType: undefined }] },
            {
              method: [
                { inputType: '.ext.Host', outputType: 'Top' },
              ],
            },
          ],
        },
        {
          name: 'google/protobuf/timestamp.proto',
          package: 'google.protobuf',
          messageType: [{ name: 'Timestamp', field: null, nestedType: null, enumType: null }],
        },
        {
          name: undefined,
          package: undefined,
          messageType: null,
          enumType: null,
          service: null,
          extension: null,
        },
      ],
    };

    normalizeFileDescriptorSetForProst(set);
    const host = set.file!.find((file) => file.name === 'ext.proto')!;
    expect(host.messageType![0].field![0].typeName).toBe('.ext.Host');
    expect(host.extension![0].extendee).toBe('.ext.Host');
    expect(host.dependency).toContain('google/protobuf/timestamp.proto');
    const bare = set.file!.find((file) => file.name === 'nopkg.proto')!;
    expect(bare.messageType![0].field![0].typeName).toBe('.Bare');
  });

  it('tolerates cyclic and missing declared dependencies during sort', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'a.proto',
          package: 'a',
          dependency: ['b.proto', 'missing.proto'],
          messageType: [{ name: 'A', field: [{ typeName: 'b.B' }] }],
        },
        {
          name: 'b.proto',
          package: 'b',
          dependency: ['a.proto'],
          messageType: [{ name: 'B', field: [{ typeName: 'a.A' }] }],
        },
      ],
    };
    expect(() => normalizeFileDescriptorSetForProst(set)).not.toThrow();
    expect(set.file!.map((file) => file.name)).toEqual(expect.arrayContaining(['a.proto', 'b.proto']));
  });

  it('is a no-op when file array is missing', () => {
    const set: FileDescriptorSetLike = {};
    expect(() => normalizeFileDescriptorSetForProst(set)).not.toThrow();
  });

  it('skips nameless files while rebuilding dependency maps', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          // name intentionally omitted — visited and dependency rebuild must tolerate it
          package: 'orphan',
          messageType: [{ name: 'Orphan', field: [{ typeName: 'google.protobuf.Timestamp' }] }],
        },
        {
          name: 'google/protobuf/timestamp.proto',
          package: 'google.protobuf',
          messageType: [{ name: 'Timestamp' }],
        },
        {
          name: 'consumer.proto',
          package: 'consumer',
          messageType: [{ name: 'UsesTs', field: [{ typeName: 'google.protobuf.Timestamp' }] }],
        },
      ],
    };
    normalizeFileDescriptorSetForProst(set);
    expect(set.file!.some((file) => file.name === 'consumer.proto')).toBe(true);
  });

  it('clears empty extendee/typeName on map-entry fields (prost-reflect compatibility)', () => {
    const set: FileDescriptorSetLike = {
      file: [
        {
          name: 'echo.proto',
          package: 'echo',
          messageType: [
            {
              name: 'ComplexEchoRequest',
              nestedType: [
                {
                  name: 'Attributes',
                  field: [
                    { name: 'key', number: 1, typeName: '', extendee: '' },
                    { name: 'value', number: 2, typeName: '', extendee: '' },
                  ],
                },
              ],
              field: [
                { name: 'attributes', number: 3, typeName: 'Attributes', extendee: '' },
              ],
            },
          ],
        },
      ],
    };

    normalizeFileDescriptorSetForProst(set);

    const request = set.file![0]!.messageType![0]!;
    const attrs = request.nestedType![0]!;
    expect(attrs.field![0]!.extendee == null).toBe(true);
    expect(attrs.field![0]!.typeName == null).toBe(true);
    expect(attrs.field![1]!.extendee == null).toBe(true);
    expect(request.field![0]!.extendee == null).toBe(true);
    expect(request.field![0]!.typeName).toBe('.echo.ComplexEchoRequest.Attributes');
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

  it('reflection map-entry protoset encodes without empty extendee (Tauri native)', async () => {
    // Live Go echo fixture — skip when Docker is down so unit CI stays hermetic.
    try {
      const health = await fetch('http://localhost:50052/health', { signal: AbortSignal.timeout(800) });
      if (!health.ok) return;
    } catch {
      return;
    }

    const { GrpcReflectionClient } = await import('./reflectionClient.js');
    const client = new GrpcReflectionClient();
    const reflected = await client.fetchReflectionRoot({
      address: 'localhost:50051',
      timeoutMs: 8_000,
    });
    const base64 = encodeRootAsProtosetBase64(reflected.root);
    const fds = descriptor.FileDescriptorSet.decode(Buffer.from(base64, 'base64'));
    const echo = (fds.file ?? []).find((f: { package?: string }) => f.package === 'echo');
    expect(echo).toBeDefined();
    const request = (echo!.messageType ?? []).find((m: { name?: string }) => m.name === 'ComplexEchoRequest');
    const attrs = (request?.nestedType ?? []).find((m: { name?: string }) => m.name === 'Attributes');
    expect(attrs).toBeDefined();
    // Encode the map-entry DescriptorProto and ensure key/value do not carry an
    // empty `extendee` (`12 00` after the field name) — that breaks prost-reflect.
    const attrsHex = Buffer.from(descriptor.DescriptorProto.encode(attrs).finish()).toString('hex');
    expect(attrsHex.includes('0a036b65791200')).toBe(false); // name "key" + empty extendee
    expect(attrsHex.includes('0a0576616c75651200')).toBe(false); // name "value" + empty extendee
    expect(attrsHex.includes('3a023801')).toBe(true); // options.map_entry = true still present
  });
});
