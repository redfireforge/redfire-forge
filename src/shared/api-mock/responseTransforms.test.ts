import { describe, expect, it, vi, afterEach } from 'vitest';
import { applyResponseTransforms } from './responseTransforms';
import type { ApiMockTransformRuleV1 } from './callbackContracts';
import * as templateEngine from './templateEngine';
import type { ApiMockTemplateContextV1 } from './contracts';

const base = {
  status: 200,
  headers: { 'Content-Type': 'application/json', 'X-Old': '1' },
  body: '{"ok":true}',
  templateErrorCount: 0,
};

describe('applyResponseTransforms', () => {
  it('applies set/remove/status/body transforms', () => {
    const rules: ApiMockTransformRuleV1[] = [
      { id: 't1', enabled: true, target: 'response', op: 'setHeader', key: 'X-Mocked', value: 'yes' },
      { id: 't2', enabled: true, target: 'response', op: 'removeHeader', key: 'X-Old' },
      { id: 't3', enabled: true, target: 'response', op: 'setStatus', value: '201' },
      { id: 't4', enabled: true, target: 'response', op: 'replaceBody', value: '{"created":true}' },
    ];
    const result = applyResponseTransforms(base, rules);
    expect(result.rendered.status).toBe(201);
    expect(result.rendered.headers['X-Mocked']).toBe('yes');
    expect(result.rendered.headers['X-Old']).toBeUndefined();
    expect(result.rendered.body).toBe('{"created":true}');
    expect(result.applied).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
  });

  it('isolates bad status without throwing', () => {
    const result = applyResponseTransforms(base, [
      { id: 'bad', enabled: true, target: 'response', op: 'setStatus', value: 'nope' },
    ]);
    expect(result.rendered.status).toBe(200);
    expect(result.errors[0]).toContain('invalid status');
  });

  it('skips disabled rules', () => {
    const result = applyResponseTransforms(base, [
      { id: 'off', enabled: false, target: 'response', op: 'setStatus', value: '500' },
    ]);
    expect(result.rendered.status).toBe(200);
    expect(result.applied).toHaveLength(0);
  });

  it('returns early when rules are empty or undefined', () => {
    expect(applyResponseTransforms(base, undefined)).toEqual({ rendered: base, applied: [], errors: [] });
    expect(applyResponseTransforms(base, [])).toEqual({ rendered: base, applied: [], errors: [] });
  });

  it('appendHeader creates, appends to scalar, and appends to array', () => {
    const result = applyResponseTransforms(
      { ...base, headers: { 'X-Multi': 'a', 'X-List': ['1', '2'] } },
      [
        { id: 'n1', enabled: true, target: 'response', op: 'appendHeader', key: 'X-New', value: 'first' },
        { id: 'n2', enabled: true, target: 'response', op: 'appendHeader', key: 'X-Multi', value: 'b' },
        { id: 'n3', enabled: true, target: 'response', op: 'appendHeader', key: 'X-List', value: '3' },
      ],
    );
    expect(result.rendered.headers['X-New']).toBe('first');
    expect(result.rendered.headers['X-Multi']).toEqual(['a', 'b']);
    expect(result.rendered.headers['X-List']).toEqual(['1', '2', '3']);
  });

  it('reports missing keys and unknown ops', () => {
    const result = applyResponseTransforms(base, [
      { id: 'sh', enabled: true, target: 'response', op: 'setHeader', value: 'x' },
      { id: 'ah', enabled: true, target: 'response', op: 'appendHeader', value: 'x' },
      { id: 'rh', enabled: true, target: 'response', op: 'removeHeader' },
      { id: 'unk', enabled: true, target: 'response', op: 'noop' as ApiMockTransformRuleV1['op'], value: 'x' },
    ]);
    expect(result.errors).toEqual([
      'sh: setHeader missing key',
      'ah: appendHeader missing key',
      'rh: removeHeader missing key',
      'unk: unknown op',
    ]);
  });

  it('removeHeader is case-insensitive', () => {
    const result = applyResponseTransforms(
      { ...base, headers: { 'x-old': 'gone', 'Content-Type': 'application/json' } },
      [{ id: 'r1', enabled: true, target: 'response', op: 'removeHeader', key: 'X-Old' }],
    );
    expect(result.rendered.headers['x-old']).toBeUndefined();
    expect(result.rendered.headers['Content-Type']).toBe('application/json');
  });

  it('resolves template values when context is provided', () => {
    const ctx: ApiMockTemplateContextV1 = {
      request: {
        method: 'GET',
        path: '/',
        pathParams: {},
        query: {},
        headers: {},
        cookies: {},
        body: null,
        rawBody: '',
      },
      state: {},
      variables: { token: 'abc' },
      counters: {},
      now: '2026-01-01T00:00:00.000Z',
      seed: 's',
    };
    const result = applyResponseTransforms(base, [
      { id: 't1', enabled: true, target: 'response', op: 'setHeader', key: 'Authorization', value: '{{variables.token}}' },
      { id: 't2', enabled: true, target: 'response', op: 'setHeader', key: 'Plain', value: 'no-template' },
      { id: 't3', enabled: true, target: 'response', op: 'setHeader', key: 'Empty', value: undefined },
    ], ctx);
    expect(result.rendered.headers['Authorization']).toBe('abc');
    expect(result.rendered.headers['Plain']).toBe('no-template');
    expect(result.rendered.headers['Empty']).toBe('');
  });

  afterEach(() => vi.restoreAllMocks());

  it('falls back to raw value when template render throws', () => {
    vi.spyOn(templateEngine, 'renderTemplate').mockImplementation(() => {
      throw new Error('boom');
    });
    const ctx = {} as ApiMockTemplateContextV1;
    const result = applyResponseTransforms(base, [
      { id: 't1', enabled: true, target: 'response', op: 'replaceBody', value: '{{bad}}' },
    ], ctx);
    expect(result.rendered.body).toBe('{{bad}}');
  });

  it('isolates transform loop failures without throwing', () => {
    vi.spyOn(Object, 'keys').mockImplementation(() => {
      throw new Error('keys failed');
    });
    const result = applyResponseTransforms(base, [
      { id: 'r1', enabled: true, target: 'response', op: 'removeHeader', key: 'X-Old' },
    ]);
    expect(result.errors[0]).toBe('r1: keys failed');
    expect(result.rendered.status).toBe(200);
  });

  it('reports non-Error transform failures', () => {
    vi.spyOn(Object, 'keys').mockImplementation(() => {
      throw 'plain failure';
    });
    const result = applyResponseTransforms(base, [
      { id: 'r2', enabled: true, target: 'response', op: 'removeHeader', key: 'X-Old' },
    ]);
    expect(result.errors[0]).toBe('r2: transform failed');
  });
});
