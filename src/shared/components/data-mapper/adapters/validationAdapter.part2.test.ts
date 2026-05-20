import { describe, it, expect, vi, afterEach } from 'vitest';
import { createValidationAdapter, type ValidationAdapterOutput, } from './validationAdapter';
import { Mapping } from '../types';
import * as mapperExpr from '../utils/mapperExpressionEvaluator';

// ── Fixtures ──────────────────────────────────────────────

const _SAMPLE_BODY = {
  data: {
    id: 42,
    name: 'Alice',
    active: true,
  },
  meta: {
    total: 100,
  },
};

const _INCLUDE_OUTPUT: ValidationAdapterOutput = {
  selectiveMode: 'include',
  expectedFields: [
    { jsonPath: 'data.id', expectedValue: '42' },
    { jsonPath: 'data.name', expectedValue: 'Alice' },
  ],
  excludedPaths: [],
};

const _EXCLUDE_OUTPUT: ValidationAdapterOutput = {
  selectiveMode: 'exclude',
  expectedFields: [
    { jsonPath: 'data.id', expectedValue: '42' },
    { jsonPath: 'data.name', expectedValue: 'Alice' },
  ],
  excludedPaths: ['data.active', 'meta.total'],
};

// ── Adapter creation ──────────────────────────────────────

describe('validationAdapter — operator round-trip', () => {
  it('serialize preserves operator and operatorValue from mappings', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { price: 99, name: 'OnStar' },
      selectiveMode: 'include',
    });
    const mappings = [
      { id: 'v1', sourceId: 'response', sourcePath: 'price', targetPath: 'price', operator: 'greater_than' as const, operatorValue: '50' },
      { id: 'v2', sourceId: 'response', sourcePath: 'name', targetPath: 'name', operator: 'contains' as const, operatorValue: 'Star' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('greater_than');
    expect(output.expectedFields[0].operatorValue).toBe('50');
    expect(output.expectedFields[1].operator).toBe('contains');
    expect(output.expectedFields[1].operatorValue).toBe('Star');
  });

  it('serialize applies autoMapDefaultOperator only to auto-mapped fields', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { name: 'Alice', age: '30' },
      selectiveMode: 'include',
    });
    const mappings = [
      { id: 'v1', sourceId: 'response', sourcePath: 'name', targetPath: 'name', isAutoMapped: true },
      { id: 'v2', sourceId: 'response', sourcePath: 'age', targetPath: 'age' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('equals');
    expect(output.expectedFields[0].operatorValue).toBeUndefined();
    expect(output.expectedFields[1].operator).toBe('equals');
  });

  it('serialize resolves expectedValue from expression ref when expression is set', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { nested: { value: 'from-expr' } },
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      {
        id: 'v1',
        sourceId: 'response-body',
        sourcePath: 'wrong',
        targetPath: 'display',
        expression: 'nested.value',
      },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].jsonPath).toBe('wrong');
    expect(output.expectedFields[0].expectedValue).toBe('from-expr');
  });

  it('serialize falls back to sourcePath value when expression resolves to undefined', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { ok: true },
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      {
        id: 'v1',
        sourceId: 'response-body',
        sourcePath: 'ok',
        targetPath: 'fallback-path',
        expression: 'missing.leaf',
      },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].expectedValue).toBe('true');
  });

  it('serialize skips array/object mappings from expectedFields', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { nums: [1, 2], obj: { a: 1 }, leaf: 'ok' },
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      { id: 'v1', sourceId: 'response-body', sourcePath: 'nums', targetPath: 'nums', expression: 'nums' },
      { id: 'v2', sourceId: 'response-body', sourcePath: 'obj', targetPath: 'obj' },
      { id: 'v3', sourceId: 'response-body', sourcePath: 'leaf', targetPath: 'leaf' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields).toHaveLength(1);
    expect(output.expectedFields[0].jsonPath).toBe('leaf');
  });

  it('deserialize restores operator and operatorValue into mappings', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { price: 99, active: true },
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'price', expectedValue: '', operator: 'greater_than', operatorValue: '10' },
        { jsonPath: 'active', expectedValue: '', operator: 'is_true' },
      ],
    });
    const output = {
      selectiveMode: 'include' as const,
      expectedFields: [
        { jsonPath: 'price', expectedValue: '', operator: 'greater_than' as const, operatorValue: '10' },
        { jsonPath: 'active', expectedValue: '', operator: 'is_true' as const },
      ],
      excludedPaths: [],
    };
    const mappings = adapter.deserialize(output);
    expect(mappings[0].operator).toBe('greater_than');
    expect(mappings[0].operatorValue).toBe('10');
    expect(mappings[1].operator).toBe('is_true');
    expect(mappings[1].operatorValue).toBeUndefined();
  });

  it('full round-trip: serialize → deserialize preserves operator data', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { score: 95, status: 'active' },
      selectiveMode: 'include',
    });
    const original = [
      { id: 'v1', sourceId: 'response', sourcePath: 'score', targetPath: 'score', operator: 'between' as const, operatorValue: '80,100' },
      { id: 'v2', sourceId: 'response', sourcePath: 'status', targetPath: 'status', operator: 'in' as const, operatorValue: '["active","pending"]' },
    ];
    const serialized = adapter.serialize(original);
    const deserialized = adapter.deserialize(serialized);
    expect(deserialized[0].operator).toBe('between');
    expect(deserialized[0].operatorValue).toBe('80,100');
    expect(deserialized[1].operator).toBe('in');
    expect(deserialized[1].operatorValue).toBe('["active","pending"]');
  });

  it('backward compatible: deserialize handles fields without operators (defaults to equals)', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { name: 'Alice' },
      selectiveMode: 'include',
      expectedFields: [{ jsonPath: 'name', expectedValue: '"Alice"' }],
    });
    const output = {
      selectiveMode: 'include' as const,
      expectedFields: [{ jsonPath: 'name', expectedValue: '"Alice"' }],
      excludedPaths: [],
    };
    const mappings = adapter.deserialize(output);
    expect(mappings[0].operator).toBe('equals');
    expect(mappings[0].operatorValue).toBeUndefined();
  });

  it('deserialize restores negate on expected fields (include mode)', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: { a: 1 } });
    const mappings = adapter.deserialize({
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'a', expectedValue: '1', operator: 'equals', operatorValue: '2', negate: true },
      ],
      excludedPaths: [],
    });
    expect(mappings[0].negate).toBe(true);
    expect(mappings[0].operator).toBe('equals');
  });

  it('deserialize restores negate when merging stored fields in exclude mode', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { keep: 1, drop: 2 },
      selectiveMode: 'exclude',
    });
    const mappings = adapter.deserialize({
      selectiveMode: 'exclude',
      expectedFields: [{ jsonPath: 'keep', expectedValue: '9', operator: 'greater_than', operatorValue: '0', negate: true }],
      excludedPaths: ['drop'],
    });
    const m = mappings.find((x) => x.sourcePath === 'keep');
    expect(m?.negate).toBe(true);
    expect(m?.operator).toBe('greater_than');
  });
});

describe('validationAdapter — resolveExpectedValue branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses getByPath fallback when evaluated expression stringifies to a template-like placeholder', () => {
    vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockReturnValue({
      value: '{{token}}',
      preview: '',
    });
    const adapter = createValidationAdapter({
      sampleResponseBody: { exprLeaf: 'resolved-from-path' },
      selectiveMode: 'include',
    });
    const out = adapter.serialize([
      {
        id: 'm1',
        sourceId: 'response-body',
        sourcePath: 'ignored',
        targetPath: 'out',
        expression: 'exprLeaf',
      },
    ]);
    expect(out.expectedFields[0].expectedValue).toBe('resolved-from-path');
  });

  it('JSON-stringifies non-string path values resolved from expression-as-path', () => {
    vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockReturnValue({
      value: '{{skip}}',
      preview: '',
    });
    const adapter = createValidationAdapter({
      sampleResponseBody: { exprLeaf: { nested: true } },
      selectiveMode: 'include',
    });
    const out = adapter.serialize([
      {
        id: 'm1',
        sourceId: 'response-body',
        sourcePath: 'ignored',
        targetPath: 'out',
        expression: 'exprLeaf',
      },
    ]);
    expect(out.expectedFields[0].expectedValue).toBe('{"nested":true}');
  });

  it('uses operatorValue when source sample does not contain sourcePath', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { other: 1 },
      selectiveMode: 'include',
    });
    const out = adapter.serialize([
      {
        id: 'm1',
        sourceId: 'response-body',
        sourcePath: 'missing.leaf',
        targetPath: 'missing.leaf',
        operatorValue: 'fallback-lit',
      },
    ]);
    expect(out.expectedFields[0].expectedValue).toBe('fallback-lit');
  });

  it('falls back to targetPath when sample lacks sourcePath and operatorValue', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { other: 1 },
      selectiveMode: 'include',
    });
    const out = adapter.serialize([
      {
        id: 'm1',
        sourceId: 'response-body',
        sourcePath: 'missing.leaf',
        targetPath: 'use-this-target',
      },
    ]);
    expect(out.expectedFields[0].expectedValue).toBe('use-this-target');
  });
});

describe('validationAdapter — deserialize container/object filtering', () => {
  it('include mode drops object-shaped fields unless operator is a container op', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { wrap: { inner: 1 } },
      selectiveMode: 'include',
    });
    const mappings = adapter.deserialize({
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'wrap', expectedValue: 'ignored', operator: 'equals' },
        { jsonPath: 'wrap.inner', expectedValue: '1' },
      ],
      excludedPaths: [],
    });
    expect(mappings.map((m) => m.sourcePath)).toEqual(['wrap.inner']);
  });

  it('include mode retains object fields mapped with is_empty container operator', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { wrap: { inner: 1 } },
      selectiveMode: 'include',
    });
    const mappings = adapter.deserialize({
      selectiveMode: 'include',
      expectedFields: [{ jsonPath: 'wrap', expectedValue: '', operator: 'is_empty' }],
      excludedPaths: [],
    });
    expect(mappings).toHaveLength(1);
    expect(mappings[0].sourcePath).toBe('wrap');
    expect(mappings[0].operator).toBe('is_empty');
  });
});

describe('expression round-trip through serialize/deserialize', () => {
  it('serialize preserves expression on ExpectedField', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { name: 'Alice', items: [1, 2, 3] },
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      { id: 'v1', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name', expression: '$upper($.name)', operator: 'equals' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].expression).toBe('$upper($.name)');
  });

  it('serialize omits expression when mapping has none', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { name: 'Alice' },
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      { id: 'v1', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name', operator: 'equals' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].expression).toBeUndefined();
  });

  it('deserialize restores expression onto Mapping', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { name: 'Alice' },
      selectiveMode: 'include',
    });
    const mappings = adapter.deserialize({
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'name', expectedValue: 'ALICE', operator: 'equals', expression: '$upper($.name)' },
      ],
      excludedPaths: [],
    });
    expect(mappings).toHaveLength(1);
    expect(mappings[0].expression).toBe('$upper($.name)');
  });

  it('full round-trip: serialize → deserialize preserves expression', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { name: 'Alice', score: 42 },
      selectiveMode: 'include',
    });
    const original: Mapping[] = [
      { id: 'v1', sourceId: 'response-body', sourcePath: 'score', targetPath: 'score', expression: '$add($.score, 1)', operator: 'equals' },
    ];
    const serialized = adapter.serialize(original);
    expect(serialized.expectedFields[0].expression).toBe('$add($.score, 1)');

    const deserialized = adapter.deserialize(serialized);
    expect(deserialized[0].expression).toBe('$add($.score, 1)');
  });
});
