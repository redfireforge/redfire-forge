import { describe, it, expect } from 'vitest';
import { getProtocolInfo, PROTOCOL_REGISTRY } from './protocolTypes';

describe('protocolTypes', () => {
  describe('getProtocolInfo', () => {
    it('returns matching protocol info for known mode', () => {
      expect(getProtocolInfo('stomp')).toEqual(
        PROTOCOL_REGISTRY.find((p) => p.id === 'stomp'),
      );
    });

    it('falls back to auto-detect for unknown mode', () => {
      expect(getProtocolInfo('unknown' as 'auto')).toEqual(PROTOCOL_REGISTRY[0]);
      expect(getProtocolInfo('unknown' as 'auto').id).toBe('auto');
    });

    it('returns auto protocol info', () => {
      const info = getProtocolInfo('auto');
      expect(info.id).toBe('auto');
      expect(info.available).toBe(true);
    });

    it('returns raw protocol info', () => {
      const info = getProtocolInfo('raw');
      expect(info.id).toBe('raw');
      expect(info.available).toBe(true);
    });

    it('returns socket-io protocol info', () => {
      const info = getProtocolInfo('socket-io');
      expect(info.id).toBe('socket-io');
      expect(info.available).toBe(true);
    });

    it('returns graphql-ws protocol info', () => {
      const info = getProtocolInfo('graphql-ws');
      expect(info.id).toBe('graphql-ws');
      expect(info.available).toBe(true);
    });
  });

  describe('PROTOCOL_REGISTRY', () => {
    it('has 5 entries', () => {
      expect(PROTOCOL_REGISTRY).toHaveLength(5);
    });

    it('all entries have required fields', () => {
      for (const p of PROTOCOL_REGISTRY) {
        expect(p.id).toBeTruthy();
        expect(p.label).toBeTruthy();
        expect(p.description).toBeTruthy();
        expect(typeof p.available).toBe('boolean');
      }
    });
  });
});
