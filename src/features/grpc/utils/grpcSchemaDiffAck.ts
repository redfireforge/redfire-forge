/**
 * Phase 11J — schema diff acknowledgement persistence (GraphQL parity).
 */
import type { GrpcSchemaDiffChange } from '@shared/grpc/grpcSchemaDiffContracts';
import { openDB } from '@shared/utils/idbOpen';

export const GRPC_SCHEMA_DIFF_ACKS_IDB_STORE = 'grpc-schema-diff-acks';

export interface GrpcSchemaDiffAck {
  /** Stable: `${baselineDescriptorKey}::${changeId}` */
  id: string;
  baselineDescriptorKey: string;
  changeId: string;
  acknowledgedAt: string;
  note?: string;
}

/** Stable change fingerprint for ack rows (entity + change kind). */
export function grpcSchemaDiffChangeId(
  change: Pick<GrpcSchemaDiffChange, 'entityType' | 'entityPath' | 'changeType'>,
): string {
  return `${change.entityType}::${change.entityPath}::${change.changeType}`;
}

export function grpcSchemaDiffAckId(baselineDescriptorKey: string, changeId: string): string {
  return `${baselineDescriptorKey}::${changeId}`;
}

export async function getGrpcSchemaDiffAcks(
  baselineDescriptorKey: string,
): Promise<GrpcSchemaDiffAck[]> {
  const db = await openDB();
  return new Promise<GrpcSchemaDiffAck[]>((resolve, reject) => {
    const tx = db.transaction(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE, 'readonly');
    const idx = tx.objectStore(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE).index('baselineDescriptorKey');
    const req = idx.getAll(IDBKeyRange.only(baselineDescriptorKey));
    req.onsuccess = () => resolve((req.result as GrpcSchemaDiffAck[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function addGrpcSchemaDiffAck(
  baselineDescriptorKey: string,
  change: Pick<GrpcSchemaDiffChange, 'entityType' | 'entityPath' | 'changeType'>,
  note?: string,
): Promise<GrpcSchemaDiffAck> {
  const changeId = grpcSchemaDiffChangeId(change);
  const ack: GrpcSchemaDiffAck = {
    id: grpcSchemaDiffAckId(baselineDescriptorKey, changeId),
    baselineDescriptorKey,
    changeId,
    acknowledgedAt: new Date().toISOString(),
    note: note?.trim() || undefined,
  };
  const db = await openDB();
  return new Promise<GrpcSchemaDiffAck>((resolve, reject) => {
    const tx = db.transaction(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE, 'readwrite');
    tx.objectStore(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE).put(ack);
    tx.oncomplete = () => resolve(ack);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteGrpcSchemaDiffAck(id: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE, 'readwrite');
    tx.objectStore(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteGrpcSchemaDiffAcksForBaseline(
  baselineDescriptorKey: string,
): Promise<void> {
  const existing = await getGrpcSchemaDiffAcks(baselineDescriptorKey);
  if (existing.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE, 'readwrite');
    const store = tx.objectStore(GRPC_SCHEMA_DIFF_ACKS_IDB_STORE);
    for (const ack of existing) store.delete(ack.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
