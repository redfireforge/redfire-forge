import type { KeyValue } from '../types';

export type QueryParam = KeyValue;

/** Placeholder row for editors when a URL has no query string. */
export const EMPTY_QUERY_PARAM: QueryParam = { key: '', value: '' };

/** Strip the query string (everything from the first `?`). */
export function getBaseUrl(url: string): string {
  const qIdx = url.indexOf('?');
  return qIdx === -1 ? url : url.slice(0, qIdx);
}

function splitQueryStringRaw(qs: string): QueryParam[] {
  if (!qs) return [];
  return qs.split('&').map((pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return { key: pair, value: '' };
    return { key: pair.slice(0, eqIdx), value: pair.slice(eqIdx + 1) };
  });
}

/**
 * Parse query parameters using URLSearchParams (keys and values are decoded).
 * Returns an empty array when the URL has no `?` or parsing fails.
 */
export function parseQueryParams(url: string): QueryParam[] {
  try {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return [];
    const params = new URLSearchParams(url.slice(qIdx + 1));
    const result: QueryParam[] = [];
    params.forEach((v, k) => result.push({ key: k, value: v }));
    return result;
  } catch {
    return [];
  }
}

/**
 * Parse query parameters without URL-decoding segments (preserves `{{var}}` and `%` encoding).
 */
export function parseQueryParamsPreserveTemplates(url: string): QueryParam[] {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return [];
  const qs = url.slice(qIdx + 1);
  if (!qs) return [];
  return splitQueryStringRaw(qs);
}

/** Decode percent-encoded `{{var}}` templates so the URL stays human-readable. */
export function decodeTemplateVars(url: string): string {
  return url.replace(/%7B%7B([\s\S]*?)%7D%7D/gi, '{{$1}}');
}

function encodeQueryPart(raw: string, kind: 'key' | 'value'): string {
  const t = kind === 'key' ? raw.trim() : raw;
  if (/\{\{[\s\S]*?\}\}/.test(t)) return t;
  return encodeURIComponent(t);
}

export interface RebuildUrlOptions {
  /** Percent-encode keys and values (default false). */
  encode?: boolean;
  /** When encoding, skip parts that contain `{{…}}` and decode template sequences in the result. */
  preserveTemplates?: boolean;
}

/**
 * Rebuild a URL from a base (query stripped) and key/value pairs.
 * Empty or whitespace-only keys are omitted.
 */
export function rebuildUrl(
  baseUrl: string,
  params: QueryParam[],
  options?: RebuildUrlOptions,
): string {
  const base = getBaseUrl(baseUrl);
  const nonEmpty = params.filter((p) => p.key.trim());
  if (nonEmpty.length === 0) return base;

  const encode = options?.encode ?? false;
  const preserveTemplates = options?.preserveTemplates ?? false;

  const qs = nonEmpty
    .map((p) => {
      const key = p.key.trim();
      const value = p.value;
      if (!encode) return `${key}=${value}`;
      if (preserveTemplates) {
        return `${encodeQueryPart(p.key, 'key')}=${encodeQueryPart(p.value, 'value')}`;
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  const built = `${base}?${qs}`;
  return preserveTemplates ? decodeTemplateVars(built) : built;
}

/** Rebuild with percent-encoding on keys and values (Request Editor). */
export function rebuildUrlEncoded(baseUrl: string, params: QueryParam[]): string {
  return rebuildUrl(baseUrl, params, { encode: true });
}
