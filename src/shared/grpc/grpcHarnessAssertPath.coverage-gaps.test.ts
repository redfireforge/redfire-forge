/**
 * Coverage gaps — grpcHarnessAssertPath.ts (Phase 8D JSONPath resolution).
 */
import { describe, expect, it } from 'vitest';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import {
  hasGrpcHarnessTerminalBody,
  resolveGrpcHarnessFieldValue,
  resolveGrpcHarnessStreamFieldValue,
  resolveGrpcHarnessStreamLength,
} from './grpcHarnessAssertPath';

describe('grpcHarnessAssertPath coverage gaps', () => {
  it('hasGrpcHarnessTerminalBody distinguishes empty and populated bodies', () => {
    expect(hasGrpcHarnessTerminalBody(undefined)).toBe(false);
    expect(hasGrpcHarnessTerminalBody({})).toBe(false);
    expect(hasGrpcHarnessTerminalBody({ count: 1 })).toBe(true);
  });

  it('returns undefined for blank grpcField paths', () => {
    const unary: GrpcHarnessCallOutcome = {
      callType: 'unary',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      body: { message: 'hello' },
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('   ', unary)).toBeUndefined();
    expect(resolveGrpcHarnessStreamFieldValue('   ', 0, unary)).toBeUndefined();
  });

  it('resolves messages[index] paths with dollar-prefix normalization', () => {
    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: [{ n: 10 }, { n: 20 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('messages[1].n', stream)).toBe(20);
    expect(resolveGrpcHarnessFieldValue('messages[0].n', stream)).toBe(10);
  });

  it('returns undefined for client streaming with no terminal body or messages', () => {
    const emptyClient: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.total', emptyClient)).toBeUndefined();
    expect(resolveGrpcHarnessStreamLength(emptyClient)).toBe(0);
  });

  it('returns undefined for unary field lookup when body is missing', () => {
    const unary: GrpcHarnessCallOutcome = {
      callType: 'unary',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.message', unary)).toBeUndefined();
  });

  it('returns undefined for server stream with no messages and no terminal body', () => {
    const emptyStream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.value', emptyStream)).toBeUndefined();
  });

  it('resolves empty json path prefix and case-insensitive messages prefix', () => {
    const unary: GrpcHarnessCallOutcome = {
      callType: 'unary',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      body: { message: 'hello' },
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.', unary)).toBeUndefined();

    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: [{ n: 7 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('MESSAGES[0].n', stream)).toBe(7);
  });

  it('resolves client streaming last inbound message when terminal body is absent', () => {
    const client: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: [{ part: 'first' }, { part: 'last' }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('part', client)).toBe('last');
  });

  it('resolves bidi terminal body when stream has no inbound messages', () => {
    const bidi: GrpcHarnessCallOutcome = {
      callType: 'bidi_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      body: { total: 9 },
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('total', bidi)).toBe(9);
  });

  it('handles sparse stream message arrays when resolving fields', () => {
    const sparseMessages = [] as Array<Record<string, unknown> | undefined>;
    sparseMessages[1] = { value: 'present' };
    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: sparseMessages as Record<string, unknown>[],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.value', stream)).toBe('present');
    expect(resolveGrpcHarnessStreamFieldValue('$.value', 1, stream)).toBe('present');
  });

  it('prefers last inbound message for server streaming grpcField', () => {
    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: [{ value: 'first' }, { value: 'last' }],
      body: { value: 'terminal-only' },
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.value', stream)).toBe('last');
  });

  it('resolves messages[index] paths without a dollar-prefix', () => {
    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: [{ score: 5 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('messages[0].score', stream)).toBe(5);
  });

  it('treats missing messages arrays as empty for stream field resolution', () => {
    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
    };
    expect(resolveGrpcHarnessStreamLength(stream)).toBe(0);
    expect(resolveGrpcHarnessStreamFieldValue('$.value', 0, stream)).toBeUndefined();
  });

  it('resolves client streaming sparse last message via empty-object fallback', () => {
    const sparseMessages = [] as Array<Record<string, unknown> | undefined>;
    sparseMessages[0] = undefined;
    sparseMessages[1] = { token: 'tail' };
    const client: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: sparseMessages as Record<string, unknown>[],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('token', client)).toBe('tail');
  });

  it('returns undefined for blank stream field paths', () => {
    const stream: GrpcHarnessCallOutcome = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      messages: [{ value: 1 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessStreamFieldValue('   ', 0, stream)).toBeUndefined();
  });

  it('resolves indexed message paths when messages array is absent on outcome', () => {
    const stream = {
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
    } as GrpcHarnessCallOutcome;
    expect(resolveGrpcHarnessFieldValue('messages[0].value', stream)).toBeUndefined();
  });
});
