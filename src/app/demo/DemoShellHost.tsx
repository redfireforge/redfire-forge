import { useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { Environment, GlobalAuthProfile, Microservice } from '../../shared/types';
import type { Workflow } from '../../features/workflow/types/workflow';
import type { Tab } from '../utils/appTabUtils';
import type { DemoHubApi } from './demoHubApi';
import { syncDemoHubRuntimeRef, resetDemoHubRuntimeRef, DEMO_HUB_MOUNT_ID } from './demoHubRuntimeRef';
import { useDemoHub } from '../../features/demo-player/useDemoHub';
import DemoHub from '../../features/demo-player/DemoHub';
import { useDemoShortcuts } from '../hooks/useDemoShortcuts';
import { useDemoWorkflowBridge } from '../hooks/useDemoWorkflowBridge';
import { useDemoSidebarBridge } from '../hooks/useDemoSidebarBridge';
import { useDemoGlobalAuthBridge } from '../hooks/useDemoGlobalAuthBridge';
import { useDemoAppEnvironmentCleanupBridge } from '../hooks/useDemoAppEnvironmentCleanupBridge';
import AppLiveDemoOverlay from '../components/AppLiveDemoOverlay';
import '../../styles/demo-player.css';
import '../../styles/demo-hub.css';

export interface DemoShellHostProps {
  navigateToTab: (tab: string) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  workflows: Workflow[];
  removeWorkflow: (id: string) => void;
  insertWorkflow?: (wf: Workflow) => void;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setAppGlobalAuthProfiles: Dispatch<SetStateAction<GlobalAuthProfile[]>>;
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
  setActiveTab,
  workflows,
  removeWorkflow,
  insertWorkflow,
  setSidebarCollapsed,
  setAppGlobalAuthProfiles,
  selectedEnvId,
  selectedSvcId,
  setEnvironments,
  setMicroservices,
  setSelectedEnvId,
  setSelectedSvcId,
}: DemoShellHostProps) {
  const demoHub = useDemoHub({ navigateToTab });
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);

  useDemoShortcuts(demoHub, activeTab, setActiveTab);
  useDemoWorkflowBridge(workflows, removeWorkflow, insertWorkflow);
  useDemoSidebarBridge(setSidebarCollapsed);
  useDemoGlobalAuthBridge(setAppGlobalAuthProfiles);
  useDemoAppEnvironmentCleanupBridge({
    selectedEnvId,
    selectedSvcId,
    setEnvironments,
    setMicroservices,
    setSelectedEnvId,
    setSelectedSvcId,
  });

  syncDemoHubRuntimeRef(demoHub as DemoHubApi);

  useEffect(() => () => resetDemoHubRuntimeRef(), []);

  useLayoutEffect(() => {
    const resolveMount = () => document.getElementById(DEMO_HUB_MOUNT_ID);

    const el = resolveMount();
    if (el) {
      setMountEl(el);
      return;
    }

    if (activeTab !== 'demo-hub') {
      setMountEl(null);
      return;
    }

    // Mount node is a sibling under `.app`; retry one frame if the shell loaded first.
    const frame = requestAnimationFrame(() => {
      setMountEl(resolveMount());
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  return (
    <>
      {mountEl && activeTab === 'demo-hub' && createPortal(
        <DemoHub hub={demoHub} />,
        mountEl,
      )}
      <AppLiveDemoOverlay demoHub={demoHub} setActiveTab={setActiveTab} />
    </>
  );
}
