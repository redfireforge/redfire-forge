import { describe, expect, it } from 'vitest';
import { computeVirtualDelayMs, previewFaultDelivery, resolveMaxDelayMs } from './faultPreview';
import { createDefaultResponse, HARD_CEILINGS } from './defaults';

describe('resolveMaxDelayMs', () => {
  it('uses hard ceiling when settings maxDelayMs is 0', () => {
    expect(resolveMaxDelayMs(0)).toBe(HARD_CEILINGS.maxDelayMs);
  });

  it('respects positive caps', () => {
    expect(resolveMaxDelayMs(250)).toBe(250);
  });
});

describe('computeVirtualDelayMs', () => {
  it('returns base delay without jitter', () => {
    const v = createDefaultResponse('r');
    v.behavior.delayMs = 120;
    v.behavior.jitterMs = 0;
    expect(computeVirtualDelayMs(v, 60_000, 'seed').totalMs).toBe(120);
  });

  it('applies seeded jitter reproducibly', () => {
    const v = createDefaultResponse('r');
    v.behavior.delayMs = 100;
    v.behavior.jitterMs = 20;
    const a = computeVirtualDelayMs(v, 60_000, 'abc');
    const b = computeVirtualDelayMs(v, 60_000, 'abc');
    expect(a.totalMs).toBe(b.totalMs);
    expect(a.totalMs).toBeGreaterThanOrEqual(80);
    expect(a.totalMs).toBeLessThanOrEqual(120);
  });

  it('returns zero delay for an undefined variant', () => {
    expect(computeVirtualDelayMs(undefined, 60_000, 'seed')).toEqual({ baseMs: 0, jitterMs: 0, totalMs: 0 });
  });

  it('can apply jitter without a seed', () => {
    const v = createDefaultResponse('r');
    v.behavior.delayMs = 50;
    v.behavior.jitterMs = 10;
    const result = computeVirtualDelayMs(v, 60_000);
    expect(result.totalMs).toBeGreaterThanOrEqual(40);
    expect(result.totalMs).toBeLessThanOrEqual(60);
  });
});

describe('previewFaultDelivery', () => {
  const behavior = { delayMs: 0, jitterMs: 0 };
  const rendered = { status: 200, body: 'hello-world' };

  it('previews normal delivery', () => {
    const p = previewFaultDelivery('none', behavior, rendered, 5_000);
    expect(p.deliveryOutcome).toBe('matched');
    expect(p.httpCompleted).toBe(true);
    expect(p.effectiveStatus).toBe(200);
  });

  it('previews reset as connection fault', () => {
    const p = previewFaultDelivery('reset', behavior, rendered, 5_000);
    expect(p.deliveryOutcome).toBe('fault');
    expect(p.httpCompleted).toBe(false);
    expect(p.effectiveStatus).toBe(0);
    expect(p.timeline[0].label).toMatch(/reset/i);
  });

  it('previews timeout hold', () => {
    const p = previewFaultDelivery('timeout', { ...behavior, longRunningMs: 1_500 }, rendered, 5_000);
    expect(p.deliveryOutcome).toBe('fault');
    expect(p.timeline.some(s => s.atMs === 1_500)).toBe(true);
  });

  it('defaults an unset timeout hold to 5s, clamped to the server cap', () => {
    expect(previewFaultDelivery('timeout', behavior, rendered, 30_000).timeline.some(s => s.atMs === 5_000)).toBe(true);
    expect(previewFaultDelivery('timeout', behavior, rendered, 1_000).timeline.some(s => s.atMs === 1_000)).toBe(true);
  });

  it('previews dribble chunks', () => {
    const p = previewFaultDelivery(
      'dribble',
      { ...behavior, chunkSchedule: [{ afterMs: 10, body: 'a' }, { afterMs: 20, body: 'b' }] },
      rendered,
      5_000,
    );
    expect(p.deliveryOutcome).toBe('fault');
    expect(p.httpCompleted).toBe(true);
    expect(p.effectiveBody).toBe('hello-world');
    expect(p.wireBody).toBe('ab');
    expect(p.timeline.length).toBeGreaterThan(2);
  });

  it('previews close, malformed, default dribble, and treats undefined fault as none', () => {
    expect(previewFaultDelivery(undefined, behavior, rendered, 5_000).fault).toBe('none');
    expect(previewFaultDelivery('close', behavior, rendered, 5_000).timeline[0].label).toMatch(/Abrupt end/);
    expect(previewFaultDelivery('malformed', behavior, rendered, 5_000).timeline[0].label).toMatch(/invalid bytes/);

    const longBody = 'x'.repeat(100);
    const dribble = previewFaultDelivery('dribble', behavior, { status: 200, body: longBody }, 5_000);
    expect(dribble.timeline.some(step => step.label.includes('…'))).toBe(true);
    expect(dribble.wireBody).toBe(longBody);
  });
});
