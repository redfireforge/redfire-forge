import { describe, it, expect } from 'vitest';
import { renderTemplate } from './templateEngine';
import type { ApiMockTemplateContextV1 } from './contracts';

function ctx(overrides: Partial<ApiMockTemplateContextV1> = {}): ApiMockTemplateContextV1 {
  return {
    request: {
      method: 'GET', path: '/users/42', pathParams: { id: '42' },
      query: { include: ['profile', 'roles'] }, headers: { 'x-tenant': ['acme'], 'authorization': ['Bearer tok'] },
      cookies: { session: 'abc' }, body: { user: { name: 'Alice', role: 'admin' } } as Record<string, unknown> | string | null,
      rawBody: '{"user":{"name":"Alice","role":"admin"}}',
    },
    state: { flow: 'active' }, variables: { apiKey: 'sk-123' },
    counters: { hits: 5 }, now: '2026-08-11T00:00:00.000Z', seed: '',
    ...overrides,
  };
}

describe('renderTemplate', () => {
  describe('variable resolution', () => {
    it('resolves simple path', () => {
      expect(renderTemplate('{{request.method}}', ctx()).output).toBe('GET');
    });
    it('resolves nested path', () => {
      expect(renderTemplate('{{request.path}}', ctx()).output).toBe('/users/42');
    });
    it('returns empty for missing path', () => {
      expect(renderTemplate('{{request.missing}}', ctx()).output).toBe('');
    });
    it('preserves literal text', () => {
      expect(renderTemplate('Hello world', ctx()).output).toBe('Hello world');
    });
    it('mixes literal and expressions', () => {
      expect(renderTemplate('Method: {{request.method}}, Path: {{request.path}}', ctx()).output)
        .toBe('Method: GET, Path: /users/42');
    });
  });

  describe('helpers', () => {
    it('pathParam', () => {
      expect(renderTemplate("{{pathParam 'id'}}", ctx()).output).toBe('42');
    });
    it('query', () => {
      expect(renderTemplate("{{query 'include'}}", ctx()).output).toBe('profile');
    });
    it('header', () => {
      expect(renderTemplate("{{header 'x-tenant'}}", ctx()).output).toBe('acme');
    });
    it('header is case-insensitive', () => {
      expect(renderTemplate("{{header 'X-Tenant'}}", ctx()).output).toBe('acme');
    });
    it('cookie', () => {
      expect(renderTemplate("{{cookie 'session'}}", ctx()).output).toBe('abc');
    });
    it('state', () => {
      expect(renderTemplate("{{state 'flow'}}", ctx()).output).toBe('active');
    });
    it('counter', () => {
      expect(renderTemplate("{{counter 'hits'}}", ctx()).output).toBe('5');
    });
    it('uuid generates a UUID', () => {
      const result = renderTemplate('{{uuid}}', ctx());
      expect(result.output).toMatch(/^[0-9a-f]{8}-/);
    });
    it('now returns the context timestamp', () => {
      expect(renderTemplate('{{now}}', ctx()).output).toBe('2026-08-11T00:00:00.000Z');
    });
    it('randomInt produces a number in range', () => {
      const result = renderTemplate("{{randomInt '1' '10'}}", ctx());
      const n = parseInt(result.output, 10);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
    });
    it('oneOf picks from values', () => {
      const result = renderTemplate("{{oneOf 'a' 'b' 'c'}}", ctx());
      expect(['a', 'b', 'c']).toContain(result.output);
    });
    it('repeat', () => {
      expect(renderTemplate("{{repeat '3' 'ab'}}", ctx()).output).toBe('ababab');
    });
    it('base64 encode', () => {
      expect(renderTemplate("{{base64 'hello'}}", ctx()).output).toBe(btoa('hello'));
    });
    it('base64 decode', () => {
      expect(renderTemplate(`{{base64 '${btoa('hello')}' 'decode'}}`, ctx()).output).toBe('hello');
    });
    it('jsonPath resolves path', () => {
      expect(renderTemplate("{{jsonPath '$.user.name'}}", ctx()).output).toBe('Alice');
    });
    it('jsonPath returns empty for missing', () => {
      expect(renderTemplate("{{jsonPath '$.missing'}}", ctx()).output).toBe('');
    });
  });

  describe('deterministic seed', () => {
    it('randomInt is deterministic with seed', () => {
      const c = ctx({ seed: 'test-seed' });
      const r1 = renderTemplate("{{randomInt '1' '100'}}", c);
      const r2 = renderTemplate("{{randomInt '1' '100'}}", c);
      expect(r1.output).toBe(r2.output);
    });
    it('oneOf is deterministic with seed', () => {
      const c = ctx({ seed: 'test-seed' });
      const r1 = renderTemplate("{{oneOf 'x' 'y' 'z'}}", c);
      const r2 = renderTemplate("{{oneOf 'x' 'y' 'z'}}", c);
      expect(r1.output).toBe(r2.output);
    });
  });

  describe('safety', () => {
    it('blocks __proto__', () => {
      const result = renderTemplate('{{__proto__}}', ctx());
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Blocked key');
    });
    it('blocks constructor', () => {
      const result = renderTemplate('{{constructor.name}}', ctx());
      expect(result.errors).toHaveLength(1);
    });
    it('blocks prototype', () => {
      const result = renderTemplate('{{prototype}}', ctx());
      expect(result.errors).toHaveLength(1);
    });
    it('reports unknown helpers', () => {
      const result = renderTemplate("{{eval 'code'}}", ctx());
      expect(result.errors.some(e => e.includes('Unknown helper'))).toBe(true);
    });
    it('handles unclosed braces', () => {
      expect(renderTemplate('{{unclosed', ctx()).output).toBe('{{unclosed');
    });
    it('handles empty expression', () => {
      expect(renderTemplate('{{}}', ctx()).output).toBe('');
    });
  });

  describe('complex templates', () => {
    it('renders a full response body', () => {
      const tmpl = `{
  "id": "{{pathParam 'id'}}",
  "name": "{{jsonPath '$.user.name'}}",
  "tenant": "{{header 'x-tenant'}}",
  "requestId": "{{uuid}}"
}`;
      const result = renderTemplate(tmpl, ctx());
      expect(result.output).toContain('"id": "42"');
      expect(result.output).toContain('"name": "Alice"');
      expect(result.output).toContain('"tenant": "acme"');
      expect(result.errors).toHaveLength(0);
    });
  });
});
