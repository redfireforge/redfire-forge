import { describe, expect, it } from 'vitest';
import {
  buildGrpcSchemaDiffReport,
  sortGrpcSchemaDiffChanges,
  summarizeGrpcSchemaDiffChanges,
  type GrpcSchemaDiffChange,
} from './grpcSchemaDiffContracts';

function change(
  patch: Partial<GrpcSchemaDiffChange> & Pick<GrpcSchemaDiffChange, 'severity' | 'entityPath'>,
): GrpcSchemaDiffChange {
  return {
    entityType: 'field',
    changeType: 'modified',
    description: patch.entityPath,
    ...patch,
  };
}

describe('grpcSchemaDiffContracts coverage gaps', () => {
  it('summarizeGrpcSchemaDiffChanges counts each severity bucket', () => {
    const summary = summarizeGrpcSchemaDiffChanges([
      change({ severity: 'breaking', entityPath: 'a' }),
      change({ severity: 'non_breaking', entityPath: 'b' }),
      change({ severity: 'informational', entityPath: 'c' }),
    ]);
    expect(summary).toEqual({ breaking: 1, nonBreaking: 1, informational: 1 });
  });

  it('sortGrpcSchemaDiffChanges orders by severity, entity, path, and change type', () => {
    const sorted = sortGrpcSchemaDiffChanges([
      change({ severity: 'informational', entityType: 'message', entityPath: 'z.msg', changeType: 'added', description: 'z' }),
      change({ severity: 'breaking', entityType: 'service', entityPath: 'echo.EchoService', changeType: 'removed', description: 'svc' }),
      change({ severity: 'breaking', entityType: 'method', entityPath: 'echo.EchoService/Echo', changeType: 'modified', description: 'm' }),
      change({ severity: 'breaking', entityType: 'method', entityPath: 'echo.EchoService/Echo', changeType: 'added', description: 'm2' }),
    ]);
    expect(sorted[0]?.entityType).toBe('service');
    expect(sorted[1]?.changeType).toBe('added');
    expect(sorted.at(-1)?.severity).toBe('informational');
  });

  it('buildGrpcSchemaDiffReport sorts changes and builds summary', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [
        change({ severity: 'breaking', entityPath: 'field.a' }),
        change({ severity: 'informational', entityPath: 'field.b', changeType: 'doc_comment_changed' }),
      ],
    });
    expect(report.summary.breaking).toBe(1);
    expect(report.summary.informational).toBe(1);
    expect(report.changes[0]?.severity).toBe('breaking');
  });

  it('sortGrpcSchemaDiffChanges breaks ties by changeType then description', () => {
    const sorted = sortGrpcSchemaDiffChanges([
      change({ severity: 'breaking', entityPath: 'svc.A', changeType: 'removed', description: 'removed field b' }),
      change({ severity: 'breaking', entityPath: 'svc.A', changeType: 'added', description: 'added field z' }),
      change({ severity: 'breaking', entityPath: 'svc.A', changeType: 'added', description: 'added field a' }),
    ]);
    expect(sorted[0]?.changeType).toBe('added');
    expect(sorted[0]?.description).toContain('added field a');
    expect(sorted[1]?.description).toContain('added field z');
    expect(sorted[2]?.changeType).toBe('removed');
  });

  it('sortGrpcSchemaDiffChanges breaks ties by entityPath when same severity/entity rank', () => {
    const sorted = sortGrpcSchemaDiffChanges([
      change({ severity: 'non_breaking', entityPath: 'svc.Z', changeType: 'doc_comment_changed', description: 'd' }),
      change({ severity: 'non_breaking', entityPath: 'svc.A', changeType: 'doc_comment_changed', description: 'd' }),
    ]);
    expect(sorted[0]?.entityPath).toBe('svc.A');
    expect(sorted[1]?.entityPath).toBe('svc.Z');
  });
});
