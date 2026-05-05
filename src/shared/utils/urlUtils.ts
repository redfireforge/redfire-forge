/**
 * Replace the host (protocol + hostname + optional base path) of a test URL
 * with the given base URL, preserving {{template}} variables.
 */
export function replaceHost(testUrl: string, baseUrl: string): string {
  if (!baseUrl) return testUrl;
  try {
    // Preserve {{template}} variables that would be URL-encoded by the URL constructor
    const placeholders: string[] = [];
    const safeUrl = testUrl.replace(/\{\{(\w+)\}\}/g, (match) => {
      placeholders.push(match);
      return `__TPL_${placeholders.length - 1}__`;
    });

    const original = new URL(safeUrl);
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    original.protocol = base.protocol;
    original.host = base.host;
    const basePath = base.pathname.replace(/\/+$/, '');
    if (basePath && !original.pathname.startsWith(basePath)) {
      original.pathname = basePath + original.pathname;
    }

    // Restore template variables
    let result = original.toString();
    placeholders.forEach((tpl, i) => {
      result = result.replace(`__TPL_${i}__`, tpl);
    });
    return result;
  } catch {
    return testUrl;
  }
}
