import { describe, it, expect } from 'vitest';
import {
  createWsSuccessEnvelope,
  createWsErrorEnvelope,
} from './contracts';

describe('createWsSuccessEnvelope', () => {
  it('creates a success envelope with op and data', () => {
    const env = createWsSuccessEnvelope('connect', { connectionId: 'abc' });
    expect(env.ok).toBe(true);
    expect(env.op).toBe('connect');
    expect(env.data).toEqual({ connectionId: 'abc' });
    expect(env.meta.timestamp).toBeTruthy();
    expect(new Date(env.meta.timestamp).getTime()).not.toBeNaN();
  });

  it('merges meta overrides', () => {
    const env = createWsSuccessEnvelope('send', { sentAt: 'x' }, { durationMs: 42 });
    expect(env.meta.durationMs).toBe(42);
    expect(env.meta.timestamp).toBeTruthy();
  });
});

describe('createWsErrorEnvelope', () => {
  it('creates an error envelope with op and error body', () => {
    const env = createWsErrorEnvelope('connect', {
      code: 'WS_CONNECT_FAILED',
      message: 'Connection refused',
    });
    expect(env.ok).toBe(false);
    expect(env.op).toBe('connect');
    expect(env.error.code).toBe('WS_CONNECT_FAILED');
    expect(env.error.message).toBe('Connection refused');
    expect(env.meta.timestamp).toBeTruthy();
  });

  it('includes retryable flag', () => {
    const env = createWsErrorEnvelope('connect', {
      code: 'WS_CONNECT_TIMEOUT',
      message: 'Timed out',
      retryable: true,
    });
    expect(env.error.retryable).toBe(true);
  });
});
