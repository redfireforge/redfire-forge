/**
 * Unit tests for kafka-service-helpers.ts
 *
 * Pure utility functions extracted from KafkaService to reduce class size.
 * Each helper is tested independently to ensure >90% branch coverage.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CLEANUP_TIMEOUT_MS,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAuthError,
  isTimeoutError,
  resolveConnectTimeout,
  resolveRequestTimeout,
  safeDisconnectConsumer,
  safeDisconnectProducer,
  safeStopAndDisconnectConsumer,
  toKafkaMessage,
  withTimeout,
} from './kafka-service-helpers.js';

// ── toKafkaMessage ─────────────────────────────────────────────────────────────

describe('toKafkaMessage', () => {
  it('extracts .message from an Error instance', () => {
    expect(toKafkaMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(toKafkaMessage('plain string')).toBe('plain string');
    expect(toKafkaMessage(42)).toBe('42');
    expect(toKafkaMessage(null)).toBe('null');
    expect(toKafkaMessage(undefined)).toBe('undefined');
    expect(toKafkaMessage({ foo: 'bar' })).toBe('[object Object]');
  });
});

// ── isTimeoutError ─────────────────────────────────────────────────────────────

describe('isTimeoutError', () => {
  it('returns true for "timed out" messages (case-insensitive)', () => {
    expect(isTimeoutError(new Error('Kafka connect timed out after 10000ms'))).toBe(true);
    expect(isTimeoutError(new Error('TIMED OUT'))).toBe(true);
  });

  it('returns true for "timeout" messages', () => {
    expect(isTimeoutError(new Error('Connection timeout'))).toBe(true);
    expect(isTimeoutError('Request timeout')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isTimeoutError(new Error('SASL authentication failed'))).toBe(false);
    expect(isTimeoutError(new Error('broker unavailable'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});

// ── isAuthError ────────────────────────────────────────────────────────────────

describe('isAuthError', () => {
  it('returns true for SASL authentication messages', () => {
    expect(isAuthError(new Error('SASL Authentication Failed'))).toBe(true);
    expect(isAuthError(new Error('sasl authentication failed: bad credentials'))).toBe(true);
  });

  it('returns true for generic authentication failed messages', () => {
    expect(isAuthError(new Error('Authentication Failed'))).toBe(true);
    expect(isAuthError('authentication failed')).toBe(true);
  });

  it('returns true for invalid credentials messages', () => {
    expect(isAuthError(new Error('Invalid Credentials'))).toBe(true);
    expect(isAuthError('invalid credentials supplied')).toBe(true);
  });

  it('returns false for non-auth errors', () => {
    expect(isAuthError(new Error('Kafka connect timed out'))).toBe(false);
    expect(isAuthError(new Error('KAFKA_NOT_CONNECTED'))).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});

// ── resolveConnectTimeout ──────────────────────────────────────────────────────

describe('resolveConnectTimeout', () => {
  it('returns DEFAULT_CONNECT_TIMEOUT_MS when connection is undefined', () => {
    expect(resolveConnectTimeout(undefined)).toBe(DEFAULT_CONNECT_TIMEOUT_MS);
  });

  it('returns the connection-specific value when set', () => {
    expect(resolveConnectTimeout({ clusterId: 'c', brokers: [], connectionTimeoutMs: 3000 })).toBe(3000);
  });

  it('returns DEFAULT_CONNECT_TIMEOUT_MS when connectionTimeoutMs is absent from config', () => {
    expect(resolveConnectTimeout({ clusterId: 'c', brokers: [] })).toBe(DEFAULT_CONNECT_TIMEOUT_MS);
  });

  it('clamps to 1 when connectionTimeoutMs is 0 or negative', () => {
    expect(resolveConnectTimeout({ clusterId: 'c', brokers: [], connectionTimeoutMs: 0 })).toBe(1);
    expect(resolveConnectTimeout({ clusterId: 'c', brokers: [], connectionTimeoutMs: -100 })).toBe(1);
  });
});

// ── resolveRequestTimeout ──────────────────────────────────────────────────────

describe('resolveRequestTimeout', () => {
  it('returns DEFAULT_REQUEST_TIMEOUT_MS when connection is undefined', () => {
    expect(resolveRequestTimeout(undefined)).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
  });

  it('returns the connection-specific value when set', () => {
    expect(resolveRequestTimeout({ clusterId: 'c', brokers: [], requestTimeoutMs: 5000 })).toBe(5000);
  });

  it('returns DEFAULT_REQUEST_TIMEOUT_MS when requestTimeoutMs is absent from config', () => {
    expect(resolveRequestTimeout({ clusterId: 'c', brokers: [] })).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
  });

  it('clamps to 1 when requestTimeoutMs is 0 or negative', () => {
    expect(resolveRequestTimeout({ clusterId: 'c', brokers: [], requestTimeoutMs: 0 })).toBe(1);
    expect(resolveRequestTimeout({ clusterId: 'c', brokers: [], requestTimeoutMs: -1 })).toBe(1);
  });
});

// ── withTimeout ────────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves when the promise settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 5000, 'test-op');
    expect(result).toBe('ok');
  });

  it('rejects with a descriptive message when the timeout fires first', async () => {
    const never = new Promise<never>(() => {/* never resolves */});
    await expect(withTimeout(never, 1, 'test-op')).rejects.toThrow(
      'Kafka test-op timed out after 1ms',
    );
  });

  it('rejects with the original promise error when it rejects before timeout', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 5000, 'test-op'),
    ).rejects.toThrow('boom');
  });

  it('clears the timer on success to avoid leaked timers', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve(1), 5000, 'timer-clear-test');
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears the timer on rejection to avoid leaked timers', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.reject(new Error('fail')), 5000, 'timer-clear-test').catch(() => {});
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

// ── safeDisconnectProducer ─────────────────────────────────────────────────────

describe('safeDisconnectProducer', () => {
  it('calls producer.disconnect()', async () => {
    const producer = { disconnect: vi.fn().mockResolvedValue(undefined) };
    await safeDisconnectProducer(producer);
    expect(producer.disconnect).toHaveBeenCalledOnce();
  });

  it('swallows errors from producer.disconnect()', async () => {
    const producer = { disconnect: vi.fn().mockRejectedValue(new Error('broker gone')) };
    await expect(safeDisconnectProducer(producer)).resolves.toBeUndefined();
  });

  it('does not throw when disconnect times out', async () => {
    const producer = {
      disconnect: vi.fn(() => new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('disconnect timed out after 2000ms')), 1),
      )),
    };
    await expect(safeDisconnectProducer(producer)).resolves.toBeUndefined();
  });
});

// ── safeDisconnectConsumer ─────────────────────────────────────────────────────

describe('safeDisconnectConsumer', () => {
  it('calls consumer.disconnect()', async () => {
    const consumer = { disconnect: vi.fn().mockResolvedValue(undefined) };
    await safeDisconnectConsumer(consumer);
    expect(consumer.disconnect).toHaveBeenCalledOnce();
  });

  it('swallows errors from consumer.disconnect()', async () => {
    const consumer = { disconnect: vi.fn().mockRejectedValue(new Error('broker gone')) };
    await expect(safeDisconnectConsumer(consumer)).resolves.toBeUndefined();
  });
});

// ── safeStopAndDisconnectConsumer ──────────────────────────────────────────────

describe('safeStopAndDisconnectConsumer', () => {
  it('calls stop() then disconnect()', async () => {
    const consumer = {
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    await safeStopAndDisconnectConsumer(consumer);
    expect(consumer.stop).toHaveBeenCalledOnce();
    expect(consumer.disconnect).toHaveBeenCalledOnce();
  });

  it('still calls disconnect() when stop() throws', async () => {
    const consumer = {
      stop: vi.fn().mockRejectedValue(new Error('stop failed')),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    await expect(safeStopAndDisconnectConsumer(consumer)).resolves.toBeUndefined();
    expect(consumer.disconnect).toHaveBeenCalledOnce();
  });

  it('does not propagate disconnect errors', async () => {
    const consumer = {
      stop: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockRejectedValue(new Error('disc fail')),
    };
    await expect(safeStopAndDisconnectConsumer(consumer)).resolves.toBeUndefined();
  });
});

// ── Constant exports ───────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('DEFAULT_CONNECT_TIMEOUT_MS is 10000', () => {
    expect(DEFAULT_CONNECT_TIMEOUT_MS).toBe(10_000);
  });

  it('DEFAULT_REQUEST_TIMEOUT_MS is 10000', () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it('DEFAULT_CLEANUP_TIMEOUT_MS is 2000', () => {
    expect(DEFAULT_CLEANUP_TIMEOUT_MS).toBe(2_000);
  });
});
