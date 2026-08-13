/**
 * API Mock Studio gallery — importable mock-server samples.
 */
import type { ApiMockSampleEntry } from './types';
import {
  createAmbiguousRoutesMock,
  createHealthCheckMock,
  createUsersApiMock,
} from './presets';

export type { ApiMockSampleEntry } from './types';
export {
  createAmbiguousRoutesMock,
  createHealthCheckMock,
  createUsersApiMock,
} from './presets';

export const apiMockSampleCatalog: ApiMockSampleEntry[] = [
  {
    id: 'am-gallery-health',
    domain: 'api-mock',
    name: 'Health check mock',
    description: 'Single GET /health on :4600 — Start the listener and confirm a matched journal row.',
    icon: '🩺',
    category: 'getting-started',
    difficulty: 'easy',
    tags: ['health', 'start', 'journal', 'track-a'],
    liveApis: [],
    routeCount: 1,
    teaches: ['create', 'start', 'journal'],
    factory: createHealthCheckMock,
  },
  {
    id: 'am-gallery-users',
    domain: 'api-mock',
    name: 'Users API',
    description: 'List / get-by-id / create users under /api/v1 — parameterized paths, JSON body predicates, and a simulation example.',
    icon: '👥',
    category: 'matching',
    difficulty: 'medium',
    tags: ['users', 'parameterized', 'json-body', 'examples'],
    liveApis: [],
    routeCount: 3,
    teaches: ['parameterized-path', 'predicates', 'examples'],
    factory: createUsersApiMock,
  },
  {
    id: 'am-gallery-conflicts',
    domain: 'api-mock',
    name: 'Ambiguous routes',
    description: 'Two equal-priority GET /orders routes — open Conflicts → Analyze to inspect overlap and simulate a witness.',
    icon: '⚔️',
    category: 'conflicts',
    difficulty: 'medium',
    tags: ['conflicts', 'overlap', 'ambiguous', 'priority'],
    liveApis: [],
    routeCount: 2,
    teaches: ['conflict-inspector', 'priority', 'simulate'],
    factory: createAmbiguousRoutesMock,
  },
];
