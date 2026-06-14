/** Demo Hub v2 — full-panel tab content */
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
        onClose={() => {/* no-op: tab navigation handles closing */}}
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
          />
        )}
        {state.view === 'concept' && state.selectedLesson && (
          <LessonPlayer
            lesson={state.selectedLesson}
            speed={state.speed}
            onStartDemo={hub.startLiveDemo}
            onSetSpeed={hub.setSpeed}
            onBack={hub.goBack}
          />
        )}
      </div>
    </div>
  );
}
