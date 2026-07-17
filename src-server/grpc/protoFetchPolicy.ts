/**
 * Phase 3E — SSRF-safe URL policy for server-side proto fetches.
 */
import {
  ServerOutboundUrlPolicyError,
  validateServerOutboundUrl,
  validateServerOutboundUrlWithDns,
  type ServerOutboundDnsValidationOptions,
  type ServerOutboundUrlPolicyOptions,
} from './serverOutboundUrlPolicy.js';

export type ProtoFetchPolicyOptions = ServerOutboundUrlPolicyOptions;

export class ProtoFetchPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtoFetchPolicyError';
  }
}

export function validateProtoFetchUrl(
  rawUrl: string,
  options: ProtoFetchPolicyOptions = {},
): URL {
  try {
    return validateServerOutboundUrl(rawUrl, options);
  } catch (error) {
    if (error instanceof ServerOutboundUrlPolicyError) {
      throw new ProtoFetchPolicyError(error.message);
    }
    throw error;
  }
}

export async function validateProtoFetchUrlWithDns(
  rawUrl: string,
  options: ServerOutboundDnsValidationOptions = {},
): Promise<URL> {
  try {
    return await validateServerOutboundUrlWithDns(rawUrl, options);
  } catch (error) {
    if (error instanceof ServerOutboundUrlPolicyError) {
      throw new ProtoFetchPolicyError(error.message);
    }
    throw error;
  }
}

export function protoPathFromFetchUrl(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean);
  const basename = segments.at(-1) ?? 'fetched.proto';
  return basename.endsWith('.proto') ? basename : `${basename}.proto`;
}
