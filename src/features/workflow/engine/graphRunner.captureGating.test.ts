import { describe, it, expect } from 'vitest';
import { resolveTraceLevel } from './graphRunner';
import type { ExecutionTraceOptions } from '@shared/types';

describe('resolveTraceLevel', () => {
  it('returns "standard" when no options provided', () => {
    expect(resolveTraceLevel()).toBe('standard');
    expect(resolveTraceLevel(undefined)).toBe('standard');
  });

  it('returns "full" when captureFullTrace is true and no traceLevel', () => {
    expect(resolveTraceLevel({ captureFullTrace: true })).toBe('full');
  });

  it('returns "standard" when captureFullTrace is false and no traceLevel', () => {
    expect(resolveTraceLevel({ captureFullTrace: false })).toBe('standard');
  });

  it('traceLevel takes precedence over captureFullTrace', () => {
    const opts: ExecutionTraceOptions = { captureFullTrace: true, traceLevel: 'minimal' };
    expect(resolveTraceLevel(opts)).toBe('minimal');
  });

  it('returns "debug" when traceLevel is debug', () => {
    expect(resolveTraceLevel({ captureFullTrace: false, traceLevel: 'debug' })).toBe('debug');
  });

  it('returns each trace level correctly', () => {
    for (const level of ['minimal', 'standard', 'full', 'debug'] as const) {
      expect(resolveTraceLevel({ captureFullTrace: false, traceLevel: level })).toBe(level);
    }
  });
});
