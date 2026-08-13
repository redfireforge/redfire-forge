/**
 * Build a sanitized closest-match debug payload for unmatched requests.
 * Used by the live listener and simulation when fallback.mode === 'closest_match_debug'.
 */
import type { ApiMockMatchExplanationV1, ApiMockStaticResponseV1 } from './contracts';

export function buildClosestMatchDebugBody(
  explanation: ApiMockMatchExplanationV1,
  fallback: ApiMockStaticResponseV1,
): { status: number; contentType: string; body: string } {
  const nearMisses = explanation.nearMisses.slice(0, 5).map(nm => ({
    routeId: nm.routeId,
    routeName: nm.routeName,
    missDistance: nm.missDistance,
    failedPredicates: nm.failedPredicates.slice(0, 8).map(fp => ({
      source: fp.source,
      reason: fp.reason,
    })),
  }));

  const payload = {
    error: 'not_found',
    mode: 'closest_match_debug',
    request: {
      method: explanation.normalizedRequest.method,
      path: explanation.normalizedRequest.path,
    },
    nearMissCount: explanation.nearMisses.length,
    nearMisses,
    hint: nearMisses.length > 0
      ? 'Closest candidates matched method/path but failed conditions.'
      : 'No near-miss candidates; check method, path, or base path.',
  };

  return {
    status: fallback.status || 404,
    contentType: 'application/json',
    body: JSON.stringify(payload, null, 2),
  };
}
