import { describe, it, expect } from 'vitest';
import {
  serializeMappings,
  deserializeMappings,
  validateMappings,
  roundTripMappings,
} from './mappingSerializer';
import type { Mapping, MapperAdapter, ValidationIssue } from '../types';

const mockMappings: Mapping[] = [
  { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'user_name' },
  { id: '2', sourcePath: 'email', sourceId: 's1', targetPath: 'user_email', expression: 'toLowerCase()' },
];

interface TestOutput {
  fields: { from: string; to: string; transform?: string }[];
}

const testAdapter: MapperAdapter<TestOutput> = {
  contextId: 'test',
  title: 'Test Adapter',
  sources: [{ id: 's1', label: 'Source' }],
  target: { label: 'Target', allowCustomFields: true },
  serialize(mappings: Mapping[]): TestOutput {
    return {
      fields: mappings.map((m) => ({
        from: m.sourcePath,
        to: m.targetPath,
        ...(m.expression ? { transform: m.expression } : {}),
      })),
    };
  },
  deserialize(existing: TestOutput): Mapping[] {
    return existing.fields.map((f, i) => ({
      id: String(i + 1),
      sourcePath: f.from,
      sourceId: 's1',
      targetPath: f.to,
      ...(f.transform ? { expression: f.transform } : {}),
    }));
  },
  validate(mappings: Mapping[]): ValidationIssue[] {
    return mappings
      .filter((m) => !m.targetPath)
      .map((m) => ({
        mappingId: m.id,
        severity: 'error' as const,
        message: 'Target path is required',
      }));
  },
};

describe('serializeMappings', () => {
  it('delegates to adapter.serialize', () => {
    const output = serializeMappings(testAdapter, mockMappings);
    expect(output.fields).toHaveLength(2);
    expect(output.fields[0]).toEqual({ from: 'name', to: 'user_name' });
    expect(output.fields[1]).toEqual({ from: 'email', to: 'user_email', transform: 'toLowerCase()' });
  });
});

describe('deserializeMappings', () => {
  it('delegates to adapter.deserialize', () => {
    const input: TestOutput = {
      fields: [{ from: 'a', to: 'b' }],
    };
    const mappings = deserializeMappings(testAdapter, input);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].sourcePath).toBe('a');
    expect(mappings[0].targetPath).toBe('b');
    expect(mappings[0].sourceId).toBe('s1');
  });
});

describe('validateMappings', () => {
  it('returns issues from adapter validator', () => {
    const bad: Mapping[] = [
      { id: '1', sourcePath: 'x', sourceId: 's1', targetPath: '' },
    ];
    const issues = validateMappings(testAdapter, bad);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
  });

  it('returns empty array when no validator', () => {
    const noValidate: MapperAdapter<TestOutput> = { ...testAdapter, validate: undefined };
    const issues = validateMappings(noValidate, mockMappings);
    expect(issues).toEqual([]);
  });

  it('returns empty for valid mappings', () => {
    const issues = validateMappings(testAdapter, mockMappings);
    expect(issues).toEqual([]);
  });
});

describe('roundTripMappings', () => {
  it('detects lossless round-trip', () => {
    const result = roundTripMappings(testAdapter, mockMappings);
    expect(result.lossless).toBe(true);
    expect(result.output.fields).toHaveLength(2);
    expect(result.restored).toHaveLength(2);
  });

  it('detects lossy round-trip when adapter drops data', () => {
    const lossyAdapter: MapperAdapter<TestOutput> = {
      ...testAdapter,
      serialize: (mappings) => ({ fields: mappings.slice(0, 1).map((m) => ({ from: m.sourcePath, to: m.targetPath })) }),
    };
    const result = roundTripMappings(lossyAdapter, mockMappings);
    expect(result.lossless).toBe(false);
  });

  it('detects lossy round-trip when operator fields are dropped', () => {
    const mappingsWithOperator: Mapping[] = [
      { id: '1', sourcePath: 'price', sourceId: 's1', targetPath: 'price', operator: 'greater_than', operatorValue: '10' },
    ];
    const adapterThatDropsOps: MapperAdapter<TestOutput> = {
      ...testAdapter,
      serialize: (mappings) => ({
        fields: mappings.map((m) => ({ from: m.sourcePath, to: m.targetPath })),
      }),
      deserialize: (existing) =>
        existing.fields.map((f, i) => ({ id: String(i + 1), sourcePath: f.from, sourceId: 's1', targetPath: f.to })),
    };
    const result = roundTripMappings(adapterThatDropsOps, mappingsWithOperator);
    expect(result.lossless).toBe(false);
  });

  it('reports lossless when operator fields are preserved', () => {
    const mappingsWithOperator: Mapping[] = [
      { id: '1', sourcePath: 'price', sourceId: 's1', targetPath: 'price', operator: 'greater_than', operatorValue: '10' },
    ];
    const adapterPreservingOps: MapperAdapter<TestOutput> = {
      ...testAdapter,
      serialize: (mappings) => ({
        fields: mappings.map((m) => ({ from: m.sourcePath, to: m.targetPath, transform: m.expression })),
      }),
      deserialize: (existing) =>
        existing.fields.map((f, i) => ({
          id: String(i + 1),
          sourcePath: f.from,
          sourceId: 's1',
          targetPath: f.to,
          operator: 'greater_than' as const,
          operatorValue: '10',
        })),
    };
    const result = roundTripMappings(adapterPreservingOps, mappingsWithOperator);
    expect(result.lossless).toBe(true);
  });

  it('detects lossy round-trip when condition/fallback are dropped', () => {
    const mappingsWithCondition: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'name', condition: '$isEmpty($.name)', fallback: 'N/A' },
    ];
    const adapterThatDrops: MapperAdapter<TestOutput> = {
      ...testAdapter,
      serialize: (mappings) => ({
        fields: mappings.map((m) => ({ from: m.sourcePath, to: m.targetPath })),
      }),
      deserialize: (existing) =>
        existing.fields.map((f, i) => ({ id: String(i + 1), sourcePath: f.from, sourceId: 's1', targetPath: f.to })),
    };
    const result = roundTripMappings(adapterThatDrops, mappingsWithCondition);
    expect(result.lossless).toBe(false);
  });
});
