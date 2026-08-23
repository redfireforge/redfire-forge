import { describe, expect, it, vi } from 'vitest';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { buildRuntimeActionBindings } from './apiMockRuntimeActionBindings';

function makeServer(id: string): ApiMockServerDefinitionV1 {
  return { id, name: id, port: 4600, routes: [] } as unknown as ApiMockServerDefinitionV1;
}

describe('buildRuntimeActionBindings', () => {
  it('dispatches every action to the latest active server snapshot', async () => {
    const activeServer = makeServer('active');
    const latestServer = makeServer('latest');
    const latestRef = { current: { activeServerId: 'latest', servers: [latestServer] } };
    const onStartServer = vi.fn(async () => undefined);
    const onStopServer = vi.fn(async () => undefined);
    const onApplyServer = vi.fn(async () => undefined);
    const onRestartServer = vi.fn(async () => undefined);
    const bindings = buildRuntimeActionBindings({
      latestRef,
      activeServer,
      onStartServer,
      onStopServer,
      onApplyServer,
      onRestartServer,
    });

    bindings.onStart();
    bindings.onStop();
    bindings.onApply();
    bindings.onRestart();
    await Promise.resolve();

    expect(onStartServer).toHaveBeenCalledWith(latestServer);
    expect(onStopServer).toHaveBeenCalledWith(latestServer);
    expect(onApplyServer).toHaveBeenCalledWith(latestServer);
    expect(onRestartServer).toHaveBeenCalledWith(latestServer);
  });

  it('falls back to the rendered active server when the latest snapshot is unavailable', async () => {
    const activeServer = makeServer('active');
    const onStartServer = vi.fn(async () => undefined);
    const onStopServer = vi.fn(async () => undefined);
    const onApplyServer = vi.fn(async () => undefined);
    const onRestartServer = vi.fn(async () => undefined);
    const bindings = buildRuntimeActionBindings({
      latestRef: { current: { servers: [] } },
      activeServer,
      onStartServer,
      onStopServer,
      onApplyServer,
      onRestartServer,
    });

    bindings.onStart();
    bindings.onStop();
    bindings.onApply();
    bindings.onRestart();
    await Promise.resolve();

    expect(onStartServer).toHaveBeenCalledWith(activeServer);
    expect(onStopServer).toHaveBeenCalledWith(activeServer);
    expect(onApplyServer).toHaveBeenCalledWith(activeServer);
    expect(onRestartServer).toHaveBeenCalledWith(activeServer);
  });
});
