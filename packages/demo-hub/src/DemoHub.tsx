/** Demo Hub — full-panel tab content */
import DemoHubHeader from './DemoHubHeader';
import DomainSelector from './DomainSelector';
import LessonList from './LessonList';
import LessonPlayer from './LessonPlayer';
import { allDomains } from './lessons/index';
import type { useDemoHub } from './useDemoHub';

type HubActions = ReturnType<typeof useDemoHub>;

interface DemoHubProps {
  hub: HubActions;
}

export default function DemoHub({ hub }: DemoHubProps) {
  const { state, progress } = hub;

  return (
    <div className="demo-hub">
      <DemoHubHeader
        view={state.view}
        domain={state.selectedDomain}
        lesson={state.selectedLesson}
        onBack={hub.goBack}
        onBackToDomains={hub.goToDomains}
      />
      <div className="demo-hub-body">
        {state.view === 'domains' && (
          <DomainSelector
            domains={allDomains}
            progress={progress}
            onSelect={hub.selectDomain}
          />
        )}
        {state.view === 'lessons' && state.selectedDomain && (
          <LessonList
            domain={state.selectedDomain}
            progress={progress}
            onSelect={hub.selectLesson}
            onBack={hub.goBack}
            onResetLesson={hub.resetLesson}
            onResetAll={hub.resetProgress}
            initialCategory={progress.lastCategory ?? state.selectedLesson?.category}
            onCategoryChange={hub.setLastCategory}
          />
        )}
        {state.view === 'concept' && state.selectedLesson && (
          <LessonPlayer
            lesson={state.selectedLesson}
            onStartDemo={hub.startLiveDemo}
          />
        )}
        {state.view === 'live' && state.selectedLesson && (
          <div className="demo-hub-live-placeholder" data-testid="demo-hub-live-placeholder">
            <p className="demo-hub-live-placeholder-title">Live demo in progress</p>
            <p className="demo-hub-live-placeholder-desc">
              Follow the floating guide panel on the lesson tab, or press <kbd>Esc</kbd> to exit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
