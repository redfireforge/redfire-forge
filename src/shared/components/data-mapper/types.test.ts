import { describe, it, expect } from 'vitest';
import { defaultCapabilities, MapperFetchError, resolveCapabilities } from './types';
import type { AdapterCapabilities } from './types';

describe('defaultCapabilities', () => {
  it('returns all flags as false except expressions', () => {
    const caps = defaultCapabilities();
    expect(caps.operators).toBe(false);
    expect(caps.arrayAssertions).toBe(false);
    expect(caps.typeChecks).toBe(false);
    expect(caps.codeEditor).toBe(false);
    expect(caps.verification).toBe(false);
    expect(caps.expressions).toBe(true);
    expect(caps.schemaDrift).toBe(false);
    expect(caps.profiles).toBe(false);
    expect(caps.unorderedArrays).toBe(false);
    expect(caps.hideAdvanced).toBe(false);
    expect(caps.conditionals).toBe(false);
    expect(caps.loopConstructs).toBe(false);
    expect(caps.errorHandling).toBe(false);
  });
});

describe('resolveCapabilities', () => {
  it('returns all-default when undefined is passed', () => {
    const caps = resolveCapabilities(undefined);
    expect(caps.operators).toBe(false);
    expect(caps.expressions).toBe(true);
  });

  it('merges partial capabilities with defaults', () => {
    const partial: AdapterCapabilities = { operators: true, verification: true };
    const caps = resolveCapabilities(partial);
    expect(caps.operators).toBe(true);
    expect(caps.verification).toBe(true);
    expect(caps.expressions).toBe(true);
    expect(caps.codeEditor).toBe(false);
    expect(caps.schemaDrift).toBe(false);
  });

  it('overrides default expressions:true when explicitly set to false', () => {
    const partial: AdapterCapabilities = { expressions: false };
    const caps = resolveCapabilities(partial);
    expect(caps.expressions).toBe(false);
  });

  it('returns Required<AdapterCapabilities> with no undefined fields', () => {
    const caps = resolveCapabilities({});
    const keys = Object.keys(caps);
    for (const key of keys) {
      expect((caps as Record<string, unknown>)[key]).not.toBeUndefined();
    }
  });
});

describe('MapperFetchError', () => {
  it('captures fetch error detail on the error instance', () => {
    const detail = {
      message: 'Request failed',
      status: 502,
      statusText: 'Bad Gateway',
      body: '{"error":"upstream"}',
    };
    const error = new MapperFetchError(detail);
    expect(error.name).toBe('MapperFetchError');
    expect(error.message).toBe('Request failed');
    expect(error.detail).toEqual(detail);
  });
});
