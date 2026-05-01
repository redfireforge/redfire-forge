/**
 * Webhook security utilities.
 *
 * Provides:
 * - HMAC signature generation and verification for webhook URLs
 * - Token-based webhook URL signing with expiration
 * - IP whitelist validation
 * - Request signature validation (for inbound webhooks from external services)
 */

import crypto from 'node:crypto';

// ── Configuration ────────────────────────────────────

/** Secret key for HMAC signing. Defaults to random per-process key. */
let hmacSecret: string = process.env.WEBHOOK_HMAC_SECRET ?? crypto.randomBytes(32).toString('hex');

/** IP whitelist (empty = allow all). */
let ipWhitelist: string[] = [];

/** Token expiration in ms. Default = 24h. 0 = no expiration. */
let tokenExpirationMs: number = parseInt(process.env.WEBHOOK_TOKEN_EXPIRY_MS ?? '86400000', 10);

/** Whether security is enabled. Default = false for dev. */
let securityEnabled: boolean = process.env.WEBHOOK_SECURITY_ENABLED === 'true';

// ── Config setters (for testing / DI) ────────────────

export function configureWebhookSecurity(opts: {
  secret?: string;
  ipWhitelist?: string[];
  tokenExpirationMs?: number;
  enabled?: boolean;
}): void {
  if (opts.secret !== undefined) hmacSecret = opts.secret;
  if (opts.ipWhitelist !== undefined) ipWhitelist = opts.ipWhitelist;
  if (opts.tokenExpirationMs !== undefined) tokenExpirationMs = opts.tokenExpirationMs;
  if (opts.enabled !== undefined) securityEnabled = opts.enabled;
}

export function isSecurityEnabled(): boolean {
  return securityEnabled;
}

// ── HMAC Signature ───────────────────────────────────

/**
 * Generate an HMAC-SHA256 signature for a given payload string.
 */
export function generateHmacSignature(payload: string): string {
  return crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature against a payload.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyHmacSignature(payload: string, signature: string): boolean {
  const expected = generateHmacSignature(payload);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

// ── Signed Webhook Tokens ────────────────────────────

export interface WebhookToken {
  /** The correlation ID this token is for. */
  correlationId: string;
  /** Webhook path. */
  webhookPath: string;
  /** Token creation timestamp (ms). */
  issuedAt: number;
  /** Token expiration timestamp (ms). 0 = no expiry. */
  expiresAt: number;
  /** HMAC signature of the token data. */
  signature: string;
}

/**
 * Generate a signed webhook token for a correlation.
 * The token can be included in webhook URLs to authenticate callbacks.
 */
export function generateWebhookToken(correlationId: string, webhookPath: string): WebhookToken {
  const issuedAt = Date.now();
  const expiresAt = tokenExpirationMs > 0 ? issuedAt + tokenExpirationMs : 0;
  const data = `${correlationId}:${webhookPath}:${issuedAt}:${expiresAt}`;
  const signature = generateHmacSignature(data);

  return { correlationId, webhookPath, issuedAt, expiresAt, signature };
}

/**
 * Verify a webhook token.
 * Checks signature validity and expiration.
 */
export function verifyWebhookToken(token: WebhookToken): { valid: boolean; reason?: string } {
  // Check expiration
  if (token.expiresAt > 0 && Date.now() > token.expiresAt) {
    return { valid: false, reason: 'Token expired' };
  }

  // Verify signature
  const data = `${token.correlationId}:${token.webhookPath}:${token.issuedAt}:${token.expiresAt}`;
  const expectedSig = generateHmacSignature(data);
  if (expectedSig.length !== token.signature.length) {
    return { valid: false, reason: 'Invalid signature' };
  }
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'hex'),
    Buffer.from(token.signature, 'hex'),
  );

  return isValid ? { valid: true } : { valid: false, reason: 'Invalid signature' };
}

/**
 * Generate a signed webhook URL.
 * The URL includes a query parameter with the encoded token.
 */
export function generateSignedWebhookUrl(
  baseUrl: string,
  correlationId: string,
  webhookPath: string,
): string {
  const token = generateWebhookToken(correlationId, webhookPath);
  const tokenStr = Buffer.from(JSON.stringify(token)).toString('base64url');
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}webhookToken=${tokenStr}`;
}

/**
 * Extract and verify a webhook token from a request query parameter.
 */
export function extractAndVerifyToken(
  queryToken: string | undefined,
  expectedCorrelationId: string,
  expectedWebhookPath: string,
): { valid: boolean; reason?: string } {
  if (!queryToken) {
    return { valid: false, reason: 'No webhook token provided' };
  }

  try {
    const decoded = Buffer.from(queryToken, 'base64url').toString('utf-8');
    const token: WebhookToken = JSON.parse(decoded);

    // Verify the token's own signature
    const sigCheck = verifyWebhookToken(token);
    if (!sigCheck.valid) return sigCheck;

    // Verify token matches the expected correlation
    if (token.correlationId !== expectedCorrelationId) {
      return { valid: false, reason: 'Token correlation ID mismatch' };
    }
    if (token.webhookPath !== expectedWebhookPath) {
      return { valid: false, reason: 'Token webhook path mismatch' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid token format' };
  }
}

// ── IP Whitelist ─────────────────────────────────────

/**
 * Check if a request IP is allowed.
 * Returns true if whitelist is empty (allow all) or IP is in the whitelist.
 */
export function isIpAllowed(ip: string | undefined): boolean {
  if (ipWhitelist.length === 0) return true;
  if (!ip) return false;

  // Normalize IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
  const normalizedIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  return ipWhitelist.some(allowed => {
    const normalizedAllowed = allowed.startsWith('::ffff:') ? allowed.slice(7) : allowed;
    // Support CIDR notation
    if (normalizedAllowed.includes('/')) {
      return isIpInCidr(normalizedIp, normalizedAllowed);
    }
    return normalizedIp === normalizedAllowed;
  });
}

/**
 * Check if an IP is within a CIDR range.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  if (ipNum === null || rangeNum === null) return false;

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

// ── Request Signature Validation ─────────────────────

/**
 * Validate an incoming webhook request's signature.
 * Supports common signature formats from external services.
 *
 * Checks headers: x-webhook-signature, x-hub-signature-256, x-signature
 */
export function validateRequestSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): { valid: boolean; reason?: string } {
  // Check for known signature headers
  const sigHeader = (
    headers['x-webhook-signature'] ??
    headers['x-hub-signature-256'] ??
    headers['x-signature']
  );

  if (!sigHeader) {
    // No signature header — only reject if security is enabled
    return securityEnabled
      ? { valid: false, reason: 'No signature header found' }
      : { valid: true };
  }

  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  // Handle "sha256=<hex>" format (GitHub-style)
  const hexSig = sig.startsWith('sha256=') ? sig.slice(7) : sig;

  return verifyHmacSignature(rawBody, hexSig)
    ? { valid: true }
    : { valid: false, reason: 'Signature verification failed' };
}
