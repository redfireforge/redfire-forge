/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureWebhookSecurity,
  generateHmacSignature,
  verifyHmacSignature,
  generateWebhookToken,
  verifyWebhookToken,
  generateSignedWebhookUrl,
  extractAndVerifyToken,
  isIpAllowed,
  validateRequestSignature,
  isSecurityEnabled,
} from './webhook-security';

describe('webhook-security', () => {
  beforeEach(() => {
    configureWebhookSecurity({
      secret: 'test-secret-key-12345',
      ipWhitelist: [],
      tokenExpirationMs: 3600000, // 1h
      enabled: true,
    });
  });

  // ── HMAC Signature ──

  describe('HMAC Signature', () => {
    it('generates deterministic signatures', () => {
      const sig1 = generateHmacSignature('hello');
      const sig2 = generateHmacSignature('hello');
      expect(sig1).toBe(sig2);
    });

    it('generates different signatures for different payloads', () => {
      const sig1 = generateHmacSignature('hello');
      const sig2 = generateHmacSignature('world');
      expect(sig1).not.toBe(sig2);
    });

    it('verifies valid signature', () => {
      const sig = generateHmacSignature('test payload');
      expect(verifyHmacSignature('test payload', sig)).toBe(true);
    });

    it('rejects invalid signature', () => {
      const sig = generateHmacSignature('test payload');
      expect(verifyHmacSignature('modified payload', sig)).toBe(false);
    });

    it('rejects wrong-length signature', () => {
      expect(verifyHmacSignature('test', 'abc')).toBe(false);
    });
  });

  // ── Webhook Token ──

  describe('Webhook Token', () => {
    it('generates token with correlationId and webhookPath', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      expect(token.correlationId).toBe('corr-123');
      expect(token.webhookPath).toBe('/webhooks/callback/payment');
      expect(token.issuedAt).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(token.issuedAt);
      expect(token.signature).toBeTruthy();
    });

    it('verifies valid token', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      expect(verifyWebhookToken(token)).toEqual({ valid: true });
    });

    it('rejects tampered token', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      token.correlationId = 'hacked';
      const result = verifyWebhookToken(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('signature');
    });

    it('rejects token when signature hex length mismatches expected', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      token.signature = 'abcd';
      const result = verifyWebhookToken(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('rejects expired token', () => {
      configureWebhookSecurity({ tokenExpirationMs: 1 });
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      // Force expiration
      token.expiresAt = Date.now() - 1000;
      // Re-sign with correct expiration to test expiry check (not signature check)
      const result = verifyWebhookToken(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token expired');
    });

    it('handles no-expiration tokens', () => {
      configureWebhookSecurity({ tokenExpirationMs: 0 });
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      expect(token.expiresAt).toBe(0);
      expect(verifyWebhookToken(token)).toEqual({ valid: true });
    });
  });

  // ── Signed URL ──

  describe('Signed URL', () => {
    it('generates URL with token parameter', () => {
      const url = generateSignedWebhookUrl(
        'http://localhost:3001/webhooks/callback/payment',
        'corr-123',
        '/webhooks/callback/payment',
      );
      expect(url).toContain('webhookToken=');
      expect(url).toContain('http://localhost:3001/webhooks/callback/payment?');
    });

    it('appends with & if URL already has query params', () => {
      const url = generateSignedWebhookUrl(
        'http://localhost:3001/webhooks/callback/payment?foo=bar',
        'corr-123',
        '/webhooks/callback/payment',
      );
      expect(url).toContain('&webhookToken=');
    });
  });

  // ── Extract & Verify Token ──

  describe('extractAndVerifyToken', () => {
    it('returns invalid if no token provided', () => {
      const result = extractAndVerifyToken(undefined, 'corr-123', '/path');
      expect(result.valid).toBe(false);
    });

    it('verifies valid token from query param', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      const encoded = Buffer.from(JSON.stringify(token)).toString('base64url');
      const result = extractAndVerifyToken(encoded, 'corr-123', '/webhooks/callback/payment');
      expect(result.valid).toBe(true);
    });

    it('rejects token with wrong correlationId', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      const encoded = Buffer.from(JSON.stringify(token)).toString('base64url');
      const result = extractAndVerifyToken(encoded, 'wrong-id', '/webhooks/callback/payment');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('correlation ID mismatch');
    });

    it('rejects token with wrong webhookPath', () => {
      const token = generateWebhookToken('corr-123', '/webhooks/callback/payment');
      const encoded = Buffer.from(JSON.stringify(token)).toString('base64url');
      const result = extractAndVerifyToken(encoded, 'corr-123', '/webhooks/callback/other');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('webhook path mismatch');
    });

    it('rejects malformed token', () => {
      const result = extractAndVerifyToken('not-valid-base64!!!', 'corr-123', '/path');
      expect(result.valid).toBe(false);
    });
  });

  // ── IP Whitelist ──

  describe('IP Whitelist', () => {
    it('allows all IPs when whitelist is empty', () => {
      configureWebhookSecurity({ ipWhitelist: [] });
      expect(isIpAllowed('192.168.1.1')).toBe(true);
      expect(isIpAllowed('10.0.0.1')).toBe(true);
    });

    it('allows IPs in whitelist', () => {
      configureWebhookSecurity({ ipWhitelist: ['192.168.1.1', '10.0.0.1'] });
      expect(isIpAllowed('192.168.1.1')).toBe(true);
      expect(isIpAllowed('10.0.0.1')).toBe(true);
    });

    it('rejects IPs not in whitelist', () => {
      configureWebhookSecurity({ ipWhitelist: ['192.168.1.1'] });
      expect(isIpAllowed('10.0.0.1')).toBe(false);
    });

    it('handles IPv6-mapped IPv4', () => {
      configureWebhookSecurity({ ipWhitelist: ['127.0.0.1'] });
      expect(isIpAllowed('::ffff:127.0.0.1')).toBe(true);
    });

    it('supports CIDR notation', () => {
      configureWebhookSecurity({ ipWhitelist: ['192.168.1.0/24'] });
      expect(isIpAllowed('192.168.1.50')).toBe(true);
      expect(isIpAllowed('192.168.1.255')).toBe(true);
      expect(isIpAllowed('192.168.2.1')).toBe(false);
    });

    it('rejects CIDR with invalid prefix length', () => {
      configureWebhookSecurity({ ipWhitelist: ['10.0.0.0/99'] });
      expect(isIpAllowed('10.0.0.1')).toBe(false);
    });

    it('treats 0.0.0.0/0 as matching any IPv4', () => {
      configureWebhookSecurity({ ipWhitelist: ['0.0.0.0/0'] });
      expect(isIpAllowed('8.8.8.8')).toBe(true);
    });

    it('rejects undefined IP', () => {
      configureWebhookSecurity({ ipWhitelist: ['192.168.1.1'] });
      expect(isIpAllowed(undefined)).toBe(false);
    });
  });

  // ── Request Signature Validation ──

  describe('Request Signature Validation', () => {
    it('accepts request with valid x-webhook-signature', () => {
      const body = '{"test": true}';
      const sig = generateHmacSignature(body);
      const result = validateRequestSignature(body, { 'x-webhook-signature': sig });
      expect(result.valid).toBe(true);
    });

    it('accepts GitHub-style sha256= prefix', () => {
      const body = '{"test": true}';
      const sig = generateHmacSignature(body);
      const result = validateRequestSignature(body, { 'x-hub-signature-256': `sha256=${sig}` });
      expect(result.valid).toBe(true);
    });

    it('accepts x-signature header when present', () => {
      const body = '{"x":1}';
      const sig = generateHmacSignature(body);
      const result = validateRequestSignature(body, { 'x-signature': sig });
      expect(result.valid).toBe(true);
    });

    it('uses first signature value when header is an array', () => {
      const body = '{"a":true}';
      const sig = generateHmacSignature(body);
      const result = validateRequestSignature(body, { 'x-webhook-signature': [sig, 'ignored'] });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid signature', () => {
      const result = validateRequestSignature('body', { 'x-webhook-signature': 'a'.repeat(64) });
      expect(result.valid).toBe(false);
    });

    it('rejects missing signature when security enabled', () => {
      configureWebhookSecurity({ enabled: true });
      const result = validateRequestSignature('body', {});
      expect(result.valid).toBe(false);
    });

    it('accepts missing signature when security disabled', () => {
      configureWebhookSecurity({ enabled: false });
      const result = validateRequestSignature('body', {});
      expect(result.valid).toBe(true);
    });
  });

  // ── isSecurityEnabled ──

  describe('isSecurityEnabled', () => {
    it('returns configured state', () => {
      configureWebhookSecurity({ enabled: true });
      expect(isSecurityEnabled()).toBe(true);
      configureWebhookSecurity({ enabled: false });
      expect(isSecurityEnabled()).toBe(false);
    });
  });
});
