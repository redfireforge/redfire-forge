import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_MESSAGES,
  PROXY_POLL_INTERVAL_MS,
  DEFAULT_RECONNECT_INTERVAL_MS,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  formatCloseFrame,
} from './useWebSocketStudioTypes';

describe('useWebSocketStudioTypes', () => {
  describe('constants', () => {
    it('exports expected default values', () => {
      expect(DEFAULT_MAX_MESSAGES).toBe(1000);
      expect(PROXY_POLL_INTERVAL_MS).toBe(200);
      expect(DEFAULT_RECONNECT_INTERVAL_MS).toBe(3000);
      expect(DEFAULT_MAX_RECONNECT_ATTEMPTS).toBe(5);
    });
  });

  describe('formatCloseFrame', () => {
    it('formats SENT direction with code label', () => {
      const result = formatCloseFrame('SENT', 1000);
      expect(result).toContain('CLOSE SENT');
      expect(result).toContain('1000');
      expect(result).toContain('Normal');
    });

    it('formats ACK direction with code label', () => {
      const result = formatCloseFrame('ACK', 1001);
      expect(result).toContain('CLOSE ACK');
      expect(result).toContain('1001');
      expect(result).toContain('Going Away');
    });

    it('includes reason when provided', () => {
      const result = formatCloseFrame('SENT', 1000, 'User disconnected');
      expect(result).toContain('reason: "User disconnected"');
    });

    it('omits reason when not provided', () => {
      const result = formatCloseFrame('ACK', 1006);
      expect(result).not.toContain('reason:');
    });

    it('handles unknown close codes', () => {
      const result = formatCloseFrame('SENT', 4999, 'Custom');
      expect(result).toContain('4999');
      expect(result).toContain('reason: "Custom"');
    });
  });
});
