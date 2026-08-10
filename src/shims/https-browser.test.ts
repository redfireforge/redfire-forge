import { describe, expect, it } from 'vitest';
import httpsShim, { get, request } from './https-browser';

describe('https-browser shim', () => {
  it('throws for request()', () => {
    expect(() => request()).toThrow('Node https API is not available in browser runtime.');
  });

  it('throws for get()', () => {
    expect(() => get()).toThrow('Node https API is not available in browser runtime.');
  });

  it('default export delegates to the same throwing functions', () => {
    expect(() => httpsShim.request()).toThrow('Node https API is not available in browser runtime.');
    expect(() => httpsShim.get()).toThrow('Node https API is not available in browser runtime.');
  });
});
