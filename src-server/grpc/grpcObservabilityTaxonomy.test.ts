/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  GRPC_ROUTE_IDS,
  GRPC_ROUTE_TAXONOMY,
} from './grpcObservabilityTaxonomy.js';

describe('grpcObservabilityTaxonomy', () => {
  it('contains unique route ids and covers every declared route constant', () => {
    const taxonomyRouteIds = GRPC_ROUTE_TAXONOMY.map((entry) => entry.routeId);
    const uniqueRouteIds = new Set(taxonomyRouteIds);
    expect(uniqueRouteIds.size).toBe(taxonomyRouteIds.length);

    const declaredRouteIds = Object.values(GRPC_ROUTE_IDS);
    expect(new Set(declaredRouteIds)).toEqual(uniqueRouteIds);
  });

  it('marks data and stream lifecycle routes with redaction tiers', () => {
    const byRoute = new Map(
      GRPC_ROUTE_TAXONOMY.map((entry) => [entry.routeId, entry]),
    );

    expect(byRoute.get(GRPC_ROUTE_IDS.CALL)?.redactionTier).toBe('export_mask');
    expect(byRoute.get(GRPC_ROUTE_IDS.STREAM_EVENTS)?.redactionTier).toBe('display_mask');
    expect(byRoute.get(GRPC_ROUTE_IDS.STREAM_SEND)?.redactionTier).toBe('export_mask');
  });
});
