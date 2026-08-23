import type { ApiMockRouteV1, ApiMockServerSettingsV1 } from '@shared/api-mock/contracts';

interface Props {
  routes: ApiMockRouteV1[];
  settings?: ApiMockServerSettingsV1;
  stats?: { analyzedRules: number; durationMs: number };
  onAnalyze?: () => void;
  onOpenStudio?: () => void;
}

const KINDS: Array<{ title: string; body: string; tone: 'danger' | 'warning' | 'info' }> = [
  { title: 'Definite / duplicate', body: 'Same method + path (or fingerprint) with no separating predicates — usually an Apply blocker.', tone: 'danger' },
  { title: 'Potential overlap', body: 'A param route can capture another rule’s literal (e.g. /users/:id vs /users/admin) at equal priority.', tone: 'warning' },
  { title: 'Shadowed / unreachable', body: 'A broader or higher-priority rule always wins, so a narrower rule never fires.', tone: 'info' },
];

function multiLabel(settings?: ApiMockServerSettingsV1): string {
  if (!settings) return 'Highest priority';
  return settings.selection.multipleMatchPolicy === 'highest_priority'
    ? 'Choose highest priority'
    : 'Reject all multiple matches';
}

function equalLabel(settings?: ApiMockServerSettingsV1): string {
  if (!settings) return 'Reject as ambiguous';
  return settings.selection.equalPriorityPolicy === 'reject'
    ? 'Reject as ambiguous (409)'
    : 'Specificity, then stable ID';
}

/**
 * Full-page Conflicts empty state — what analysis checks + current policy.
 */
export function ApiMockConflictGuide({
  routes,
  settings,
  stats,
  onAnalyze,
  onOpenStudio,
}: Props) {
  const enabled = routes.filter(r => r.enabled).length;
  const analyzed = stats?.analyzedRules ?? enabled;
  const hasRun = stats != null;

  return (
    <div className="am-guide" data-testid="api-mock-conflict-guide">
      <div className="am-guide-hero">
        <div className="am-guide-kicker">{hasRun ? 'Last analysis clean' : 'Ready to analyze'}</div>
        <h2 className="am-guide-title">
          {hasRun ? 'No route conflicts detected' : 'Check rules before they collide at runtime'}
        </h2>
        <p className="am-guide-lead">
          Conflict Inspector compares enabled rules statically — overlaps, duplicates, and shadowing —
          using your selection policy so Apply-time surprises show up here first.
        </p>
        <div className="am-guide-actions">
          {onAnalyze && (
            <button type="button" className="am-btn primary" onClick={onAnalyze} data-testid="api-mock-conflict-guide-analyze">
              {hasRun ? 'Re-analyze' : 'Analyze rules'}
            </button>
          )}
          {onOpenStudio && (
            <button type="button" className="am-btn" onClick={onOpenStudio} data-testid="api-mock-conflict-guide-studio">
              Open Studio
            </button>
          )}
        </div>
      </div>

      <div className="am-guide-stats" role="list" aria-label="Conflict analysis summary">
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Findings</span>
          <span className="am-guide-stat-value">0</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Enabled rules</span>
          <span className="am-guide-stat-value">{enabled} / {routes.length}</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Last run</span>
          <span className="am-guide-stat-value">
            {hasRun ? `${analyzed} rules · ${stats.durationMs} ms` : 'Not run yet'}
          </span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Multiple match</span>
          <span className="am-guide-stat-value">{multiLabel(settings)}</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Equal priority</span>
          <span className="am-guide-stat-value">{equalLabel(settings)}</span>
        </div>
      </div>

      <div className="am-guide-cards am-guide-cards--3">
        {KINDS.map(k => (
          <article key={k.title} className={`am-guide-card tone-${k.tone}`}>
            <h3>{k.title}</h3>
            <p>{k.body}</p>
          </article>
        ))}
      </div>

      <div className="am-notice" style={{ marginTop: 4 }}>
        <span>
          Tip: give literal paths a higher priority than param routes, or add predicates
          (e.g. <span className="am-mono">id</span> regex) so <span className="am-mono">/users/admin</span> and
          {' '}<span className="am-mono">/users/:id</span> cannot both match.
        </span>
      </div>
    </div>
  );
}
