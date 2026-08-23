/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import type { GraphqlHistoryItem } from '@shared/types/graphql';
import {
  HISTORY_TRUNCATION_SUFFIX,
  buildHistoryPreviewData,
  extractHistoryDataObject,
  formatHistoryVariablesText,
  historyEntrySummary,
  isHistoryResponseTruncated,
  parseHistoryResponseJson,
  parseHistoryVariablesObject,
  stripHistoryTruncationMarker,
} from './historyItemParse';

function makeItem(overrides: Partial<GraphqlHistoryItem> = {}): GraphqlHistoryItem {
  return {
    id: 'item-1',
    connectionId: 'conn-1',
    timestamp: Date.now(),
    latencyMs: 12,
    status: 'success',
    operation: {
      query: 'query GetUser($id: ID!) { user(id: $id) { id name } }',
      variables: '{"id":"usr-a"}',
      name: 'GetUser',
      operationType: 'query',
      headers: [],
    },
    response: JSON.stringify({ data: { user: { id: 'usr-a', name: 'Alice' } } }),
    ...overrides,
  };
}

describe('historyItemParse', () => {
  it('detects and strips truncation marker', () => {
    const raw = '{"data":{}}\n__TRUNCATED__';
    expect(isHistoryResponseTruncated(raw)).toBe(true);
    expect(stripHistoryTruncationMarker(raw)).toBe('{"data":{}}');
  });

  it('parseHistoryResponseJson returns null on invalid JSON', () => {
    expect(parseHistoryResponseJson('not-json')).toBeNull();
  });

  it('parseHistoryVariablesObject handles empty, invalid, and array values', () => {
    expect(parseHistoryVariablesObject(undefined)).toEqual({});
    expect(parseHistoryVariablesObject('{}')).toEqual({});
    expect(parseHistoryVariablesObject('{"id":"a"}')).toEqual({ id: 'a' });
    expect(parseHistoryVariablesObject('[]')).toEqual({});
    expect(parseHistoryVariablesObject('bad')).toEqual({});
  });

  it('formatHistoryVariablesText pretty-prints or returns raw on parse failure', () => {
    expect(formatHistoryVariablesText('{}')).toBeNull();
    expect(formatHistoryVariablesText('{"id":"a"}')).toBe('{\n  "id": "a"\n}');
    expect(formatHistoryVariablesText('raw-vars')).toBe('raw-vars');
  });

  it('extractHistoryDataObject returns empty for missing or non-object data', () => {
    expect(extractHistoryDataObject(null)).toEqual({});
    expect(extractHistoryDataObject({ errors: [] })).toEqual({});
    expect(extractHistoryDataObject({ data: null })).toEqual({});
    expect(extractHistoryDataObject({ data: [1] })).toEqual({});
    expect(extractHistoryDataObject({ data: { user: { name: 'Alice' } } })).toEqual({
      user: { name: 'Alice' },
    });
  });

  it('historyEntrySummary includes user name when present', () => {
    expect(historyEntrySummary(makeItem())).toBe('GetUser · Alice');
    expect(historyEntrySummary(makeItem({ operation: { ...makeItem().operation, name: undefined } })))
      .toBe('(anonymous) · Alice');
    expect(historyEntrySummary(makeItem({ response: '{"data":{}}' }))).toBe('GetUser');
    expect(historyEntrySummary(makeItem({ response: 'invalid' }))).toBe('GetUser');
  });

  it('buildHistoryPreviewData formats response with errors and httpStatus', () => {
    const item = makeItem({
      response: JSON.stringify({
        data: { user: { name: 'Alice' } },
        errors: [{ message: 'fail' }],
        extensions: { trace: true },
        httpStatus: 200,
      }),
    });
    const preview = buildHistoryPreviewData(item);
    expect(preview.httpStatus).toBe(200);
    expect(preview.hasGraphqlErrors).toBe(true);
    expect(preview.queryText).toContain('GetUser');
    expect(preview.variablesText).toContain('"id"');
    expect(preview.responseBodyText).toContain('"errors"');
    expect(preview.responseBodyText).toContain('"extensions"');
  });

  it('buildHistoryPreviewData handles truncated non-JSON fallback', () => {
    const item = makeItem({
      response: `partial-body${HISTORY_TRUNCATION_SUFFIX}`,
    });
    const preview = buildHistoryPreviewData(item);
    expect(preview.isTruncated).toBe(true);
    expect(preview.responseBodyText).toBe('partial-body');
    expect(preview.hasGraphqlErrors).toBe(false);
  });

  it('buildHistoryPreviewData stringifies whole payload when no data/errors/extensions keys', () => {
    const item = makeItem({
      response: JSON.stringify({ meta: { ok: true } }),
    });
    const preview = buildHistoryPreviewData(item);
    expect(preview.responseBodyText).toContain('"meta"');
  });
});
