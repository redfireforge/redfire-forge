/**
 * Phase 5B — collection tree projection tests.
 */
import { describe, expect, it } from 'vitest';
import type { GrpcCollectionV1 } from '@shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '@shared/grpc/grpcSavedRequest';
import { GRPC_TEST_TIMESTAMP, makeGrpcSavedRequest } from '../../../test-utils/grpcFactories';
import {
  buildGrpcCollectionServiceMethodTree,
  flattenGrpcCollectionServiceMethodTree,
} from './grpcCollectionTree';

const TS = GRPC_TEST_TIMESTAMP;

function makeSaved(
  id: string,
  service: string,
  method: string,
  name: string,
  callType: GrpcSavedRequest['callType'] = 'unary',
): GrpcSavedRequest {
  return makeGrpcSavedRequest(id, { service, method, name, callType });
}

describe('grpcCollectionTree (Phase 5B)', () => {
  it('groups saved requests by service and method with stable ordering', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Mixed',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [
        makeSaved('sr-3', 'zeta.Service', 'Zed', 'Zed / Zed'),
        makeSaved('sr-1', 'alpha.Service', 'Beta', 'Beta B'),
        makeSaved('sr-2', 'alpha.Service', 'Beta', 'Beta A'),
        makeSaved('sr-4', 'alpha.Service', 'Alpha', 'Alpha A'),
      ],
    };

    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(tree.services.map((node) => node.service)).toEqual(['alpha.Service', 'zeta.Service']);
    expect(tree.services[0].methods.map((node) => node.method)).toEqual(['Alpha', 'Beta']);
    expect(tree.services[0].methods[1].savedRequests.map((saved) => saved.id)).toEqual(['sr-2', 'sr-1']);
  });

  it('flatten restores deterministic display order', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Mixed',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [
        makeSaved('sr-2', 'alpha.Service', 'Beta', 'Beta A'),
        makeSaved('sr-1', 'alpha.Service', 'Beta', 'Beta B'),
      ],
    };
    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(flattenGrpcCollectionServiceMethodTree(tree).map((saved) => saved.id)).toEqual(['sr-2', 'sr-1']);
  });

  it('sorts same method name by call type when streaming variants coexist', () => {
    const collection: GrpcCollectionV1 = {
      id: 'col-1',
      name: 'Streaming',
      createdAt: TS,
      updatedAt: TS,
      savedRequests: [
        makeSaved('sr-bidi', 'echo.EchoService', 'Chat', 'Chat bidi', 'bidi'),
        makeSaved('sr-unary', 'echo.EchoService', 'Chat', 'Chat unary', 'unary'),
        makeSaved('sr-server', 'echo.EchoService', 'Chat', 'Chat server', 'server_streaming'),
      ],
    };
    const tree = buildGrpcCollectionServiceMethodTree(collection);
    expect(tree.services[0].methods.map((node) => node.callType)).toEqual([
      'bidi',
      'server_streaming',
      'unary',
    ]);
  });
});
