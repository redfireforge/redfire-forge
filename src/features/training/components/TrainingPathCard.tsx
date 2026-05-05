import { useState } from 'react';
import type { TrainingPath, ManualProgress, ManualStatus } from '../../../data/galleries/trainingPaths/types';
import type { WhatsNewType } from '../hooks/useWhatsNew';
import { TrainingPhaseSection } from './TrainingPhaseSection';

interface Props {
  path: TrainingPath;
  getManualProgress: (manualPath: string) => ManualProgress | undefined;
  getBadge: (manualPath: string) => WhatsNewType | null;
  onStatusChange?: (manualPath: string, status: ManualStatus) => void;
  onOpenManual?: (manualPath: string) => void;
  onNavigateToSample?: (sampleId: string) => void;
  defaultExpanded?: boolean;
}

export function TrainingPathCard({
  path,
  getManualProgress,
  getBadge,
  onStatusChange,
  onOpenManual,
  onNavigateToSample,
  defaultExpanded = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const pathManuals = path.phases.flatMap(p => p.manuals).filter(m => m.manualPath);
  const completed = pathManuals.filter(m => getManualProgress(m.manualPath!)?.status === 'completed').length;
  const inProgress = pathManuals.filter(m => getManualProgress(m.manualPath!)?.status === 'in_progress').length;
  const total = pathManuals.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

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
          <div className="training-path-name">{path.name}</div>
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
          {path.phases.map(phase => (
            <TrainingPhaseSection
              key={phase.id}
              phase={phase}
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
