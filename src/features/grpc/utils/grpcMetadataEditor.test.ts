import { describe, expect, it } from 'vitest';
import {
  metadataEntriesFromRecord,
  metadataRecordFromEntries,
  validateGrpcMetadataEntry,
  validateGrpcMetadataEntries,
} from './grpcMetadataEditor';

describe('grpcMetadataEditor (Phase 1F)', () => {
  it('normalizes metadata keys to lowercase on persist (Phase 4C)', () => {
    const record = metadataRecordFromEntries([
      { key: 'X-Request-Id', value: 'abc', enabled: true },
      { key: 'trace-id', value: '1', enabled: true },
    ]);
    expect(record).toEqual({
      'x-request-id': 'abc',
      'trace-id': '1',
    });
  });

  it('rejects empty metadata keys', () => {
    expect(validateGrpcMetadataEntry('', 'value')).toMatch(/required/i);
    expect(validateGrpcMetadataEntry('   ', 'value')).toMatch(/required/i);
  });

  it('requires base64 for -bin metadata values', () => {
    expect(validateGrpcMetadataEntry('payload-bin', 'not!!!base64')).toMatch(/base64/i);
    expect(validateGrpcMetadataEntry('payload-bin', 'aGVsbG8=')).toBeNull();
  });

  it('validates row-level metadata errors', () => {
    const result = validateGrpcMetadataEntries([
      { key: 'ok', value: '1', enabled: true },
      { key: 'bad key', value: 'x', enabled: true },
    ]);
    expect(result.valid).toBe(false);
    expect(result.rowErrors[1]).toBeTruthy();
  });

  it('keeps the last metadata row when duplicate keys are entered', () => {
    const record = metadataRecordFromEntries([
      { key: 'trace-id', value: 'first', enabled: true },
      { key: 'trace-id', value: 'second', enabled: true },
    ]);
    expect(record).toEqual({ 'trace-id': 'second' });
  });

  it('round-trips metadata record through entries with lowercase keys', () => {
    const source = { 'x-foo': 'bar' };
    expect(metadataRecordFromEntries(metadataEntriesFromRecord(source))).toEqual(source);
  });
});
