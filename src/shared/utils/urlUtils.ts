/**
 * Replace the host (protocol + hostname + optional base path) of a test URL
 * with the given base URL, preserving {{template}} variables.
 *
 * IMPORTANT: If testUrl is already an absolute URL (starts with http:// or https://),
 * it is returned unchanged. This allows tests to override the base URL when needed
 * (e.g., using httpbin.org for specific status codes while the environment uses jsonplaceholder).
 */
export function replaceHost(testUrl: string, baseUrl: string): string {
  if (!baseUrl) return testUrl;

  // If the test URL is already absolute, don't replace its host
  if (testUrl.startsWith('http://') || testUrl.startsWith('https://')) {
    return testUrl;
  }

  try {
    // Preserve {{template}} variables that would be URL-encoded by the URL constructor
    const placeholders: string[] = [];
    const safeUrl = testUrl.replace(/\{\{(\w+)\}\}/g, (match) => {
      placeholders.push(match);
      return `__TPL_${placeholders.length - 1}__`;
    });

    // For relative URLs, build the full URL from base + path
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    const path = safeUrl.startsWith('/') ? safeUrl.slice(1) : safeUrl;
    const result = new URL(path, base);

    // Restore template variables
    let finalUrl = result.toString();
    placeholders.forEach((tpl, i) => {
      finalUrl = finalUrl.replace(`__TPL_${i}__`, tpl);
    });
    return finalUrl;
  } catch {
    return testUrl;
  }
}
