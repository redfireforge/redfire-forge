/**
 * Phase 5B — service → method → saved-requests tree projection.
 */
import type { GrpcCallType } from '@shared/grpc/contracts';
import type { GrpcCollectionV1 } from '@shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '@shared/grpc/grpcSavedRequest';

export interface GrpcCollectionMethodNode {
  service: string;
  method: string;
  callType: GrpcCallType;
  savedRequests: GrpcSavedRequest[];
}

export interface GrpcCollectionServiceNode {
  service: string;
  methods: GrpcCollectionMethodNode[];
}

export interface GrpcCollectionServiceMethodTree {
  collectionId: string;
  services: GrpcCollectionServiceNode[];
}

function compareSavedRequests(a: GrpcSavedRequest, b: GrpcSavedRequest): number {
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

function compareMethods(a: GrpcCollectionMethodNode, b: GrpcCollectionMethodNode): number {
  const byMethod = a.method.localeCompare(b.method);
  if (byMethod !== 0) return byMethod;
  const byCallType = a.callType.localeCompare(b.callType);
  if (byCallType !== 0) return byCallType;
  return a.service.localeCompare(b.service);
}

/** Deterministic service → method → saved request tree for a collection. */
export function buildGrpcCollectionServiceMethodTree(
  collection: GrpcCollectionV1,
): GrpcCollectionServiceMethodTree {
  const methodMap = new Map<string, GrpcCollectionMethodNode>();

  for (const saved of collection.savedRequests) {
    const key = `${saved.service}\0${saved.method}\0${saved.callType}`;
    const existing = methodMap.get(key);
    if (existing) {
      existing.savedRequests.push(saved);
    } else {
      methodMap.set(key, {
        service: saved.service,
        method: saved.method,
        callType: saved.callType,
        savedRequests: [saved],
      });
    }
  }

  const serviceMap = new Map<string, GrpcCollectionMethodNode[]>();
  for (const methodNode of methodMap.values()) {
    methodNode.savedRequests.sort(compareSavedRequests);
    const methods = serviceMap.get(methodNode.service) ?? [];
    methods.push(methodNode);
    serviceMap.set(methodNode.service, methods);
  }

  const services: GrpcCollectionServiceNode[] = Array.from(serviceMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([service, methods]) => ({
      service,
      methods: methods.slice().sort(compareMethods),
    }));

  return {
    collectionId: collection.id,
    services,
  };
}

/** Flatten tree back to saved requests in display order. */
export function flattenGrpcCollectionServiceMethodTree(
  tree: GrpcCollectionServiceMethodTree,
): GrpcSavedRequest[] {
  const out: GrpcSavedRequest[] = [];
  for (const serviceNode of tree.services) {
    for (const methodNode of serviceNode.methods) {
      out.push(...methodNode.savedRequests);
    }
  }
  return out;
}
