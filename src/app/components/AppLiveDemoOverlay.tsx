/** Live Demo overlay rendered above the active tab during demo lessons. */
import LiveDemo from '@redfireforge/demo-hub/LiveDemo';
import type { useDemoHub } from '@redfireforge/demo-hub/useDemoHub';
import type { Tab } from '../utils/appTabUtils';

type DemoHub = ReturnType<typeof useDemoHub>;

interface AppLiveDemoOverlayProps {
  demoHub: DemoHub;
  setActiveTab: (tab: Tab) => void;
}

export default function AppLiveDemoOverlay({ demoHub, setActiveTab }: AppLiveDemoOverlayProps) {
  if (demoHub.state.view !== 'live' || !demoHub.state.selectedLesson) return null;

  return (
    <LiveDemo
      lesson={demoHub.state.selectedLesson}
      stepIndex={demoHub.state.stepIndex}
      isPlaying={demoHub.state.isPlaying}
      stepPhase={demoHub.stepPhase}
      onNext={demoHub.nextStep}
      onTogglePlay={demoHub.toggleAutoPlay}
      onSkipReading={demoHub.skipReading}
      onRestart={demoHub.restartDemo}
      onExit={() => { void demoHub.exitLiveDemo().then(() => setActiveTab('demo-hub')); }}
      onComplete={() => {
        demoHub.confirmLessonComplete();
        void demoHub.exitLiveDemo().then(() => setActiveTab('demo-hub'));
      }}
    />
  );
}
