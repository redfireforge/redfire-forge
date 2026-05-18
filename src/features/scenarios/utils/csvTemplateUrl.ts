import type { KeyValue } from '../../../shared/types';
import type { PathSegmentChoice } from './csvTemplateTypes';

export function parseUrl(url: string): { origin: string; pathname: string; params: KeyValue[] } {
  try {
    const u = new URL(url);
    const params: KeyValue[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return { origin: u.origin, pathname: u.pathname, params };
  } catch {
    return { origin: '', pathname: url, params: [] };
  }
}

/**
 * Heuristic: a path segment is likely a variable if it looks like an ID/VIN
 * (contains digits mixed with letters and is 8+ chars, or is purely numeric).
 */
function looksLikeVariable(segment: string): boolean {
  if (/^\d+$/.test(segment)) return true;
  if (segment.length >= 8 && /\d/.test(segment) && /[A-Za-z]/.test(segment)) return true;
  return false;
}

export function analyzeUrlPath(url: string): { segments: PathSegmentChoice[]; origin: string; params: KeyValue[] } {
  const { origin, pathname, params } = parseUrl(url);
  const parts = pathname.split('/').filter(Boolean);

  const segments: PathSegmentChoice[] = parts.map((seg, i) => {
    // Decode percent-encoded segments (e.g. %7B%7Bvin%7D%7D → {{vin}})
    const decoded = decodeURIComponent(seg);
    const suggested = looksLikeVariable(decoded);
    return {
      index: i,
      segment: decoded,
      suggestedVariable: suggested,
      variableName: suggested ? `path_var_${i}` : '',
    };
  });

  return { segments, origin, params };
}

export function buildUrlFromTemplate(
  urlPattern: string,
  pathValues: Record<string, string>,
  params: KeyValue[]
): string {
  let url = urlPattern;
  for (const [name, value] of Object.entries(pathValues)) {
    url = url.replace(`{{${name}}}`, encodeURIComponent(value));
  }
  if (params.length > 0) {
    const qs = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    url = `${url}?${qs}`;
  }
  return url;
}
