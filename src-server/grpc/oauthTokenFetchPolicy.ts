/**
 * Phase 4 — SSRF-safe URL policy for server-side OAuth2 token endpoint fetches.
 */
import {
  ServerOutboundUrlPolicyError,
  validateServerOutboundUrl,
  validateServerOutboundUrlWithDns,
  type ServerOutboundDnsValidationOptions,
  type ServerOutboundUrlPolicyOptions,
} from './serverOutboundUrlPolicy.js';

export class OAuthTokenFetchPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthTokenFetchPolicyError';
  }
}

export function validateOAuthTokenUrl(
  rawUrl: string,
  options: ServerOutboundUrlPolicyOptions = {},
): URL {
  try {
    return validateServerOutboundUrl(rawUrl, options);
  } catch (error) {
    if (error instanceof ServerOutboundUrlPolicyError) {
      throw new OAuthTokenFetchPolicyError(error.message);
    }
    throw error;
  }
}

export async function validateOAuthTokenUrlWithDns(
  rawUrl: string,
  options: ServerOutboundDnsValidationOptions = {},
): Promise<URL> {
  try {
    return await validateServerOutboundUrlWithDns(rawUrl, options);
  } catch (error) {
    if (error instanceof ServerOutboundUrlPolicyError) {
      throw new OAuthTokenFetchPolicyError(error.message);
    }
    throw error;
  }
}
