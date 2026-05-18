import type { AuthConfig } from '../types';
import { resolveAuthHeaders } from './authHeaders';
import { acquireOAuth2Token } from '../../engine/tokenManager';

/**
 * Resolve auth config into headers and merge them into the provided headers object.
 * Handles OAuth2 token acquisition automatically.
 *
 * This is the canonical pattern for applying auth to request headers —
 * use this instead of manually calling acquireOAuth2Token + resolveAuthHeaders.
 *
 * @param auth - The auth configuration to apply
 * @param headers - Mutable headers object to merge auth headers into
 * @returns The same headers object with auth headers applied
 */
export async function applyAuthHeaders(
  auth: AuthConfig,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  if (auth.type === 'oauth2' && auth.tokenUrl) {
    const token = await acquireOAuth2Token(auth);
    Object.assign(headers, resolveAuthHeaders(auth, token));
  } else if (auth.type !== 'none' && auth.type !== 'inherit') {
    Object.assign(headers, resolveAuthHeaders(auth));
  }
  return headers;
}
