import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectRoute } from './routeSelector';
import { DEFAULT_SETTINGS } from './defaults';
import type { ApiMockCapturedRequestV1, ApiMockServerDefinitionV1, ApiMockServerSettingsV1 } from './contracts';

interface CorpusCase {
  id: string;
  server: { settings?: Partial<ApiMockServerSettingsV1>; routes: ApiMockServerDefinitionV1['routes'] };
  request: ApiMockCapturedRequestV1;
  expected: {
    outcome: string;
    matchedRouteId?: string;
    matchedResponseId?: string;
    status?: number;
  };
}

function loadCases(name: string): CorpusCase[] {
  const path = resolve(process.cwd(), 'docs/plan/future/apimock/fixtures', name);
  return JSON.parse(readFileSync(path, 'utf8')) as CorpusCase[];
}

function toDefinition(id: string, slice: CorpusCase['server']): ApiMockServerDefinitionV1 {
  const ts = '2026-08-11T00:00:00.000Z';
  return {
    id,
    name: id,
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: slice.routes,
    settings: {
      ...DEFAULT_SETTINGS,
      ...slice.settings,
      selection: { ...DEFAULT_SETTINGS.selection, ...slice.settings?.selection },
      fallback: { ...DEFAULT_SETTINGS.fallback, ...slice.settings?.fallback },
    },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('TypeScript/native parity corpus (10E)', () => {
  it('matches basic seed outcomes on the TypeScript selector', () => {
    for (const c of loadCases('conformance-seed-basic.json')) {
      const def = toDefinition(c.id, c.server);
      const result = selectRoute(def.routes, c.request, def.settings, def.basePath);
      expect(result.outcome, c.id).toBe(c.expected.outcome);
      if (c.expected.matchedRouteId) {
        expect(result.selectedRouteId, c.id).toBe(c.expected.matchedRouteId);
      }
    }
  });

  it('matches advanced seed outcomes on the TypeScript selector', () => {
    for (const c of loadCases('conformance-seed-advanced.json')) {
      const def = toDefinition(c.id, c.server);
      const result = selectRoute(def.routes, c.request, def.settings, def.basePath);
      expect(result.outcome, c.id).toBe(c.expected.outcome);
      if (c.expected.matchedRouteId) {
        expect(result.selectedRouteId, c.id).toBe(c.expected.matchedRouteId);
      }
    }
  });
});
