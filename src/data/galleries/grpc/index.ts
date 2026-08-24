/**
 * gRPC Gallery — standalone protocol samples.
 *
 * This domain surfaces gRPC-specific request/test entries (unary, streaming,
 * health-check, CRUD) as a dedicated gallery tab, distinct from the general
 * `workflows` and `tests` domains.
 */

import { createGrpcHealthTest, createGrpcCrudTest } from '../tests/presets-grpc';
import type { GrpcSampleEntry } from './types';

export type { GrpcSampleEntry } from './types';
export type { GrpcSampleCategory } from './types';

export const grpcSampleCatalog: GrpcSampleEntry[] = [
  {
    id: 'grpc-health-check',
    domain: 'grpc',
    name: 'gRPC Unary Smoke Test',
    description:
      'Call grpc.health.v1.Health/Check on grpcb.in and assert status SERVING — the fastest way to confirm a gRPC endpoint is live.',
    icon: '🔌',
    category: 'health',
    difficulty: 'easy',
    tags: ['grpc', 'health', 'unary', 'smoke'],
    liveApis: ['grpcb.in'],
    scenarioCount: 1,
    assertionTypes: ['grpcField'],
    factory: createGrpcHealthTest,
  },
  {
    id: 'grpc-crud-scenarios',
    domain: 'grpc',
    name: 'gRPC CRUD Scenarios',
    description:
      'Three scenarios demonstrating Get / Create / Delete patterns with gRPC unary calls and field assertions — uses grpcb.in public reflection server.',
    icon: '🔌',
    category: 'crud',
    difficulty: 'medium',
    tags: ['grpc', 'crud', 'unary', 'variables'],
    liveApis: ['grpcb.in'],
    scenarioCount: 3,
    assertionTypes: ['grpcField'],
    factory: createGrpcCrudTest,
  },
];
