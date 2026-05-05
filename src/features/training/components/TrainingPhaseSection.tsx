import { useState } from 'react';
import type { TrainingPhase, ManualProgress } from '../../../data/galleries/trainingPaths/types';
import type { WhatsNewType } from '../hooks/useWhatsNew';
import { ManualRow } from './ManualRow';

interface Props {
  phase: TrainingPhase;
  getManualProgress: (manualPath: string) => ManualProgress | undefined;
  getBadge: (manualPath: string) => WhatsNewType | null;
  onNavigateToSample?: () => void;
  defaultExpanded?: boolean;
}

export function TrainingPhaseSection({
  phase,
  getManualProgress,
  getBadge,
  onNavigateToSample,
  defaultExpanded = true,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const manualsWithPath = phase.manuals.filter(m => m.manualPath);

  return (
    <div className="training-phase">
      <div
        className="training-phase-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded); }}
        aria-expanded={isExpanded}
      >
        <span className={`training-phase-chevron ${isExpanded ? 'expanded' : ''}`}>▸</span>
        <span className="training-phase-number">P{phase.id}</span>
        <span className="training-phase-name">{phase.name}</span>
        <span className="training-phase-count">{manualsWithPath.length} manuals</span>
      </div>
      {isExpanded && (
        <div className="training-manuals-list">
          {manualsWithPath.map((manual, idx) => (
            <ManualRow
              key={idx}
              manual={manual}
              progress={getManualProgress(manual.manualPath!)}
              badge={getBadge(manual.manualPath!)}
              onNavigateToSample={manual.sampleId ? onNavigateToSample : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
