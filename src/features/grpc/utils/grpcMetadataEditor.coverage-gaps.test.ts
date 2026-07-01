/**
 * Coverage gaps — grpcMetadataEditor.ts
 */
import { describe, expect, it } from 'vitest';
import {
  metadataEntriesFromRecord,
  metadataRecordFromEntries,
  validateGrpcMetadataEntries,
} from './grpcMetadataEditor';

describe('grpcMetadataEditor coverage gaps', () => {
  it('metadataEntriesFromRecord maps record entries to enabled rows', () => {
    expect(metadataEntriesFromRecord({ 'x-trace': 'abc' })).toEqual([
      { key: 'x-trace', value: 'abc', enabled: true },
    ]);
  });

  it('metadataRecordFromEntries skips disabled and blank rows', () => {
    expect(metadataRecordFromEntries([
      { key: 'x-trace', value: 'abc', enabled: true },
      { key: 'ignored', value: 'x', enabled: false },
      { key: '   ', value: 'blank-key', enabled: true },
      { key: 'ok', value: '   ', enabled: true },
    ])).toEqual({ 'x-trace': 'abc', ok: '   ' });
  });

  it('validateGrpcMetadataEntries validates rows with empty keys and values separately', () => {
    expect(validateGrpcMetadataEntries([
      { key: '', value: 'orphan-value', enabled: true },
    ]).valid).toBe(false);

    expect(validateGrpcMetadataEntries([
      { key: 'trace-id', value: '', enabled: true },
    ]).valid).toBe(true);
  });

  it('validateGrpcMetadataEntries keeps the first row error message', () => {
    const result = validateGrpcMetadataEntries([
      { key: 'bad key', value: '1', enabled: true },
      { key: 'also bad', value: '2', enabled: true },
    ]);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Metadata keys may only contain/);
    expect(Object.keys(result.rowErrors).length).toBeGreaterThanOrEqual(1);
    expect(result.rowErrors[1]).toBeTruthy();
  });

  it('validateGrpcMetadataEntries skips disabled invalid rows entirely', () => {
    const result = validateGrpcMetadataEntries([
      { key: 'bad key', value: '1', enabled: false },
    ]);
    expect(result.valid).toBe(true);
  });
});
