/** True when curl should bypass HTTP(S)_PROXY (local dev servers). */
export function isLocalhostGraphqlEndpoint(endpointUrl: string): boolean {
  try {
    const host = new URL(endpointUrl).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/** Build a reproducible curl command for a GraphQL POST request. */
export function buildGraphqlCurlCommand(
  query: string,
  variables: unknown,
  endpointUrl: string,
): string {
  const body = JSON.stringify({ query, variables });
  const url = endpointUrl.trim() || '<endpoint>';
  const escapedBody = body.replace(/'/g, "'\\''");
  const noproxy = isLocalhostGraphqlEndpoint(url) ? " --noproxy '*'" : '';
  return `curl -X POST${noproxy} -H "Content-Type: application/json" -d '${escapedBody}' '${url}'`;
}
