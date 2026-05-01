import { describe, it, expect } from 'vitest';
import { VariableContext } from './variableContext';
import { ensureAbsoluteUrlWithBase } from './absoluteUrl';

describe('ensureAbsoluteUrlWithBase', () => {
  it('prepends baseUrl for path-only URLs', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://api.example.com' });
    expect(ensureAbsoluteUrlWithBase('/v1/x', ctx)).toBe('https://api.example.com/v1/x');
  });

  it('strips trailing slash from baseUrl', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://api.example.com/' });
    expect(ensureAbsoluteUrlWithBase('/v1/x', ctx)).toBe('https://api.example.com/v1/x');
  });

  it('leaves absolute URLs unchanged', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://ignored.com' });
    expect(ensureAbsoluteUrlWithBase('https://other.com/a', ctx)).toBe('https://other.com/a');
  });

  it('leaves path-only URL unchanged when no baseUrl', () => {
    const ctx = new VariableContext({});
    expect(ensureAbsoluteUrlWithBase('/only/path', ctx)).toBe('/only/path');
  });
});
