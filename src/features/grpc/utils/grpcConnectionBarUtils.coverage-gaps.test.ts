import { describe, expect, it } from 'vitest';
import {
  formatGrpcDeadlineLabel,
  resolveGrpcAuthBadgeLabel,
  resolveGrpcTlsBadgePresentation,
} from './grpcConnectionBarUtils';

describe('grpcConnectionBarUtils coverage gaps', () => {
  it('resolveGrpcTlsBadgePresentation keeps plaintext when invalid but disabled', () => {
    expect(resolveGrpcTlsBadgePresentation('disabled', false)).toEqual({
      label: 'Plaintext',
      variant: 'plain',
      icon: '🔓',
    });
  });

  it('resolveGrpcAuthBadgeLabel covers basic and api_key types', () => {
    expect(resolveGrpcAuthBadgeLabel({ type: 'basic', username: 'u', password: 'p' })).toBe('Auth: Basic');
    expect(resolveGrpcAuthBadgeLabel({ type: 'api_key', headerName: 'X-Key', apiKey: 'k' })).toBe('Auth: API Key');
  });

  it('formatGrpcDeadlineLabel handles edge timeout values', () => {
    expect(formatGrpcDeadlineLabel(0)).toBe('No deadline');
    expect(formatGrpcDeadlineLabel(-1)).toBe('No deadline');
    expect(formatGrpcDeadlineLabel(Number.NaN)).toBe('No deadline');
    expect(formatGrpcDeadlineLabel(1000)).toBe('1s');
    expect(formatGrpcDeadlineLabel(2000)).toBe('2s');
    expect(formatGrpcDeadlineLabel(120_000)).toBe('2m');
    expect(formatGrpcDeadlineLabel(1500)).toBe('1500ms');
  });
});
