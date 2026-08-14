/**
 * API Mock Studio — TLS/HTTPS contracts (Phase 10A).
 * Capability-gated settings for HTTPS and mTLS listeners.
 */

export interface ApiMockTlsSettingsV1 {
  _capabilityPhase: 10;
  enabled: boolean;
  certSource: 'generated' | 'imported';
  certPem?: string;
  keyPem?: string;
  caCertPem?: string;
  minTlsVersion?: '1.2' | '1.3';
  clientAuth?: 'none' | 'request' | 'require';
}

export interface ApiMockTlsStatus {
  enabled: boolean;
  certSource: 'generated' | 'imported';
  certSubject?: string;
  certExpiry?: string;
  certFingerprint?: string;
  clientAuth: 'none' | 'request' | 'require';
  minTlsVersion: string;
}

export interface ApiMockCertificateValidation {
  valid: boolean;
  errors: string[];
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  fingerprint?: string;
}

export const TLS_DEFAULTS: Omit<ApiMockTlsSettingsV1, '_capabilityPhase'> = {
  enabled: false,
  certSource: 'generated',
  clientAuth: 'none',
  minTlsVersion: '1.2',
};

/** Validate that PEM content does not contain private keys in export/log contexts. */
export function containsPrivateKey(pem: string): boolean {
  return pem.includes('PRIVATE KEY');
}

/** Redact PEM certificate material for traces/exports. */
export function redactPemForTrace(pem: string): string {
  return pem.replace(/(-----BEGIN[^-]+-----)[\s\S]*?(-----END[^-]+-----)/g, '$1\n[REDACTED]\n$2');
}

/** Extract subject CN from a PEM certificate (simple regex, not a full parser). */
export function extractSubjectCN(certPem: string): string | undefined {
  const match = certPem.match(/subject.*?CN\s*=\s*([^\n/,]+)/i);
  return match?.[1]?.trim();
}

/** Validate basic certificate PEM structure. */
export function validateCertPem(certPem: string | undefined): ApiMockCertificateValidation {
  if (!certPem || !certPem.trim()) {
    return { valid: false, errors: ['Certificate PEM is empty'] };
  }
  if (!certPem.includes('-----BEGIN CERTIFICATE-----')) {
    return { valid: false, errors: ['Missing BEGIN CERTIFICATE marker'] };
  }
  if (!certPem.includes('-----END CERTIFICATE-----')) {
    return { valid: false, errors: ['Missing END CERTIFICATE marker'] };
  }
  const subject = extractSubjectCN(certPem);
  return { valid: true, errors: [], subject };
}

/** Validate basic private key PEM structure. */
export function validateKeyPem(keyPem: string | undefined): { valid: boolean; errors: string[] } {
  if (!keyPem || !keyPem.trim()) {
    return { valid: false, errors: ['Private key PEM is empty'] };
  }
  if (!keyPem.includes('PRIVATE KEY')) {
    return { valid: false, errors: ['Missing PRIVATE KEY marker'] };
  }
  return { valid: true, errors: [] };
}
