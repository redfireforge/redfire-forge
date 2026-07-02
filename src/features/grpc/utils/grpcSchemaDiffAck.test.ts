/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  addGrpcSchemaDiffAck,
  deleteGrpcSchemaDiffAck,
  deleteGrpcSchemaDiffAcksForBaseline,
  getGrpcSchemaDiffAcks,
  grpcSchemaDiffAckId,
  grpcSchemaDiffChangeId,
} from '../utils/grpcSchemaDiffAck';

const BASELINE_KEY = 'reflection:localhost:50051';
const SAMPLE_CHANGE = {
  severity: 'breaking' as const,
  entityType: 'field' as const,
  entityPath: 'echo.EchoRequest.message',
  changeType: 'removed' as const,
  description: 'Field removed',
};

describe('grpcSchemaDiffAck (Phase 11J)', () => {
  beforeEach(async () => {
    await deleteGrpcSchemaDiffAcksForBaseline(BASELINE_KEY);
  });

  it('computes stable change and ack ids', () => {
    const changeId = grpcSchemaDiffChangeId(SAMPLE_CHANGE);
    expect(changeId).toBe('field::echo.EchoRequest.message::removed');
    expect(grpcSchemaDiffAckId(BASELINE_KEY, changeId)).toBe(
      `${BASELINE_KEY}::${changeId}`,
    );
  });

  it('persists acknowledgements per baseline key', async () => {
    await addGrpcSchemaDiffAck(BASELINE_KEY, SAMPLE_CHANGE, 'reviewed');
    const acks = await getGrpcSchemaDiffAcks(BASELINE_KEY);
    expect(acks).toHaveLength(1);
    expect(acks[0]?.changeId).toBe(grpcSchemaDiffChangeId(SAMPLE_CHANGE));
    expect(acks[0]?.note).toBe('reviewed');
  });

  it('deletes acknowledgements when baseline is cleared', async () => {
    await addGrpcSchemaDiffAck(BASELINE_KEY, SAMPLE_CHANGE);
    await deleteGrpcSchemaDiffAcksForBaseline(BASELINE_KEY);
    expect(await getGrpcSchemaDiffAcks(BASELINE_KEY)).toHaveLength(0);
  });

  it('deleteGrpcSchemaDiffAck removes a single acknowledgement row', async () => {
    const ack = await addGrpcSchemaDiffAck(BASELINE_KEY, SAMPLE_CHANGE);
    await deleteGrpcSchemaDiffAck(ack.id);
    expect(await getGrpcSchemaDiffAcks(BASELINE_KEY)).toHaveLength(0);
  });

  it('addGrpcSchemaDiffAck drops blank notes', async () => {
    const ack = await addGrpcSchemaDiffAck(BASELINE_KEY, SAMPLE_CHANGE, '   ');
    expect(ack.note).toBeUndefined();
  });

  it('deleteGrpcSchemaDiffAcksForBaseline is a no-op when baseline has no rows', async () => {
    await deleteGrpcSchemaDiffAcksForBaseline('baseline-without-rows');
    expect(await getGrpcSchemaDiffAcks('baseline-without-rows')).toHaveLength(0);
  });

  it('isolates acknowledgements per baseline descriptor key', async () => {
    const otherKey = 'reflection:localhost:50052';
    await addGrpcSchemaDiffAck(BASELINE_KEY, SAMPLE_CHANGE);
    await addGrpcSchemaDiffAck(otherKey, SAMPLE_CHANGE);
    expect(await getGrpcSchemaDiffAcks(BASELINE_KEY)).toHaveLength(1);
    await deleteGrpcSchemaDiffAcksForBaseline(otherKey);
    expect(await getGrpcSchemaDiffAcks(BASELINE_KEY)).toHaveLength(1);
    await deleteGrpcSchemaDiffAcksForBaseline(BASELINE_KEY);
  });
});
