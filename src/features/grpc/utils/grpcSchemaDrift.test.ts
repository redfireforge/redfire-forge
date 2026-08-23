import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  analyzeGrpcSchemaDrift,
  analyzeWarningDriftWithBaseline,
  compareRequestSchemaDrift,
  pruneGrpcBodyToSchema,
  rebindGrpcBodyToMethod,
  suggestGrpcSchemaRebinds,
} from './grpcSchemaDrift';

describe('grpcSchemaDrift', () => {
  it('returns none when no method is selected', () => {
    const analysis = analyzeGrpcSchemaDrift({
      nextDescriptor: FIXTURE_DESCRIPTOR,
    });
    expect(analysis.state).toBe('none');
  });

  it('detects blocking drift when active method is removed', () => {
    const analysis = analyzeGrpcSchemaDrift({
      previousDescriptor: FIXTURE_DESCRIPTOR,
      nextDescriptor: {
        ...FIXTURE_DESCRIPTOR,
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(analysis.state).toBe('blocking');
    expect(analysis.issues[0]?.kind).toBe('method_missing');
  });

  it('preserves analysis context with field removed warning', () => {
    const previous = FIXTURE_DESCRIPTOR;
    const next = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
          entry.name === 'Echo'
            ? {
              ...entry,
              requestSchema: {
                ...entry.requestSchema,
                fields: [],
              },
            }
            : entry
        )),
      }],
    };
    const analysis = analyzeGrpcSchemaDrift({
      previousDescriptor: previous,
      nextDescriptor: next,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(analysis.state).toBe('warning');
    expect(analysis.issues.some((issue) => issue.kind === 'field_removed')).toBe(true);
  });

  it('detects field type changes', () => {
    const issues = compareRequestSchemaDrift(
      { message: 'hello' },
      FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!.requestSchema,
      {
        typeName: 'echo.EchoRequest',
        fields: [{ name: 'message', number: 1, type: 'int32', label: 'optional' }],
      },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('field_type_changed');
  });

  it('detects optional to repeated label changes', () => {
    const previous = {
      typeName: 'echo.EchoRequest',
      fields: [{ name: 'message', number: 1, type: 'string', label: 'optional' as const }],
    };
    const next = {
      typeName: 'echo.EchoRequest',
      fields: [{ name: 'message', number: 1, type: 'string', label: 'repeated' as const }],
    };
    const issues = compareRequestSchemaDrift({ message: 'hello' }, previous, next);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('field_type_changed');
    expect(issues[0]?.message).toContain('optional');
    expect(issues[0]?.message).toContain('repeated');
  });

  it('detects map key type changes', () => {
    const previous = {
      typeName: 'demo.MapRequest',
      fields: [{
        name: 'counts',
        number: 1,
        type: 'int32' as const,
        label: 'optional' as const,
        isMap: true,
        mapKeyType: 'string' as const,
      }],
    };
    const next = {
      typeName: 'demo.MapRequest',
      fields: [{
        name: 'counts',
        number: 1,
        type: 'int32' as const,
        label: 'optional' as const,
        isMap: true,
        mapKeyType: 'int32' as const,
      }],
    };
    const issues = compareRequestSchemaDrift({ counts: { a: 1 } }, previous, next);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('map<string,int32>');
    expect(issues[0]?.message).toContain('map<int32,int32>');
  });

  it('detects map message value type changes', () => {
    const previous = {
      typeName: 'demo.MapRequest',
      fields: [{
        name: 'payloads',
        number: 1,
        type: 'message' as const,
        label: 'optional' as const,
        isMap: true,
        mapKeyType: 'string' as const,
        messageTypeName: 'demo.PayloadA',
      }],
    };
    const next = {
      typeName: 'demo.MapRequest',
      fields: [{
        name: 'payloads',
        number: 1,
        type: 'message' as const,
        label: 'optional' as const,
        isMap: true,
        mapKeyType: 'string' as const,
        messageTypeName: 'demo.PayloadB',
      }],
    };
    const issues = compareRequestSchemaDrift(
      { payloads: { key: { label: 'x' } } },
      previous,
      next,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('demo.PayloadA');
    expect(issues[0]?.message).toContain('demo.PayloadB');
  });

  it('suggests same-name and same-request-type rebinds', () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
    const previousDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: [
          ...FIXTURE_DESCRIPTOR.services[0]!.methods,
          {
            ...echoMethod,
            name: 'MissingMethod',
          },
        ],
      }],
    };
    const suggestions = suggestGrpcSchemaRebinds(
      FIXTURE_DESCRIPTOR,
      previousDescriptor,
      'echo.EchoService',
      'MissingMethod',
    );
    expect(suggestions.some((entry) => entry.reason.includes('Same request type'))).toBe(true);
  });

  it('detects orphan body keys not present in the schema', () => {
    const schema = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!.requestSchema;
    const issues = compareRequestSchemaDrift(
      { message: 'hello', staleExtra: 'remove-me' },
      schema,
      schema,
    );
    expect(issues.some((issue) => issue.fieldName === 'staleExtra')).toBe(true);
  });

  it('prunes unknown body keys', () => {
    const schema = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.requestSchema;
    expect(pruneGrpcBodyToSchema({ message: 'hi', stale: 1 }, schema)).toEqual({ message: 'hi' });
  });

  it('rebind coerces body to the target method schema', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
    expect(rebindGrpcBodyToMethod({ message: 'hello', extra: true }, method)).toEqual({ message: 'hello' });
  });

  it('re-evaluates warning drift against a stored baseline schema', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
    const baseline = method.requestSchema;
    const cleared = analyzeWarningDriftWithBaseline({ message: 'hello' }, baseline, method);
    expect(cleared.state).toBe('none');
    const warning = analyzeWarningDriftWithBaseline(
      { message: 'hello', stale: 'extra' },
      baseline,
      method,
    );
    expect(warning.state).toBe('warning');
  });
});
