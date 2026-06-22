import { describe, it, expect } from 'vitest';
import { isLoopbackUrl, preferLocalhostHostname, resolveLoopbackUrl } from './loopbackUrl';

describe('loopbackUrl', () => {
  describe('isLoopbackUrl', () => {
    it('detects localhost and 127.0.0.1', () => {
      expect(isLoopbackUrl('http://localhost:4010/graphql')).toBe(true);
      expect(isLoopbackUrl('http://127.0.0.1:4010/graphql')).toBe(true);
      expect(isLoopbackUrl('http://api.example.com/graphql')).toBe(false);
    });
  });

  describe('resolveLoopbackUrl', () => {
    it('rewrites localhost to 127.0.0.1', () => {
      expect(resolveLoopbackUrl('http://localhost:4010/graphql')).toBe('http://127.0.0.1:4010/graphql');
    });

    it('leaves 127.0.0.1 unchanged', () => {
      expect(resolveLoopbackUrl('http://127.0.0.1:4010/graphql')).toBe('http://127.0.0.1:4010/graphql');
    });

    it('leaves remote hosts unchanged', () => {
      expect(resolveLoopbackUrl('https://api.example.com/graphql')).toBe('https://api.example.com/graphql');
    });
  });

  describe('preferLocalhostHostname', () => {
    it('rewrites 127.0.0.1 to localhost', () => {
      expect(preferLocalhostHostname('http://127.0.0.1:4010/graphql')).toBe('http://localhost:4010/graphql');
    });

    it('leaves localhost unchanged', () => {
      expect(preferLocalhostHostname('http://localhost:4010/graphql')).toBe('http://localhost:4010/graphql');
    });
  });
});
