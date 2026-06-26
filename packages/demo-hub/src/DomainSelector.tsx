/** Domain Selector — grid of domain cards with progress rings */
import type { DemoDomain, DemoProgress } from './types';

interface DomainSelectorProps {
  domains: DemoDomain[];
  progress: DemoProgress;
  onSelect: (domain: DemoDomain) => void;
}

export default function DomainSelector({ domains, progress, onSelect }: DomainSelectorProps) {
  return (
    <div className="demo-domain-selector">
      <p className="demo-hub-subtitle">Master RedfireForge with interactive lessons.</p>
      <div className="demo-domain-grid">
        {domains.map(domain => {
          const completedCount = domain.lessons.filter(l =>
            progress.completedLessons.includes(l.id)
          ).length;
          const totalCount = domain.lessons.length;
          const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

          return (
            <button
              key={domain.id}
              className={`demo-domain-card ${!domain.available ? 'coming-soon' : ''}`}
              onClick={() => domain.available && onSelect(domain)}
              disabled={!domain.available}
            >
              <span className="demo-domain-icon">{domain.icon}</span>
              <span className="demo-domain-name">{domain.name}</span>
              <span className="demo-domain-count">
                {totalCount > 0 ? `${totalCount} lesson${totalCount > 1 ? 's' : ''}` : ''}
              </span>
              {domain.available ? (
                <ProgressRing pct={pct} />
              ) : (
                <span className="demo-domain-badge">Coming Soon</span>
              )}
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
    <svg className="demo-progress-ring" width="40" height="40" viewBox="0 0 40 40">
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
      {pct > 0 && (
        <text x="20" y="24" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          {Math.round(pct)}%
        </text>
      )}
    </svg>
  );
}
