import { useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { Environment, GlobalAuthProfile, Microservice } from '../../shared/types';
import type { Tab } from '../utils/appTabUtils';
import type { DemoHubApi } from './demoHubApi';
import { syncDemoHubRuntimeRef, resetDemoHubRuntimeRef, DEMO_HUB_MOUNT_ID } from './demoHubRuntimeRef';
import { useDemoHub } from '@redfireforge/demo-hub/useDemoHub';
import DemoHub from '@redfireforge/demo-hub/DemoHub';
import { LessonNotesProvider } from '@redfireforge/demo-hub/LessonNotesContext';
import LessonNotesPanel from '@redfireforge/demo-hub/LessonNotesPanel';
import { clearDemoBootFreeze, revealDemoBootSurface } from '@redfireforge/demo-hub/demoBootFreeze';
import { useDemoShortcuts } from '../hooks/useDemoShortcuts';
import { useDemoSidebarBridge } from '../hooks/useDemoSidebarBridge';
import { useDemoGlobalAuthBridge } from '../hooks/useDemoGlobalAuthBridge';
import { useDemoWorkspaceDefaultsBridge } from '../hooks/useDemoWorkspaceDefaultsBridge';
import { useDemoAppEnvironmentCleanupBridge } from '../hooks/useDemoAppEnvironmentCleanupBridge';
import { useDemoSettingsEnvBridge } from '../hooks/useDemoSettingsEnvBridge';
import { useDemoSettingsSvcBridge } from '../hooks/useDemoSettingsSvcBridge';
import AppLiveDemoOverlay from '../components/AppLiveDemoOverlay';
import '../../styles/demo-player.css';
import '../../styles/demo-hub.css';

export interface DemoShellHostProps {
  navigateToTab: (tab: string) => void;
  activeTab: Tab;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setAppGlobalAuthProfiles: Dispatch<SetStateAction<GlobalAuthProfile[]>>;
  setWorkspaceDefaults: Dispatch<SetStateAction<Record<string, string>>>;
  selectedEnvId: string;
  selectedSvcId: string;
  setEnvironments: Dispatch<SetStateAction<Environment[]>>;
  setMicroservices: Dispatch<SetStateAction<Microservice[]>>;
  setSelectedEnvId: (id: string) => void;
  setSelectedSvcId: (id: string) => void;
}

/** Runs demo hooks, Learning Hub pane (portal), and live overlay. Lazy-loaded when demo is enabled. */
export function DemoShellHost({
  navigateToTab,
  activeTab,
  setSidebarCollapsed,
  setAppGlobalAuthProfiles,
  setWorkspaceDefaults,
  selectedEnvId,
  selectedSvcId,
  setEnvironments,
  setMicroservices,
  setSelectedEnvId,
  setSelectedSvcId,
}: DemoShellHostProps) {
  const demoHub = useDemoHub({ navigateToTab });
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);

  useDemoShortcuts(demoHub, activeTab, navigateToTab, demoHub.suppressLiveTabExitRef);
  useDemoSidebarBridge(setSidebarCollapsed);
  useDemoGlobalAuthBridge(setAppGlobalAuthProfiles);
  useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults);
  useDemoAppEnvironmentCleanupBridge({
    selectedEnvId,
    selectedSvcId,
    setEnvironments,
    setMicroservices,
    setSelectedEnvId,
    setSelectedSvcId,
  });
  useDemoSettingsEnvBridge({ setEnvironments });
  useDemoSettingsSvcBridge({ setMicroservices });

  syncDemoHubRuntimeRef(demoHub as DemoHubApi);

  useEffect(() => () => resetDemoHubRuntimeRef(), []);

  // Sync the boot veil / body attr with bootstrapping state.
  // On teardown, fade the veil out via revealDemoBootSurface — a hard
  // clearDemoBootFreeze here would skip the CSS transition and cause a
  // jarring pop instead of the intended soft reveal into step 1.
  useLayoutEffect(() => {
    if (demoHub.isDemoBootstrapping) {
      document.body.setAttribute('data-demo-bootstrapping', '1');
    } else {
      revealDemoBootSurface();
    }
  }, [demoHub.isDemoBootstrapping]);

  useEffect(() => () => {
    document.body.removeAttribute('data-demo-bootstrapping');
    clearDemoBootFreeze();
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tryResolveMount = () => {
      if (cancelled) return;
      const el = document.getElementById(DEMO_HUB_MOUNT_ID);
      if (el) {
        setMountEl(el);
        return;
      }
      attempts += 1;
      if (attempts < 24) {
        requestAnimationFrame(tryResolveMount);
      }
    };

    tryResolveMount();
    return () => { cancelled = true; };
  }, [activeTab]);

  // Live demos render on the lesson tab — never park on empty Demo Hub.
  // Previously we skipped this while bootstrapping; that left a blank Demo Hub
  // body (Concept unmounted, placeholder hidden) for the whole Preparing phase
  // whenever the Start-click tab switch lagged.
  useEffect(() => {
    if (demoHub.state.view !== 'live' || activeTab !== 'demo-hub') return;
    if (demoHub.suppressLiveTabExitRef?.current) return;
    const target = demoHub.state.selectedLesson?.initialTab;
    if (target && target !== 'demo-hub') {
      navigateToTab(target);
    }
  }, [
    demoHub.state.view,
    demoHub.state.selectedLesson,
    demoHub.suppressLiveTabExitRef,
    activeTab,
    navigateToTab,
  ]);

  return (
    <LessonNotesProvider>
      {mountEl && activeTab === 'demo-hub' && createPortal(
        <DemoHub hub={demoHub} />,
        mountEl,
      )}
      <AppLiveDemoOverlay demoHub={demoHub} navigateToTab={navigateToTab} />
      <LessonNotesPanel />
    </LessonNotesProvider>
  );
}
