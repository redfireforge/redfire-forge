import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  analyzeGrpcSchemaDrift,
  analyzeWarningDriftWithBaseline,
  compareRequestSchemaDrift,
  suggestGrpcSchemaRebinds,
} from './grpcSchemaDrift';

describe('grpcSchemaDrift coverage gaps', () => {
  const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
  const echoSchema = echoMethod.requestSchema;

  it('analyzeGrpcSchemaDrift returns none for blank service or method', () => {
    expect(analyzeGrpcSchemaDrift({
      nextDescriptor: FIXTURE_DESCRIPTOR,
      service: '  ',
      method: 'Echo',
    }).state).toBe('none');
    expect(analyzeGrpcSchemaDrift({
      nextDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: '',
    }).state).toBe('none');
  });

  it('analyzeGrpcSchemaDrift returns none when method is new (no previous descriptor match)', () => {
    const analysis = analyzeGrpcSchemaDrift({
      previousDescriptor: FIXTURE_DESCRIPTOR,
      nextDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
    });
    expect(analysis.state).toBe('none');
  });

  it('compareRequestSchemaDrift ignores empty body field values', () => {
    const issues = compareRequestSchemaDrift(
      { message: '', stale: null, tags: [], missing: undefined },
      echoSchema,
      { ...echoSchema, fields: [] },
    );
    expect(issues.some((issue) => issue.fieldName === 'message')).toBe(false);
    expect(issues.some((issue) => issue.fieldName === 'stale')).toBe(false);
  });

  it('compareRequestSchemaDrift skips duplicate orphan key issues', () => {
    const issues = compareRequestSchemaDrift(
      { orphan: 'value', orphan2: 'x' },
      { typeName: 'demo.Req', fields: [] },
      { typeName: 'demo.Req', fields: [] },
    );
    const orphanIssues = issues.filter((issue) => issue.kind === 'field_removed');
    expect(orphanIssues).toHaveLength(2);
  });

  it('detects enum type signature changes via fieldShapeSignature', () => {
    const previous = {
      typeName: 'demo.Req',
      fields: [{
        name: 'state',
        number: 1,
        type: 'enum' as const,
        label: 'optional' as const,
        enumTypeName: 'demo.StateA',
      }],
    };
    const next = {
      typeName: 'demo.Req',
      fields: [{
        name: 'state',
        number: 1,
        type: 'enum' as const,
        label: 'optional' as const,
        enumTypeName: 'demo.StateB',
      }],
    };
    const issues = compareRequestSchemaDrift({ state: 1 }, previous, next);
    expect(issues[0]?.kind).toBe('field_type_changed');
    expect(issues[0]?.message).toContain('demo.StateA');
  });

  it('suggestGrpcSchemaRebinds prefers same method name on same service', () => {
    const suggestions = suggestGrpcSchemaRebinds(
      FIXTURE_DESCRIPTOR,
      undefined,
      'echo.EchoService',
      'Echo',
    );
    expect(suggestions.some((entry) => entry.reason === 'Same method name on service')).toBe(true);
  });

  it('suggestGrpcSchemaRebinds labels cross-service method matches', () => {
    const otherServiceDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [
        ...FIXTURE_DESCRIPTOR.services,
        {
          fullName: 'other.OtherService',
          methods: [{
            ...echoMethod,
            name: 'Echo',
          }],
        },
      ],
    };
    const suggestions = suggestGrpcSchemaRebinds(
      otherServiceDescriptor,
      undefined,
      'missing.Service',
      'Echo',
    );
    expect(suggestions.some((entry) => entry.reason.includes('Method "Echo" on'))).toBe(true);
  });

  it('analyzeWarningDriftWithBaseline summarizes multiple issues', () => {
    const baseline = echoSchema;
    const method = {
      ...echoMethod,
      requestSchema: {
        ...echoSchema,
        fields: [],
      },
    };
    const analysis = analyzeWarningDriftWithBaseline(
      { message: 'hello', extra: 'field' },
      baseline,
      method,
    );
    expect(analysis.state).toBe('warning');
    expect(analysis.message).toMatch(/2 request schema changes/);
  });

  it('analyzeGrpcSchemaDrift summarizes multiple field issues', () => {
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
                fields: [{
                  name: 'message',
                  number: 1,
                  type: 'int32' as const,
                  label: 'optional' as const,
                }],
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
      body: { message: 'hello', orphan: 'x' },
    });
    expect(analysis.state).toBe('warning');
    expect(analysis.message).toMatch(/request schema changes/);
  });
});
