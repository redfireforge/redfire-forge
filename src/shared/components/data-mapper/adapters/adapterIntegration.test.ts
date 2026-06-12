/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createExtractionAdapter, splitExtractions } from './extractionAdapter';
import { createAssertionAdapter } from './assertionAdapter';
import { createValidationAdapter } from './validationAdapter';
import { createPopulateFromApiAdapter } from './populateFromApiAdapter';
import { createColumnMappingAdapter } from './columnMappingAdapter';
import { createSharedDsFetchAdapter } from './sharedDsFetchAdapter';
import { createDemoAdapter } from './demoAdapter';
import { createWebhookExtractionAdapter } from './webhookExtractionAdapter';
import { createWsExtractionAdapter } from './wsExtractionAdapter';
import { createVariableBindingAdapter } from './variableBindingAdapter';
import { createRequestBodyAdapter } from './requestBodyAdapter';
import { Mapping } from '../types';
import { Extraction, DataSource, DataSourceColumn, Scenario } from '../../../types';

// ── Fixtures ──────────────────────────────────────────────

const SAMPLE_BODY = {
  data: { id: 42, name: 'Alice', active: true },
  meta: { total: 100 },
};

// ── 3D.1: host-override pipeline (fetchSampleData threading) ──

describe('3D.1 — fetchSampleData host-override pipeline', () => {
  it('extraction adapter delegates fetchSampleData to provided callback', async () => {
    const mockFetch = vi.fn().mockResolvedValue(SAMPLE_BODY);
    const adapter = createExtractionAdapter({
      sampleResponseBody: SAMPLE_BODY,
      fetchSampleData: mockFetch,
    });

    expect(adapter.fetchSampleData).toBeDefined();
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual(SAMPLE_BODY);
  });

  it('assertion adapter delegates fetchSampleData', async () => {
    const mockFetch = vi.fn().mockResolvedValue(SAMPLE_BODY);
    const adapter = createAssertionAdapter({
      sampleResponseBody: SAMPLE_BODY,
      fetchSampleData: mockFetch,
    });

    expect(adapter.fetchSampleData).toBeDefined();
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual(SAMPLE_BODY);
  });

  it('validation adapter delegates fetchSampleData', async () => {
    const mockFetch = vi.fn().mockResolvedValue(SAMPLE_BODY);
    const adapter = createValidationAdapter({
      sampleResponseBody: SAMPLE_BODY,
      fetchSampleData: mockFetch,
    });

    expect(adapter.fetchSampleData).toBeDefined();
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual(SAMPLE_BODY);
  });

  it('fetchSampleData is undefined when no callback provided', () => {
    const ext = createExtractionAdapter({ sampleResponseBody: SAMPLE_BODY });
    const asr = createAssertionAdapter({ sampleResponseBody: SAMPLE_BODY });
    const val = createValidationAdapter({ sampleResponseBody: SAMPLE_BODY });

    expect(ext.fetchSampleData).toBeUndefined();
    expect(asr.fetchSampleData).toBeUndefined();
    expect(val.fetchSampleData).toBeUndefined();

    expect(ext.sources[0].supportsLiveFetch).toBe(false);
    expect(asr.sources[0].supportsLiveFetch).toBe(false);
    expect(val.sources[0].supportsLiveFetch).toBe(false);
  });

  it('fetchSampleData can return updated sample data for source refresh', async () => {
    const updatedSample = { data: { id: 99, name: 'Bob', active: false }, meta: { total: 200 } };
    const mockFetch = vi.fn().mockResolvedValue(updatedSample);
    const adapter = createExtractionAdapter({
      sampleResponseBody: SAMPLE_BODY,
      fetchSampleData: mockFetch,
    });

    const result = await adapter.fetchSampleData!();
    expect(result).toEqual(updatedSample);
    expect(result).not.toEqual(SAMPLE_BODY);
  });
});

// ── 3D.2: variable hints compatibility ──

describe('3D.2 — variable hints interface compatibility', () => {
  it('extraction adapter source matches expected sourceId for variable binding', () => {
    const adapter = createExtractionAdapter({ sampleResponseBody: SAMPLE_BODY });
    expect(adapter.sources[0].id).toBe('response-body');
    expect(adapter.sources[0].label).toBe('Response Body');
  });

  it('assertion adapter source matches expected sourceId', () => {
    const adapter = createAssertionAdapter({ sampleResponseBody: SAMPLE_BODY });
    expect(adapter.sources[0].id).toBe('response-body');
    expect(adapter.sources[0].label).toBe('Response Body');
  });

  it('validation adapter source matches expected sourceId', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: SAMPLE_BODY });
    expect(adapter.sources[0].id).toBe('response-body');
    expect(adapter.sources[0].label).toBe('Response Body');
  });

  it('populate adapter source matches expected sourceId', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const adapter = createPopulateFromApiAdapter({ dataSource: ds });
    expect(adapter.sources[0].id).toBe('api-response');
    expect(adapter.sources[0].label).toBe('API Response');
  });

  it('column-mapping adapter source matches expected sourceId', () => {
    const scenario = { id: 's1', name: 'T', url: 'https://a.com/{{v}}', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } as Scenario;
    const adapter = createColumnMappingAdapter({ columns: [], scenario });
    expect(adapter.sources[0].id).toBe('data-source-columns');
    expect(adapter.sources[0].label).toBe('Data Source Columns');
  });

  it('adapter context IDs are distinct and non-overlapping', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const scenario = { id: 's1', name: 'T', url: 'https://a.com/{{v}}', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } as Scenario;
    const ids = new Set([
      createExtractionAdapter().contextId,
      createAssertionAdapter().contextId,
      createValidationAdapter().contextId,
      createPopulateFromApiAdapter({ dataSource: ds }).contextId,
      createColumnMappingAdapter({ columns: [], scenario }).contextId,
      createSharedDsFetchAdapter({ dataSource: ds }).contextId,
      createDemoAdapter().contextId,
      createWebhookExtractionAdapter().contextId,
      createWsExtractionAdapter().contextId,
      createVariableBindingAdapter({ variableHints: [], templateSlots: [] }).contextId,
      createRequestBodyAdapter({ existingBody: '{}' }).contextId,
    ]);
    expect(ids.size).toBe(11);
    expect(ids).toContain('extraction');
    expect(ids).toContain('assertion');
    expect(ids).toContain('validation');
    expect(ids).toContain('populate-from-api');
    expect(ids).toContain('column-mapping');
    expect(ids).toContain('shared-ds-fetch');
    expect(ids).toContain('demo');
    expect(ids).toContain('webhook-extraction');
    expect(ids).toContain('ws-extraction');
    expect(ids).toContain('variable-binding');
    expect(ids).toContain('request-body');
  });

  it('all HTTP adapters share the same category', () => {
    const ext = createExtractionAdapter();
    const asr = createAssertionAdapter();
    const val = createValidationAdapter();
    expect(ext.category).toBe('http');
    expect(asr.category).toBe('http');
    expect(val.category).toBe('http');
  });
});

// ── Cross-adapter consistency ──

describe('cross-adapter consistency', () => {
  it('all adapters accept and parse JSON string sampleResponseBody', () => {
    const jsonStr = JSON.stringify(SAMPLE_BODY);
    const ext = createExtractionAdapter({ sampleResponseBody: jsonStr });
    const asr = createAssertionAdapter({ sampleResponseBody: jsonStr });
    const val = createValidationAdapter({ sampleResponseBody: jsonStr });

    expect(ext.sources[0].sampleData).toEqual(SAMPLE_BODY);
    expect(asr.sources[0].sampleData).toEqual(SAMPLE_BODY);
    expect(val.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('all adapters handle invalid JSON string gracefully', () => {
    const ext = createExtractionAdapter({ sampleResponseBody: '{bad' });
    const asr = createAssertionAdapter({ sampleResponseBody: '{bad' });
    const val = createValidationAdapter({ sampleResponseBody: '{bad' as unknown as string });

    expect(ext.sources[0].sampleData).toBeUndefined();
    expect(asr.sources[0].sampleData).toBeUndefined();
    expect(val.sources[0].sampleData).toBeUndefined();
  });

  it('all adapters return empty mappings for null input', () => {
    const ext = createExtractionAdapter();
    const asr = createAssertionAdapter();
    const val = createValidationAdapter();

    expect(ext.deserialize(null as unknown as Extraction[])).toEqual([]);
    expect(asr.deserialize(null as unknown as never)).toEqual([]);
    expect(val.deserialize(null as unknown as never)).toEqual([]);
  });

  it('extraction serialize → deserialize round-trip preserves data', () => {
    const adapter = createExtractionAdapter({ sampleResponseBody: SAMPLE_BODY });
    const extractions: Extraction[] = [
      { name: 'userId', source: 'body', expression: '$.data.id' },
      { name: 'userName', source: 'body', expression: '$.data.name' },
    ];
    const mappings = adapter.deserialize(extractions);
    const result = adapter.serialize(mappings);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('userId');
    expect(result[0].expression).toBe('$.data.id');
    expect(result[1].name).toBe('userName');
  });

  it('assertion serialize → deserialize round-trip preserves jsonPath', () => {
    const adapter = createAssertionAdapter({
      sampleResponseBody: SAMPLE_BODY,
      initialPattern: 'test-pattern',
      initialPatternName: 'My Pattern',
    });
    const existing = { jsonPath: '$.data.id', pattern: 'test-pattern', patternName: 'My Pattern' };
    const mappings = adapter.deserialize(existing);
    const result = adapter.serialize(mappings);

    expect(result.jsonPath).toBe('$.data.id');
    expect(result.pattern).toBe('test-pattern');
    expect(result.patternName).toBe('My Pattern');
  });

  it('validation include serialize → deserialize round-trip', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: SAMPLE_BODY,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: 'data.id' },
    ];
    const serialized = adapter.serialize(mappings);
    const deserialized = adapter.deserialize(serialized);

    expect(deserialized).toHaveLength(1);
    expect(deserialized[0].sourcePath).toBe('data.id');
    expect(deserialized[0].targetPath).toBe('data.id');
  });

  it('splitExtractions correctly partitions body and non-body', () => {
    const extractions: Extraction[] = [
      { name: 'id', source: 'body', expression: '$.id' },
      { name: 'loc', source: 'header', expression: 'Location' },
      { name: 'code', source: 'status', expression: '' },
    ];
    const { body, nonBody } = splitExtractions(extractions);
    expect(body).toHaveLength(1);
    expect(nonBody).toHaveLength(2);
    expect(body[0].source).toBe('body');
    expect(nonBody.every((e) => e.source !== 'body')).toBe(true);
  });

  it('extraction adapter merges non-body extractions on serialize', () => {
    const headerExtraction: Extraction = { name: 'loc', source: 'header', expression: 'Location' };
    const adapter = createExtractionAdapter({
      sampleResponseBody: SAMPLE_BODY,
      nonBodyExtractions: [headerExtraction],
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'userId' },
    ];
    const result = adapter.serialize(mappings);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(headerExtraction);
    expect(result[1].name).toBe('userId');
    expect(result[1].source).toBe('body');
  });

  it('all adapters validate correctly for valid data', () => {
    const ext = createExtractionAdapter();
    const asr = createAssertionAdapter({ initialPattern: '^[A-Z]' });
    const val = createValidationAdapter({ selectiveMode: 'include' });
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const pop = createPopulateFromApiAdapter({
      dataSource: ds,
      responseJson: { items: [{ id: 1, name: 'A' }] },
      selectedArrayPath: 'items',
    });
    const sdf = createSharedDsFetchAdapter({
      dataSource: ds,
      responseJson: { items: [{ id: 1, name: 'A' }] },
      selectedArrayPath: 'items',
    });

    const extMappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'userId' },
    ];
    const asrMappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'jsonPath' },
    ];
    const valMappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '42' },
    ];
    const popMappings: Mapping[] = [
      { id: 'pop-0', sourceId: 'api-response', sourcePath: 'id', targetPath: 'ID' },
    ];
    const sdfMappings: Mapping[] = [
      { id: 'sdf-0', sourceId: 'shared-ds-response', sourcePath: 'id', targetPath: 'ID' },
    ];
    const demo = createDemoAdapter();
    const demoMappings: Mapping[] = [
      { id: 'd1', sourceId: 'api-response', sourcePath: 'name', targetPath: 'fullName' },
    ];
    const wh = createWebhookExtractionAdapter({ samplePayload: '{"event":"test"}' });
    const whMappings: Mapping[] = [
      { id: 'wh-0', sourceId: 'webhook-payload', sourcePath: '$.event', targetPath: 'eventType' },
    ];
    const vb = createVariableBindingAdapter({
      variableHints: [{ ref: 'orderId', label: 'Order ID', source: { nodeLabel: 'Step', nodeType: 'http', category: 'HTTP Steps' } }],
      templateSlots: [{ ref: 'orderId', location: 'url' }],
    });
    const vbMappings: Mapping[] = [
      { id: 'vb-0', sourceId: 'Step', sourcePath: 'orderId', targetPath: 'orderId' },
    ];

    expect(ext.validate!(extMappings)).toHaveLength(0);
    expect(asr.validate!(asrMappings)).toHaveLength(0);
    expect(val.validate!(valMappings)).toHaveLength(0);
    expect(pop.validate!(popMappings).filter(i => i.severity === 'error')).toHaveLength(0);
    expect(sdf.validate!(sdfMappings).filter(i => i.severity === 'error')).toHaveLength(0);
    expect(demo.validate!(demoMappings).filter(i => i.severity === 'error')).toHaveLength(0);
    expect(wh.validate!(whMappings)).toHaveLength(0);
    expect(vb.validate!(vbMappings)).toHaveLength(0);
  });

  it('populate serialize → deserialize round-trip preserves mapping structure', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const response = { items: [{ userId: '1', name: 'Alice' }] };
    const adapter = createPopulateFromApiAdapter({
      dataSource: ds,
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const mappings: Mapping[] = [
      { id: 'pop-0', sourceId: 'api-response', sourcePath: 'userId', targetPath: 'UserID' },
      { id: 'pop-1', sourceId: 'api-response', sourcePath: 'name', targetPath: 'Name' },
    ];
    const output = adapter.serialize(mappings);
    const roundTripped = adapter.deserialize(output);

    expect(roundTripped).toHaveLength(2);
    expect(roundTripped[0].sourcePath).toBe('userId');
    expect(roundTripped[0].targetPath).toBe('UserID');
    expect(roundTripped[1].sourcePath).toBe('name');
    expect(roundTripped[1].targetPath).toBe('Name');
  });

  it('populate adapter has data-source category', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const adapter = createPopulateFromApiAdapter({ dataSource: ds });
    expect(adapter.category).toBe('data-source');
  });

  it('column-mapping serialize → deserialize round-trip preserves type and mapping', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'VIN', type: 'path', mapping: 'vin' },
      { id: 'c2', name: 'Channel', type: 'param', mapping: 'channel' },
    ];
    const scenario = { id: 's1', name: 'T', url: 'https://a.com/{{vin}}?ch={{channel}}', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } as Scenario;
    const adapter = createColumnMappingAdapter({ columns: cols, scenario });
    const mappings = adapter.deserialize(cols);
    const output = adapter.serialize(mappings);
    expect(output[0].type).toBe('path');
    expect(output[0].mapping).toBe('vin');
    expect(output[1].type).toBe('param');
    expect(output[1].mapping).toBe('channel');
  });

  it('column-mapping adapter has data-source category', () => {
    const scenario = { id: 's1', name: 'T', url: 'https://a.com/{{v}}', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } as Scenario;
    const adapter = createColumnMappingAdapter({ columns: [], scenario });
    expect(adapter.category).toBe('data-source');
  });

  it('shared-ds-fetch adapter source matches expected sourceId', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const adapter = createSharedDsFetchAdapter({ dataSource: ds });
    expect(adapter.sources[0].id).toBe('shared-ds-response');
    expect(adapter.sources[0].label).toBe('Shared DS API Response');
  });

  it('shared-ds-fetch serialize → deserialize round-trip preserves mapping structure', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const response = { items: [{ userId: '1', name: 'Alice' }] };
    const adapter = createSharedDsFetchAdapter({
      dataSource: ds,
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: 'shared-ds-response', sourcePath: 'userId', targetPath: 'UserID' },
      { id: 'sdf-1', sourceId: 'shared-ds-response', sourcePath: 'name', targetPath: 'Name' },
    ];
    const output = adapter.serialize(mappings);
    const roundTripped = adapter.deserialize(output);

    expect(roundTripped).toHaveLength(2);
    expect(roundTripped[0].sourcePath).toBe('userId');
    expect(roundTripped[0].targetPath).toBe('UserID');
    expect(roundTripped[1].sourcePath).toBe('name');
    expect(roundTripped[1].targetPath).toBe('Name');
  });

  it('shared-ds-fetch adapter has data-source category', () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const adapter = createSharedDsFetchAdapter({ dataSource: ds });
    expect(adapter.category).toBe('data-source');
  });

  it('shared-ds-fetch adapter delegates fetchSampleData', async () => {
    const ds: DataSource = { id: 'ds1', columns: [], rows: [], source: { type: 'inline' } };
    const mockFetch = vi.fn().mockResolvedValue({ items: [{ x: 1 }] });
    const adapter = createSharedDsFetchAdapter({
      dataSource: ds,
      fetchSampleData: mockFetch,
    });
    expect(adapter.fetchSampleData).toBeDefined();
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ x: 1 });
  });

  it('webhook-extraction adapter source matches expected sourceId', () => {
    const adapter = createWebhookExtractionAdapter({ samplePayload: '{"event":"test"}' });
    expect(adapter.sources[0].id).toBe('webhook-payload');
    expect(adapter.sources[0].label).toBe('Webhook Payload');
  });

  it('webhook-extraction adapter has webhook category', () => {
    const adapter = createWebhookExtractionAdapter();
    expect(adapter.category).toBe('webhook');
  });

  it('webhook-extraction serialize → deserialize round-trip preserves structure', () => {
    const adapter = createWebhookExtractionAdapter({
      samplePayload: '{"data":{"id":"123","name":"test"}}',
    });
    const mappings: Mapping[] = [
      { id: 'wh-0', sourceId: 'webhook-payload', sourcePath: '$.data.id', targetPath: 'recordId' },
      { id: 'wh-1', sourceId: 'webhook-payload', sourcePath: '$.data.name', targetPath: 'recordName' },
    ];
    const serialized = adapter.serialize(mappings);
    const restored = adapter.deserialize(serialized);

    expect(restored).toHaveLength(2);
    expect(restored[0].sourcePath).toBe('$.data.id');
    expect(restored[0].targetPath).toBe('recordId');
    expect(restored[1].sourcePath).toBe('$.data.name');
    expect(restored[1].targetPath).toBe('recordName');
  });

  it('variable-binding adapter has workflow category', () => {
    const adapter = createVariableBindingAdapter({ variableHints: [], templateSlots: [] });
    expect(adapter.category).toBe('workflow');
  });

  it('variable-binding serialize → deserialize round-trip preserves structure', () => {
    const hints = [
      { ref: 'token', label: 'Token', source: { nodeId: 'n1', nodeLabel: 'Auth', nodeType: 'http', category: 'HTTP Steps' } },
      { ref: 'userId', label: 'User', source: { nodeId: 'n2', nodeLabel: 'GetUser', nodeType: 'http', category: 'HTTP Steps' } },
    ];
    const slots = [
      { ref: 'token', location: 'header' as const, headerKey: 'Authorization' },
      { ref: 'userId', location: 'url' as const },
    ];
    const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
    const mappings: Mapping[] = [
      { id: 'vb-0', sourceId: 'n1', sourcePath: 'token', targetPath: 'token' },
      { id: 'vb-1', sourceId: 'n2', sourcePath: 'userId', targetPath: 'userId' },
    ];
    const serialized = adapter.serialize(mappings);
    const restored = adapter.deserialize(serialized);

    expect(restored).toHaveLength(2);
    expect(restored[0].sourcePath).toBe('token');
    expect(restored[0].targetPath).toBe('token');
    expect(restored[0].sourceId).toBe('n1');
    expect(restored[1].sourcePath).toBe('userId');
    expect(restored[1].targetPath).toBe('userId');
    expect(restored[1].sourceId).toBe('n2');
  });
});
