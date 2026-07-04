/**
 * Friendly labels for PrerequisiteGate health-probe endpoints.
 *
 * The gate probes raw URLs (e.g. `http://localhost:50052/health`). A bare
 * `host:port` is accurate but not human-friendly, so we map the fixed demo
 * fixture ports to readable names ("Docker echo", "Express proxy", …). Callers
 * may still pass explicit labels to override this.
 */

/** Fixed demo/test fixture ports → human-readable service names. */
const WELL_KNOWN_PORT_LABELS: Record<string, string> = {
  '50052': 'Docker echo',
  '50453': 'Docker echo (TLS)',
  '50454': 'Docker echo (mTLS)',
  '3001': 'Express proxy',
  '4010': 'GraphQL server',
  '4444': 'GraphQL server (TLS)',
  '4446': 'GraphQL server (mTLS)',
  '8080': 'Spring Boot fixture',
  '8085': 'Schema Registry',
};

/** Parse the `host:port` for a probe URL, falling back to the raw string. */
export function deriveEndpointHostPort(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return `${parsed.hostname}:${port}`;
  } catch {
    return url;
  }
}

/**
 * Friendly display name for a probe endpoint. Prefers a well-known port name,
 * otherwise falls back to `host:port`.
 */
export function deriveEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const known = parsed.port ? WELL_KNOWN_PORT_LABELS[parsed.port] : undefined;
    return known ?? deriveEndpointHostPort(url);
  } catch {
    return url;
  }
}
