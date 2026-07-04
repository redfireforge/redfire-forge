import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import { createResolveTabConnectionHandler } from './grpcStudioTabCommands';
import type { useGrpcStudioSessionCore } from './useGrpcStudioSessionCore';
import {
  createIdleTargetConnectionSession,
  probeGrpcTargetConnection,
  resetTargetConnectionSession,
  resolveGrpcTargetProbeTimeoutMs,
} from '../utils/grpcTargetConnection';
import {
  bumpGrpcTargetProbeGeneration,
  isGrpcTargetProbeGenerationCurrent,
} from '../utils/grpcTargetProbeGeneration';

type SessionCore = ReturnType<typeof useGrpcStudioSessionCore>;

export { resetGrpcTargetProbeGenerationForTests } from '../utils/grpcTargetProbeGeneration';

export function createConnectTargetHandler(
  runtimeCtx: GrpcStudioRuntimeContext,
  core: SessionCore,
) {
  const resolveTabConnection = createResolveTabConnectionHandler(runtimeCtx);
  return async (tabId: string) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;

    const generation = bumpGrpcTargetProbeGeneration(tabId);
    const resolution = resolveTabConnection(tabId);
    core.updateTab(tabId, {
      targetConnection: { state: 'connecting' },
    });

    const session = await probeGrpcTargetConnection(
      resolution,
      resolveGrpcTargetProbeTimeoutMs(tab.timeoutMs),
    );
    if (!isGrpcTargetProbeGenerationCurrent(tabId, generation)) {
      return;
    }

    if (session.state === 'connected') {
      const descriptorState = core.sessionRef.current.tabDescriptors[tabId];
      const hasLoadedDescriptor = Boolean(descriptorState?.descriptor);
      const isDescriptorLoadError = descriptorState?.loadState === 'error';
      if (!hasLoadedDescriptor && isDescriptorLoadError) {
        runtimeCtx.patchTabDescriptor(tabId, {
          loadState: 'idle',
          errorMessage: undefined,
        });
      }
    }

    core.updateTab(tabId, { targetConnection: session });
  };
}

export function createDisconnectTargetHandler(core: SessionCore) {
  return (tabId: string) => {
    bumpGrpcTargetProbeGeneration(tabId);
    core.updateTab(tabId, {
      targetConnection: resetTargetConnectionSession(),
    });
  };
}

export function createToggleTargetConnectionHandler(
  core: SessionCore,
  connectTarget: (tabId: string) => Promise<void>,
  disconnectTarget: (tabId: string) => void,
) {
  return (tabId: string) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;
    const state = tab.targetConnection?.state ?? createIdleTargetConnectionSession().state;
    if (state === 'connected' || state === 'connecting') {
      disconnectTarget(tabId);
      return;
    }
    void connectTarget(tabId);
  };
}
