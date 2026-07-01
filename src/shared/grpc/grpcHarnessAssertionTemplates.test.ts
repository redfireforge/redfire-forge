/**
 * Phase 8F — shared gRPC harness assertion template mapping tests.
 */
import { describe, expect, it } from 'vitest';
import {
  mapGrpcHarnessAssertionTemplateStrings,
  mapGrpcHarnessAssertionsTemplateStrings,
} from './grpcHarnessAssertionTemplates';

describe('grpcHarnessAssertionTemplates', () => {
  const map = (template: string) => template.replace('{{greeting}}', 'hello');

  it('maps grpcField equals and contains', () => {
    expect(mapGrpcHarnessAssertionTemplateStrings(
      { grpcField: '$.message', equals: '{{greeting}}', contains: 'prefix-{{greeting}}' },
      map,
    )).toEqual({
      grpcField: '$.message',
      equals: 'hello',
      contains: 'prefix-hello',
    });
  });

  it('maps grpcNumericField string values', () => {
    expect(mapGrpcHarnessAssertionTemplateStrings(
      { grpcNumericField: '$.code', operator: '==', value: '{{greeting}}' },
      map,
    )).toEqual({
      grpcNumericField: '$.code',
      operator: '==',
      value: 'hello',
    });
  });

  it('maps grpcTrailer equals', () => {
    expect(mapGrpcHarnessAssertionTemplateStrings(
      { grpcTrailer: 'x-trace', equals: '{{greeting}}' },
      map,
    )).toEqual({
      grpcTrailer: 'x-trace',
      equals: 'hello',
    });
  });

  it('maps grpcStreamField equals and contains', () => {
    expect(mapGrpcHarnessAssertionTemplateStrings(
      { grpcStreamField: '$.items', index: 0, equals: '{{greeting}}', contains: '{{greeting}}-x' },
      map,
    )).toEqual({
      grpcStreamField: '$.items',
      index: 0,
      equals: 'hello',
      contains: 'hello-x',
    });
  });

  it('leaves status and duration assertions unchanged', () => {
    const status = { grpcStatus: 0 };
    const duration = { grpcDuration: { max: 1000 } };
    expect(mapGrpcHarnessAssertionTemplateStrings(status, map)).toBe(status);
    expect(mapGrpcHarnessAssertionTemplateStrings(duration, map)).toBe(duration);
  });

  it('maps assertion arrays', () => {
    expect(mapGrpcHarnessAssertionsTemplateStrings(
      [{ grpcField: '$.message', equals: '{{greeting}}' }],
      map,
    )).toEqual([{ grpcField: '$.message', equals: 'hello' }]);
  });
});
