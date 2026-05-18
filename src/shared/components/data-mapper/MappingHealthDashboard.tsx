import { useMemo } from 'react';
import type { Mapping } from './types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import { computeHealthStats } from './utils/healthStats';
import type { HealthStats } from './utils/healthStats';

function statusLabel(stats: HealthStats): { text: string; level: 'healthy' | 'warning' | 'critical' } {
  if (stats.brokenCount > 0) {
    return { text: 'Broken', level: 'critical' };
  }
  if (stats.driftWarnings > 0 || stats.typeMismatches > 0) {
    return { text: 'Warnings', level: 'warning' };
  }
  return { text: 'Healthy', level: 'healthy' };
}

interface MappingHealthDashboardProps {
  mappings: Mapping[];
  targetTree: JsonTreeNode | null;
  driftMappingIds?: Map<string, 'warning' | 'breaking'>;
  typeMismatchCount: number;
  onShowDrift?: () => void;
}

export default function MappingHealthDashboard({
  mappings,
  targetTree,
  driftMappingIds,
  typeMismatchCount,
  onShowDrift,
}: MappingHealthDashboardProps) {
  const stats = useMemo(
    () => computeHealthStats(mappings, targetTree, driftMappingIds, typeMismatchCount),
    [mappings, targetTree, driftMappingIds, typeMismatchCount],
  );

  const status = useMemo(() => statusLabel(stats), [stats]);

  const hasIssues = stats.brokenCount > 0 || stats.driftWarnings > 0 || stats.typeMismatches > 0;
  if (!hasIssues && stats.totalMappings === 0) return null;

  return (
    <div className={`dm-health-dashboard dm-health-dashboard--${status.level}`} role="status" aria-live="polite">
      <span className={`dm-health-status dm-health-status--${status.level}`}>
        {status.level === 'critical' ? '✕' : status.level === 'warning' ? '⚠' : '✓'} {status.text}
      </span>

      <span className="dm-health-divider" />

      {stats.totalTargetFields > 0 && (
        <span className="dm-health-metric" title={`${stats.mappedTargetFields} of ${stats.totalTargetFields} target fields mapped`}>
          <span className="dm-health-metric-value">{stats.coveragePercent}%</span>
          <span className="dm-health-metric-label">coverage</span>
        </span>
      )}

      {stats.brokenCount > 0 && (
        <span
          className="dm-health-metric dm-health-metric--critical"
          role={onShowDrift ? 'button' : undefined}
          tabIndex={onShowDrift ? 0 : undefined}
          onClick={onShowDrift}
          onKeyDown={onShowDrift ? (e) => { if (e.key === 'Enter') onShowDrift(); } : undefined}
          title={`${stats.brokenCount} mapping${stats.brokenCount !== 1 ? 's' : ''} broken by schema drift`}
        >
          <span className="dm-health-metric-value">{stats.brokenCount}</span>
          <span className="dm-health-metric-label">broken</span>
        </span>
      )}

      {stats.driftWarnings > 0 && (
        <span
          className="dm-health-metric dm-health-metric--warning"
          role={onShowDrift ? 'button' : undefined}
          tabIndex={onShowDrift ? 0 : undefined}
          onClick={onShowDrift}
          onKeyDown={onShowDrift ? (e) => { if (e.key === 'Enter') onShowDrift(); } : undefined}
          title={`${stats.driftWarnings} drift warning${stats.driftWarnings !== 1 ? 's' : ''}`}
        >
          <span className="dm-health-metric-value">{stats.driftWarnings}</span>
          <span className="dm-health-metric-label">drift</span>
        </span>
      )}

      {stats.typeMismatches > 0 && (
        <span className="dm-health-metric dm-health-metric--warning" title={`${stats.typeMismatches} type mismatch${stats.typeMismatches !== 1 ? 'es' : ''}`}>
          <span className="dm-health-metric-value">{stats.typeMismatches}</span>
          <span className="dm-health-metric-label">mismatch{stats.typeMismatches !== 1 ? 'es' : ''}</span>
        </span>
      )}
    </div>
  );
}
