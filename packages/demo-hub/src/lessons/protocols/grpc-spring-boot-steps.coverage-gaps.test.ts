/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';
import { grpcSpringBootSteps } from './grpc-spring-boot-steps';

const helperSpies = vi.hoisted(() => ({
  ensureStudioNav: vi.fn(async () => {}),
  ensureSpringStudioReady: vi.fn(async () => {}),
  ensureTransportModeQuiet: vi.fn(async () => {}),
  resetGrpcConnectionSettingsQuiet: vi.fn(async () => {}),
  setGrpcTargetQuiet: vi.fn(async () => {}),
  spotlightAndPause: vi.fn(async () => {}),
  spotlightElementAndPause: vi.fn(async () => {}),
  selectMethodVisible: vi.fn(async () => {}),
  ensureMessageFilledQuiet: vi.fn(async () => {}),
  reflectQuiet: vi.fn(async () => {}),
  openAuthTabQuiet: vi.fn(async () => {}),
  selectAuthTypeQuiet: vi.fn(async () => {}),
  ensureManageModalOpen: vi.fn(async () => {}),
  ensureManageModalClosed: vi.fn(async () => {}),
  upsertWorkspaceDefaults: vi.fn(),
}));

vi.mock('./grpc-spring-boot-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-spring-boot-helpers')>('./grpc-spring-boot-helpers');
  return {
    ...actual,
    ensureStudioNav: helperSpies.ensureStudioNav,
    ensureSpringStudioReady: helperSpies.ensureSpringStudioReady,
    ensureTransportModeQuiet: helperSpies.ensureTransportModeQuiet,
    selectMethodVisible: helperSpies.selectMethodVisible,
    ensureMessageFilledQuiet: helperSpies.ensureMessageFilledQuiet,
    reflectQuiet: helperSpies.reflectQuiet,
    openAuthTabQuiet: helperSpies.openAuthTabQuiet,
    selectAuthTypeQuiet: helperSpies.selectAuthTypeQuiet,
    ensureManageModalOpen: helperSpies.ensureManageModalOpen,
    ensureManageModalClosed: helperSpies.ensureManageModalClosed,
    isTransportModeActive: vi.fn(() => true),
    bearerTokenFieldValue: vi.fn(() => ''),
    fillBearerTokenField: vi.fn(),
  };
});

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    resetGrpcConnectionSettingsQuiet: helperSpies.resetGrpcConnectionSettingsQuiet,
    setGrpcTargetQuiet: helperSpies.setGrpcTargetQuiet,
    spotlightAndPause: helperSpies.spotlightAndPause,
    spotlightElementAndPause: helperSpies.spotlightElementAndPause,
    openGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  };
});

vi.mock('../../adapters', async () => {
  const actual = await vi.importActual<typeof import('../../adapters')>('../../adapters');
  return {
    ...actual,
    upsertWorkspaceDefaults: helperSpies.upsertWorkspaceDefaults,
    getDemoBridgeWindow: () => ({
      __demoGetGrpcActiveDescriptorKey: () => 'descriptor-key',
      __demoPatchGrpcActiveTab: vi.fn(),
    }),
  };
});

function getStep(stepId: string) {
  const step = grpcSpringBootSteps.find((entry) => entry.id === stepId);
  if (!step) throw new Error(`Missing step ${stepId}`);
  return step;
}

function mountSpringBootDom() {
  const echoMethodId = 'grpc-method-echo-echoservice-echo';
  const secureEchoId = 'grpc-method-echo-echoservice-secureecho';
  document.body.innerHTML = `
    <div data-testid="grpc-connection-bar"></div>
    <span data-testid="grpc-transport-badge" class="grpc-connection-transport-badge--spring-servlet"></span>
    <input data-testid="grpc-target-input" value="localhost:9090" />
    <button data-testid="grpc-connection-settings-btn"></button>
    <div data-testid="grpc-connection-settings-drawer"></div>
    <button data-testid="grpc-settings-nav-transport"></button>
    <div data-testid="grpc-settings-panel-transport"></div>
    <button data-testid="grpc-transport-mode-express" aria-pressed="true"></button>
    <button data-testid="grpc-transport-mode-spring-servlet" aria-pressed="false"></button>
    <div data-testid="grpc-transport-mode-reason-express"></div>
    <button data-testid="grpc-settings-close"></button>
    <button data-testid="grpc-reflect-btn"></button>
    <div data-testid="grpc-explorer-tree"></div>
    <div data-testid="grpc-service-explorer"></div>
    <button data-testid="grpc-service-health-v1-health"></button>
    <button data-testid="grpc-service-grpc-health-v1-health"></button>
    <button data-testid="${echoMethodId}"></button>
    <button data-testid="${secureEchoId}" class="grpc-explorer-method-btn--selected"></button>
    <div data-testid="grpc-call-panel"></div>
    <button data-testid="grpc-send-btn"></button>
    <div data-testid="grpc-response-body"></div>
    <div data-testid="grpc-response-status">OK</div>
    <div data-testid="grpc-response-error-panel"></div>
    <div data-testid="grpc-request-json-compact"></div>
    <textarea data-testid="grpc-request-json"></textarea>
    <button data-testid="grpc-request-tab-auth" aria-pressed="false"></button>
    <select data-testid="grpc-auth-type-select"><option value="none" selected></option><option value="bearer"></option></select>
    <input data-testid="grpc-auth-bearer-token" value="" />
    <button data-testid="grpc-manage-schemas-btn"></button>
    <div data-testid="grpc-proto-manage-modal">
      <button data-testid="grpc-proto-cancel-btn"></button>
      <button data-testid="grpc-proto-tab-schema-browser"></button>
      <div data-testid="grpc-schema-browser"></div>
      <div data-testid="grpc-schema-browser-tree"></div>
      <input data-testid="grpc-schema-browser-search" />
      <div data-testid="grpc-schema-method-signature"></div>
    </div>
    <div data-testid="grpc-health-panel"></div>
    <div data-testid="grpc-health-status-serving"></div>
    <button data-testid="grpc-health-watch-btn"></button>
    <div data-testid="grpc-health-watch-stream"></div>
    <button data-testid="grpc-health-check-unary-btn"></button>
    <div data-testid="grpc-spring-hint-spring_health_actuator"></div>
    <button data-testid="grpc-spring-hint-dismiss-spring_health_actuator"></button>
    <button data-testid="grpc-settings-nav-health"></button>
    <div data-testid="grpc-settings-panel-health"></div>
  `;
}

describe('grpc-spring-boot-steps coverage gaps', () => {
  beforeEach(() => {
    mountSpringBootDom();
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  it('executes intro through execute-echo callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc15-intro').preAction?.(ctx);
    await getStep('grpc15-intro').action?.(ctx);
    await getStep('grpc15-connect-netty').preAction?.(ctx);
    await getStep('grpc15-connect-netty').action?.(ctx);
    await getStep('grpc15-execute-echo').preAction?.(ctx);
    await getStep('grpc15-execute-echo').action?.(ctx);

    expect(helperSpies.ensureStudioNav).toHaveBeenCalled();
    expect(helperSpies.ensureSpringStudioReady).toHaveBeenCalled();
    expect(helperSpies.selectMethodVisible).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.CONNECTION_SETTINGS_BTN);
  });

  it('executes servlet-reflect and bearer-auth callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc15-servlet-reflect').preAction?.(ctx);
    await getStep('grpc15-servlet-reflect').action?.(ctx);
    await getStep('grpc15-bearer-auth').preAction?.(ctx);
    await getStep('grpc15-bearer-auth').action?.(ctx);

    expect(helperSpies.ensureSpringStudioReady).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.REFLECT_BTN);
    expect(helperSpies.openAuthTabQuiet).toHaveBeenCalled();
    expect(helperSpies.selectAuthTypeQuiet).toHaveBeenCalled();
  });

  it('runs every spring-boot step preAction and action', async () => {
    const ctx = makeCtx();
    for (const step of grpcSpringBootSteps) {
      await step.preAction?.(ctx);
      await step.action?.(ctx);
    }
    expect(helperSpies.ensureSpringStudioReady).toHaveBeenCalled();
    expect(helperSpies.spotlightAndPause).toHaveBeenCalled();
  });

  it('proto-stubs action falls back to Echo search when Health node is missing', async () => {
    mountSpringBootDom();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValue(new Error('timeout'));

    await getStep('grpc15-proto-stubs').action?.(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(GRPC.SCHEMA_BROWSER_SEARCH, 'Echo');
  });
});
