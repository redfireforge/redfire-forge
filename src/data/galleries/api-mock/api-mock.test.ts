import { describe, it, expect } from 'vitest';
import { apiMockSampleCatalog } from './index';
import {
  createAmbiguousRoutesMock,
  createHealthCheckMock,
  createUsersApiMock,
} from './presets';

describe('api-mock gallery catalog', () => {
  it('ships the first three Phase 12E samples', () => {
    expect(apiMockSampleCatalog.map(e => e.id)).toEqual([
      'am-gallery-health',
      'am-gallery-users',
      'am-gallery-conflicts',
    ]);
    for (const entry of apiMockSampleCatalog) {
      expect(entry.domain).toBe('api-mock');
      expect(entry.factory().routes.length).toBe(entry.routeCount);
      expect(entry.factory().name).toBeTruthy();
    }
  });

  it('health sample serves GET /health', () => {
    const server = createHealthCheckMock();
    expect(server.routes[0]?.path.value).toBe('/health');
    expect(server.routes[0]?.method).toBe('GET');
    expect(server.samples).toHaveLength(1);
  });

  it('users sample includes parameterized path and POST body predicate', () => {
    const server = createUsersApiMock();
    expect(server.basePath).toBe('/api/v1');
    expect(server.routes.some(r => r.path.kind === 'parameterized')).toBe(true);
    expect(server.routes.some(r => r.method === 'POST')).toBe(true);
  });

  it('conflicts sample has two equal-priority overlapping GETs', () => {
    const server = createAmbiguousRoutesMock();
    expect(server.routes).toHaveLength(2);
    expect(server.routes.every(r => r.path.value === '/orders')).toBe(true);
    expect(server.routes[0]?.priority).toBe(server.routes[1]?.priority);
    expect(server.settings.selection.multipleMatchPolicy).toBe('reject_multiple');
  });
});
