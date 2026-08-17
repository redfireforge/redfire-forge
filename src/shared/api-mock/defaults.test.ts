import { describe, expect, it } from 'vitest';
import { clampTimeoutHoldMs, DEFAULT_TIMEOUT_HOLD_MS, HARD_CEILINGS } from './defaults';

describe('clampTimeoutHoldMs', () => {
  it('defaults to 5s when unset, clamped to a smaller cap', () => {
    expect(clampTimeoutHoldMs(undefined, 30_000)).toBe(DEFAULT_TIMEOUT_HOLD_MS);
    expect(clampTimeoutHoldMs(undefined, 1_000)).toBe(1_000);
  });

  it('clamps a requested hold to the server cap and the hard ceiling', () => {
    expect(clampTimeoutHoldMs(8_000, 5_000)).toBe(5_000);
    expect(clampTimeoutHoldMs(HARD_CEILINGS.maxLongRunningMs + 1, HARD_CEILINGS.maxLongRunningMs)).toBe(
      HARD_CEILINGS.maxLongRunningMs,
    );
  });

  it('treats non-positive requested values as unset', () => {
    expect(clampTimeoutHoldMs(0, 30_000)).toBe(DEFAULT_TIMEOUT_HOLD_MS);
    expect(clampTimeoutHoldMs(-12, 30_000)).toBe(DEFAULT_TIMEOUT_HOLD_MS);
    expect(clampTimeoutHoldMs(Number.NaN, 30_000)).toBe(DEFAULT_TIMEOUT_HOLD_MS);
  });

  it('falls back to the hard ceiling when the cap is missing or invalid', () => {
    expect(clampTimeoutHoldMs(50, 0)).toBe(50);
    expect(clampTimeoutHoldMs(undefined, 0)).toBe(DEFAULT_TIMEOUT_HOLD_MS);
    expect(clampTimeoutHoldMs(HARD_CEILINGS.maxLongRunningMs + 5, -1)).toBe(HARD_CEILINGS.maxLongRunningMs);
  });

  it('floors fractional milliseconds and never returns below 1', () => {
    expect(clampTimeoutHoldMs(12.9, 30_000)).toBe(12);
    expect(clampTimeoutHoldMs(0.4, 30_000)).toBe(1);
  });
});
