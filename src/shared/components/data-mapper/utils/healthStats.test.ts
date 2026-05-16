import { describe, expect, it } from 'vitest';
import type { Mapping } from '../types';
import { buildJsonTree } from '../../../utils/jsonTreeModel';
import { computeHealthStats } from './healthStats';

function mapping(partial: Pick<Mapping, 'id' | 'targetPath'> & Partial<Mapping>): Mapping {
  return {
    sourcePath: '$.src',
    sourceId: 'default',
    ...partial,
  };
}

describe('computeHealthStats', () => {
  it('returns zeros for empty mappings and null target tree', () => {
    expect(computeHealthStats([], null)).toEqual({
      totalMappings: 0,
      totalTargetFields: 0,
      mappedTargetFields: 0,
      coveragePercent: 0,
      brokenCount: 0,
      driftWarnings: 0,
      driftBreaking: 0,
      typeMismatches: 0,
    });
  });

  it('computes coverage from leaf paths when a target tree is provided', () => {
    const targetTree = buildJsonTree({ a: 1, b: 2, c: 3 }, '', '');
    const mappings: Mapping[] = [
      mapping({ id: '1', targetPath: 'a' }),
      mapping({ id: '2', targetPath: 'b' }),
    ];
    const stats = computeHealthStats(mappings, targetTree);
    expect(stats.totalMappings).toBe(2);
    expect(stats.totalTargetFields).toBe(3);
    expect(stats.mappedTargetFields).toBe(2);
    expect(stats.coveragePercent).toBe(Math.round((2 / 3) * 100));
  });

  it('counts 100% coverage when every leaf is mapped', () => {
    const targetTree = buildJsonTree({ x: true, y: false }, '', '');
    const mappings: Mapping[] = [
      mapping({ id: '1', targetPath: 'x' }),
      mapping({ id: '2', targetPath: 'y' }),
    ];
    const stats = computeHealthStats(mappings, targetTree);
    expect(stats.mappedTargetFields).toBe(2);
    expect(stats.totalTargetFields).toBe(2);
    expect(stats.coveragePercent).toBe(100);
  });

  it('classifies drift mapping ids into warnings vs breaking and brokenCount', () => {
    const drift = new Map<string, 'warning' | 'breaking'>([
      ['a', 'warning'],
      ['b', 'breaking'],
      ['c', 'warning'],
      ['d', 'breaking'],
    ]);
    const stats = computeHealthStats([], null, drift);
    expect(stats.driftWarnings).toBe(2);
    expect(stats.driftBreaking).toBe(2);
    expect(stats.brokenCount).toBe(2);
  });

  it('passes through typeMismatchCount and defaults to 0 when omitted', () => {
    expect(computeHealthStats([], null, undefined, 7).typeMismatches).toBe(7);
    expect(computeHealthStats([], null).typeMismatches).toBe(0);
    expect(computeHealthStats([], null, undefined, 0).typeMismatches).toBe(0);
  });

  it('combines mappings, drift, and type mismatches in one result', () => {
    const targetTree = buildJsonTree({ id: '', name: '', active: true }, '', '');
    const mappings: Mapping[] = [
      mapping({ id: 'm1', targetPath: 'id' }),
      mapping({ id: 'm2', targetPath: 'name' }),
      mapping({ id: 'm3', targetPath: 'orphan' }),
    ];
    const drift = new Map<string, 'warning' | 'breaking'>([
      ['m1', 'breaking'],
      ['m2', 'warning'],
    ]);
    const stats = computeHealthStats(mappings, targetTree, drift, 4);
    expect(stats.totalMappings).toBe(3);
    expect(stats.totalTargetFields).toBe(3);
    expect(stats.mappedTargetFields).toBe(2);
    expect(stats.coveragePercent).toBe(67);
    expect(stats.driftBreaking).toBe(1);
    expect(stats.driftWarnings).toBe(1);
    expect(stats.brokenCount).toBe(1);
    expect(stats.typeMismatches).toBe(4);
  });

  it('uses zero coverage and zero mapped fields when there is no target tree', () => {
    const mappings: Mapping[] = [
      mapping({ id: '1', targetPath: 'any.path' }),
      mapping({ id: '2', targetPath: 'other' }),
    ];
    const stats = computeHealthStats(mappings, null);
    expect(stats.totalTargetFields).toBe(0);
    expect(stats.mappedTargetFields).toBe(0);
    expect(stats.coveragePercent).toBe(0);
    expect(stats.totalMappings).toBe(2);
  });

  it('treats an empty drift map as no drift issues', () => {
    const drift = new Map<string, 'warning' | 'breaking'>();
    const stats = computeHealthStats([], null, drift);
    expect(stats.driftWarnings).toBe(0);
    expect(stats.driftBreaking).toBe(0);
    expect(stats.brokenCount).toBe(0);
  });

  it('ignores mappings whose targetPath does not match any leaf', () => {
    const targetTree = buildJsonTree({ only: 1 }, '', '');
    const mappings: Mapping[] = [mapping({ id: '1', targetPath: 'missing' })];
    const stats = computeHealthStats(mappings, targetTree);
    expect(stats.mappedTargetFields).toBe(0);
    expect(stats.coveragePercent).toBe(0);
  });
});
