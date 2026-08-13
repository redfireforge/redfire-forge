import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/grpcSchemaBrowserModel', () => ({
  lookupMessageSchema: (descriptor: { __schemas?: Record<string, unknown> }, typeName: string) =>
    descriptor.__schemas?.[typeName] ?? null,
}));

import {
  buildGrpcurlBodyTemplate,
  fieldLabelText,
  fieldTypeLabel,
  grpcurlInstallHintForPlatform,
  schemaTypeTestId,
} from './GrpcSchemaBrowser.helpers';

const originalNavigator = (globalThis as { navigator?: { platform?: string } }).navigator;

function setNavigatorPlatform(platform?: string): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: platform ? { platform } : undefined,
    configurable: true,
    writable: true,
  });
}

function descriptorWithSchemas(schemas: Record<string, { fields: Array<Record<string, unknown>> }>) {
  return {
    files: [{ package: 'demo.v1', services: [] }],
    __schemas: schemas,
  } as unknown as import('../../../shared/grpc/contracts').GrpcDescriptor;
}

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
});

describe('grpcurlInstallHintForPlatform', () => {
  it('returns macOS install hint', () => {
    setNavigatorPlatform('MacIntel');
    expect(grpcurlInstallHintForPlatform()).toContain('brew install grpcurl');
  });

  it('returns Windows install hint', () => {
    setNavigatorPlatform('Win32');
    expect(grpcurlInstallHintForPlatform()).toContain('official release package');
  });

  it('returns generic hint when navigator is unavailable', () => {
    setNavigatorPlatform(undefined);
    expect(grpcurlInstallHintForPlatform()).toContain('use your distro package');
  });
});

describe('field label helpers', () => {
  it('formats map, message, enum, and fallback types', () => {
    expect(fieldTypeLabel({ isMap: true, mapKeyType: undefined, type: 'string', name: 'm', label: 'optional' } as never)).toBe('map<string, string>');
    expect(fieldTypeLabel({ isMap: true, mapKeyType: 'int32', type: 'message', messageTypeName: 'User', name: 'm', label: 'optional' } as never)).toBe('map<int32, User>');
    expect(fieldTypeLabel({ isMap: false, type: 'message', messageTypeName: 'Item', name: 'x', label: 'optional' } as never)).toBe('Item');
    expect(fieldTypeLabel({ isMap: false, type: 'enum', enumTypeName: 'Status', name: 'x', label: 'optional' } as never)).toBe('Status');
    expect(fieldTypeLabel({ isMap: false, type: 'bytes', name: 'x', label: 'optional' } as never)).toBe('bytes');
  });

  it('formats oneof and regular labels', () => {
    expect(fieldLabelText({ isOneofMember: true, oneofName: 'choice', label: 'optional', name: 'a', type: 'string' } as never)).toBe('oneof choice');
    expect(fieldLabelText({ isOneofMember: false, label: 'repeated', name: 'a', type: 'string' } as never)).toBe('repeated');
  });
});

describe('buildGrpcurlBodyTemplate', () => {
  it('builds full body and deduplicates oneof fields', () => {
    const descriptor = descriptorWithSchemas({
      Request: {
        fields: [
          { name: 'id', label: 'optional', type: 'string' },
          { name: 'choiceA', label: 'optional', type: 'string', isOneofMember: true, oneofName: 'choice' },
          { name: 'choiceB', label: 'optional', type: 'string', isOneofMember: true, oneofName: 'choice' },
          { name: 'flags', label: 'repeated', type: 'bool' },
          { name: 'meta', label: 'optional', type: 'message', messageTypeName: 'Meta' },
          { name: 'status', label: 'optional', type: 'enum' },
        ],
      },
      Meta: {
        fields: [
          { name: 'name', label: 'optional', type: 'string' },
          { name: 'loop', label: 'optional', type: 'message', messageTypeName: 'Meta' },
        ],
      },
    });

    const method = { name: 'Get', requestTypeName: 'Request' } as unknown as import('../../../shared/grpc/contracts').GrpcMethodInfo;
    const body = buildGrpcurlBodyTemplate(descriptor, method, 'full');

    expect(body).toMatchObject({ id: 'A-100', flags: [], meta: { name: 'demo', loop: {} }, status: 0 });
    expect(body).toHaveProperty('choiceA');
    expect(body).not.toHaveProperty('choiceB');
  });

  it('builds minimal body using preferred field fallback and nested message path', () => {
    const descriptor = descriptorWithSchemas({
      Request: {
        fields: [
          { name: 'zzz', label: 'optional', type: 'message', messageTypeName: 'Nested' },
        ],
      },
      Nested: {
        fields: [
          { name: 'plain', label: 'optional', type: 'int32' },
        ],
      },
    });
    const method = { name: 'Get', requestTypeName: 'Request' } as unknown as import('../../../shared/grpc/contracts').GrpcMethodInfo;

    expect(buildGrpcurlBodyTemplate(descriptor, method, 'minimal')).toEqual({ zzz: { plain: 1 } });
  });

  it('returns empty objects for missing schema, empty fields, and invalid message field metadata', () => {
    const descriptor = descriptorWithSchemas({
      Empty: { fields: [] },
      Request: {
        fields: [
          { name: 'nested', label: 'optional', type: 'message' },
        ],
      },
    });

    const missingMethod = { name: 'Get', requestTypeName: 'Missing' } as unknown as import('../../../shared/grpc/contracts').GrpcMethodInfo;
    const emptyMethod = { name: 'Get', requestTypeName: 'Empty' } as unknown as import('../../../shared/grpc/contracts').GrpcMethodInfo;
    const invalidNested = { name: 'Get', requestTypeName: 'Request' } as unknown as import('../../../shared/grpc/contracts').GrpcMethodInfo;

    expect(buildGrpcurlBodyTemplate(descriptor, missingMethod, 'minimal')).toEqual({});
    expect(buildGrpcurlBodyTemplate(descriptor, emptyMethod, 'minimal')).toEqual({});
    expect(buildGrpcurlBodyTemplate(descriptor, invalidNested, 'minimal')).toEqual({ nested: null });
  });
});

describe('schemaTypeTestId', () => {
  it('normalizes type names for test IDs', () => {
    expect(schemaTypeTestId('Demo.V1/User-Profile')).toBe('demo-v1-user-profile');
  });
});
