import { useState, useCallback, useMemo } from 'react';
import type { TrainingPath, TrainingPhase, TrainingManual } from '../../../data/galleries/trainingPaths';
import type { GallerySampleStatus } from '../../../features/gallery/types';
import { DifficultyDots } from './DifficultyDots';

interface TrainingPathsViewProps {
  paths: TrainingPath[];
  /** Currently focused path ID from sidebar click (if any). */
  activePathId?: string;
  /** Called when the user clicks an Import button on a manual row. */
  onImportSample?: (sampleId: string) => void;
  /** Map of gallery sample ID → import status for showing badges. */
  sampleStatus?: Record<string, GallerySampleStatus>;
}

/**
 * Curriculum-first view showing training paths as expandable phase cards.
 * Replaces the sample grid when the gallery is in "paths" mode.
 */
export function TrainingPathsView({
  paths,
  activePathId,
  onImportSample,
  sampleStatus,
}: TrainingPathsViewProps) {
  return (
    <div className="training-paths-view">
      <div className="training-paths-header">
        <h2 className="training-paths-title">📖 Training Paths</h2>
        <p className="training-paths-subtitle">
          Structured learning journeys. Click a path to see its phases, manuals, and linked samples.
        </p>
      </div>

      <div className="training-paths-list">
        {paths.map(tp => (
          <TrainingPathCard
            key={tp.id}
            path={tp}
            highlighted={tp.id === activePathId}
            onImportSample={onImportSample}
            sampleStatus={sampleStatus}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Path Card ── */

function TrainingPathCard({
  path,
  highlighted,
  onImportSample,
  sampleStatus,
}: {
  path: TrainingPath;
  highlighted: boolean;
  onImportSample?: (sampleId: string) => void;
  sampleStatus?: Record<string, GallerySampleStatus>;
}) {
  const [expanded, setExpanded] = useState(highlighted && !path.comingSoon);
  const totalManuals = path.phases.reduce((s, p) => s + p.manuals.length, 0);
  const totalSamples = path.phases.reduce(
    (s, p) => s + p.manuals.filter(m => m.sampleId).length, 0,
  );

  // Track which phases are expanded (default: all expanded)
  const defaultPhaseState = useMemo(
    () => Object.fromEntries(path.phases.map(p => [p.id, true])),
    [path.phases],
  );
  const [phaseExpanded, setPhaseExpanded] = useState<Record<number, boolean>>(defaultPhaseState);
  const allCollapsed = Object.values(phaseExpanded).every(v => !v);

  const toggleAllPhases = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = allCollapsed; // if all collapsed → expand all, else collapse all
    setPhaseExpanded(Object.fromEntries(path.phases.map(p => [p.id, newState])));
  }, [allCollapsed, path.phases]);

  const togglePhase = useCallback((phaseId: number) => {
    setPhaseExpanded(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  }, []);

  return (
    <div
      className={`training-path-card${highlighted ? ' training-path-card-highlighted' : ''}${path.comingSoon ? ' training-path-card-soon' : ''}`}
    >
      <button
        className="training-path-hero"
        onClick={() => !path.comingSoon && setExpanded(v => !v)}
        type="button"
        aria-expanded={expanded}
      >
        <span className="training-path-emoji">{path.icon}</span>
        <div className="training-path-meta">
          <h3 className="training-path-name">{path.name}</h3>
          <p className="training-path-desc">{path.description}</p>
          <div className="training-path-stats">
            {path.comingSoon ? (
              <span className="training-path-stat">Coming soon</span>
            ) : (
              <>
                <span className="training-path-stat"><strong>{totalManuals}</strong> manuals</span>
                <span className="training-path-stat"><strong>{path.phases.length}</strong> phases</span>
                {totalSamples > 0 && (
                  <span className="training-path-stat"><strong>{totalSamples}</strong> samples</span>
                )}
              </>
            )}
          </div>
        </div>
        {!path.comingSoon && (
          <span className={`training-path-chevron${expanded ? ' open' : ''}`}>▶</span>
        )}
      </button>

      {expanded && !path.comingSoon && (
        <div className="training-path-phases">
          <div className="training-path-phase-toolbar">
            <button
              className="training-path-collapse-all-btn"
              onClick={toggleAllPhases}
              type="button"
              title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            >
              {allCollapsed ? '▶ Expand All' : '▼ Collapse All'}
            </button>
          </div>
          {path.phases.map(phase => (
            <PhaseSection
              key={phase.id}
              phase={phase}
              onImportSample={onImportSample}
              sampleStatus={sampleStatus}
              expanded={phaseExpanded[phase.id] ?? true}
              onToggle={() => togglePhase(phase.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Phase Section ── */

function PhaseSection({
  phase,
  onImportSample,
  sampleStatus,
  expanded,
  onToggle,
}: {
  phase: TrainingPhase;
  onImportSample?: (sampleId: string) => void;
  sampleStatus?: Record<string, GallerySampleStatus>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="training-phase">
      <button
        className="training-phase-header"
        onClick={onToggle}
        type="button"
        aria-expanded={expanded}
      >
        <span className="training-phase-number">P{phase.id}</span>
        <span className="training-phase-name">{phase.name}</span>
        <span className="training-phase-count">{phase.manuals.length} manuals</span>
        <span className={`training-phase-chevron${expanded ? ' open' : ''}`}>▶</span>
      </button>
      {expanded && (
        <div className="training-phase-manuals">
          {phase.manuals.map(manual => (
            <ManualRow
              key={manual.title}
              manual={manual}
              onImportSample={onImportSample}
              sampleStatus={manual.sampleId ? sampleStatus?.[manual.sampleId] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Manual Row ── */

function ManualRow({
  manual,
  onImportSample,
  sampleStatus: status,
}: {
  manual: TrainingManual;
  onImportSample?: (sampleId: string) => void;
  sampleStatus?: GallerySampleStatus;
}) {
  return (
    <div className="training-manual-row">
      <span className="training-manual-icon">📄</span>
      <div className="training-manual-info">
        <div className="training-manual-title">{manual.title}</div>
        <div className="training-manual-desc">{manual.description}</div>
      </div>
      <DifficultyDots level={manual.difficulty} />
      {manual.sampleId && (
        <div className="training-manual-sample">
          <span className="training-manual-sample-chip">
            {manual.sampleId}
            {status && (
              <span className={`gallery-card-status-badge gallery-status-${status}`}>
                {status === 'imported' ? '✓' : '↻'}
              </span>
            )}
          </span>
          <button
            className="training-manual-import-btn"
            onClick={() => onImportSample?.(manual.sampleId!)}
            type="button"
          >
            Import
          </button>
        </div>
      )}
    </div>
  );
}
