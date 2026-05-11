import { describe, it, expect } from 'vitest';
import { exportMappingTraces, importMappingTraces, extractAllMappingTraces } from './traceExportImport';
import type { MappingTrace } from './mappingTrace';

function makeTrace(overrides: Partial<MappingTrace> & { mappingId: string }): MappingTrace {
  return {
    sourcePath: 'name',
    sourceValue: 'Alice',
    targetPath: 'userName',
    targetValue: 'Alice',
    timestamp: 1700000000000,
    durationMs: 1.5,
    ...overrides,
  };
}

describe('exportMappingTraces', () => {
  it('produces version 1 envelope', () => {
    const result = exportMappingTraces([makeTrace({ mappingId: 'm1' })]);
    expect(result.version).toBe(1);
    expect(result.traces).toHaveLength(1);
    expect(result.exportedAt).toBeTruthy();
  });

  it('includes metadata when provided', () => {
    const result = exportMappingTraces([makeTrace({ mappingId: 'm1' })], {
      workflowId: 'wf1',
      workflowName: 'Test Flow',
      iterationIndex: 0,
      nodeId: 'n1',
      nodeLabel: 'API Call',
    });
    expect(result.workflowId).toBe('wf1');
    expect(result.workflowName).toBe('Test Flow');
    expect(result.nodeLabel).toBe('API Call');
  });

  it('round-trips through export then import', () => {
    const original = [
      makeTrace({ mappingId: 'm1', expression: '$upper($.name)', error: undefined }),
      makeTrace({ mappingId: 'm2', targetValue: null, sourceId: 's2' }),
    ];
    const exported = exportMappingTraces(original);
    const json = JSON.parse(JSON.stringify(exported));
    const imported = importMappingTraces(json);
    expect(imported).toHaveLength(2);
    expect(imported[0].mappingId).toBe('m1');
    expect(imported[0].expression).toBe('$upper($.name)');
    expect(imported[1].sourceId).toBe('s2');
  });
});

describe('importMappingTraces', () => {
  it('rejects non-object input', () => {
    expect(() => importMappingTraces(null)).toThrow('expected a JSON object');
    expect(() => importMappingTraces('string')).toThrow('expected a JSON object');
  });

  it('rejects unsupported version', () => {
    expect(() => importMappingTraces({ version: 2, traces: [] })).toThrow('Unsupported');
  });

  it('rejects missing traces array', () => {
    expect(() => importMappingTraces({ version: 1 })).toThrow('"traces" must be an array');
  });

  it('rejects trace without mappingId', () => {
    expect(() => importMappingTraces({
      version: 1,
      traces: [{ sourcePath: 'a', targetPath: 'b' }],
    })).toThrow('missing "mappingId"');
  });

  it('rejects trace without sourcePath', () => {
    expect(() => importMappingTraces({
      version: 1,
      traces: [{ mappingId: 'm1', targetPath: 'b' }],
    })).toThrow('missing "sourcePath"');
  });

  it('rejects trace without targetPath', () => {
    expect(() => importMappingTraces({
      version: 1,
      traces: [{ mappingId: 'm1', sourcePath: 'a' }],
    })).toThrow('missing "targetPath"');
  });

  it('defaults timestamp and durationMs for incomplete traces', () => {
    const result = importMappingTraces({
      version: 1,
      traces: [{ mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }],
    });
    expect(result[0].timestamp).toBeGreaterThan(0);
    expect(result[0].durationMs).toBe(0);
  });

  it('preserves all valid fields', () => {
    const result = importMappingTraces({
      version: 1,
      traces: [{
        mappingId: 'm1',
        sourcePath: 'a',
        targetPath: 'b',
        sourceId: 's1',
        sourceValue: 42,
        expression: '$add($.a, 1)',
        evaluatedValue: 43,
        targetValue: 43,
        timestamp: 12345,
        durationMs: 2.5,
        error: 'oops',
      }],
    });
    expect(result[0].sourceId).toBe('s1');
    expect(result[0].sourceValue).toBe(42);
    expect(result[0].expression).toBe('$add($.a, 1)');
    expect(result[0].evaluatedValue).toBe(43);
    expect(result[0].error).toBe('oops');
    expect(result[0].durationMs).toBe(2.5);
  });
});

describe('extractAllMappingTraces', () => {
  it('extracts traces from multiple iterations and events', () => {
    const trace1 = makeTrace({ mappingId: 'm1' });
    const trace2 = makeTrace({ mappingId: 'm2' });
    const executionTrace = {
      iterations: [
        {
          index: 0,
          events: [
            { nodeId: 'n1', nodeLabel: 'Node A', details: { mappingTraces: [trace1] } },
          ],
        },
        {
          index: 1,
          events: [
            { nodeId: 'n2', nodeLabel: 'Node B', details: { mappingTraces: [trace2] } },
            { nodeId: 'n3', nodeLabel: 'Node C', details: {} },
          ],
        },
      ],
    };
    const result = extractAllMappingTraces(executionTrace);
    expect(result).toHaveLength(2);
    expect(result[0].iterationIndex).toBe(0);
    expect(result[0].nodeId).toBe('n1');
    expect(result[0].nodeLabel).toBe('Node A');
    expect(result[1].iterationIndex).toBe(1);
    expect(result[1].nodeId).toBe('n2');
  });

  it('returns empty array when no mapping traces exist', () => {
    const executionTrace = {
      iterations: [{
        index: 0,
        events: [{ nodeId: 'n1', nodeLabel: 'Node', details: {} }],
      }],
    };
    expect(extractAllMappingTraces(executionTrace)).toHaveLength(0);
  });

  it('handles events without details', () => {
    const executionTrace = {
      iterations: [{
        index: 0,
        events: [{ nodeId: 'n1', nodeLabel: 'Node' }],
      }],
    };
    expect(extractAllMappingTraces(executionTrace)).toHaveLength(0);
  });
});
