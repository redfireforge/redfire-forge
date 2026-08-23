import { describe, expect, it } from 'vitest';
import type { GrpcDescriptor, GrpcFieldSchema, GrpcMethodInfo } from '@shared/grpc/contracts';
import {
  buildGrpcurlBodyTemplate,
  fieldTypeLabel,
  fieldLabelText,
  grpcurlInstallHintForPlatform,
  schemaTypeTestId,
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

  it('formats direct field labels and schema test ids', () => {
    expect(fieldTypeLabel({
      name: 'payload',
      number: 1,
      type: 'message',
      label: 'optional',
      messageTypeName: 'demo.Payload',
    })).toBe('demo.Payload');

    expect(fieldTypeLabel({
      name: 'state',
      number: 2,
      type: 'enum',
      label: 'optional',
      enumTypeName: 'demo.State',
    })).toBe('demo.State');

    expect(fieldTypeLabel({
      name: 'raw',
      number: 3,
      type: 'string',
      label: 'optional',
    })).toBe('string');

    expect(fieldLabelText({
      name: 'mode',
      number: 4,
      type: 'string',
      label: 'optional',
      isOneofMember: true,
      oneofName: 'choice',
    } as GrpcFieldSchema)).toBe('oneof choice');

    expect(fieldLabelText({
      name: 'mode',
      number: 5,
      type: 'string',
      label: 'required',
    })).toBe('required');

    expect(schemaTypeTestId('Demo.Service Request!')).toBe('demo-service-request');
  });

  it('builds full grpcurl bodies with scalar, nested, oneof, and fallback branches', () => {
    const descriptor: GrpcDescriptor = {
      source: 'reflection',
      key: 'descriptor-full-body',
      services: [{
        fullName: 'demo.DemoService',
        methods: [BASE_METHOD],
      }],
      messageTypes: [
        {
          typeName: 'demo.FullRequest',
          fields: [
            { name: 'tags', number: 1, type: 'string', label: 'optional', isMap: true },
            { name: 'repeated_values', number: 2, type: 'string', label: 'repeated' },
            { name: 'request_id', number: 3, type: 'string', label: 'optional' },
            { name: 'message_text', number: 4, type: 'bytes', label: 'optional' },
            { name: 'enabled', number: 5, type: 'bool', label: 'optional' },
            { name: 'count32', number: 6, type: 'int32', label: 'optional' },
            { name: 'count64', number: 7, type: 'int64', label: 'optional' },
            {
              name: 'status',
              number: 8,
              type: 'enum',
              label: 'optional',
              enumTypeName: 'demo.Status',
              enumValues: [{ name: 'OK', number: 7 }],
            },
            {
              name: 'child',
              number: 9,
              type: 'message',
              label: 'optional',
              messageTypeName: 'demo.Nested',
            },
            {
              name: 'choice_a',
              number: 10,
              type: 'string',
              label: 'optional',
              isOneofMember: true,
              oneofName: 'choice',
            },
            {
              name: 'choice_b',
              number: 11,
              type: 'string',
              label: 'optional',
              isOneofMember: true,
              oneofName: 'choice',
            },
            {
              name: 'broken_child',
              number: 12,
              type: 'message',
              label: 'optional',
            },
          ],
        },
        {
          typeName: 'demo.Nested',
          fields: [
            { name: 'nested_name', number: 1, type: 'string', label: 'optional' },
          ],
        },
        {
          typeName: 'demo.Cycle',
          fields: [
            {
              name: 'self',
              number: 1,
              type: 'message',
              label: 'optional',
              messageTypeName: 'demo.Cycle',
            },
          ],
        },
      ],
      enumTypes: [{
        typeName: 'demo.Status',
        values: [{ name: 'OK', number: 7 }],
      }],
    };

    expect(buildGrpcurlBodyTemplate(
      descriptor,
      { ...BASE_METHOD, requestTypeName: 'demo.FullRequest' },
      'full',
    )).toEqual({
      tags: {},
      repeated_values: [],
      request_id: 'A-100',
      message_text: 'hello',
      enabled: true,
      count32: 1,
      count64: '1',
      status: 7,
      child: {
        nested_name: 'demo',
      },
      choice_a: 'string',
      broken_child: null,
    });

    expect(buildGrpcurlBodyTemplate(
      descriptor,
      { ...BASE_METHOD, requestTypeName: 'demo.UnknownRequest' },
      'full',
    )).toEqual({});

    expect(buildGrpcurlBodyTemplate(
      descriptor,
      { ...BASE_METHOD, requestTypeName: 'demo.Cycle' },
      'full',
    )).toEqual({
      self: {},
    });
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
