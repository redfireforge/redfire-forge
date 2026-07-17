/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  assertGrpcLoadTestConfig,
  GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS,
  validateGrpcLoadTestConfig,
} from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import {
  deleteGrpcLoadTestProfile,
  getGrpcLoadTestProfileById,
  listGrpcLoadTestProfiles,
  renameGrpcLoadTestProfile,
  resetGrpcLoadTestProfilesPersistQueueForTests,
  saveGrpcLoadTestProfile,
} from './grpcLoadTestProfileRepository';

describe('grpcLoadTestProfileRepository (Phase 11J)', () => {
  beforeEach(async () => {
    resetGrpcLoadTestProfilesPersistQueueForTests();
    const profiles = await listGrpcLoadTestProfiles();
    for (const profile of profiles) {
      await deleteGrpcLoadTestProfile(profile.id);
    }
  });

  it('round-trips load-test config through save and list', async () => {
    const config = { concurrency: 4, totalCalls: 40, rampUpMs: 500 };
    const saved = await saveGrpcLoadTestProfile({ name: 'Smoke', config });
    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe(saved.id);
    expect(profiles[0]?.config).toEqual(config);
    expect(validateGrpcLoadTestConfig('unary', profiles[0]!.config)).toEqual([]);
    expect(() => assertGrpcLoadTestConfig('unary', profiles[0]!.config)).not.toThrow();
  });

  it('rejects duplicate profile names', async () => {
    await saveGrpcLoadTestProfile({ name: 'Dup', config: { concurrency: 1, totalCalls: 1 } });
    await expect(
      saveGrpcLoadTestProfile({ name: 'dup', config: { concurrency: 2, totalCalls: 2 } }),
    ).rejects.toThrow(/already exists/i);
  });

  it('renames and deletes profiles', async () => {
    const saved = await saveGrpcLoadTestProfile({ name: 'Before', config: { concurrency: 3, totalCalls: 30 } });
    const renamed = await renameGrpcLoadTestProfile(saved.id, 'After');
    expect(renamed.name).toBe('After');
    await deleteGrpcLoadTestProfile(saved.id);
    expect(await listGrpcLoadTestProfiles()).toHaveLength(0);
  });

  it('does not resurrect deleted profiles from empty IDB reads', async () => {
    const first = await saveGrpcLoadTestProfile({ name: 'Ephemeral', config: { concurrency: 2, totalCalls: 20 } });
    await deleteGrpcLoadTestProfile(first.id);
    const second = await saveGrpcLoadTestProfile({ name: 'Fresh', config: { concurrency: 4, totalCalls: 40 } });
    const profiles = await listGrpcLoadTestProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe(second.id);
  });

  it('looks up profiles by id', async () => {
    const saved = await saveGrpcLoadTestProfile({ name: 'Lookup', config: { concurrency: 2, totalCalls: 10 } });
    const found = await getGrpcLoadTestProfileById(saved.id);
    expect(found?.name).toBe('Lookup');
    expect(await getGrpcLoadTestProfileById('missing')).toBeUndefined();
    expect(await getGrpcLoadTestProfileById('   ')).toBeUndefined();
  });

  it('rejects profiles with maxMessagesPerStream above safety cap (Phase 11O)', async () => {
    await expect(saveGrpcLoadTestProfile({
      name: 'Stream cap',
      config: {
        concurrency: 2,
        totalCalls: 10,
        maxMessagesPerStream: GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS.maxMaxMessagesPerStream + 1,
      },
    })).rejects.toThrow(/maxMessagesPerStream exceeds max/i);
  });
});
