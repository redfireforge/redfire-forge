import { describe, it, expect } from 'vitest';
import { diffKeyValueHeaders } from './keyValueDiff';
import type { KeyValue } from '../types';

describe('diffKeyValueHeaders', () => {
  const oldHeaders: KeyValue[] = [
    { key: 'Accept', value: 'application/json' },
    { key: 'X-Old', value: 'keep' },
  ];

  it('returns empty diff when headers are identical', () => {
    const result = diffKeyValueHeaders(oldHeaders, [...oldHeaders]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.modified).toEqual([]);
  });

  it('detects added headers', () => {
    const newHeaders: KeyValue[] = [...oldHeaders, { key: 'X-New', value: 'yes' }];
    const result = diffKeyValueHeaders(oldHeaders, newHeaders);
    expect(result.added).toEqual([{ key: 'X-New', value: 'yes' }]);
    expect(result.removed).toEqual([]);
    expect(result.modified).toEqual([]);
  });

  it('detects removed headers', () => {
    const result = diffKeyValueHeaders(oldHeaders, []);
    expect(result.removed).toEqual(oldHeaders);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
  });

  it('detects modified header values', () => {
    const newHeaders: KeyValue[] = [
      { key: 'Accept', value: 'text/plain' },
      { key: 'X-Old', value: 'keep' },
    ];
    const result = diffKeyValueHeaders(oldHeaders, newHeaders);
    expect(result.modified).toEqual([
      { key: 'Accept', from: 'application/json', to: 'text/plain' },
    ]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('ignores entries with blank keys', () => {
    const withBlank: KeyValue[] = [
      ...oldHeaders,
      { key: '  ', value: 'ignored' },
      { key: '', value: 'also ignored' },
    ];
    const result = diffKeyValueHeaders(oldHeaders, withBlank);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.modified).toEqual([]);
  });

  it('treats blank-key-only new list as no additions', () => {
    const result = diffKeyValueHeaders(oldHeaders, [{ key: '', value: 'x' }]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(oldHeaders);
  });
});
