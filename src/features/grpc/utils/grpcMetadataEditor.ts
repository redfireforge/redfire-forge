/**
 * gRPC metadata editor helpers — validation and record mapping (Phase 1F).
 */
import type { WsKeyValueEntry } from '../../../shared/websocket/types';
import { normalizeGrpcMetadata } from '../../../shared/grpc/contracts';
import {
  validateGrpcMetadataEntry,
} from '../../../shared/grpc/metadataValidation';

export {
  isGrpcBinaryMetadataKey,
  validateGrpcMetadataEntry,
  validateGrpcMetadataKey,
  validateGrpcMetadataValue,
} from '../../../shared/grpc/metadataValidation';

export function metadataEntriesFromRecord(
  record: Record<string, string>,
): WsKeyValueEntry[] {
  return Object.entries(record).map(([key, value]) => ({
    key,
    value,
    enabled: true,
  }));
}

export function metadataRecordFromEntries(
  entries: WsKeyValueEntry[],
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.enabled) continue;
    const trimmedKey = entry.key.trim();
    if (!trimmedKey) continue;
    record[trimmedKey] = entry.value;
  }
  return normalizeGrpcMetadata(record);
}

export interface GrpcMetadataValidationResult {
  valid: boolean;
  rowErrors: Record<number, string>;
  message?: string;
}

export function validateGrpcMetadataEntries(
  entries: WsKeyValueEntry[],
): GrpcMetadataValidationResult {
  const rowErrors: Record<number, string> = {};
  let message: string | undefined;

  entries.forEach((entry, index) => {
    if (!entry.enabled) return;
    if (!entry.key.trim() && !entry.value.trim()) return;

    const error = validateGrpcMetadataEntry(entry.key, entry.value);
    if (error) {
      rowErrors[index] = error;
      message ??= error;
    }
  });

  return {
    valid: Object.keys(rowErrors).length === 0,
    rowErrors,
    message,
  };
}
