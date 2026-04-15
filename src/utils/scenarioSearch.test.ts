import { describe, it, expect } from 'vitest';
import { parseSearchQuery, evaluateQuery } from './scenarioSearch';

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
