import type { CatalogSpecDiff, EndpointDiff } from '../types/catalog';

interface Props {
  diff: CatalogSpecDiff;
}

import { SWAGGER_METHOD_COLORS as METHOD_COLORS } from '../../../shared/constants/httpMethodColors';

export default function CatalogVersionDiff({ diff }: Props) {
  const total = diff.summary.totalAdded + diff.summary.totalRemoved + diff.summary.totalChanged;
  const hasMetadata = diff.metadata && diff.metadata.length > 0;

  if (total === 0 && !hasMetadata) {
    return (
      <div className="cat-vd-empty">
        No differences found between v{diff.fromVersion} and v{diff.toVersion}.
      </div>
    );
  }

  return (
    <div className="cat-vd" data-testid="catalog-version-diff">
      <div className="cat-vd-header">
        Changes from v{diff.fromVersion} → v{diff.toVersion}
      </div>

      <div className="cat-vd-summary" data-testid="catalog-version-diff-summary">
        {diff.summary.totalAdded > 0 && (
          <span className="cat-vd-badge cat-vd-added">+ {diff.summary.totalAdded} added</span>
        )}
        {diff.summary.totalRemoved > 0 && (
          <span className="cat-vd-badge cat-vd-removed">− {diff.summary.totalRemoved} removed</span>
        )}
        {diff.summary.totalChanged > 0 && (
          <span className="cat-vd-badge cat-vd-changed">~ {diff.summary.totalChanged} changed</span>
        )}
        {hasMetadata && (
          <span className="cat-vd-badge cat-vd-meta">⚙ metadata</span>
        )}
      </div>

      {hasMetadata && (
        <div className="cat-vd-section cat-vd-section-meta">
          <div className="cat-vd-section-title">Metadata Changes</div>
          <ul className="cat-vd-details cat-vd-meta-list">
            {diff.metadata!.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {diff.added.length > 0 && (
        <DiffSection title="Added Endpoints" items={diff.added} type="added" />
      )}
      {diff.removed.length > 0 && (
        <DiffSection title="Removed Endpoints" items={diff.removed} type="removed" />
      )}
      {diff.changed.length > 0 && (
        <DiffSection title="Changed Endpoints" items={diff.changed} type="changed" />
      )}
    </div>
  );
}

function DiffSection({ title, items, type }: { title: string; items: EndpointDiff[]; type: string }) {
  return (
    <div className={`cat-vd-section cat-vd-section-${type}`}>
      <div className="cat-vd-section-title">{title}</div>
      {items.map((ep, i) => (
        <div key={i} className={`cat-vd-item cat-vd-item-${type}`}>
          <div className="cat-vd-item-header">
            <span className={`cat-vd-prefix cat-vd-prefix-${type}`}>
              {type === 'added' ? '+' : type === 'removed' ? '−' : '~'}
            </span>
            <span className="cat-vd-method" style={{ color: METHOD_COLORS[ep.method] ?? '#888' }}>
              {ep.method}
            </span>
            <span className="cat-vd-path">{ep.path}</span>
          </div>
          {ep.details && ep.details.length > 0 && (
            <ul className="cat-vd-details">
              {ep.details.map((d, j) => (
                <li key={j} className={d.startsWith('  ') ? 'cat-vd-sub' : undefined}>
                  {d.startsWith('  ') ? d.trimStart() : d}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
