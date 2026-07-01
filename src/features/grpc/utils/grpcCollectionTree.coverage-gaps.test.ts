import { describe, expect, it } from 'vitest';
import { createGrpcSavedRequestIdentity } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcCollectionV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import {
  buildGrpcCollectionServiceMethodTree,
  flattenGrpcCollectionServiceMethodTree,
} from './grpcCollectionTree';

const TS = '2026-06-29T12:00:00.000Z';

function makeSaved(
  id: string,
  service: string,
  method: string,
  name: string,
  callType: GrpcSavedRequest['callType'] = 'unary',
): GrpcSavedRequest {
  const identity = createGrpcSavedRequestIdentity(id, TS);
  return {
    ...identity,
    name,
    callType,
    service,
    method,
    descriptorKey: 'desc-1',
    body: {},
    metadata: {},
    timeoutMs: 30_000,
  };
}

describe('grpcCollectionTree coverage gaps', () => {
  it('returns an empty tree for collections without saved requests', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-empty',
      name: 'Empty',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [],
    };

    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(tree.collectionId).toBe('col-empty');
    expect(tree.services).toEqual([]);
    expect(flattenGrpcCollectionServiceMethodTree(tree)).toEqual([]);
  });

  it('merges saved requests that share the same service, method, and call type', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Echo',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [
        makeSaved('sr-2', 'echo.EchoService', 'Echo', 'Echo B'),
        makeSaved('sr-1', 'echo.EchoService', 'Echo', 'Echo A'),
      ],
    };

    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(tree.services).toHaveLength(1);
    expect(tree.services[0]?.methods).toHaveLength(1);
    expect(tree.services[0]?.methods[0]?.savedRequests.map((saved) => saved.id)).toEqual(['sr-1', 'sr-2']);
  });

  it('sorts saved requests with identical names by id', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Echo',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [
        makeSaved('sr-z', 'echo.EchoService', 'Echo', 'Same name'),
        makeSaved('sr-a', 'echo.EchoService', 'Echo', 'Same name'),
      ],
    };

    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(tree.services[0]?.methods[0]?.savedRequests.map((saved) => saved.id)).toEqual(['sr-a', 'sr-z']);
  });

  it('sorts methods with identical names by call type then service', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Streaming',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [
        makeSaved('sr-unary', 'zeta.Service', 'Chat', 'Zeta unary', 'unary'),
        makeSaved('sr-bidi', 'alpha.Service', 'Chat', 'Alpha bidi', 'bidi'),
        makeSaved('sr-server', 'alpha.Service', 'Chat', 'Alpha server', 'server_streaming'),
      ],
    };

    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(tree.services.map((node) => node.service)).toEqual(['alpha.Service', 'zeta.Service']);
    expect(tree.services[0]?.methods.map((node) => node.callType)).toEqual([
      'bidi',
      'server_streaming',
    ]);
  });
});
