import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultSseConfig,
  createSseEvent,
  resetSseIdCounter,
} from './sseTypes';

describe('sseTypes', () => {
  describe('createDefaultSseConfig', () => {
    it('returns a config with empty url', () => {
      const config = createDefaultSseConfig();
      expect(config.url).toBe('');
    });

    it('returns empty headers array', () => {
      const config = createDefaultSseConfig();
      expect(config.headers).toEqual([]);
    });

    it('returns autoReconnect true', () => {
      const config = createDefaultSseConfig();
      expect(config.autoReconnect).toBe(true);
    });

    it('returns maxRetries of 10', () => {
      const config = createDefaultSseConfig();
      expect(config.maxRetries).toBe(10);
    });
  });

  describe('createSseEvent', () => {
    beforeEach(() => {
      resetSseIdCounter();
    });

    it('creates an event with the given type and data', () => {
      const event = createSseEvent('message', 'hello', '');
      expect(event.eventType).toBe('message');
      expect(event.data).toBe('hello');
    });

    it('assigns a unique id', () => {
      const e1 = createSseEvent('msg', 'a', '');
      const e2 = createSseEvent('msg', 'b', '');
      expect(e1.id).not.toBe(e2.id);
    });

    it('includes lastEventId', () => {
      const event = createSseEvent('msg', 'data', 'evt-42');
      expect(event.lastEventId).toBe('evt-42');
    });

    it('calculates byte size correctly', () => {
      const event = createSseEvent('msg', 'hello', '');
      expect(event.size).toBe(5);
    });

    it('handles multi-byte characters', () => {
      const event = createSseEvent('msg', '日本語', '');
      // 3 CJK chars * 3 bytes each = 9
      expect(event.size).toBe(9);
    });

    it('includes a valid ISO timestamp', () => {
      const event = createSseEvent('msg', 'data', '');
      expect(new Date(event.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('resetSseIdCounter', () => {
    it('resets the id counter so IDs start from 1 again', () => {
      createSseEvent('msg', 'a', '');
      createSseEvent('msg', 'b', '');
      resetSseIdCounter();
      const event = createSseEvent('msg', 'c', '');
      // After reset, id should contain "sse-1-"
      expect(event.id).toMatch(/^sse-1-/);
    });
  });
});
