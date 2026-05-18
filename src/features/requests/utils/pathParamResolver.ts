export interface PathParamValue {
  key: string;
  value: string;
}

/**
 * Resolves a URL by substituting path parameter values into the originalPath template,
 * then prepending the URL prefix found in the current URL.
 *
 * @param currentUrl - The current full URL (may be corrupted from previous bad substitutions)
 * @param originalPath - The path template from catalogMeta (e.g. "/vehicles/{vin}/details")
 * @param params - Path parameter key-value pairs to substitute
 * @returns The resolved URL with parameters substituted
 */
export function resolvePathParamUrl(
  currentUrl: string,
  originalPath: string,
  params: PathParamValue[],
): string {
  const [urlWithoutQuery, ...queryParts] = currentUrl.split('?');
  const queryString = queryParts.length > 0 ? `?${queryParts.join('?')}` : '';

  const prefix = findUrlPrefix(urlWithoutQuery, originalPath);

  let resolvedPath = originalPath;
  for (const p of params) {
    if (p.value) {
      resolvedPath = resolvedPath.replace(`{${p.key}}`, p.value);
    }
  }

  return prefix + resolvedPath + queryString;
}

/**
 * Finds the URL portion that comes before the originalPath template.
 * Works by locating the first static (non-placeholder) segment of originalPath in the URL.
 */
export function findUrlPrefix(urlWithoutQuery: string, originalPath: string): string {
  const segments = originalPath.split('/').filter(Boolean);
  const anchorIdx = segments.findIndex(s => !s.startsWith('{'));

  if (anchorIdx >= 0) {
    const anchorSegment = '/' + segments.slice(0, anchorIdx + 1).join('/');
    const searchIn = urlWithoutQuery.replace(/^https?:\/\/[^/]+/, '');
    const hostPart = urlWithoutQuery.slice(0, urlWithoutQuery.length - searchIn.length);
    const idx = searchIn.indexOf(anchorSegment);
    if (idx >= 0) return hostPart + searchIn.slice(0, idx);
  }

  return '';
}
