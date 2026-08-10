import { describe, expect, it } from 'vitest';
import httpShim, { get, request } from './http-browser';

describe('http-browser shim', () => {
  it('throws for request()', () => {
    expect(() => request()).toThrow('Node http API is not available in browser runtime.');
  });

  it('throws for get()', () => {
    expect(() => get()).toThrow('Node http API is not available in browser runtime.');
  });

  it('default export delegates to the same throwing functions', () => {
    expect(() => httpShim.request()).toThrow('Node http API is not available in browser runtime.');
    expect(() => httpShim.get()).toThrow('Node http API is not available in browser runtime.');
  });
});
