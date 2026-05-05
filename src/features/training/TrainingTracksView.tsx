import { useTrainingProgress } from './hooks/useTrainingProgress';
import { useWhatsNew } from './hooks/useWhatsNew';
import { TrainingProgressDashboard } from './components/TrainingProgressDashboard';
import { ContinueLearningCard } from './components/ContinueLearningCard';
import { trainingPaths } from '../../data/galleries/trainingPaths';
import './training.css';

interface Props {
  onNavigateToSample: () => void;
}

export default function TrainingTracksView({ onNavigateToSample }: Props) {
  const {
    isLoading,
    overallStats,
    lastViewedInProgress,
    getManualProgress,
  } = useTrainingProgress();

  const whatsNew = useWhatsNew();

  if (isLoading) {
    return (
      <div className="training-tracks-view">
        <div className="training-loading">Loading training progress...</div>
      </div>
    );
  }

  // Find the manual details for "Continue Learning"
  const continueManual = lastViewedInProgress
    ? (() => {
        for (const path of trainingPaths) {
          for (const phase of path.phases) {
            const manual = phase.manuals.find(m => m.manualPath === lastViewedInProgress.manualPath);
            if (manual) {
              return { manual, pathName: path.name, phaseName: phase.name };
            }
          }
        }
        return null;
      })()
    : null;

  return (
    <div className="training-tracks-view">
      <header className="training-header">
        <h1 className="training-title">
          <span className="training-title-icon">📖</span>
          Training Manual Tracks
        </h1>
        <p className="training-subtitle">
          Master RedfireForge through structured learning paths. Track your progress and level up your API testing skills.
        </p>
      </header>

      <TrainingProgressDashboard stats={overallStats} />

      {continueManual && (
        <ContinueLearningCard
          manualTitle={continueManual.manual.title}
          pathName={continueManual.pathName}
          phaseName={continueManual.phaseName}
          difficulty={continueManual.manual.difficulty}
          manualPath={continueManual.manual.manualPath!}
        />
      )}

      {whatsNew.counts.total > 0 && (
        <section className="training-whats-new">
          <div className="training-whats-new-header">
            <div className="training-whats-new-title">
              <span className="training-whats-new-icon">🆕</span>
              <span>What's New</span>
              <span className="training-whats-new-badge">{whatsNew.counts.total} items</span>
            </div>
            <button
              className="training-whats-new-toggle"
              onClick={whatsNew.toggleExpanded}
            >
              {whatsNew.isExpanded ? 'Hide ▲' : 'Show ▼'}
            </button>
          </div>
          {whatsNew.isExpanded && (
            <div className="training-whats-new-list">
              {whatsNew.displayedItems.map((item, idx) => (
                <a
                  key={idx}
                  className="training-whats-new-item"
                  href={`/docs/training-manuals/${item.metadata.manualPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="training-whats-new-item-icon">{item.pathIcon}</div>
                  <div className="training-whats-new-item-info">
                    <div className="training-whats-new-item-title">{item.manual.title}</div>
                    <div className="training-whats-new-item-meta">
                      <span className={`training-badge training-badge-${item.type}`}>
                        {item.type === 'new' ? 'NEW' : 'UPDATED'}
                      </span>
                      <span>{item.pathName} • {item.manual.difficulty}</span>
                    </div>
                  </div>
                </a>
              ))}
              {whatsNew.hasMore && (
                <button
                  className="training-whats-new-show-all"
                  onClick={whatsNew.toggleShowAll}
                >
                  {whatsNew.showAll ? 'Show less' : `Show all ${whatsNew.counts.total} items`}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="training-paths-section">
        <h2 className="training-section-title">Learning Paths</h2>
        <p className="training-section-subtitle">
          {trainingPaths.filter(p => !p.comingSoon).length} paths available • {overallStats.totalManuals} manuals total
        </p>

        <div className="training-paths-list">
          {trainingPaths.filter(p => !p.comingSoon).map(path => {
            const pathManuals = path.phases.flatMap(p => p.manuals).filter(m => m.manualPath);
            const completed = pathManuals.filter(m => getManualProgress(m.manualPath!)?.status === 'completed').length;
            const inProgress = pathManuals.filter(m => getManualProgress(m.manualPath!)?.status === 'in_progress').length;
            const total = pathManuals.length;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div key={path.id} className="training-path-card">
                <div className="training-path-header">
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
                </div>
                <div className="training-path-phases">
                  {path.phases.map(phase => (
                    <div key={phase.id} className="training-phase">
                      <div className="training-phase-header">
                        <span className="training-phase-number">P{phase.id}</span>
                        <span className="training-phase-name">{phase.name}</span>
                        <span className="training-phase-count">{phase.manuals.filter(m => m.manualPath).length} manuals</span>
                      </div>
                      <div className="training-manuals-list">
                        {phase.manuals.filter(m => m.manualPath).map((manual, idx) => {
                          const progress = getManualProgress(manual.manualPath!);
                          const badge = whatsNew.getBadge(manual.manualPath!);
                          return (
                            <div key={idx} className="training-manual-row">
                              <div className={`training-manual-status training-manual-status-${progress?.status ?? 'not_started'}`}>
                                {progress?.status === 'completed' ? '✓' : progress?.status === 'in_progress' ? '◐' : ''}
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
                              {manual.sampleId && (
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
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
