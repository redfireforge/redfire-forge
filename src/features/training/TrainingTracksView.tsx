import { useCallback } from 'react';
import { useTrainingProgress } from './hooks/useTrainingProgress';
import { useWhatsNew } from './hooks/useWhatsNew';
import { TrainingProgressDashboard } from './components/TrainingProgressDashboard';
import { ContinueLearningCard } from './components/ContinueLearningCard';
import { TrainingPathCard } from './components/TrainingPathCard';
import { WhatsNewBanner } from './components/WhatsNewBanner';
import { trainingPaths } from '../../data/galleries/trainingPaths';
import type { ManualStatus } from '../../data/galleries/trainingPaths/types';
import './training.css';

interface Props {
  onNavigateToSample: (sampleId: string) => void;
}

export default function TrainingTracksView({ onNavigateToSample }: Props) {
  const {
    isLoading,
    overallStats,
    lastViewedInProgress,
    getManualProgress,
    updateManualStatus,
    markViewed,
  } = useTrainingProgress();

  const whatsNew = useWhatsNew();

  // Handle status change from ManualRow
  const handleStatusChange = useCallback((manualPath: string, status: ManualStatus) => {
    updateManualStatus(manualPath, status);
  }, [updateManualStatus]);

  // Handle opening a manual (marks as viewed and opens in new tab)
  const handleOpenManual = useCallback((manualPath: string) => {
    markViewed(manualPath);
    window.open(`/docs/training-manuals/${manualPath}`, '_blank');
  }, [markViewed]);

  // Handle "Continue Learning" click
  const handleContinueLearning = useCallback(() => {
    if (lastViewedInProgress) {
      handleOpenManual(lastViewedInProgress.manualPath);
    }
  }, [lastViewedInProgress, handleOpenManual]);

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

  const activePaths = trainingPaths.filter(p => !p.comingSoon);

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
          onContinue={handleContinueLearning}
        />
      )}

      <WhatsNewBanner
        items={whatsNew.allItems}
        displayedItems={whatsNew.displayedItems}
        counts={whatsNew.counts}
        isExpanded={whatsNew.isExpanded}
        showAll={whatsNew.showAll}
        hasMore={whatsNew.hasMore}
        onToggleExpanded={whatsNew.toggleExpanded}
        onToggleShowAll={whatsNew.toggleShowAll}
        onItemClick={markViewed}
      />

      <section className="training-paths-section">
        <h2 className="training-section-title">Learning Paths</h2>
        <p className="training-section-subtitle">
          {activePaths.length} paths available • {overallStats.totalManuals} manuals total
        </p>

        <div className="training-paths-list">
          {activePaths.map(path => (
            <TrainingPathCard
              key={path.id}
              path={path}
              getManualProgress={getManualProgress}
              getBadge={whatsNew.getBadge}
              onStatusChange={handleStatusChange}
              onOpenManual={handleOpenManual}
              onNavigateToSample={onNavigateToSample}
              defaultExpanded={false}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
