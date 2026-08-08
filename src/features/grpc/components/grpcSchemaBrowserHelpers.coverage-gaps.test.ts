import { describe, expect, it } from 'vitest';
import type { GrpcDescriptor, GrpcMethodInfo } from '../../../shared/grpc/contracts';
import {
  buildGrpcurlBodyTemplate,
  fieldTypeLabel,
  grpcurlInstallHintForPlatform,
} from './grpcSchemaBrowserHelpers';

const BASE_METHOD: GrpcMethodInfo = {
  name: 'Probe',
  callType: 'unary',
  requestTypeName: 'demo.ProbeRequest',
  responseTypeName: 'demo.ProbeResponse',
  requestSchema: {
    typeName: 'demo.ProbeRequest',
    fields: [],
  },
  responseSchema: {
    typeName: 'demo.ProbeResponse',
    fields: [],
  },
};

describe('grpcSchemaBrowserHelpers coverage gaps', () => {
  it('returns platform-specific grpcurl install hints for mac and windows', () => {
    const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'MacIntel' },
    });
    expect(grpcurlInstallHintForPlatform()).toContain('Install grpcurl (macOS)');

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'Win32' },
    });
    expect(grpcurlInstallHintForPlatform()).toContain('Install grpcurl (Windows)');

    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    } else {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }
  });

  it('formats map type labels with default key type and explicit message value type', () => {
    expect(fieldTypeLabel({
      name: 'tags',
      number: 1,
      type: 'string',
      label: 'optional',
      isMap: true,
    })).toBe('map<string, string>');

    expect(fieldTypeLabel({
      name: 'nested',
      number: 2,
      type: 'message',
      label: 'optional',
      isMap: true,
      mapKeyType: 'int32',
      messageTypeName: 'demo.Nested',
    })).toBe('map<int32, demo.Nested>');
  });

  it('covers minimal body fallbacks for missing request type and empty fields', () => {
    const descriptorWithoutMessages: GrpcDescriptor = {
      source: 'reflection',
      key: 'descriptor-missing',
      services: [{
        fullName: 'demo.DemoService',
        methods: [BASE_METHOD],
      }],
      messageTypes: [],
      enumTypes: [],
    };

    expect(buildGrpcurlBodyTemplate(
      descriptorWithoutMessages,
      { ...BASE_METHOD, requestTypeName: 'demo.UnknownRequest' },
      'minimal',
    )).toEqual({});

    const descriptorWithEmptyRequest: GrpcDescriptor = {
      ...descriptorWithoutMessages,
      key: 'descriptor-empty-fields',
      messageTypes: [{
        typeName: 'demo.EmptyRequest',
        fields: [],
      }],
    };

    expect(buildGrpcurlBodyTemplate(
      descriptorWithEmptyRequest,
      { ...BASE_METHOD, requestTypeName: 'demo.EmptyRequest' },
      'minimal',
    )).toEqual({});
  });

  it('handles minimal recursive message selection and enum fallback value', () => {
    const descriptor: GrpcDescriptor = {
      source: 'reflection',
      key: 'descriptor-recursive',
      services: [{
        fullName: 'demo.DemoService',
        methods: [BASE_METHOD],
      }],
      messageTypes: [
        {
          typeName: 'demo.RootRequest',
          fields: [{
            name: 'meta',
            number: 1,
            type: 'message',
            label: 'optional',
            messageTypeName: 'demo.RootRequest',
          }],
        },
        {
          typeName: 'demo.EnumRequest',
          fields: [{
            name: 'status',
            number: 1,
            type: 'enum',
            label: 'optional',
            enumTypeName: 'demo.Status',
            enumValues: [],
          }],
        },
      ],
      enumTypes: [{
        typeName: 'demo.Status',
        values: [],
      }],
    };

    expect(buildGrpcurlBodyTemplate(
      descriptor,
      { ...BASE_METHOD, requestTypeName: 'demo.RootRequest' },
      'minimal',
    )).toEqual({
      meta: {},
    });

    expect(buildGrpcurlBodyTemplate(
      descriptor,
      { ...BASE_METHOD, requestTypeName: 'demo.EnumRequest' },
      'minimal',
    )).toEqual({
      status: 0,
    });
  });
});
