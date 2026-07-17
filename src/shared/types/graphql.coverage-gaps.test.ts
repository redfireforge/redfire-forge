import { describe, it, expect } from 'vitest';
import {
  GraphqlAssertionError,
  ScriptAbortError,
  ScriptSkipError,
} from './graphql';

describe('graphql types — runtime error classes', () => {
  it('ScriptAbortError uses default and custom messages', () => {
    expect(new ScriptAbortError().message).toBe('Script aborted');
    expect(new ScriptAbortError('stop now').message).toBe('stop now');
    expect(new ScriptAbortError().name).toBe('ScriptAbortError');
  });

  it('ScriptSkipError uses default and custom messages', () => {
    expect(new ScriptSkipError().message).toBe('Script requested skip');
    expect(new ScriptSkipError('skip step').message).toBe('skip step');
    expect(new ScriptSkipError().name).toBe('ScriptSkipError');
  });

  it('GraphqlAssertionError uses default and custom messages', () => {
    expect(new GraphqlAssertionError().message).toBe('Assertion failed');
    expect(new GraphqlAssertionError('bad field').message).toBe('bad field');
    expect(new GraphqlAssertionError().name).toBe('GraphqlAssertionError');
  });
});
