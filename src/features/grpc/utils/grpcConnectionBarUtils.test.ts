import { describe, expect, it } from 'vitest';
import {
  formatGrpcDeadlineLabel,
  isGrpcAuthConfigured,
  resolveGrpcAuthBadgeLabel,
  resolveGrpcConnectionDotModifier,
  resolveGrpcConnectionToggleLabel,
  resolveGrpcTlsBadgePresentation,
} from './grpcConnectionBarUtils';

describe('grpcConnectionBarUtils', () => {
  describe('resolveGrpcTlsBadgePresentation', () => {
    it('maps tls modes to badge labels', () => {
      expect(resolveGrpcTlsBadgePresentation('disabled', true)).toEqual({
        label: 'Plaintext',
        variant: 'plain',
        icon: '🔓',
      });
      expect(resolveGrpcTlsBadgePresentation('tls', true)).toEqual({
        label: 'TLS',
        variant: 'tls',
        icon: '🔒',
      });
      expect(resolveGrpcTlsBadgePresentation('mtls', true)).toEqual({
        label: 'mTLS',
        variant: 'mtls',
        icon: '🛡',
      });
    });

    it('shows invalid variant when tls config fails validation', () => {
      expect(resolveGrpcTlsBadgePresentation('tls', false)).toEqual({
        label: 'TLS invalid',
        variant: 'invalid',
        icon: '🔒',
      });
    });
  });

  describe('resolveGrpcAuthBadgeLabel', () => {
    it('returns None when auth is unset', () => {
      expect(resolveGrpcAuthBadgeLabel(undefined)).toBe('Auth: None');
      expect(resolveGrpcAuthBadgeLabel({ type: 'none' })).toBe('Auth: None');
    });

    it('returns configured auth type label', () => {
      expect(resolveGrpcAuthBadgeLabel({ type: 'bearer', bearerToken: 'x' })).toBe('Auth: Bearer');
      expect(resolveGrpcAuthBadgeLabel({ type: 'oauth2', tokenUrl: 'u', clientId: 'c' })).toBe('Auth: OAuth2');
    });
  });

  describe('isGrpcAuthConfigured', () => {
    it('detects configured auth', () => {
      expect(isGrpcAuthConfigured(undefined)).toBe(false);
      expect(isGrpcAuthConfigured({ type: 'none' })).toBe(false);
      expect(isGrpcAuthConfigured({ type: 'bearer', bearerToken: 't' })).toBe(true);
    });
  });

  describe('formatGrpcDeadlineLabel', () => {
    it('formats common timeout values', () => {
      expect(formatGrpcDeadlineLabel(30_000)).toBe('30s');
      expect(formatGrpcDeadlineLabel(60_000)).toBe('1m');
      expect(formatGrpcDeadlineLabel(1500)).toBe('1500ms');
    });
  });

  describe('connection probe presentation', () => {
    it('maps session state to dot modifier and toggle label', () => {
      expect(resolveGrpcConnectionDotModifier(undefined)).toBe('idle');
      expect(resolveGrpcConnectionDotModifier({ state: 'connected' })).toBe('connected');
      expect(resolveGrpcConnectionToggleLabel({ state: 'connected' })).toBe('Disconnect');
      expect(resolveGrpcConnectionToggleLabel({ state: 'connecting' })).toBe('Cancel');
      expect(resolveGrpcConnectionToggleLabel(undefined)).toBe('Connect');
    });
  });
});
