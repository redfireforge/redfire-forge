import { describe, expect, it } from 'vitest';
import { protocolHint, statusChipClass } from './protocolPanelUtils';

describe('protocolPanelUtils', () => {
  it('maps endpoint row statuses to chip classes', () => {
    expect(statusChipClass('explicit')).toBe('em-url-status--ok');
    expect(statusChipClass('fallback')).toBe('em-url-status--fallback');
    expect(statusChipClass('unresolved')).toBe('em-url-status--unresolved');
    expect(statusChipClass('empty')).toBe('em-url-status--empty');
  });

  it('returns protocol hints and empty string for unknown keys', () => {
    expect(protocolHint('grpc')).toContain('gRPC');
    expect(protocolHint('http')).toContain('REST');
    expect(protocolHint('unknown' as never)).toBe('');
  });
});
