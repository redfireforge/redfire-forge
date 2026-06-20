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
  });
});
