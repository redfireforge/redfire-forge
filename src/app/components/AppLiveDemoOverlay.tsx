/** Live Demo overlay rendered above the active tab during demo lessons. */
import LiveDemo from '@redfireforge/demo-hub/LiveDemo';
import type { useDemoHub } from '@redfireforge/demo-hub/useDemoHub';

type DemoHub = ReturnType<typeof useDemoHub>;

interface AppLiveDemoOverlayProps {
  demoHub: DemoHub;
  navigateToTab: (tab: string) => void;
}

export default function AppLiveDemoOverlay({ demoHub, navigateToTab }: AppLiveDemoOverlayProps) {
  if (demoHub.state.view !== 'live' || !demoHub.state.selectedLesson) return null;

  const pinDemoHubTab = () => {
    navigateToTab('demo-hub');
  };

  const exitToConcept = () => {
    // exitLiveDemo sets suppressLiveTabExitRef before pinning demo-hub so
    // DemoShellHost cannot bounce live+demo-hub → initialTab (Studio flash).
    if (demoHub.suppressLiveTabExitRef) {
      demoHub.suppressLiveTabExitRef.current = true;
    }
    const exitPromise = Promise.resolve(demoHub.exitLiveDemo());
    pinDemoHubTab();
    void exitPromise.finally(() => {
      // Lesson cleanup may navigate to protocol/workflow tabs; pin final destination.
      pinDemoHubTab();
    });
  };

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
      onExit={exitToConcept}
      onComplete={() => {
        demoHub.confirmLessonComplete();
        exitToConcept();
      }}
    />
  );
}
