import { useMemo } from 'react';
import type { Mapping } from './types';
import type { ArrayMappingInfo } from './utils/arrayMapping';
import type { TypeMismatch } from './utils/typeMismatch';

interface MapperFooterProps {
  mappings: Mapping[];
  arrayMappingInfos: ArrayMappingInfo[];
  typeMismatches: TypeMismatch[];
}

export default function MapperFooter({ mappings, arrayMappingInfos, typeMismatches }: MapperFooterProps) {
  const stats = useMemo(() => {
    const expressionCount = mappings.filter((m) => !!m.expression).length;
    let loopCount = 0;
    let aggregateCount = 0;
    for (const info of arrayMappingInfos) {
      if (info.kind === 'loop') loopCount++;
      else if (info.kind === 'aggregate') aggregateCount++;
    }
    return {
      mapped: mappings.length,
      expressions: expressionCount,
      loops: loopCount,
      aggregates: aggregateCount,
      mismatches: typeMismatches.length,
    };
  }, [mappings, arrayMappingInfos, typeMismatches]);

  return (
    <div className="dm-stats-footer" role="status">
      <div className="dm-stats-counters">
        <span className="dm-stat">
          <span className="dm-stat-value dm-stat-value--mapped">{stats.mapped}</span> mapped
        </span>
        {stats.expressions > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--expression">{stats.expressions}</span> expression{stats.expressions !== 1 ? 's' : ''}
          </span>
        )}
        {stats.loops > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--loop">{stats.loops}</span> loop{stats.loops !== 1 ? 's' : ''}
          </span>
        )}
        {stats.aggregates > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--aggregate">{stats.aggregates}</span> aggregate{stats.aggregates !== 1 ? 's' : ''}
          </span>
        )}
        {stats.mismatches > 0 && (
          <span className="dm-stat">
            <span className="dm-stat-value dm-stat-value--mismatch">{stats.mismatches}</span> mismatch{stats.mismatches !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
      <div className="dm-stats-shortcuts">
        <span className="dm-shortcut"><kbd className="dm-kbd">/</kbd> Search</span>
        <span className="dm-shortcut"><kbd className="dm-kbd">⌫</kbd> Delete</span>
        <span className="dm-shortcut"><kbd className="dm-kbd">⌘Z</kbd> Undo</span>
        <span className="dm-shortcut"><kbd className="dm-kbd">Tab</kbd> Switch panel</span>
      </div>
    </div>
  );
}
