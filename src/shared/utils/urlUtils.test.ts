import { describe, it, expect } from 'vitest';
import { replaceHost } from './urlUtils';

describe('urlUtils', () => {
  describe('replaceHost', () => {
    it('returns original URL when baseUrl is empty', () => {
      expect(replaceHost('https://api.example.com/users', '')).toBe('https://api.example.com/users');
    });

    it('returns testUrl when baseUrl is nullish', () => {
      const url = 'https://api.example.com/users';
      expect(replaceHost(url, undefined as unknown as string)).toBe(url);
      expect(replaceHost(url, null as unknown as string)).toBe(url);
    });

    it('returns testUrl when base URL cannot be parsed', () => {
      const testUrl = 'https://api.example.com/users';
      expect(replaceHost(testUrl, 'not a valid base url')).toBe(testUrl);
    });

    it('replaces host with new base URL', () => {
      const result = replaceHost('https://api.example.com/users', 'https://new-api.example.com');
      expect(result).toBe('https://new-api.example.com/users');
    });

    it('handles base URL with trailing slash', () => {
      const result = replaceHost('https://api.example.com/users', 'https://new-api.example.com/');
      expect(result).toBe('https://new-api.example.com/users');
    });

    it('normalizes base URL without trailing slash before parsing', () => {
      const baseNoSlash = 'https://new-api.example.com';
      const baseWithSlash = `${baseNoSlash}/`;
      const path = '/v1/items';
      const a = replaceHost(`https://old.example.com${path}`, baseNoSlash);
      const b = replaceHost(`https://old.example.com${path}`, baseWithSlash);
      expect(a).toBe(b);
      expect(a).toBe(`https://new-api.example.com${path}`);
    });

    it('preserves protocol from base URL', () => {
      const result = replaceHost('http://api.example.com/users', 'https://secure-api.example.com');
      expect(result).toBe('https://secure-api.example.com/users');
    });

    it('preserves query parameters', () => {
      const result = replaceHost('https://api.example.com/users?limit=10&offset=0', 'https://new-api.example.com');
      expect(result).toContain('limit=10');
      expect(result).toContain('offset=0');
    });

    it('preserves hash fragments', () => {
      const result = replaceHost('https://api.example.com/page#section', 'https://new-api.example.com');
      expect(result).toContain('#section');
    });

    it('preserves {{template}} variables in path', () => {
      const result = replaceHost('https://api.example.com/users/{{userId}}', 'https://new-api.example.com');
      expect(result).toBe('https://new-api.example.com/users/{{userId}}');
    });

    it('preserves multiple {{template}} variables', () => {
      const result = replaceHost('https://api.example.com/{{resource}}/{{id}}/{{action}}', 'https://new-api.example.com');
      expect(result).toContain('{{resource}}');
      expect(result).toContain('{{id}}');
      expect(result).toContain('{{action}}');
    });

    it('restores each placeholder index after URL parsing', () => {
      const testUrl =
        'https://api.example.com/{{a}}/{{b}}?q={{c}}#{{d}}';
      const out = replaceHost(testUrl, 'https://new.example.com');
      expect(out).toContain('{{a}}');
      expect(out).toContain('{{b}}');
      expect(out).toContain('{{c}}');
      expect(out).toContain('{{d}}');
      expect(out).not.toContain('__TPL_');
    });

    it('preserves {{template}} variables in query params', () => {
      const result = replaceHost('https://api.example.com/users?token={{apiToken}}', 'https://new-api.example.com');
      expect(result).toContain('{{apiToken}}');
    });

    it('handles base path in base URL', () => {
      const result = replaceHost('https://api.example.com/users', 'https://new-api.example.com/v2');
      expect(result).toBe('https://new-api.example.com/v2/users');
    });

    it('avoids duplicating base path if already present', () => {
      const result = replaceHost('https://api.example.com/v2/users', 'https://new-api.example.com/v2');
      expect(result).toBe('https://new-api.example.com/v2/users');
    });

    it('merges base path when original pathname does not start with it', () => {
      const result = replaceHost('https://api.example.com/users', 'https://new-api.example.com/api/v99');
      expect(result).toBe('https://new-api.example.com/api/v99/users');
    });

    it('handles base URL with multiple path segments', () => {
      const result = replaceHost('https://api.example.com/users', 'https://new-api.example.com/api/v3');
      expect(result).toBe('https://new-api.example.com/api/v3/users');
    });

    it('returns original URL for invalid URL', () => {
      const invalidUrl = 'not-a-valid-url';
      expect(replaceHost(invalidUrl, 'https://api.example.com')).toBe(invalidUrl);
    });

    it('handles port numbers in base URL', () => {
      const result = replaceHost('https://api.example.com/users', 'http://localhost:3000');
      expect(result).toContain('localhost:3000');
    });

    it('handles different protocols', () => {
      const result = replaceHost('https://api.example.com/data', 'http://dev.example.com');
      expect(result).toBe('http://dev.example.com/data');
    });
  });
});
