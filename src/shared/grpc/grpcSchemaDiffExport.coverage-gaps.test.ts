/**
 * Coverage gaps — grpcSchemaDiffExport.ts (Phase 11F).
 */
import { describe, expect, it } from 'vitest';
import {
  buildGrpcSchemaDiffReport,
  type GrpcSchemaDiffChange,
} from './grpcSchemaDiffContracts';
import {
  serializeGrpcSchemaDiffReportJson,
  serializeGrpcSchemaDiffReportMarkdown,
} from './grpcSchemaDiffExport';

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

describe('grpcSchemaDiffExport coverage gaps', () => {
  it('serializes JSON with trailing newline', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [],
    });
    expect(serializeGrpcSchemaDiffReportJson(report).endsWith('\n')).toBe(true);
  });

  it('maps known severities and uppercases unknown severity labels in Markdown', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [
        change({ severity: 'breaking', entityPath: 'a', description: 'breaking change' }),
        change({ severity: 'non_breaking', entityPath: 'b', description: 'compatible change' }),
        change({ severity: 'informational', entityPath: 'c', description: 'doc only' }),
        change({
          severity: 'custom_severity' as GrpcSchemaDiffChange['severity'],
          entityPath: 'd',
          description: 'custom bucket',
        }),
      ],
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('| BREAKING |');
    expect(markdown).toContain('| NON_BREAKING |');
    expect(markdown).toContain('| INFORMATIONAL |');
    expect(markdown).toContain('| CUSTOM_SEVERITY |');
  });

  it('escapes markdown table cells and renders caveats', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [
        change({
          severity: 'non_breaking',
          entityPath: 'order.Status|OPEN',
          description: 'Enum value added\nwith caveat',
          caveat: 'Clients must tolerate unknown enum values on the wire.',
        }),
      ],
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('order.Status\\|OPEN');
    expect(markdown).toContain('Enum value added with caveat');
    expect(markdown).toContain('unknown enum values');
  });

  it('renders empty change list placeholder in Markdown', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [],
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('_No schema changes detected._');
    expect(markdown.endsWith('\n')).toBe(true);
  });
});
