/**
 * gRPC Gallery — standalone protocol samples.
 *
 * This domain surfaces gRPC-specific request/test entries (unary, streaming,
 * health-check, CRUD) as a dedicated gallery tab, distinct from the general
 * `workflows` and `tests` domains.
 *
 * Scaffold: catalog is empty — entries will be added in a future phase.
 */

import type { GrpcSampleEntry } from './types';

export type { GrpcSampleEntry } from './types';
export type { GrpcSampleCategory } from './types';

export const grpcSampleCatalog: GrpcSampleEntry[] = [];
