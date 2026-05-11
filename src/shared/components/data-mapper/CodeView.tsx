import { useMemo } from 'react';
import type { Mapping } from './types';

interface CodeViewProps {
  mappings: Mapping[];
}

function formatMapping(m: Mapping): string {
  const target = m.targetPath || '(unmapped)';
  const source = m.sourcePath || '(unknown)';
  if (m.expression) {
    return `${target} ← ${m.expression}`;
  }
  return `${target} ← ${source}`;
}

export default function CodeView({ mappings }: CodeViewProps) {
  const lines = useMemo(() => {
    if (mappings.length === 0) return ['// No mappings defined'];
    const sorted = [...mappings].sort((a, b) => a.targetPath.localeCompare(b.targetPath));
    return sorted.map(formatMapping);
  }, [mappings]);

  return (
    <div className="dm-code-view" role="region" aria-label="Mapping code view">
      <div className="dm-code-view-header">
        <span className="dm-code-view-title">Mapping Code</span>
        <span className="dm-code-view-count">{mappings.length} mapping{mappings.length !== 1 ? 's' : ''}</span>
      </div>
      <pre className="dm-code-view-content">
        {lines.map((line, i) => (
          <div key={i} className="dm-code-view-line">
            <span className="dm-code-view-line-no">{i + 1}</span>
            <span className="dm-code-view-line-text">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
