/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Dispatch, SetStateAction } from 'react';

const navigateToTab = vi.fn();
const suppressLiveTabExitRef = { current: false };
let liveView = true;

vi.mock('@redfireforge/demo-hub/useDemoHub', () => ({
  useDemoHub: () => ({
    state: {
      view: liveView ? 'live' : 'concept',
      selectedLesson: { id: 'sse-tabs', initialTab: 'sse-studio' },
      stepIndex: 0,
      isPlaying: false,
      selectedDomain: null,
      speed: 1,
    },
    suppressLiveTabExitRef,
    hubOpen: true,
    hubVisible: !liveView,
    stepPhase: 'reading',
    progress: {},
    openHub: vi.fn(),
    closeHub: vi.fn(),
    goBack: vi.fn(),
    goToDomains: vi.fn(),
    selectDomain: vi.fn(),
    selectLesson: vi.fn(),
    startLiveDemo: vi.fn(),
    exitLiveDemo: vi.fn(),
    nextStep: vi.fn(),
    toggleAutoPlay: vi.fn(),
    skipReading: vi.fn(),
    restartDemo: vi.fn(),
    confirmLessonComplete: vi.fn(),
    resetLesson: vi.fn(),
    resetLessons: vi.fn(),
    setLastCategory: vi.fn(),
  }),
}));

vi.mock('@redfireforge/demo-hub/DemoHub', () => ({ default: () => null }));
vi.mock('@redfireforge/demo-hub/LessonNotesContext', () => ({
  LessonNotesProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@redfireforge/demo-hub/LessonNotesPanel', () => ({ default: () => null }));
vi.mock('../hooks/useDemoShortcuts', () => ({ useDemoShortcuts: () => {} }));
vi.mock('../hooks/useDemoSidebarBridge', () => ({ useDemoSidebarBridge: () => {} }));
vi.mock('../hooks/useDemoGlobalAuthBridge', () => ({ useDemoGlobalAuthBridge: () => {} }));
vi.mock('../hooks/useDemoWorkspaceDefaultsBridge', () => ({ useDemoWorkspaceDefaultsBridge: () => {} }));
vi.mock('../hooks/useDemoAppEnvironmentCleanupBridge', () => ({ useDemoAppEnvironmentCleanupBridge: () => {} }));
vi.mock('../hooks/useDemoSettingsEnvBridge', () => ({ useDemoSettingsEnvBridge: () => {} }));
vi.mock('../hooks/useDemoSettingsSvcBridge', () => ({ useDemoSettingsSvcBridge: () => {} }));
vi.mock('../components/AppLiveDemoOverlay', () => ({ default: () => null }));
vi.mock('./demoHubRuntimeRef', () => ({
  syncDemoHubRuntimeRef: () => {},
  resetDemoHubRuntimeRef: () => {},
  DEMO_HUB_MOUNT_ID: 'demo-hub-mount',
}));

import { DemoShellHost } from './DemoShellHost';

function renderHost(activeTab: 'demo-hub' | 'sse-studio' = 'demo-hub') {
  const noopSet = (() => {}) as Dispatch<SetStateAction<unknown>>;
  return render(
    <DemoShellHost
      navigateToTab={navigateToTab}
      activeTab={activeTab as never}
      setSidebarCollapsed={noopSet as Dispatch<SetStateAction<boolean>>}
      setAppGlobalAuthProfiles={noopSet as never}
      setWorkspaceDefaults={noopSet as never}
      selectedEnvId=""
      selectedSvcId=""
      setEnvironments={noopSet as never}
      setMicroservices={noopSet as never}
      setSelectedEnvId={vi.fn()}
      setSelectedSvcId={vi.fn()}
    />,
  );
}

describe('DemoShellHost live→initialTab redirect', () => {
  beforeEach(() => {
    navigateToTab.mockClear();
    suppressLiveTabExitRef.current = false;
    liveView = true;
  });

  it('redirects demo-hub → lesson initialTab while live', () => {
    renderHost('demo-hub');
    expect(navigateToTab).toHaveBeenCalledWith('sse-studio');
  });

  it('does not redirect when exit suppress flag is set (Contents stay stable)', () => {
    suppressLiveTabExitRef.current = true;
    renderHost('demo-hub');
    expect(navigateToTab).not.toHaveBeenCalled();
  });
});
