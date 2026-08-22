import { describe, it, expect, vi, afterEach } from 'vitest';
import { countCompetingRules, renderFallbackBody, newTransactionId } from './fallbackBody';

describe('renderFallbackBody', () => {
  it('substitutes the correlation id', () => {
    expect(renderFallbackBody('{"error":"not_found","requestId":"{{requestId}}"}', { requestId: 'tx-1' }))
      .toBe('{"error":"not_found","requestId":"tx-1"}');
  });

  it('substitutes the competing rule count', () => {
    expect(renderFallbackBody('{"competingRules":{{competingRuleCount}}}', { requestId: 'x', competingRuleCount: 3 }))
      .toBe('{"competingRules":3}');
  });

  it('defaults an absent count to 0 rather than emitting invalid JSON', () => {
    const out = renderFallbackBody('{"n":{{competingRuleCount}}}', { requestId: 'x' });
    expect(out).toBe('{"n":0}');
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderFallbackBody('{{ requestId }}', { requestId: 'tx-2' })).toBe('tx-2');
  });

  it('leaves bodies without placeholders untouched', () => {
    const plain = '{"error":"not_found"}';
    expect(renderFallbackBody(plain, { requestId: 'tx-3' })).toBe(plain);
  });

  it('does not touch unknown placeholders', () => {
    expect(renderFallbackBody('{{somethingElse}}', { requestId: 'tx-4' })).toBe('{{somethingElse}}');
  });
});

describe('countCompetingRules', () => {
  it('prefers policy matchedCount over the full candidate list', () => {
    expect(countCompetingRules({
      policyDecision: { matchedCount: 2 },
      candidates: [{ overallMatch: true }, { overallMatch: false }, { overallMatch: false }],
    })).toBe(2);
  });

  it('counts overallMatch when matchedCount is missing', () => {
    expect(countCompetingRules({
      candidates: [{ overallMatch: true }, { overallMatch: true }, { overallMatch: false }],
    })).toBe(2);
  });

  it('is 0 when there is no explanation', () => {
    expect(countCompetingRules()).toBe(0);
  });
});

describe('newTransactionId', () => {
  afterEach(() => vi.useRealTimers());

  it('is prefixed and unique', () => {
    const a = newTransactionId();
    const b = newTransactionId();
    expect(a).toMatch(/^tx-\d+-[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});
