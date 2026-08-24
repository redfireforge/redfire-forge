import { describe, it, expect } from 'vitest';
import { sseSampleCatalog } from './index';

describe('sseSampleCatalog', () => {
  it('has 4 entries', () => {
    expect(sseSampleCatalog).toHaveLength(4);
  });

  it('every entry has a unique id', () => {
    const ids = sseSampleCatalog.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has domain "sse"', () => {
    for (const entry of sseSampleCatalog) {
      expect(entry.domain).toBe('sse');
    }
  });

  it('every entry has at least one eventType', () => {
    for (const entry of sseSampleCatalog) {
      expect(entry.eventTypes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has a valid category', () => {
    const validCategories = new Set(['public-feed', 'auth', 'json-events', 'retry']);
    for (const entry of sseSampleCatalog) {
      expect(validCategories.has(entry.category)).toBe(true);
    }
  });

  it('every factory returns a valid SseConnectionConfig', () => {
    for (const entry of sseSampleCatalog) {
      const config = entry.factory();
      expect(typeof config.url).toBe('string');
      expect(config.url.length).toBeGreaterThan(0);
      expect(Array.isArray(config.headers)).toBe(true);
      expect(typeof config.autoReconnect).toBe('boolean');
      expect(typeof config.maxRetries).toBe('number');
    }
  });

  it('sse-public-echo factory returns sse.dev url with no headers', () => {
    const entry = sseSampleCatalog.find(e => e.id === 'sse-public-echo')!;
    const config = entry.factory();
    expect(config.url).toBe('https://sse.dev/test');
    expect(config.headers).toHaveLength(0);
    expect(config.autoReconnect).toBe(true);
    expect(config.maxRetries).toBe(5);
  });

  it('sse-hacker-news-updates factory returns firebase url with Accept header', () => {
    const entry = sseSampleCatalog.find(e => e.id === 'sse-hacker-news-updates')!;
    const config = entry.factory();
    expect(config.url).toContain('hacker-news.firebaseio.com');
    expect(config.headers).toHaveLength(1);
    expect(config.headers[0]?.key).toBe('Accept');
    expect(config.headers[0]?.value).toBe('text/event-stream');
    expect(config.maxRetries).toBe(5);
  });

  it('sse-auth-bearer factory returns Authorization + Accept headers', () => {
    const entry = sseSampleCatalog.find(e => e.id === 'sse-auth-bearer')!;
    const config = entry.factory();
    expect(config.url).toContain('example.com');
    expect(config.headers).toHaveLength(2);
    const authHeader = config.headers.find(h => h.key === 'Authorization');
    expect(authHeader?.value).toContain('Bearer');
    expect(config.maxRetries).toBe(3);
  });

  it('sse-retry-reconnect factory returns maxRetries=10', () => {
    const entry = sseSampleCatalog.find(e => e.id === 'sse-retry-reconnect')!;
    const config = entry.factory();
    expect(config.url).toBe('https://sse.dev/test');
    expect(config.autoReconnect).toBe(true);
    expect(config.maxRetries).toBe(10);
  });

  it('public entries include liveApis', () => {
    const publicEntry = sseSampleCatalog.find(e => e.id === 'sse-public-echo')!;
    expect(publicEntry.liveApis).toContain('sse.dev');

    const hnEntry = sseSampleCatalog.find(e => e.id === 'sse-hacker-news-updates')!;
    expect(hnEntry.liveApis.length).toBeGreaterThan(0);
  });

  it('auth entry has empty liveApis (template only)', () => {
    const authEntry = sseSampleCatalog.find(e => e.id === 'sse-auth-bearer')!;
    expect(authEntry.liveApis).toHaveLength(0);
  });
});
