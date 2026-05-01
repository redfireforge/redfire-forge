import type { AuthConfig } from '../types';

/**
 * Build authorization headers from an AuthConfig.
 * This is the single source of truth for auth → header mapping.
 *
 * @param auth - The auth configuration
 * @param oauth2Token - Pre-acquired OAuth2 token (callers handle token acquisition)
 * @returns Record of header name → value for auth headers only
 */
export function resolveAuthHeaders(auth: AuthConfig, oauth2Token?: string): Record<string, string> {
  const headers: Record<string, string> = {};

  if (auth.type === 'basic' && auth.username) {
    headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password ?? ''}`)}`;
  } else if (auth.type === 'bearer' && auth.token) {
    const prefix = auth.prefix?.trim() || 'Bearer';
    headers['Authorization'] = `${prefix} ${auth.token}`;
  } else if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn === 'header') {
    headers[auth.apiKeyName] = auth.apiKeyValue;
  } else if (auth.type === 'digest' && auth.username) {
    headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password ?? ''}`)}`;
  } else if (auth.type === 'oauth2' && oauth2Token) {
    headers['Authorization'] = `Bearer ${oauth2Token}`;
  }

  return headers;
}
