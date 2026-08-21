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

  it('prepends baseUrl with slash for relative URLs without leading slash', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://api.example.com' });
    expect(ensureAbsoluteUrlWithBase('sales/product/v1/status', ctx)).toBe('https://api.example.com/sales/product/v1/status');
  });

  it('leaves relative URL without slash unchanged when no baseUrl', () => {
    const ctx = new VariableContext({});
    expect(ensureAbsoluteUrlWithBase('sales/product/v1/status', ctx)).toBe('sales/product/v1/status');
  });

  it('handles empty URL', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://api.example.com' });
    expect(ensureAbsoluteUrlWithBase('', ctx)).toBe('');
  });

  it('handles whitespace-only URL', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://api.example.com' });
    expect(ensureAbsoluteUrlWithBase('   ', ctx)).toBe('');
  });

  it('does not prepend env baseUrl onto unresolved {{templates}}', () => {
    const ctx = new VariableContext({}, { baseUrl: 'https://jsonplaceholder.typicode.com' });
    expect(ensureAbsoluteUrlWithBase('{{mockBaseUrl}}/cart', ctx)).toBe('{{mockBaseUrl}}/cart');
  });
});
