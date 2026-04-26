import { describe, it, expect } from 'vitest';
import type { Scenario } from '../../../shared/types';
import { VariableContext } from './variableContext';
import { decodeUrlEncodedTemplateBraces, resolveScenario } from './resolveScenario';

const baseScenario: Scenario = {
  id: '1',
  name: 't',
  url: 'https://example.com',
  method: 'GET',
  headers: [],
  body: '',
  auth: { type: 'none' },
  validation: { mode: 'none' },
};

describe('decodeUrlEncodedTemplateBraces', () => {
  it('restores {{var}} from percent-encoded query', () => {
    expect(decodeUrlEncodedTemplateBraces('?a=%7B%7Bx%7D%7D')).toBe('?a={{x}}');
  });

  it('passes through normal URLs', () => {
    expect(decodeUrlEncodedTemplateBraces('https://x.com?a=1')).toBe('https://x.com?a=1');
  });
});

describe('resolveScenario URL', () => {
  it('substitutes query params saved as encoded templates', () => {
    const ctx = new VariableContext({ country: 'US', channel: 'MOBILE' });
    const scenario: Scenario = {
      ...baseScenario,
      url: 'https://api.test/v1/r?country=%7B%7Bcountry%7D%7D&channel=%7B%7Bchannel%7D%7D',
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.url).toBe('https://api.test/v1/r?country=US&channel=MOBILE');
  });

  it('substitutes literal {{var}} in query', () => {
    const ctx = new VariableContext({ country: 'US' });
    const scenario: Scenario = {
      ...baseScenario,
      url: 'https://api.test/v1/r?country={{country}}',
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.url).toBe('https://api.test/v1/r?country=US');
  });

  it('substitutes node-scoped {{node:id.name}} in query', () => {
    const ctx = new VariableContext();
    ctx.setForNode('upstream-1', 'channel', 'WEB');
    const scenario: Scenario = {
      ...baseScenario,
      url: 'https://api.test/v1/r?channel={{node:upstream-1.channel}}',
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.url).toBe('https://api.test/v1/r?channel=WEB');
  });
});

describe('resolveScenario auth fields', () => {
  it('substitutes bearer token variable', () => {
    const ctx = new VariableContext({ myToken: 'abc123' });
    const scenario: Scenario = {
      ...baseScenario,
      auth: { type: 'bearer', token: '{{myToken}}' },
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.auth.token).toBe('abc123');
  });

  it('substitutes apiKeyValue variable', () => {
    const ctx = new VariableContext({ key: 'secret' });
    const scenario: Scenario = {
      ...baseScenario,
      auth: { type: 'apikey', apiKeyName: 'x-key', apiKeyValue: '{{key}}', apiKeyIn: 'header' },
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.auth.apiKeyValue).toBe('secret');
  });

  it('substitutes basic auth username and password', () => {
    const ctx = new VariableContext({ user: 'admin', pass: 's3cret' });
    const scenario: Scenario = {
      ...baseScenario,
      auth: { type: 'basic', username: '{{user}}', password: '{{pass}}' },
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.auth.username).toBe('admin');
    expect(out.auth.password).toBe('s3cret');
  });

  it('substitutes OAuth2 clientId and clientSecret', () => {
    const ctx = new VariableContext({ cid: 'client-1', csec: 'client-secret' });
    const scenario: Scenario = {
      ...baseScenario,
      auth: { type: 'oauth2-client-credentials', clientId: '{{cid}}', clientSecret: '{{csec}}', tokenUrl: 'https://auth.test/token' },
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.auth.clientId).toBe('client-1');
    expect(out.auth.clientSecret).toBe('client-secret');
  });

  it('leaves undefined auth fields as undefined', () => {
    const ctx = new VariableContext({});
    const scenario: Scenario = { ...baseScenario, auth: { type: 'none' } };
    const out = resolveScenario(scenario, ctx);
    expect(out.auth.token).toBeUndefined();
    expect(out.auth.apiKeyValue).toBeUndefined();
    expect(out.auth.username).toBeUndefined();
    expect(out.auth.password).toBeUndefined();
    expect(out.auth.clientId).toBeUndefined();
    expect(out.auth.clientSecret).toBeUndefined();
  });
});

describe('resolveScenario headers and body', () => {
  it('substitutes variables in headers', () => {
    const ctx = new VariableContext({ token: 'bearer-val' });
    const scenario: Scenario = {
      ...baseScenario,
      headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.headers[0].value).toBe('Bearer bearer-val');
  });

  it('substitutes variables in body', () => {
    const ctx = new VariableContext({ name: 'Test' });
    const scenario: Scenario = {
      ...baseScenario,
      body: '{"name":"{{name}}"}',
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.body).toBe('{"name":"Test"}');
  });

  it('substitutes variables in bodyForm', () => {
    const ctx = new VariableContext({ val: '42' });
    const scenario: Scenario = {
      ...baseScenario,
      bodyForm: [{ key: 'field', value: '{{val}}' }],
    };
    const out = resolveScenario(scenario, ctx);
    expect(out.bodyForm![0].value).toBe('42');
  });

  it('leaves bodyForm untouched when undefined', () => {
    const ctx = new VariableContext({});
    const scenario: Scenario = { ...baseScenario };
    const out = resolveScenario(scenario, ctx);
    expect(out.bodyForm).toBeUndefined();
  });
});
