import { useState } from 'react';
import type { TrainingPath, TrainingPhase, TrainingManual, ManualProgress, ManualStatus } from '../../../data/galleries/trainingPaths/types';
import type { WhatsNewType } from '../hooks/useWhatsNew';
import { TrainingPhaseSection } from './TrainingPhaseSection';

interface FilteredPhase {
  phase: TrainingPhase;
  manuals: TrainingManual[];
}

interface Props {
  path: TrainingPath;
  getManualProgress: (manualPath: string) => ManualProgress | undefined;
  getBadge: (manualPath: string) => WhatsNewType | null;
  onStatusChange?: (manualPath: string, status: ManualStatus) => void;
  onOpenManual?: (manualPath: string) => void;
  onNavigateToSample?: (sampleId: string) => void;
  defaultExpanded?: boolean;
  /** When provided, only these filtered phases/manuals are shown */
  filteredPhases?: FilteredPhase[];
}

export function TrainingPathCard({
  path,
  getManualProgress,
  getBadge,
  onStatusChange,
  onOpenManual,
  onNavigateToSample,
  defaultExpanded = false,
  filteredPhases,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Use filtered phases if provided, otherwise use all phases
  const phasesToShow = filteredPhases ?? path.phases.map(phase => ({
    phase,
    manuals: phase.manuals.filter(m => m.manualPath),
  }));

  const pathManuals = path.phases.flatMap(p => p.manuals).filter(m => m.manualPath);
  const completed = pathManuals.filter(m => getManualProgress(m.manualPath!)?.status === 'completed').length;
  const inProgress = pathManuals.filter(m => getManualProgress(m.manualPath!)?.status === 'in_progress').length;
  const total = pathManuals.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Count for filtered view
  const filteredCount = filteredPhases 
    ? filteredPhases.reduce((sum, fp) => sum + fp.manuals.length, 0)
    : null;

  return (
    <div className={`training-path-card ${isExpanded ? 'expanded' : ''}`}>
      <div
        className="training-path-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded); }}
        aria-expanded={isExpanded}
      >
        <div className="training-path-icon">{path.icon}</div>
        <div className="training-path-info">
          <div className="training-path-name">
            {path.name}
            {filteredCount !== null && (
              <span className="training-path-match-count">
                {filteredCount} match{filteredCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <div className="training-path-desc">{path.description}</div>
          <div className="training-path-progress">
            <div className="training-progress-bar">
              <div
                className="training-progress-fill"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="training-progress-text">
              {completed}/{total} manuals ({percentage}%)
            </span>
          </div>
          {inProgress > 0 && (
            <div className="training-path-in-progress">
              {inProgress} in progress
            </div>
          )}
        </div>
        <span className={`training-path-chevron ${isExpanded ? 'expanded' : ''}`}>▸</span>
      </div>
      {isExpanded && (
        <div className="training-path-phases">
          {phasesToShow.map(({ phase, manuals }) => (
            <TrainingPhaseSection
              key={phase.id}
              phase={phase}
              filteredManuals={filteredPhases ? manuals : undefined}
              getManualProgress={getManualProgress}
              getBadge={getBadge}
              onStatusChange={onStatusChange}
              onOpenManual={onOpenManual}
              onNavigateToSample={onNavigateToSample}
              defaultExpanded={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
