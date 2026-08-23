import { acquireOAuth2Token } from '@engine/tokenManager';
import type { AuthConfig, Scenario } from '../types';
import { getEffectiveBodyType, serializeWithContentType } from './bodySerializer';
import { resolveAuthHeaders } from './authHeaders';

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

  if (effectiveAuth.type === 'basic' || effectiveAuth.type === 'bearer' ||
      (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyIn !== 'query')) {
    const authHdrs = resolveAuthHeaders(effectiveAuth);
    for (const [k, v] of Object.entries(authHdrs)) {
      headerEntries.push({ key: k, value: v });
    }
  } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
    if (effectiveAuth.apiKeyIn === 'query') {
      try {
        const url = new URL(scenario.url);
        url.searchParams.set(effectiveAuth.apiKeyName, effectiveAuth.apiKeyValue);
        parts[parts.indexOf(`'${scenario.url}'`)] = `'${url.toString()}'`;
      } catch { /* keep original URL */ }
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

  const bodyType = getEffectiveBodyType(scenario);

  // For form-data, use --form flags (skip Content-Type header — curl sets it automatically)
  if (bodyType === 'form-data') {
    const ctIdx = headerEntries.findIndex(h => h.key.toLowerCase() === 'content-type');
    if (ctIdx >= 0) headerEntries.splice(ctIdx, 1);
    for (const h of headerEntries) {
      parts.push(`\\\n  -H '${h.key}: ${h.value}'`);
    }
    for (const kv of scenario.bodyForm ?? []) {
      if (!kv.key.trim()) continue;
      const escaped = kv.value.replace(/'/g, "'\\''");
      parts.push(`\\\n  --form '${kv.key.trim()}=${escaped}'`);
    }
    return parts.join(' ');
  }

  // For form-urlencoded, use --data-urlencode
  if (bodyType === 'form-urlencoded') {
    if (!headerEntries.some(h => h.key.toLowerCase() === 'content-type')) {
      headerEntries.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
    }
    for (const h of headerEntries) {
      parts.push(`\\\n  -H '${h.key}: ${h.value}'`);
    }
    const { body: serialized } = serializeWithContentType(scenario);
    if (serialized) {
      const escaped = serialized.replace(/'/g, "'\\''");
      parts.push(`\\\n  --data-urlencode '${escaped}'`);
    }
    return parts.join(' ');
  }

  // For other types (json, xml, text, file)
  if (bodyType !== 'none' && !headerEntries.some(h => h.key.toLowerCase() === 'content-type')) {
    const { contentType } = serializeWithContentType(scenario);
    if (contentType) headerEntries.push({ key: 'Content-Type', value: contentType });
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
