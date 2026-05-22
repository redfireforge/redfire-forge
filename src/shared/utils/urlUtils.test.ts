import { describe, it, expect } from 'vitest';
import { replaceHost } from './urlUtils';

describe('urlUtils', () => {
  describe('replaceHost', () => {
    // --- Passthrough cases (no base URL or absolute URL) ---
    it('returns original URL when baseUrl is empty', () => {
      expect(replaceHost('https://api.example.com/users', '')).toBe('https://api.example.com/users');
    });

    it('returns testUrl when baseUrl is nullish', () => {
      const url = 'https://api.example.com/users';
      expect(replaceHost(url, undefined as unknown as string)).toBe(url);
      expect(replaceHost(url, null as unknown as string)).toBe(url);
    });

    it('preserves absolute https URLs unchanged (does NOT replace host)', () => {
      const absoluteUrl = 'https://httpbin.org/status/204';
      const result = replaceHost(absoluteUrl, 'https://jsonplaceholder.typicode.com');
      expect(result).toBe(absoluteUrl);
    });

    it('preserves absolute http URLs unchanged', () => {
      const absoluteUrl = 'http://httpbin.org/delay/1';
      const result = replaceHost(absoluteUrl, 'https://api.example.com');
      expect(result).toBe(absoluteUrl);
    });

    // --- Relative path cases ---
    it('prepends base URL to relative path starting with /', () => {
      const result = replaceHost('/users', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/users');
    });

    it('prepends base URL to relative path without leading /', () => {
      const result = replaceHost('users/123', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/users/123');
    });

    it('handles base URL with trailing slash', () => {
      const result = replaceHost('/users', 'https://api.example.com/');
      expect(result).toBe('https://api.example.com/users');
    });

    it('normalizes base URL without trailing slash', () => {
      const baseNoSlash = 'https://api.example.com';
      const baseWithSlash = `${baseNoSlash}/`;
      const a = replaceHost('/v1/items', baseNoSlash);
      const b = replaceHost('/v1/items', baseWithSlash);
      expect(a).toBe(b);
      expect(a).toBe('https://api.example.com/v1/items');
    });

    it('preserves query parameters on relative URLs', () => {
      const result = replaceHost('/users?limit=10&offset=0', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/users?limit=10&offset=0');
    });

    it('preserves hash fragments on relative URLs', () => {
      const result = replaceHost('/page#section', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/page#section');
    });

    it('preserves {{template}} variables in relative path', () => {
      const result = replaceHost('/users/{{userId}}', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/users/{{userId}}');
    });

    it('preserves multiple {{template}} variables in relative path', () => {
      const result = replaceHost('/{{resource}}/{{id}}/{{action}}', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/{{resource}}/{{id}}/{{action}}');
    });

    it('restores each placeholder index after URL parsing', () => {
      const relUrl = '/{{a}}/{{b}}?q={{c}}#{{d}}';
      const out = replaceHost(relUrl, 'https://api.example.com');
      expect(out).toContain('{{a}}');
      expect(out).toContain('{{b}}');
      expect(out).toContain('{{c}}');
      expect(out).toContain('{{d}}');
      expect(out).not.toContain('__TPL_');
    });

    it('preserves {{template}} variables in query params', () => {
      const result = replaceHost('/users?token={{apiToken}}', 'https://api.example.com');
      expect(result).toContain('{{apiToken}}');
    });

    it('handles base path in base URL', () => {
      const result = replaceHost('/users', 'https://api.example.com/v2');
      expect(result).toBe('https://api.example.com/v2/users');
    });

    it('handles base URL with multiple path segments', () => {
      const result = replaceHost('/users', 'https://api.example.com/api/v3');
      expect(result).toBe('https://api.example.com/api/v3/users');
    });

    it('treats invalid-looking paths as relative (no fallback needed)', () => {
      // Even strange-looking paths get treated as relative paths and prepended
      const strangePath = '://invalid';
      const result = replaceHost(strangePath, 'https://api.example.com');
      expect(result).toBe('https://api.example.com/://invalid');
    });

    it('handles port numbers in base URL', () => {
      const result = replaceHost('/users', 'http://localhost:3000');
      expect(result).toBe('http://localhost:3000/users');
    });

    it('uses protocol from base URL', () => {
      const result = replaceHost('/data', 'http://dev.example.com');
      expect(result).toBe('http://dev.example.com/data');
    });

    // --- Edge case: empty path ---
    it('handles empty relative path', () => {
      const result = replaceHost('', 'https://api.example.com');
      expect(result).toBe('https://api.example.com/');
    });
  });
});
