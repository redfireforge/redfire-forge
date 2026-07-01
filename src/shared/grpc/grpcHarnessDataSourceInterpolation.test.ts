/**
 * Phase 8F — gRPC harness data-source interpolation tests.
 */
import { describe, expect, it } from 'vitest';
import {
  interpolateGrpcHarnessCallAction,
  substituteGrpcHarnessJsonValue,
  substituteGrpcHarnessTemplateVars,
} from './grpcHarnessDataSourceInterpolation';
import type { GrpcHarnessCallActionConfig } from '../types/grpc-harness';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';

const BASE_CONFIG: GrpcHarnessCallActionConfig = {
  callType: 'unary',
  target: 'localhost:50051',
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
  service: FIXTURE_UNARY_CALL_REQUEST.service,
  method: FIXTURE_UNARY_CALL_REQUEST.method,
  body: { message: '{{greeting}}', nested: { id: '{{orderId}}' } },
  metadata: { 'x-trace': '{{traceId}}' },
  assertions: [
    { grpcField: '$.message', equals: '{{expectedMessage}}' },
    { grpcNumericField: '$.code', operator: '==', value: '{{expectedCode}}' },
    { grpcTrailer: 'x-trace', equals: '{{traceId}}' },
  ],
};

describe('grpcHarnessDataSourceInterpolation (Phase 8F)', () => {
  const vars = {
    greeting: 'hello',
    orderId: 'order-42',
    traceId: 'trace-9',
    expectedMessage: 'hello',
    expectedCode: '200',
  };

  it('substitutes template vars in strings', () => {
    expect(substituteGrpcHarnessTemplateVars('{{greeting}}-world', vars)).toBe('hello-world');
    expect(substituteGrpcHarnessTemplateVars('{{missing}}', vars)).toBe('{{missing}}');
  });

  it('preserves escaped literals per Phase 9B grammar', () => {
    const escaped = String.raw`\{{greeting}}`;
    expect(substituteGrpcHarnessTemplateVars(escaped, vars)).toBe(escaped);
  });

  it('deep-substitutes JSON body values', () => {
    expect(substituteGrpcHarnessJsonValue(
      { message: '{{greeting}}', items: ['{{orderId}}'] },
      vars,
    )).toEqual({ message: 'hello', items: ['order-42'] });
  });

  it('interpolates grpcCallAction target, metadata, body, and assertions', () => {
    const resolved = interpolateGrpcHarnessCallAction(BASE_CONFIG, vars, true);
    expect(resolved?.body).toEqual({ message: 'hello', nested: { id: 'order-42' } });
    expect(resolved?.metadata).toEqual({ 'x-trace': 'trace-9' });
    expect(resolved?.assertions?.[0]).toEqual({
      grpcField: '$.message',
      equals: 'hello',
    });
    expect(resolved?.assertions?.[1]).toEqual({
      grpcNumericField: '$.code',
      operator: '==',
      value: '200',
    });
    expect(resolved?.assertions?.[2]).toEqual({
      grpcTrailer: 'x-trace',
      equals: 'trace-9',
    });
  });

  it('interpolates sendMessages for streaming call types', () => {
    const streaming: GrpcHarnessCallActionConfig = {
      ...BASE_CONFIG,
      callType: 'client_streaming',
      sendMessages: [{ n: '{{orderId}}' }],
    };
    const resolved = interpolateGrpcHarnessCallAction(streaming, vars, true);
    expect(resolved?.sendMessages).toEqual([{ n: 'order-42' }]);
  });

  it('interpolates grpcField contains and grpcStreamField assertions', () => {
    const config: GrpcHarnessCallActionConfig = {
      ...BASE_CONFIG,
      assertions: [
        { grpcField: '$.message', contains: 'prefix-{{greeting}}' },
        { grpcStreamField: '$.items', index: 0, equals: '{{greeting}}' },
      ],
    };
    const resolved = interpolateGrpcHarnessCallAction(config, vars, true);
    expect(resolved?.assertions?.[0]).toEqual({
      grpcField: '$.message',
      contains: 'prefix-hello',
    });
    expect(resolved?.assertions?.[1]).toEqual({
      grpcStreamField: '$.items',
      index: 0,
      equals: 'hello',
    });
  });

  it('returns original config when no body vars are present', () => {
    const resolved = interpolateGrpcHarnessCallAction(BASE_CONFIG, {}, false);
    expect(resolved).toBe(BASE_CONFIG);
  });
});
