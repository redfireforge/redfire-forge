/**
 * Phase 8B — gRPC harness template resolver tests.
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcHarnessAssertionsTemplatesResolved,
  assertGrpcHarnessJsonTemplatesResolved,
  assertGrpcHarnessTemplatesResolved,
  resolveGrpcHarnessAssertions,
  resolveGrpcHarnessJsonValue,
  resolveGrpcHarnessMetadata,
  resolveGrpcHarnessSendMessages,
} from './grpcHarnessTemplateResolver';

describe('grpcHarnessTemplateResolver (Phase 8B)', () => {
  it('deep-interpolates JSON body values', () => {
    const resolved = resolveGrpcHarnessJsonValue(
      { message: '{{greeting}}', nested: { id: '{{orderId}}' } },
      (template) => template.replace('{{greeting}}', 'hello').replace('{{orderId}}', '99'),
    );
    expect(resolved).toEqual({ message: 'hello', nested: { id: '99' } });
  });

  it('interpolates sendMessages array entries', () => {
    const messages = resolveGrpcHarnessSendMessages(
      [{ message: '{{part}}' }],
      (template) => template.replace('{{part}}', 'one'),
    );
    expect(messages).toEqual([{ message: 'one' }]);
  });

  it('rejects unresolved template tokens in JSON leaves', () => {
    expect(() => assertGrpcHarnessJsonTemplatesResolved({ message: '{{missing}}' }))
      .toThrow('unresolved template variables');
    expect(() => assertGrpcHarnessTemplatesResolved('target', '{{grpcHost}}'))
      .toThrow('unresolved template variables');
  });

  it('rejects metadata key collisions after template resolution', () => {
    expect(() => resolveGrpcHarnessMetadata(
      { '{{a}}': 'one', '{{b}}': 'two' },
      () => 'same-key',
    )).toThrow(/metadata key collision after template resolution/i);
  });

  it('rejects body key collisions after template resolution', () => {
    expect(() => resolveGrpcHarnessJsonValue(
      { '{{a}}': '1', '{{b}}': '2' },
      () => 'dup-key',
    )).toThrow(/body key collision after template resolution/i);
  });

  it('resolves env templates in harness assertions', () => {
    const resolved = resolveGrpcHarnessAssertions(
      [
        { grpcField: '$.message', equals: '{{expectedMessage}}' },
        { grpcNumericField: '$.code', operator: '==', value: '{{expectedCode}}' },
      ],
      (template) => template.replace('{{expectedMessage}}', 'hello').replace('{{expectedCode}}', '200'),
    );
    expect(resolved).toEqual([
      { grpcField: '$.message', equals: 'hello' },
      { grpcNumericField: '$.code', operator: '==', value: '200' },
    ]);
  });

  it('rejects unresolved template tokens in assertion expected values', () => {
    expect(() => assertGrpcHarnessAssertionsTemplatesResolved([
      { grpcField: '$.message', equals: '{{missing}}' },
    ])).toThrow('unresolved template variables');
  });
});
