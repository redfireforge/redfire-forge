import { describe, it, expect } from 'vitest';
import type { ExpectedField, Scenario } from '../../../shared/types';
import { parseSearchQuery, evaluateQuery, buildSearchText } from './scenarioSearch';

function scenarioBase(over: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'My Test',
    url: 'https://api.example/v1',
    method: 'POST',
    headers: [{ key: 'X-Trace', value: 'abc' }],
    body: '{"x":1}',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...over,
  };
}

describe('parseSearchQuery', () => {
  it('returns null for empty string', () => {
    expect(parseSearchQuery('')).toBeNull();
    expect(parseSearchQuery('   ')).toBeNull();
  });

  it('parses a single term', () => {
    const node = parseSearchQuery('login');
    expect(node).toEqual({ type: 'term', value: 'login', exact: false });
  });

  it('lowercases terms', () => {
    const node = parseSearchQuery('LOGIN');
    expect(node).toEqual({ type: 'term', value: 'login', exact: false });
  });

  it('parses quoted exact match', () => {
    const node = parseSearchQuery('"hello world"');
    expect(node).toEqual({ type: 'term', value: 'hello world', exact: true });
  });

  it('treats unclosed double quote as a single token (no closing quote)', () => {
    const node = parseSearchQuery('"hello');
    expect(node).toEqual({ type: 'term', value: '"hello', exact: false });
  });

  it('parses NOT prefix', () => {
    const node = parseSearchQuery('NOT error');
    expect(node).toEqual({ type: 'not', child: { type: 'term', value: 'error', exact: false } });
  });

  it('parses dash prefix as NOT', () => {
    const node = parseSearchQuery('-error');
    expect(node).toEqual({ type: 'not', child: { type: 'term', value: 'error', exact: false } });
  });

  it('parses implicit AND (space-separated terms)', () => {
    const node = parseSearchQuery('login api');
    expect(node).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'login', exact: false },
        { type: 'term', value: 'api', exact: false },
      ],
    });
  });

  it('parses explicit AND', () => {
    const node = parseSearchQuery('login AND api');
    expect(node).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'login', exact: false },
        { type: 'term', value: 'api', exact: false },
      ],
    });
  });

  it('parses OR', () => {
    const node = parseSearchQuery('login OR signup');
    expect(node).toEqual({
      type: 'or',
      children: [
        { type: 'term', value: 'login', exact: false },
        { type: 'term', value: 'signup', exact: false },
      ],
    });
  });

  it('respects AND precedence over OR', () => {
    const node = parseSearchQuery('a OR b c');
    expect(node).toEqual({
      type: 'or',
      children: [
        { type: 'term', value: 'a', exact: false },
        {
          type: 'and',
          children: [
            { type: 'term', value: 'b', exact: false },
            { type: 'term', value: 'c', exact: false },
          ],
        },
      ],
    });
  });

  it('parses parenthesized groups', () => {
    const node = parseSearchQuery('(a OR b) c');
    expect(node).toEqual({
      type: 'and',
      children: [
        {
          type: 'or',
          children: [
            { type: 'term', value: 'a', exact: false },
            { type: 'term', value: 'b', exact: false },
          ],
        },
        { type: 'term', value: 'c', exact: false },
      ],
    });
  });

  it('parses complex nested query', () => {
    const node = parseSearchQuery('NOT (error OR timeout) "status ok"');
    expect(node).not.toBeNull();
    expect(node!.type).toBe('and');
  });
});

describe('evaluateQuery', () => {
  const text = 'GET /api/v2/users login endpoint returns 200';

  it('matches a substring term', () => {
    const node = parseSearchQuery('login')!;
    expect(evaluateQuery(node, text)).toBe(true);
  });

  it('does not match absent term', () => {
    const node = parseSearchQuery('signup')!;
    expect(evaluateQuery(node, text)).toBe(false);
  });

  it('matches exact quoted phrase', () => {
    const node = parseSearchQuery('"login endpoint"')!;
    expect(evaluateQuery(node, text)).toBe(true);
  });

  it('rejects partial exact match', () => {
    const node = parseSearchQuery('"login end"')!;
    expect(evaluateQuery(node, text)).toBe(false);
  });

  it('evaluates NOT correctly', () => {
    expect(evaluateQuery(parseSearchQuery('NOT signup')!, text)).toBe(true);
    expect(evaluateQuery(parseSearchQuery('NOT login')!, text)).toBe(false);
  });

  it('evaluates AND correctly', () => {
    expect(evaluateQuery(parseSearchQuery('login api')!, text)).toBe(true);
    expect(evaluateQuery(parseSearchQuery('login signup')!, text)).toBe(false);
  });

  it('evaluates OR correctly', () => {
    expect(evaluateQuery(parseSearchQuery('login OR signup')!, text)).toBe(true);
    expect(evaluateQuery(parseSearchQuery('signup OR register')!, text)).toBe(false);
  });

  it('evaluates complex boolean expression', () => {
    const node = parseSearchQuery('(login OR signup) NOT timeout')!;
    expect(evaluateQuery(node, text)).toBe(true);

    const textWithTimeout = 'login endpoint timeout error';
    expect(evaluateQuery(node, textWithTimeout)).toBe(false);
  });

  it('case-insensitive matching', () => {
    expect(evaluateQuery(parseSearchQuery('GET')!, text)).toBe(true);
    expect(evaluateQuery(parseSearchQuery('get')!, text)).toBe(true);
  });
});

describe('buildSearchText', () => {
  it('joins core fields and header key/value pairs', () => {
    const t = scenarioBase();
    const s = buildSearchText(t);
    expect(s).toContain('My Test');
    expect(s).toContain('https://api.example/v1');
    expect(s).toContain('POST');
    expect(s).toContain('{"x":1}');
    expect(s).toContain('X-Trace');
    expect(s).toContain('abc');
    expect(s).toContain('none');
  });

  it('includes optional auth and validation fields when present', () => {
    const t = scenarioBase({
      auth: {
        type: 'oauth2',
        tokenUrl: 'https://idp/token',
        clientId: 'cid',
        username: 'user@example.com',
      },
      validation: {
        mode: 'selective',
        expectedJson: '{"ok":true}',
        expectedFields: [
          { jsonPath: '$.id', expectedValue: '42' },
          { jsonPath: undefined, expectedValue: undefined } as ExpectedField,
        ],
      },
    });
    const s = buildSearchText(t);
    expect(s).toContain('https://idp/token');
    expect(s).toContain('cid');
    expect(s).toContain('user@example.com');
    expect(s).toContain('selective');
    expect(s).toContain('$.id');
    expect(s).toContain('42');
    expect(s).toContain('{"ok":true}');
  });
});

describe('parseSearchQuery — additional branches', () => {
  it('handles unclosed parenthesis gracefully', () => {
    const node = parseSearchQuery('(a OR b');
    expect(node).not.toBeNull();
    expect(node!.type).toBe('or');
  });

  it('handles negation with dash-prefix token', () => {
    const node = parseSearchQuery('-error');
    expect(node).toEqual({ type: 'not', child: { type: 'term', value: 'error', exact: false } });
  });
});

describe('buildSearchText — scenario tags', () => {
  it('includes scenarioTags in search text', () => {
    const t = scenarioBase({ scenarioTags: ['smoke', 'regression'] });
    const s = buildSearchText(t);
    expect(s).toContain('smoke');
    expect(s).toContain('regression');
  });

  it('handles undefined scenarioTags', () => {
    const t = scenarioBase({ scenarioTags: undefined });
    const s = buildSearchText(t);
    expect(s).toContain('My Test');
  });

  it('handles empty scenarioTags array', () => {
    const t = scenarioBase({ scenarioTags: [] });
    const s = buildSearchText(t);
    expect(s).toContain('My Test');
  });

  it('search matches by tag name', () => {
    const t = scenarioBase({ scenarioTags: ['smoke', 'critical'] });
    const text = buildSearchText(t);
    const node = parseSearchQuery('smoke')!;
    expect(evaluateQuery(node, text)).toBe(true);
  });

  it('search does not match non-existent tag', () => {
    const t = scenarioBase({ scenarioTags: ['smoke', 'critical'] });
    const text = buildSearchText(t);
    const node = parseSearchQuery('regression')!;
    expect(evaluateQuery(node, text)).toBe(false);
  });
});
