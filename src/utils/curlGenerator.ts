import { acquireOAuth2Token } from '../engine/executor';
import type { AuthConfig, Scenario } from '../types';

/**
 * Build a cURL command string for the given scenario and resolved effective auth.
 */
export async function buildCurlCommand(scenario: Scenario, effectiveAuth: AuthConfig): Promise<string> {
  const parts: string[] = ['curl'];

  if (scenario.method !== 'GET') {
    parts.push(`-X ${scenario.method}`);
  }

  parts.push(`'${scenario.url}'`);

  const headerEntries: { key: string; value: string }[] = [];

  for (const h of scenario.headers) {
    if (!h.key.trim()) continue;
    if (h.key.trim().toLowerCase() === 'authorization' && effectiveAuth.type !== 'none') continue;
    headerEntries.push({ key: h.key.trim(), value: h.value });
  }

  if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
    const encoded = btoa(`${effectiveAuth.username}:${effectiveAuth.password ?? ''}`);
    headerEntries.push({ key: 'Authorization', value: `Basic ${encoded}` });
  } else if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
    const prefix = effectiveAuth.prefix?.trim() || 'Bearer';
    headerEntries.push({ key: 'Authorization', value: `${prefix} ${effectiveAuth.token}` });
  } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
    if (effectiveAuth.apiKeyIn === 'query') {
      try {
        const url = new URL(scenario.url);
        url.searchParams.set(effectiveAuth.apiKeyName, effectiveAuth.apiKeyValue);
        parts[parts.indexOf(`'${scenario.url}'`)] = `'${url.toString()}'`;
      } catch { /* keep original URL */ }
    } else {
      headerEntries.push({ key: effectiveAuth.apiKeyName, value: effectiveAuth.apiKeyValue });
    }
  } else if (effectiveAuth.type === 'digest' && effectiveAuth.username) {
    parts.push('--digest');
    parts.push(`-u '${effectiveAuth.username}:${effectiveAuth.password ?? ''}'`);
  } else if (effectiveAuth.type === 'oauth2') {
    try {
      const token = await acquireOAuth2Token(effectiveAuth);
      headerEntries.push({ key: 'Authorization', value: `Bearer ${token}` });
    } catch {
      headerEntries.push({ key: 'Authorization', value: 'Bearer <TOKEN_ERROR: check OAuth2 config>' });
    }
  }

  if (scenario.body && !headerEntries.some((h) => h.key.toLowerCase() === 'content-type')) {
    headerEntries.push({ key: 'Content-Type', value: 'application/json' });
  }

  for (const h of headerEntries) {
    parts.push(`\\\n  -H '${h.key}: ${h.value}'`);
  }

  if (scenario.body) {
    const escaped = scenario.body.replace(/'/g, "'\\''");
    parts.push(`\\\n  -d '${escaped}'`);
  }

  return parts.join(' ');
}
