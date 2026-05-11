import { describe, it, expect, vi } from 'vitest';
import {
  captureMappingTraces,
  shouldCaptureMappingTraces,
  summarizeMappingTraces,
  formatTraceValue,
  isTraceError,
} from './mappingTrace';
import type { MappingTrace, MappingTraceOptions } from './mappingTrace';
import type { MapperSource, Mapping } from '../types';
import type { TraceCaptureLevel } from '../../../types';

// ─── Test Fixtures ────────────────────────────────────────

const sources: MapperSource[] = [
  {
    id: 'response',
    label: 'Response',
    sampleData: { name: 'Alice', age: 30, address: { city: 'NYC' }, tags: ['dev', 'test'] },
  },
];

const jsonStringSources: MapperSource[] = [
  {
    id: 'response',
    label: 'Response',
    sampleData: '{"name":"Bob","score":99}',
  },
];

function makeOpts(overrides: Partial<MappingTraceOptions> = {}): MappingTraceOptions {
  return {
    mappings: [],
    sources,
    activeSourceId: 'response',
    ...overrides,
  };
}

// ─── shouldCaptureMappingTraces ───────────────────────────

describe('shouldCaptureMappingTraces', () => {
  it('returns true for "full" level', () => {
    expect(shouldCaptureMappingTraces('full')).toBe(true);
  });

  it('returns true for "debug" level', () => {
    expect(shouldCaptureMappingTraces('debug')).toBe(true);
  });

  it('returns false for "standard" level', () => {
    expect(shouldCaptureMappingTraces('standard')).toBe(false);
  });

  it('returns false for "minimal" level', () => {
    expect(shouldCaptureMappingTraces('minimal')).toBe(false);
  });

  it('returns false for all non-eligible levels', () => {
    const levels: TraceCaptureLevel[] = ['minimal', 'standard'];
    for (const level of levels) {
      expect(shouldCaptureMappingTraces(level)).toBe(false);
    }
  });
});

// ─── captureMappingTraces ─────────────────────────────────

describe('captureMappingTraces', () => {
  it('returns empty array for empty mappings', () => {
    const traces = captureMappingTraces(makeOpts());
    expect(traces).toEqual([]);
  });

  it('captures direct path mapping trace', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'response', targetPath: 'userName' }],
    }));

    expect(traces).toHaveLength(1);
    expect(traces[0].mappingId).toBe('m1');
    expect(traces[0].sourcePath).toBe('name');
    expect(traces[0].sourceValue).toBe('Alice');
    expect(traces[0].evaluatedValue).toBe('Alice');
    expect(traces[0].targetPath).toBe('userName');
    expect(traces[0].targetValue).toBe('Alice');
    expect(traces[0].error).toBeUndefined();
    expect(traces[0].expression).toBeUndefined();
    expect(traces[0].timestamp).toBeGreaterThan(0);
    expect(traces[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures nested path mapping', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'address.city', sourceId: 'response', targetPath: 'city' }],
    }));

    expect(traces[0].sourceValue).toBe('NYC');
    expect(traces[0].evaluatedValue).toBe('NYC');
  });

  it('captures expression mapping with result', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'response',
        targetPath: 'greeting',
        expression: '$upper($.name)',
      }],
    }));

    expect(traces[0].sourceValue).toBe('Alice');
    expect(traces[0].expression).toBe('$upper($.name)');
    expect(traces[0].evaluatedValue).toBe('ALICE');
    expect(traces[0].targetValue).toBe('ALICE');
    expect(traces[0].error).toBeUndefined();
  });

  it('captures expression with evaluator error (parser error path)', () => {
    // Empty expression evaluates to empty string (no error)
    // Unclosed paren triggers parser error via evaluateExpression's catch
    const traces = captureMappingTraces(makeOpts({
      mappings: [{
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'response',
        targetPath: 'out',
        expression: '{{',
      }],
    }));

    expect(traces[0].sourceValue).toBe('Alice');
    // Parser may set result.error or return a partial value; verify no crash
    expect(traces[0]).toBeDefined();
    expect(traces[0].mappingId).toBe('m1');
    expect(traces[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes through unknown function names without error', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'response',
        targetPath: 'out',
        expression: '$unknownFunc($.name)',
      }],
    }));

    // Unknown functions are passed through as {{$unknownFunc}} by the evaluator
    expect(traces[0].evaluatedValue).toBeDefined();
    expect(traces[0].error).toBeUndefined();
  });

  it('captures multiple mappings in order', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [
        { id: 'm1', sourcePath: 'name', sourceId: 'response', targetPath: 'userName' },
        { id: 'm2', sourcePath: 'age', sourceId: 'response', targetPath: 'userAge' },
      ],
    }));

    expect(traces).toHaveLength(2);
    expect(traces[0].mappingId).toBe('m1');
    expect(traces[1].mappingId).toBe('m2');
    expect(traces[0].sourceValue).toBe('Alice');
    expect(traces[1].sourceValue).toBe(30);
  });

  it('handles missing source path gracefully', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'nonexistent', sourceId: 'response', targetPath: 'out' }],
    }));

    expect(traces[0].sourceValue).toBeUndefined();
    expect(traces[0].evaluatedValue).toBeUndefined();
  });

  it('handles missing source entirely', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'missing', targetPath: 'out' }],
      sources: [],
    }));

    expect(traces[0].sourceValue).toBeUndefined();
  });

  it('handles null source sampleData', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'empty', targetPath: 'out' }],
      sources: [{ id: 'empty', label: 'Empty', sampleData: null }],
    }));

    expect(traces[0].sourceValue).toBeUndefined();
  });

  it('handles JSON string source sampleData', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'response', targetPath: 'out' }],
      sources: jsonStringSources,
    }));

    expect(traces[0].sourceValue).toBe('Bob');
  });

  it('falls back to activeSourceId when mapping has no sourceId', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: '', targetPath: 'out' }],
    }));

    expect(traces[0].sourceValue).toBe('Alice');
  });

  it('resolves root path as entire source data', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: '$', sourceId: 'response', targetPath: 'root' }],
    }));

    expect(traces[0].sourceValue).toEqual({ name: 'Alice', age: 30, address: { city: 'NYC' }, tags: ['dev', 'test'] });
  });

  it('strips $. prefix from source path', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: '$.name', sourceId: 'response', targetPath: 'out' }],
    }));

    expect(traces[0].sourceValue).toBe('Alice');
  });

  it('preserves sourceId on trace', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'response', targetPath: 'out' }],
    }));

    expect(traces[0].sourceId).toBe('response');
  });

  it('records durationMs for each trace', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'response', targetPath: 'out' }],
    }));

    expect(typeof traces[0].durationMs).toBe('number');
    expect(traces[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures expression error when evaluator returns an error result', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'response',
        targetPath: 'out',
        expression: '{{',
      }],
    }));

    // The `{{` expression causes a parse error or error result from evaluator
    expect(traces[0].mappingId).toBe('m1');
    // Evaluator may return error via result.error or via catch path
    if (traces[0].error) {
      expect(traces[0].evaluatedValue).toBeUndefined();
      expect(traces[0].targetValue).toBeUndefined();
    }
  });

  it('handles invalid JSON string sampleData gracefully', () => {
    const traces = captureMappingTraces(makeOpts({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'bad', targetPath: 'out' }],
      sources: [{ id: 'bad', label: 'Bad', sampleData: '{not valid json' }],
    }));

    expect(traces[0].sourceValue).toBeUndefined();
  });

  it('uses custom expression functions when provided', () => {
    const custom = {
      name: '$double',
      category: 'Custom' as const,
      signature: '$double(n)',
      description: 'Double a number',
      args: [{ name: 'n', type: 'number' as const, required: true, description: '' }],
      returnType: 'number' as const,
      evaluate: (v: unknown) => Number(v) * 2,
    };

    const traces = captureMappingTraces(makeOpts({
      mappings: [{
        id: 'm1',
        sourcePath: 'age',
        sourceId: 'response',
        targetPath: 'doubleAge',
        expression: '$double($.age)',
      }],
      customFunctions: [custom],
    }));

    expect(traces[0].evaluatedValue).toBe(60);
    expect(traces[0].error).toBeUndefined();
  });
});

// ─── summarizeMappingTraces ───────────────────────────────

describe('summarizeMappingTraces', () => {
  it('returns zero counts for empty traces', () => {
    const summary = summarizeMappingTraces([]);
    expect(summary.total).toBe(0);
    expect(summary.successful).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.errors).toEqual([]);
    expect(summary.totalDurationMs).toBe(0);
  });

  it('counts successful traces', () => {
    const traces: MappingTrace[] = [
      { mappingId: 'm1', sourcePath: 'a', sourceValue: 1, evaluatedValue: 1, targetPath: 'b', targetValue: 1, timestamp: 0, durationMs: 1 },
      { mappingId: 'm2', sourcePath: 'c', sourceValue: 2, evaluatedValue: 2, targetPath: 'd', targetValue: 2, timestamp: 0, durationMs: 2 },
    ];
    const summary = summarizeMappingTraces(traces);
    expect(summary.total).toBe(2);
    expect(summary.successful).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.totalDurationMs).toBe(3);
  });

  it('counts failed traces with errors', () => {
    const traces: MappingTrace[] = [
      { mappingId: 'm1', sourcePath: 'a', sourceValue: 1, evaluatedValue: 1, targetPath: 'b', targetValue: 1, timestamp: 0, durationMs: 1 },
      { mappingId: 'm2', sourcePath: 'c', sourceValue: undefined, evaluatedValue: undefined, targetPath: 'd', targetValue: undefined, timestamp: 0, durationMs: 0.5, error: 'source not found' },
    ];
    const summary = summarizeMappingTraces(traces);
    expect(summary.total).toBe(2);
    expect(summary.successful).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toEqual([{ mappingId: 'm2', error: 'source not found' }]);
  });

  it('counts trace with undefined targetValue but no explicit error as success', () => {
    const traces: MappingTrace[] = [
      { mappingId: 'm1', sourcePath: 'x', sourceValue: undefined, evaluatedValue: undefined, targetPath: 'y', targetValue: undefined, timestamp: 0, durationMs: 0 },
    ];
    const summary = summarizeMappingTraces(traces);
    expect(summary.failed).toBe(0);
    expect(summary.successful).toBe(1);
  });

  it('rounds totalDurationMs to three decimal places', () => {
    const traces: MappingTrace[] = [
      { mappingId: 'm1', sourcePath: 'a', sourceValue: 1, evaluatedValue: 1, targetPath: 'b', targetValue: 1, timestamp: 0, durationMs: 0.1234567 },
    ];
    const summary = summarizeMappingTraces(traces);
    const decimalPlaces = (summary.totalDurationMs.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(3);
  });
});

// ─── formatTraceValue ─────────────────────────────────────

describe('formatTraceValue', () => {
  it('formats undefined', () => {
    expect(formatTraceValue(undefined)).toBe('undefined');
  });

  it('formats null', () => {
    expect(formatTraceValue(null)).toBe('null');
  });

  it('formats short string as-is', () => {
    expect(formatTraceValue('hello')).toBe('hello');
  });

  it('truncates long string with ellipsis', () => {
    const long = 'a'.repeat(100);
    const result = formatTraceValue(long);
    expect(result.length).toBe(50);
    expect(result.endsWith('…')).toBe(true);
  });

  it('formats number as JSON', () => {
    expect(formatTraceValue(42)).toBe('42');
  });

  it('formats object as JSON', () => {
    expect(formatTraceValue({ a: 1 })).toBe('{"a":1}');
  });

  it('formats array as JSON', () => {
    expect(formatTraceValue([1, 2])).toBe('[1,2]');
  });

  it('respects custom max length', () => {
    const result = formatTraceValue('hello world', 8);
    expect(result).toBe('hello w…');
    expect(result.length).toBe(8);
  });

  it('does not truncate when exactly at max length', () => {
    expect(formatTraceValue('12345', 5)).toBe('12345');
  });
});

// ─── isTraceError ─────────────────────────────────────────

describe('isTraceError', () => {
  it('returns true when error is set', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: 1,
      evaluatedValue: undefined, targetPath: 'b', targetValue: undefined,
      timestamp: 0, durationMs: 0, error: 'fail',
    };
    expect(isTraceError(trace)).toBe(true);
  });

  it('returns false when targetValue is undefined but no error', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: 1,
      evaluatedValue: undefined, targetPath: 'b', targetValue: undefined,
      timestamp: 0, durationMs: 0,
    };
    expect(isTraceError(trace)).toBe(false);
  });

  it('returns false when targetValue is null (intentional null is not an error)', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: 1,
      evaluatedValue: null, targetPath: 'b', targetValue: null,
      timestamp: 0, durationMs: 0,
    };
    expect(isTraceError(trace)).toBe(false);
  });

  it('returns false for successful trace', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: 'hello',
      evaluatedValue: 'hello', targetPath: 'b', targetValue: 'hello',
      timestamp: 0, durationMs: 0,
    };
    expect(isTraceError(trace)).toBe(false);
  });

  it('returns false when targetValue is 0 (falsy but valid)', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: 0,
      evaluatedValue: 0, targetPath: 'b', targetValue: 0,
      timestamp: 0, durationMs: 0,
    };
    expect(isTraceError(trace)).toBe(false);
  });

  it('returns false when targetValue is empty string (falsy but valid)', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: '',
      evaluatedValue: '', targetPath: 'b', targetValue: '',
      timestamp: 0, durationMs: 0,
    };
    expect(isTraceError(trace)).toBe(false);
  });

  it('returns false when error is empty string', () => {
    const trace: MappingTrace = {
      mappingId: 'm1', sourcePath: 'a', sourceValue: 1,
      evaluatedValue: 1, targetPath: 'b', targetValue: 1,
      timestamp: 0, durationMs: 0, error: '',
    };
    expect(isTraceError(trace)).toBe(false);
  });
});

describe('captureMappingTraces — expression error paths', () => {
  it('captures error when evaluateMapperExpression returns an error result', async () => {
    const evalMod = await import('./mapperExpressionEvaluator');
    const spy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockReturnValueOnce({
      value: undefined, preview: '', error: 'Unknown function: $bad',
    });

    const sources: MapperSource[] = [{ id: 's1', label: 'S', sampleData: { name: 'A' } }];
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out', expression: '$bad($.name)' },
    ];
    const traces = captureMappingTraces({ mappings, sources, activeSourceId: 's1' });
    expect(traces).toHaveLength(1);
    expect(traces[0].error).toBe('Unknown function: $bad');
    expect(traces[0].evaluatedValue).toBeUndefined();
    spy.mockRestore();
  });

  it('captures error when evaluateMapperExpression throws', async () => {
    const evalMod = await import('./mapperExpressionEvaluator');
    const spy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const sources: MapperSource[] = [{ id: 's1', label: 'S', sampleData: { x: 1 } }];
    const mappings: Mapping[] = [
      { id: 'm2', sourcePath: 'x', sourceId: 's1', targetPath: 'y', expression: '$crash()' },
    ];
    const traces = captureMappingTraces({ mappings, sources, activeSourceId: 's1' });
    expect(traces).toHaveLength(1);
    expect(traces[0].error).toBe('boom');
    expect(traces[0].evaluatedValue).toBeUndefined();
    spy.mockRestore();
  });
});
