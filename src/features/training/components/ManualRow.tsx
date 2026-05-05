import type { TrainingManual, ManualProgress, ManualStatus } from '../../../data/galleries/trainingPaths/types';
import type { WhatsNewType } from '../hooks/useWhatsNew';

interface Props {
  manual: TrainingManual;
  progress: ManualProgress | undefined;
  badge: WhatsNewType | null;
  onStatusChange?: (manualPath: string, status: ManualStatus) => void;
  onOpenManual?: (manualPath: string) => void;
  onNavigateToSample?: (sampleId: string) => void;
}

/** Get next status in cycle: not_started -> in_progress -> completed -> not_started */
function getNextStatus(current: ManualStatus): ManualStatus {
  switch (current) {
    case 'not_started': return 'in_progress';
    case 'in_progress': return 'completed';
    case 'completed': return 'not_started';
  }
}

/** Get aria label for status button */
function getStatusLabel(status: ManualStatus): string {
  switch (status) {
    case 'not_started': return 'Not started. Click to mark as in progress.';
    case 'in_progress': return 'In progress. Click to mark as completed.';
    case 'completed': return 'Completed. Click to reset.';
  }
}

export function ManualRow({ 
  manual, 
  progress, 
  badge, 
  onStatusChange,
  onOpenManual,
  onNavigateToSample,
}: Props) {
  const status = progress?.status ?? 'not_started';

  const handleStatusClick = () => {
    if (onStatusChange && manual.manualPath) {
      onStatusChange(manual.manualPath, getNextStatus(status));
    }
  };

  const handleOpenManual = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenManual && manual.manualPath) {
      onOpenManual(manual.manualPath);
    }
  };

  const handleViewSample = () => {
    if (onNavigateToSample && manual.sampleId) {
      onNavigateToSample(manual.sampleId);
    }
  };

  return (
    <div className="training-manual-row">
      <button
        className={`training-manual-status training-manual-status-${status}`}
        onClick={handleStatusClick}
        aria-label={getStatusLabel(status)}
        title={getStatusLabel(status)}
        type="button"
      >
        {status === 'completed' ? '✓' : status === 'in_progress' ? '◐' : '○'}
      </button>
      <div className="training-manual-info">
        <div className="training-manual-title">
          <a
            href={`/docs/training-manuals/${manual.manualPath}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenManual}
          >
            {manual.title}
          </a>
          {badge && (
            <span className={`training-badge training-badge-${badge}`}>
              {badge === 'new' ? 'NEW' : 'UPDATED'}
            </span>
          )}
        </div>
        <div className="training-manual-desc">{manual.description}</div>
      </div>
      <div className={`training-difficulty training-difficulty-${manual.difficulty}`}>
        <span className="training-difficulty-dot" />
        {manual.difficulty === 'medium' && <span className="training-difficulty-dot" />}
        {manual.difficulty === 'advanced' && (
          <>
            <span className="training-difficulty-dot" />
            <span className="training-difficulty-dot" />
          </>
        )}
      </div>
      {manual.sampleId && onNavigateToSample && (
        <button
          className="training-manual-sample-btn"
          onClick={handleViewSample}
          title="View sample in Gallery"
          type="button"
        >
          🧪
        </button>
      )}
    </div>
  );
}
