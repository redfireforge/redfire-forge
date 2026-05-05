import { useState } from 'react';
import type { TrainingPhase, TrainingManual, ManualProgress, ManualStatus } from '../../../data/galleries/trainingPaths/types';
import type { WhatsNewType } from '../hooks/useWhatsNew';
import { ManualRow } from './ManualRow';

interface Props {
  phase: TrainingPhase;
  getManualProgress: (manualPath: string) => ManualProgress | undefined;
  getBadge: (manualPath: string) => WhatsNewType | null;
  onStatusChange?: (manualPath: string, status: ManualStatus) => void;
  onOpenManual?: (manualPath: string) => void;
  onNavigateToSample?: (sampleId: string) => void;
  defaultExpanded?: boolean;
  /** When provided, only these filtered manuals are shown */
  filteredManuals?: TrainingManual[];
}

export function TrainingPhaseSection({
  phase,
  getManualProgress,
  getBadge,
  onStatusChange,
  onOpenManual,
  onNavigateToSample,
  defaultExpanded = true,
  filteredManuals,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Use filtered manuals if provided, otherwise filter by manualPath
  const manualsToShow = filteredManuals ?? phase.manuals.filter(m => m.manualPath);

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
        <span className="training-phase-count">{manualsToShow.length} manuals</span>
      </div>
      {isExpanded && (
        <div className="training-manuals-list">
          {manualsToShow.map((manual, idx) => (
            <ManualRow
              key={idx}
              manual={manual}
              progress={getManualProgress(manual.manualPath!)}
              badge={getBadge(manual.manualPath!)}
              onStatusChange={onStatusChange}
              onOpenManual={onOpenManual}
              onNavigateToSample={manual.sampleId ? onNavigateToSample : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
