/**
 * Phase 11F - gRPC schema diff report export serializers.
 */

import type { GrpcSchemaDiffReport } from './grpcSchemaDiffContracts';

export function serializeGrpcSchemaDiffReportJson(report: GrpcSchemaDiffReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function severityLabel(severity: string): string {
  switch (severity) {
    case 'breaking':
      return 'BREAKING';
    case 'non_breaking':
      return 'NON_BREAKING';
    case 'informational':
      return 'INFORMATIONAL';
    default:
      return severity.toUpperCase();
  }
}

function escapeMarkdownCell(value: string): string {
  return value
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
}

export function serializeGrpcSchemaDiffReportMarkdown(report: GrpcSchemaDiffReport): string {
  const lines: string[] = [
    '# gRPC Schema Diff Report',
    '',
    `- **Baseline:** \`${report.leftDescriptorKey}\``,
    `- **Candidate:** \`${report.rightDescriptorKey}\``,
    `- **Generated:** ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `| Severity | Count |`,
    `| --- | ---: |`,
    `| Breaking | ${report.summary.breaking} |`,
    `| Non-breaking | ${report.summary.nonBreaking} |`,
    `| Informational | ${report.summary.informational} |`,
    '',
    '## Changes',
    '',
  ];

  if (report.changes.length === 0) {
    lines.push('_No schema changes detected._', '');
    return `${lines.join('\n')}\n`;
  }

  lines.push(
    '| Severity | Entity | Path | Change | Description |',
    '| --- | --- | --- | --- | --- |',
  );

  for (const change of report.changes) {
    const caveat = change.caveat ? ` (${change.caveat})` : '';
    const description = escapeMarkdownCell(`${change.description}${caveat}`);
    lines.push(
      `| ${severityLabel(change.severity)} | ${change.entityType} | \`${escapeMarkdownCell(change.entityPath)}\` | ${change.changeType} | ${description} |`,
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}
