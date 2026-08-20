/** Domain Selector — grid of rich learning-path cards with progress + categories */
import type { DemoCategoryMeta, DemoDomain, DemoLesson, DemoProgress } from './types';

interface DomainSelectorProps {
  domains: DemoDomain[];
  progress: DemoProgress;
  onSelect: (domain: DemoDomain) => void;
}

interface CategoryStat extends DemoCategoryMeta {
  count: number;
}

interface DomainStat {
  completedCount: number;
  totalCount: number;
  pct: number;
  totalMinutes: number;
  categoryStats: CategoryStat[];
  uncategorized: number;
  status: 'complete' | 'in-progress' | 'new';
}

/** Sum of per-lesson estimates → "45 min" / "2h 15m" / "3h". */
function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function computeDomainStat(domain: DemoDomain, progress: DemoProgress): DomainStat {
  const lessons = domain.lessons;
  const totalCount = lessons.length;
  const completedCount = lessons.filter(l => progress.completedLessons.includes(l.id)).length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalMinutes = lessons.reduce((sum, l) => sum + (l.estimatedMinutes || 0), 0);

  const categories = domain.categories ?? [];
  const byCategory = (id: string) => lessons.filter((l: DemoLesson) => l.category === id).length;
  const categoryStats: CategoryStat[] = categories.map(c => ({ ...c, count: byCategory(c.id) }));
  const categorizedIds = new Set(categories.map(c => c.id));
  const uncategorized = lessons.filter(l => !l.category || !categorizedIds.has(l.category)).length;

  const status: DomainStat['status'] =
    totalCount > 0 && completedCount >= totalCount ? 'complete'
      : completedCount > 0 ? 'in-progress'
        : 'new';

  return { completedCount, totalCount, pct, totalMinutes, categoryStats, uncategorized, status };
}

const STATUS_LABEL: Record<DomainStat['status'], string> = {
  complete: 'Completed',
  'in-progress': 'In progress',
  new: 'Start learning',
};

export default function DomainSelector({ domains, progress, onSelect }: DomainSelectorProps) {
  return (
    <div className="demo-domain-selector">
      <p className="demo-hub-subtitle">
        Master RedfireForge with interactive, guided lessons — pick a learning path to begin.
      </p>
      <div className="demo-domain-grid">
        {domains.map(domain => {
          const stat = computeDomainStat(domain, progress);
          const disabled = !domain.available;

          return (
            <button
              key={domain.id}
              className={`demo-domain-card status-${stat.status}${disabled ? ' coming-soon' : ''}`}
              onClick={() => domain.available && onSelect(domain)}
              disabled={disabled}
              data-testid={`demo-domain-card-${domain.id}`}
              aria-label={`${domain.name} — ${stat.totalCount} lessons, ${stat.pct}% complete`}
            >
              <span className="demo-domain-accent" aria-hidden="true" />

              <div className="demo-domain-card-head">
                <span className="demo-domain-icon-tile" aria-hidden="true">{domain.icon}</span>
                <div className="demo-domain-headline">
                  <span className="demo-domain-name">{domain.name}</span>
                  <span className="demo-domain-count">
                    {stat.totalCount > 0 ? `${stat.totalCount} lesson${stat.totalCount > 1 ? 's' : ''}` : 'Coming soon'}
                    {stat.categoryStats.length > 0 && ` · ${stat.categoryStats.length} categories`}
                  </span>
                </div>
                {domain.available ? (
                  <ProgressRing pct={stat.pct} />
                ) : (
                  <span className="demo-domain-badge">Coming Soon</span>
                )}
              </div>

              {domain.description && (
                <p className="demo-domain-desc">{domain.description}</p>
              )}

              {stat.categoryStats.length > 0 && (
                <div className="demo-domain-cats" aria-hidden="true">
                  {stat.categoryStats.map(cat => (
                    <span key={cat.id} className="demo-domain-cat-chip" title={`${cat.label}: ${cat.count} lesson${cat.count === 1 ? '' : 's'}`}>
                      <span className="demo-domain-cat-icon">{cat.icon}</span>
                      <span className="demo-domain-cat-label">{cat.label}</span>
                      <span className="demo-domain-cat-count">{cat.count}</span>
                    </span>
                  ))}
                  {stat.uncategorized > 0 && (
                    <span className="demo-domain-cat-chip demo-domain-cat-chip--more" title={`${stat.uncategorized} more lessons`}>
                      <span className="demo-domain-cat-label">+{stat.uncategorized} more</span>
                    </span>
                  )}
                </div>
              )}

              {domain.available && (
                <div className="demo-domain-progress">
                  <div className="demo-domain-progress-track">
                    <div className="demo-domain-progress-fill" style={{ width: `${stat.pct}%` }} />
                  </div>
                  <span className="demo-domain-progress-label">
                    {stat.completedCount}/{stat.totalCount}
                  </span>
                </div>
              )}

              <div className="demo-domain-foot">
                <span className={`demo-domain-status demo-domain-status--${stat.status}`}>
                  {stat.status === 'complete' && <span className="demo-domain-status-tick">✓</span>}
                  {STATUS_LABEL[stat.status]}
                </span>
                {domain.available && stat.totalMinutes > 0 && (
                  <span className="demo-domain-time" title="Estimated total time">
                    <span className="demo-domain-time-icon" aria-hidden="true">◷</span>
                    {formatDuration(stat.totalMinutes)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg className="demo-progress-ring" width="44" height="44" viewBox="0 0 40 40" role="img" aria-label={`${pct}% complete`}>
      <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="24" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="600">
        {pct}%
      </text>
    </svg>
  );
}
