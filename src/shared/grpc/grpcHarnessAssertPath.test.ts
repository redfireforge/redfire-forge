/**
 * Phase 8D — harness assert path resolution tests.
 */
import { describe, expect, it } from 'vitest';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import {
  resolveGrpcHarnessFieldValue,
  resolveGrpcHarnessStreamFieldValue,
  resolveGrpcHarnessStreamLength,
} from './grpcHarnessAssertPath';

const unary: GrpcHarnessCallOutcome = {
  callType: 'unary',
  passed: true,
  grpcStatus: 0,
  durationMs: 10,
  body: { message: 'hello', count: 42 },
  attempts: 1,
};

const serverStream: GrpcHarnessCallOutcome = {
  callType: 'server_streaming',
  passed: true,
  grpcStatus: 0,
  durationMs: 50,
  messages: [{ n: 1 }, { n: 2 }],
  attempts: 1,
};

const clientStream: GrpcHarnessCallOutcome = {
  callType: 'client_streaming',
  passed: true,
  grpcStatus: 0,
  durationMs: 30,
  body: { total: 99 },
  attempts: 1,
};

describe('grpcHarnessAssertPath (Phase 8D)', () => {
  it('resolves grpcField on unary body', () => {
    expect(resolveGrpcHarnessFieldValue('$.message', unary)).toBe('hello');
    expect(resolveGrpcHarnessFieldValue('count', unary)).toBe(42);
  });

  it('resolves grpcField on client_streaming terminal body', () => {
    expect(resolveGrpcHarnessFieldValue('$.total', clientStream)).toBe(99);
  });

  it('resolves grpcField on client_streaming inbound messages when terminal body is absent', () => {
    const clientMessagesOnly: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 30,
      messages: [{ total: 42 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.total', clientMessagesOnly)).toBe(42);
  });

  it('prefers client_streaming terminal body over inbound messages for grpcField', () => {
    const clientBoth: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 30,
      body: { total: 99 },
      messages: [{ total: 1 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.total', clientBoth)).toBe(99);
  });

  it('treats empty client_streaming terminal body as absent and uses inbound messages', () => {
    const clientEmptyBody: GrpcHarnessCallOutcome = {
      callType: 'client_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 30,
      body: {},
      messages: [{ total: 42 }],
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.total', clientEmptyBody)).toBe(42);
  });

  it('resolves grpcField on last server stream message', () => {
    expect(resolveGrpcHarnessFieldValue('$.n', serverStream)).toBe(2);
  });

  it('resolves messages[index] prefix paths', () => {
    expect(resolveGrpcHarnessFieldValue('messages[0].n', serverStream)).toBe(1);
  });

  it('resolves grpcStreamField within indexed message', () => {
    expect(resolveGrpcHarnessStreamFieldValue('$.n', 1, serverStream)).toBe(2);
    expect(resolveGrpcHarnessStreamFieldValue('n', 0, serverStream)).toBe(1);
  });

  it('returns undefined for missing stream index', () => {
    expect(resolveGrpcHarnessStreamFieldValue('$.n', 5, serverStream)).toBeUndefined();
  });

  it('reports stream length from messages array', () => {
    expect(resolveGrpcHarnessStreamLength(serverStream)).toBe(2);
    expect(resolveGrpcHarnessStreamLength(clientStream)).toBe(0);
  });

  it('resolves grpcField on bidi terminal body when no inbound messages', () => {
    const bidiTerminalOnly: GrpcHarnessCallOutcome = {
      callType: 'bidi_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 40,
      body: { total: 7 },
      attempts: 1,
    };
    expect(resolveGrpcHarnessFieldValue('$.total', bidiTerminalOnly)).toBe(7);
  });
});
