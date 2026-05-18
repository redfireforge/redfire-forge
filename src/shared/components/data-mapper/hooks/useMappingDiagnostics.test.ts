/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMappingDiagnostics } from './useMappingDiagnostics';
import type { MapperSource, MapperTarget, Mapping } from '../types';

const source: MapperSource = {
  id: 's1',
  label: 'Source',
  sampleData: { name: 'Alice', email: 'a@b.com' },
};

const target: MapperTarget = {
  label: 'Target',
  sampleData: { userName: '', userEmail: '' },
  allowCustomFields: false,
};

describe('useMappingDiagnostics', () => {
  it('returns zero issues for valid mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], target, []),
    );
    expect(result.current.unresolved).toBe(0);
    expect(result.current.resolved).toBe(1);
    expect(result.current.issues).toHaveLength(0);
  });

  it('detects missing target path', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'nonexistent' },
    ];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], target, []),
    );
    expect(result.current.unresolved).toBe(1);
    const targetIssue = result.current.issues.find((i) => i.kind === 'missing-target');
    expect(targetIssue).toBeDefined();
    expect(targetIssue!.severity).toBe('error');
  });

  it('detects unresolved source path', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'nonexistent', sourceId: 's1', targetPath: 'userName' },
    ];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], target, []),
    );
    const srcIssue = result.current.issues.find((i) => i.kind === 'unresolved-path');
    expect(srcIssue).toBeDefined();
    expect(srcIssue!.severity).toBe('warning');
  });

  it('detects duplicate target mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userName' },
    ];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], target, []),
    );
    const dupIssue = result.current.issues.find((i) => i.kind === 'duplicate-target');
    expect(dupIssue).toBeDefined();
  });

  it('includes type mismatch issues', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const mismatches = [{
      mappingId: 'm1',
      sourcePath: 'name',
      targetPath: 'userName',
      sourceType: 'string' as const,
      targetType: 'number' as const,
      severity: 'warning' as const,
      message: 'Type mismatch: string → number',
      suggestedFix: 'Number($)',
    }];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], target, mismatches),
    );
    const mismatchIssue = result.current.issues.find((i) => i.kind === 'type-mismatch');
    expect(mismatchIssue).toBeDefined();
    expect(mismatchIssue!.suggestedFixExpression).toBe('Number($)');
  });

  it('sorts issues by severity (errors first)', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'nonexistent_src', sourceId: 's1', targetPath: 'nonexistent_tgt' },
    ];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], target, []),
    );
    expect(result.current.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.current.issues[0].severity).toBe('error');
    expect(result.current.issues[1].severity).toBe('warning');
  });

  it('handles target with fields instead of sampleData', () => {
    const fieldsTarget: MapperTarget = {
      label: 'Fields Target',
      allowCustomFields: false,
      fields: [
        { path: 'outputName', label: 'outputName', type: 'string' },
      ],
    };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'outputName' },
    ];
    const { result } = renderHook(() =>
      useMappingDiagnostics(mappings, 's1', [source], fieldsTarget, []),
    );
    expect(result.current.unresolved).toBe(0);
    expect(result.current.issues).toHaveLength(0);
  });

  it('handles empty mappings', () => {
    const { result } = renderHook(() =>
      useMappingDiagnostics([], 's1', [source], target, []),
    );
    expect(result.current.unresolved).toBe(0);
    expect(result.current.resolved).toBe(0);
    expect(result.current.issues).toHaveLength(0);
  });
});
