import { describe, it, expect } from 'vitest';
import { evaluateMatch, evaluateRules, expandTemplate } from './wsMockRuleEngine';
import type { WsMockRule, WsMockMatch } from '../../shared/websocket/types';

function makeRule(overrides: Partial<WsMockRule> = {}): WsMockRule {
  return {
    id: 'r1',
    name: 'Test Rule',
    enabled: true,
    match: { type: 'any', pattern: '' },
    response: { type: 'echo' },
    ...overrides,
  };
}

describe('evaluateMatch', () => {
  it('any matches everything', () => {
    expect(evaluateMatch({ type: 'any', pattern: '' }, 'hello')).toBe(true);
    expect(evaluateMatch({ type: 'any', pattern: '' }, '')).toBe(true);
  });

  it('exact matches identical strings', () => {
    expect(evaluateMatch({ type: 'exact', pattern: 'hello' }, 'hello')).toBe(true);
    expect(evaluateMatch({ type: 'exact', pattern: 'hello' }, 'world')).toBe(false);
    expect(evaluateMatch({ type: 'exact', pattern: 'hello' }, 'Hello')).toBe(false);
  });

  it('contains matches substrings', () => {
    expect(evaluateMatch({ type: 'contains', pattern: 'ell' }, 'hello')).toBe(true);
    expect(evaluateMatch({ type: 'contains', pattern: 'xyz' }, 'hello')).toBe(false);
    expect(evaluateMatch({ type: 'contains', pattern: '' }, 'hello')).toBe(true);
  });

  it('regex matches patterns', () => {
    expect(evaluateMatch({ type: 'regex', pattern: '^hello' }, 'hello world')).toBe(true);
    expect(evaluateMatch({ type: 'regex', pattern: '^world' }, 'hello world')).toBe(false);
    expect(evaluateMatch({ type: 'regex', pattern: '\\d+' }, 'abc123')).toBe(true);
    expect(evaluateMatch({ type: 'regex', pattern: '\\d+' }, 'abc')).toBe(false);
  });

  it('regex returns false for invalid patterns', () => {
    expect(evaluateMatch({ type: 'regex', pattern: '[invalid' }, 'hello')).toBe(false);
  });

  it('jsonpath matches existence', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.type' }, '{"type":"ping"}')).toBe(true);
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.missing' }, '{"type":"ping"}')).toBe(false);
  });

  it('jsonpath matches value equality', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.type=ping' }, '{"type":"ping"}')).toBe(true);
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.type=pong' }, '{"type":"ping"}')).toBe(false);
  });

  it('jsonpath matches nested paths', () => {
    const msg = '{"data":{"user":{"name":"Alice"}}}';
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.data.user.name=Alice' }, msg)).toBe(true);
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.data.user.name=Bob' }, msg)).toBe(false);
  });

  it('jsonpath matches array indices', () => {
    const msg = '{"items":[10,20,30]}';
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.items[1]' }, msg)).toBe(true);
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.items[1]=20' }, msg)).toBe(true);
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.items[5]' }, msg)).toBe(false);
  });

  it('jsonpath returns false for non-JSON', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.type' }, 'not json')).toBe(false);
  });

  it('jsonpath returns false for null values (existence check)', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.a' }, '{"a":null}')).toBe(false);
  });

  it('jsonpath returns false when traversing through a primitive', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.a.b' }, '{"a":"text"}')).toBe(false);
  });

  it('jsonpath returns false for value equality when the resolved value is null', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.a=x' }, '{"a":null}')).toBe(false);
  });

  it('jsonpath returns false when an intermediate segment is missing', () => {
    expect(evaluateMatch({ type: 'jsonpath', pattern: '$.missing.child' }, '{"other":1}')).toBe(false);
  });

  it('unknown match type returns false', () => {
    expect(evaluateMatch({ type: 'unknown' as WsMockMatch['type'], pattern: '' }, 'hello')).toBe(false);
  });
});

describe('evaluateRules', () => {
  it('returns first matching enabled rule', () => {
    const rules = [
      makeRule({ id: 'r1', name: 'First', match: { type: 'exact', pattern: 'hello' } }),
      makeRule({ id: 'r2', name: 'Second', match: { type: 'any', pattern: '' } }),
    ];
    const result = evaluateRules(rules, 'hello', 'echo');
    expect(result.matched).toBe(true);
    expect(result.rule?.id).toBe('r1');
  });

  it('skips disabled rules', () => {
    const rules = [
      makeRule({ id: 'r1', name: 'Disabled', enabled: false, match: { type: 'any', pattern: '' } }),
      makeRule({ id: 'r2', name: 'Enabled', match: { type: 'any', pattern: '' }, response: { type: 'static', data: 'ok' } }),
    ];
    const result = evaluateRules(rules, 'hello', 'echo');
    expect(result.matched).toBe(true);
    expect(result.rule?.id).toBe('r2');
  });

  it('falls through to fallback echo when no rule matches', () => {
    const rules = [
      makeRule({ id: 'r1', match: { type: 'exact', pattern: 'never' } }),
    ];
    const result = evaluateRules(rules, 'hello', 'echo');
    expect(result.matched).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.response?.type).toBe('echo');
  });

  it('falls through to fallback ignore', () => {
    const result = evaluateRules([], 'hello', 'ignore');
    expect(result.matched).toBe(false);
    expect(result.response).toBeUndefined();
  });

  it('falls through to fallback close', () => {
    const result = evaluateRules([], 'hello', 'close');
    expect(result.matched).toBe(false);
    expect(result.response?.type).toBe('close');
    expect(result.response?.closeCode).toBe(1000);
  });

  it('respects priority order (first match wins)', () => {
    const rules = [
      makeRule({ id: 'r1', name: 'Catch-all', match: { type: 'any', pattern: '' }, response: { type: 'static', data: 'first' } }),
      makeRule({ id: 'r2', name: 'Also matches', match: { type: 'any', pattern: '' }, response: { type: 'static', data: 'second' } }),
    ];
    const result = evaluateRules(rules, 'anything', 'ignore');
    expect(result.rule?.id).toBe('r1');
    expect(result.response?.data).toBe('first');
  });

  it('returns response from matched rule', () => {
    const rules = [
      makeRule({
        id: 'r1',
        match: { type: 'contains', pattern: 'ping' },
        response: { type: 'static', data: 'pong', delay: 100 },
      }),
    ];
    const result = evaluateRules(rules, 'ping me', 'echo');
    expect(result.matched).toBe(true);
    expect(result.response?.type).toBe('static');
    expect(result.response?.data).toBe('pong');
    expect(result.response?.delay).toBe(100);
  });

  it('handles empty rule list', () => {
    const result = evaluateRules([], 'hello', 'echo');
    expect(result.matched).toBe(false);
    expect(result.fallback).toBe(true);
  });
});

describe('expandTemplate', () => {
  it('replaces {{message}}', () => {
    expect(expandTemplate('echo: {{message}}', { message: 'hello', clientId: 'c1', counter: 1 }))
      .toBe('echo: hello');
  });

  it('replaces {{clientId}}', () => {
    expect(expandTemplate('client: {{clientId}}', { message: '', clientId: 'abc123', counter: 0 }))
      .toBe('client: abc123');
  });

  it('replaces {{counter}}', () => {
    expect(expandTemplate('#{{counter}}', { message: '', clientId: '', counter: 42 }))
      .toBe('#42');
  });

  it('replaces {{timestamp}} with ISO string', () => {
    const result = expandTemplate('ts: {{timestamp}}', { message: '', clientId: '', counter: 0 });
    expect(result).toMatch(/^ts: \d{4}-\d{2}-\d{2}T/);
  });

  it('replaces multiple variables in one template', () => {
    const result = expandTemplate(
      '{"msg":"{{message}}","from":"{{clientId}}","n":{{counter}}}',
      { message: 'hi', clientId: 'c1', counter: 5 },
    );
    expect(result).toBe('{"msg":"hi","from":"c1","n":5}');
  });

  it('leaves unrecognized placeholders unchanged', () => {
    expect(expandTemplate('{{unknown}}', { message: '', clientId: '', counter: 0 }))
      .toBe('{{unknown}}');
  });
});
