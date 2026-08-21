import { describe, expect, it } from 'vitest';
import { renderTemplate } from './templateEngine';
import { HARD_CEILINGS } from './defaults';
import type { ApiMockTemplateContextV1 } from './contracts';

function ctx(overrides: Partial<ApiMockTemplateContextV1> = {}): ApiMockTemplateContextV1 {
  return {
    request: {
      method: 'GET',
      path: '/users/42',
      pathParams: { id: '42' },
      query: { include: ['profile', 'roles'] },
      headers: { 'x-tenant': ['acme'], authorization: ['Bearer tok'] },
      cookies: { session: 'abc' },
      body: { user: { name: 'Alice', role: 'admin' }, nested: { obj: { ok: true } } } as Record<string, unknown> | string | null,
      rawBody: '{"user":{"name":"Alice","role":"admin"}}',
    },
    state: { flow: 'active' },
    variables: { apiKey: 'sk-123' },
    counters: { hits: 5 },
    now: '2026-08-11T00:00:00.000Z',
    seed: '',
    ...overrides,
  };
}

describe('templateEngine coverage gaps', () => {
  it('covers helper argument fallbacks and now timestamp fallback', () => {
    const withoutNow = ctx({ now: '' });
    expect(renderTemplate('{{pathParam}}', withoutNow).output).toBe('');
    expect(renderTemplate('{{query}}', withoutNow).output).toBe('');
    expect(renderTemplate('{{header}}', withoutNow).output).toBe('');
    expect(renderTemplate('{{cookie}}', withoutNow).output).toBe('');
    expect(renderTemplate('{{state}}', withoutNow).output).toBe('');
    expect(renderTemplate('{{counter}}', withoutNow).output).toBe('0');
    expect(renderTemplate('{{now}}', withoutNow).output).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(renderTemplate("{{pathParam 'missing'}}", withoutNow).output).toBe('');
    expect(renderTemplate("{{query 'missing'}}", withoutNow).output).toBe('');
    expect(renderTemplate("{{header 'missing'}}", withoutNow).output).toBe('');
    expect(renderTemplate("{{cookie 'missing'}}", withoutNow).output).toBe('');
    expect(renderTemplate("{{state 'missing'}}", withoutNow).output).toBe('');
    expect(renderTemplate("{{counter 'missing'}}", withoutNow).output).toBe('0');
  });

  it('covers oneOf empty args and repeat clamp behavior', () => {
    expect(renderTemplate('{{oneOf}}', ctx()).output).toBe('');
    expect(renderTemplate("{{repeat '-3' 'ab'}}", ctx()).output).toBe('');
    expect(renderTemplate('{{repeat}}', ctx()).output).toBe('');
    expect(renderTemplate(`{{repeat '${HARD_CEILINGS.maxTemplateOperations}' 'x'}}`, ctx()).output.length).toBe(HARD_CEILINGS.maxTemplateOperations > 100 ? 100 : HARD_CEILINGS.maxTemplateOperations);
  });

  it('covers base64 failure and jsonPath object/null/string fallbacks', () => {
    const failed = renderTemplate("{{base64 '%' 'decode'}}", ctx());
    expect(failed.output).toBe('');
    expect(failed.errors).toContain('base64 decode failed');

    expect(renderTemplate("{{jsonPath '$.nested.obj'}}", ctx()).output).toBe(JSON.stringify({ ok: true }));
    expect(renderTemplate('{{jsonPath}}', ctx()).output).toBe(JSON.stringify(ctx().request.body));
    expect(renderTemplate("{{jsonPath '$.user.name'}}", ctx({ request: { ...ctx().request, body: null } })).output).toBe('');
    expect(renderTemplate("{{jsonPath '$.user.name'}}", ctx({ request: { ...ctx().request, body: 'raw-string' } })).output).toBe('');
    expect(renderTemplate("{{jsonPath '$.user.name.first'}}", ctx()).output).toBe('');
    expect(renderTemplate("{{jsonPath '$.__proto__[0]'}}", ctx()).output).toBe('');
    expect(renderTemplate("{{jsonPath '$.items[0].sku'}}", ctx({
      request: { ...ctx().request, body: { items: [{ sku: 'RF-100' }] } },
    })).output).toBe('RF-100');
  });

  it('covers parse-expression quoting and tab separation', () => {
    expect(renderTemplate('{{oneOf "x y" "z"}}', ctx({ seed: 'seed-1' })).output).toMatch(/x y|z/);
    expect(renderTemplate('{{query\t"include"}}', ctx()).output).toBe('profile');
    expect(renderTemplate('{{query"include"}}', ctx()).output).toBe('profile');
    expect(renderTemplate('{{"}}', ctx()).output).toBe('');
  });

  it('covers operation limit, blocked json path, and blocked nested resolve path', () => {
    const blockedJsonPath = renderTemplate("{{jsonPath '$.__proto__'}}", ctx());
    expect(blockedJsonPath.output).toBe('');

    const blockedResolve = renderTemplate('{{request.__proto__.polluted}}', ctx());
    expect(blockedResolve.errors.some(error => error.includes('Blocked key'))).toBe(true);

    expect(renderTemplate('{{request.method.foo}}', ctx()).output).toBe('');

    const overOpsTemplate = Array.from({ length: HARD_CEILINGS.maxTemplateOperations + 1 }, () => '{{request.method}}').join('');
    const overOps = renderTemplate(overOpsTemplate, ctx());
    expect(overOps.errors.some(error => error.includes('Operation limit'))).toBe(true);

    const overHelperOpsTemplate = Array.from({ length: HARD_CEILINGS.maxTemplateOperations + 1 }, () => "{{counter 'hits'}}").join('');
    const overHelperOps = renderTemplate(overHelperOpsTemplate, ctx());
    expect(overHelperOps.errors.some(error => error.includes('Operation limit'))).toBe(true);
  });

  it('covers output truncation before consuming the whole template', () => {
    const template = 'x'.repeat(HARD_CEILINGS.maxResponseBodyBytes + 2);
    const result = renderTemplate(template, ctx());
    expect(result.truncated).toBe(true);
    expect(result.output.length).toBeGreaterThan(HARD_CEILINGS.maxResponseBodyBytes);
  });
});
