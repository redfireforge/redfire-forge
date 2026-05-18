import { useMemo } from 'react';
import type { Mapping } from './types';
import type { ArrayMappingInfo } from './utils/arrayMapping';
import type { TypeMismatch } from './utils/typeMismatch';

interface MapperFooterProps {
  mappings: Mapping[];
  arrayMappingInfos: ArrayMappingInfo[];
  typeMismatches: TypeMismatch[];
  resolvedCount?: number;
  unresolvedCount?: number;
  compactMode?: boolean;
  verifyPassedCount?: number;
  verifyFailedCount?: number;
  verifyStatus?: 'idle' | 'running' | 'complete';
  onFilterFailed?: () => void;
}

export default function MapperFooter({
  mappings,
  arrayMappingInfos,
  typeMismatches,
  resolvedCount,
  unresolvedCount,
  compactMode = false,
  verifyPassedCount,
  verifyFailedCount,
  verifyStatus = 'idle',
  onFilterFailed,
}: MapperFooterProps) {
  const stats = useMemo(() => {
    const expressionCount = mappings.filter((m) => !!m.expression).length;
    let loopCount = 0;
    let aggregateCount = 0;
    for (const info of arrayMappingInfos) {
      if (info.kind === 'loop') loopCount++;
      else if (info.kind === 'aggregate') aggregateCount++;
    }
    return {
      mapped: resolvedCount ?? mappings.length,
      unresolved: unresolvedCount ?? Math.max(mappings.length - (resolvedCount ?? mappings.length), 0),
      expressions: expressionCount,
      loops: loopCount,
      aggregates: aggregateCount,
      mismatches: typeMismatches.length,
    };
  }, [mappings, arrayMappingInfos, typeMismatches, resolvedCount, unresolvedCount]);

  if (compactMode && stats.mapped === 0 && stats.unresolved === 0 && stats.mismatches === 0) {
    return null;
  }

  return (
    <div className={`dm-stats-footer ${compactMode ? 'dm-stats-footer--compact' : ''}`} role="status">
      <div className="dm-stats-counters">
        <span className="dm-stat">
          <span className="dm-stat-value dm-stat-value--mapped">{stats.mapped}</span> mapped
        </span>
        {stats.unresolved > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--mismatch">{stats.unresolved}</span> unresolved
          </span>
        )}
        {!compactMode && stats.expressions > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--expression">{stats.expressions}</span> expression{stats.expressions !== 1 ? 's' : ''}
          </span>
        )}
        {!compactMode && stats.loops > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--loop">{stats.loops}</span> loop{stats.loops !== 1 ? 's' : ''}
          </span>
        )}
        {!compactMode && stats.aggregates > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--aggregate">{stats.aggregates}</span> aggregate{stats.aggregates !== 1 ? 's' : ''}
          </span>
        )}
        {stats.mismatches > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--mismatch">{stats.mismatches}</span> mismatch{stats.mismatches !== 1 ? 'es' : ''}
          </span>
        )}
        {verifyStatus === 'complete' && verifyPassedCount !== undefined && (
          <span className="dm-stat dm-stat--verify">
            <span className="dm-stat-value dm-stat-value--verify-pass">{verifyPassedCount}</span> passed
          </span>
        )}
        {verifyStatus === 'complete' && (verifyFailedCount ?? 0) > 0 && (
          <span
            className="dm-stat dm-stat--verify dm-stat--clickable"
            onClick={onFilterFailed}
            title="Click to filter failed rules"
            role="button"
            tabIndex={0}
          >
            <span className="dm-stat-value dm-stat-value--verify-fail">{verifyFailedCount}</span> failed
          </span>
        )}
      </div>
      {!compactMode && (
        <div className="dm-stats-shortcuts">
          <span className="dm-shortcut"><kbd className="dm-kbd">/</kbd> Search</span>
          <span className="dm-shortcut"><kbd className="dm-kbd">⌫</kbd> Delete</span>
          <span className="dm-shortcut"><kbd className="dm-kbd">⌘Z</kbd> Undo</span>
          <span className="dm-shortcut"><kbd className="dm-kbd">Tab</kbd> Switch panel</span>
        </div>
      )}
    </div>
  );
}
