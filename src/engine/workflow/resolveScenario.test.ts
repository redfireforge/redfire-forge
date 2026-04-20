import { describe, it, expect } from 'vitest';
import type { Scenario } from '../../types';
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
