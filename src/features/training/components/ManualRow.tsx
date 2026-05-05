import type { TrainingManual, ManualProgress } from '../../../data/galleries/trainingPaths/types';
import type { WhatsNewType } from '../hooks/useWhatsNew';

interface Props {
  manual: TrainingManual;
  progress: ManualProgress | undefined;
  badge: WhatsNewType | null;
  onNavigateToSample?: () => void;
}

export function ManualRow({ manual, progress, badge, onNavigateToSample }: Props) {
  const status = progress?.status ?? 'not_started';

  return (
    <div className="training-manual-row">
      <div className={`training-manual-status training-manual-status-${status}`}>
        {status === 'completed' ? '✓' : status === 'in_progress' ? '◐' : ''}
      </div>
      <div className="training-manual-info">
        <div className="training-manual-title">
          <a
            href={`/docs/training-manuals/${manual.manualPath}`}
            target="_blank"
            rel="noopener noreferrer"
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
          onClick={onNavigateToSample}
          title="View sample in Gallery"
        >
          🧪
        </button>
      )}
    </div>
  );
}
