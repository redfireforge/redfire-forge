import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';

type LatestWorkspaceRef = {
  current: {
    activeServerId?: string;
    servers: ApiMockServerDefinitionV1[];
  };
};

type RuntimeAction = (server: ApiMockServerDefinitionV1) => Promise<void>;

export function buildRuntimeActionBindings(args: {
  latestRef: LatestWorkspaceRef;
  activeServer: ApiMockServerDefinitionV1;
  onStartServer: RuntimeAction;
  onStopServer: RuntimeAction;
  onApplyServer: RuntimeAction;
  onRestartServer: RuntimeAction;
}): {
  onStart: () => void;
  onStop: () => void;
  onApply: () => void;
  onRestart: () => void;
} {
  const resolveLatest = (): ApiMockServerDefinitionV1 => {
    const id = args.latestRef.current.activeServerId ?? args.activeServer.id;
    const latest = args.latestRef.current.servers.find(s => s.id === id);
    return latest ?? args.activeServer;
  };

  return {
    onStart: () => { void args.onStartServer(resolveLatest()); },
    onStop: () => { void args.onStopServer(resolveLatest()); },
    onApply: () => { void args.onApplyServer(resolveLatest()); },
    onRestart: () => { void args.onRestartServer(resolveLatest()); },
  };
}