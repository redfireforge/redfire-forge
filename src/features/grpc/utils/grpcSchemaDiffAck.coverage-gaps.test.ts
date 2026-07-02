/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

function makeErrorReq(fakeError: DOMException) {
  const req = {
    result: null as unknown,
    error: fakeError,
    onsuccess: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  setTimeout(() => req.onerror?.(), 0);
  return req;
}

function makeSuccessIndex(rows: unknown[]) {
  const req = {
    result: rows,
    error: null,
    onsuccess: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  setTimeout(() => req.onsuccess?.(), 0);
  return { getAll: () => req };
}

describe('grpcSchemaDiffAck IDB error paths', () => {
  it('getGrpcSchemaDiffAcks rejects when index read fails', async () => {
    vi.resetModules();
    const fakeError = new DOMException('read failed');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => ({
          objectStore: () => ({ index: () => ({ getAll: () => makeErrorReq(fakeError) }) }),
        }),
      }),
    }));
    const { getGrpcSchemaDiffAcks } = await import('./grpcSchemaDiffAck');
    await expect(getGrpcSchemaDiffAcks('baseline-key')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('addGrpcSchemaDiffAck rejects when write transaction fails', async () => {
    vi.resetModules();
    const fakeError = new DOMException('write failed');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const tx = {
            objectStore: () => ({ put: vi.fn() }),
            error: fakeError,
            oncomplete: null as null | (() => void),
            onerror: null as null | (() => void),
          };
          setTimeout(() => tx.onerror?.(), 0);
          return tx;
        },
      }),
    }));
    const { addGrpcSchemaDiffAck } = await import('./grpcSchemaDiffAck');
    await expect(addGrpcSchemaDiffAck('baseline-key', {
      entityType: 'field',
      entityPath: 'echo.EchoRequest.message',
      changeType: 'removed',
    })).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('deleteGrpcSchemaDiffAck rejects when delete transaction fails', async () => {
    vi.resetModules();
    const fakeError = new DOMException('delete failed');
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const tx = {
            objectStore: () => ({ delete: vi.fn() }),
            error: fakeError,
            oncomplete: null as null | (() => void),
            onerror: null as null | (() => void),
          };
          setTimeout(() => tx.onerror?.(), 0);
          return tx;
        },
      }),
    }));
    const { deleteGrpcSchemaDiffAck } = await import('./grpcSchemaDiffAck');
    await expect(deleteGrpcSchemaDiffAck('ack-id')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('deleteGrpcSchemaDiffAcksForBaseline rejects when batch delete fails', async () => {
    vi.resetModules();
    const fakeError = new DOMException('batch delete failed');
    const ack = {
      id: 'baseline::field::path::removed',
      baselineDescriptorKey: 'baseline',
      changeId: 'field::path::removed',
      acknowledgedAt: '2026-07-01T00:00:00.000Z',
    };
    let callCount = 0;
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          callCount += 1;
          if (callCount === 1) {
            return { objectStore: () => ({ index: () => makeSuccessIndex([ack]) }) };
          }
          const tx = {
            objectStore: () => ({ delete: vi.fn() }),
            error: fakeError,
            oncomplete: null as null | (() => void),
            onerror: null as null | (() => void),
          };
          setTimeout(() => tx.onerror?.(), 0);
          return tx;
        },
      }),
    }));
    const { deleteGrpcSchemaDiffAcksForBaseline } = await import('./grpcSchemaDiffAck');
    await expect(deleteGrpcSchemaDiffAcksForBaseline('baseline')).rejects.toBe(fakeError);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });

  it('getGrpcSchemaDiffAcks treats null IDB result as empty list', async () => {
    vi.resetModules();
    vi.doMock('../../../shared/utils/idbOpen', () => ({
      openDB: vi.fn().mockResolvedValue({
        transaction: () => {
          const req = {
            result: null,
            error: null,
            onsuccess: null as null | (() => void),
            onerror: null as null | (() => void),
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return { objectStore: () => ({ index: () => ({ getAll: () => req }) }) };
        },
      }),
    }));
    const { getGrpcSchemaDiffAcks } = await import('./grpcSchemaDiffAck');
    await expect(getGrpcSchemaDiffAcks('baseline-null')).resolves.toEqual([]);
    vi.doUnmock('../../../shared/utils/idbOpen');
  });
});
