import { describe, expect, it } from 'vitest';
import {
  GRPC_MAP_PENDING_KEY_PREFIX,
  isGrpcMapPendingKey,
  stripGrpcMapPendingKeysDeep,
} from './grpcMapPendingKeys';

describe('grpcMapPendingKeys', () => {
  it('detects pending map keys', () => {
    expect(isGrpcMapPendingKey(`${GRPC_MAP_PENDING_KEY_PREFIX}1`)).toBe(true);
    expect(isGrpcMapPendingKey('alpha')).toBe(false);
  });

  it('strips pending map keys recursively before execute', () => {
    const pending = `${GRPC_MAP_PENDING_KEY_PREFIX}1`;
    expect(stripGrpcMapPendingKeysDeep({
      counts: { alpha: 1, [pending]: 7 },
      nested: [{ [pending]: 'x' }],
    })).toEqual({
      counts: { alpha: 1 },
      nested: [{}],
    });
  });
});
