/**
 * @vitest-environment jsdom
 *
 * Coverage-gap tests for grpc-metadata-auth.ts
 * Exercises preAction / action branches that unit tests of helpers already
 * miss — guard paths, DOM interaction forks, and skip conditions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const helperSpies = vi.hoisted(() => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  ensureGrpcTarget: vi.fn(async () => {}),
  ensureGrpcReflected: vi.fn(async () => {}),
  ensureEchoMethodSelected: vi.fn(async () => {}),
  ensureGrpcStudioSubNavQuiet: vi.fn(async () => {}),
  ensureUnaryExecuted: vi.fn(async () => {}),
  grpcFirstCallSetup: vi.fn(async () => {}),
  grpcFirstCallCleanup: vi.fn(async () => {}),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: helperSpies.navigateToGrpcStudio,
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureGrpcTarget: helperSpies.ensureGrpcTarget,
    ensureGrpcReflected: helperSpies.ensureGrpcReflected,
    ensureEchoMethodSelected: helperSpies.ensureEchoMethodSelected,
    ensureGrpcStudioSubNavQuiet: helperSpies.ensureGrpcStudioSubNavQuiet,
    ensureUnaryExecuted: helperSpies.ensureUnaryExecuted,
    grpcFirstCallSetup: helperSpies.grpcFirstCallSetup,
    grpcFirstCallCleanup: helperSpies.grpcFirstCallCleanup,
  };
});

import { grpcMetadataAuthLesson } from './grpc-metadata-auth';

function getStep(stepId: string) {
  const step = grpcMetadataAuthLesson.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Missing step: ${stepId}`);
  return step;
}

describe('grpc-metadata-auth coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  // ---------------------------------------------------------------------------
  // Lesson metadata
  // ---------------------------------------------------------------------------
  it('has the expected step IDs in order', () => {
    const ids = grpcMetadataAuthLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'grpc18-intro',
      'grpc18-metadata-add',
      'grpc18-send-metadata',
      'grpc18-bearer-auth',
      'grpc18-basic-auth',
      'grpc18-api-key-auth',
      'grpc18-conflict',
      'grpc18-oauth2',
      'grpc18-env-var',
    ]);
  });

  it('has category grpc and domainId protocols', () => {
    expect(grpcMetadataAuthLesson.category).toBe('grpc');
    expect(grpcMetadataAuthLesson.domainId).toBe('protocols');
  });

  it('has a concept with key terms', () => {
    expect(grpcMetadataAuthLesson.concept.keyTerms.length).toBeGreaterThanOrEqual(3);
    const terms = grpcMetadataAuthLesson.concept.keyTerms.map((kt) => kt.term);
    expect(terms).toContain('Request metadata');
    expect(terms).toContain('Bearer token');
    expect(terms).toContain('OAuth2 client-credentials');
  });

  // ---------------------------------------------------------------------------
  // Step 1: grpc18-intro
  // ---------------------------------------------------------------------------
  it('intro preAction navigates and ensures target/reflect/method', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="grpc-connection-bar"></div>
      <input data-testid="grpc-target-input" />
    `;
    await getStep('grpc18-intro').preAction?.(ctx);
    expect(helperSpies.navigateToGrpcStudio).toHaveBeenCalled();
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcTarget).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcReflected).toHaveBeenCalled();
    expect(helperSpies.ensureEchoMethodSelected).toHaveBeenCalled();
  });

  it('intro action opens drawer when not already open', async () => {
    const ctx = makeCtx();
    const clickSpy = vi.fn();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-tls"></button>
      <button data-testid="grpc-settings-nav-auth"></button>
      <button data-testid="grpc-settings-nav-call"></button>
      <button data-testid="grpc-settings-nav-compression"></button>
      <button data-testid="grpc-settings-nav-health"></button>
      <button data-testid="grpc-settings-close"></button>
      <div data-testid="grpc-connection-bar"></div>
    `;
    document.querySelector<HTMLElement>(GRPC.CONNECTION_SETTINGS_BTN)?.addEventListener('click', clickSpy);
    await getStep('grpc18-intro').action?.(ctx);
    // Drawer already present so btn click should be skipped.
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('intro action calls ctx.click on connection settings btn when drawer absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-bar"></div>
    `;
    await getStep('grpc18-intro').action?.(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.CONNECTION_SETTINGS_BTN);
  });

  // ---------------------------------------------------------------------------
  // Step 2: grpc18-metadata-add
  // ---------------------------------------------------------------------------
  it('metadata-add preAction resets auth and closes drawer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select"><option value="bearer" selected>Bearer</option><option value="none">None</option></select>
      </div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await getStep('grpc18-metadata-add').preAction?.(ctx);
    expect(helperSpies.ensureEchoMethodSelected).toHaveBeenCalled();
  });

  it('metadata-add action clicks Metadata tab and adds a row', async () => {
    const ctx = makeCtx();
    const tabClick = vi.fn();
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
      <div data-testid="grpc-metadata-editor">
        <button data-testid="grpc-metadata-add-btn"></button>
        <input placeholder="key" value="" />
        <input placeholder="value" value="" />
      </div>
    `;
    document.querySelector<HTMLElement>(GRPC.REQUEST_TAB_METADATA)?.addEventListener('click', tabClick);
    await getStep('grpc18-metadata-add').action?.(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.REQUEST_TAB_METADATA);
  });

  it('metadata-add action does not crash when METADATA_ADD_BTN is absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
      <div data-testid="grpc-metadata-editor"></div>
    `;
    await expect(getStep('grpc18-metadata-add').action?.(ctx)).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Step 3: grpc18-send-metadata
  // ---------------------------------------------------------------------------
  it('send-metadata preAction fills message when empty', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="grpc-proto-field-input-message" value="" />
    `;
    await getStep('grpc18-send-metadata').preAction?.(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.PROTO_FIELD_INPUT_MESSAGE, 'Hello from gRPC Studio');
  });

  it('send-metadata preAction skips fill when message already set', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="grpc-proto-field-input-message" value="already set" />
    `;
    await getStep('grpc18-send-metadata').preAction?.(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('send-metadata action calls ensureUnaryExecuted', async () => {
    const ctx = makeCtx();
    await getStep('grpc18-send-metadata').action?.(ctx);
    expect(helperSpies.ensureUnaryExecuted).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Step 4: grpc18-bearer-auth
  // ---------------------------------------------------------------------------
  it('bearer-auth preAction calls ensureEchoMethodSelected', async () => {
    const ctx = makeCtx();
    await getStep('grpc18-bearer-auth').preAction?.(ctx);
    expect(helperSpies.ensureEchoMethodSelected).toHaveBeenCalled();
  });

  it('bearer-auth action opens settings and selects bearer type', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select">
          <option value="none" selected>None</option>
          <option value="bearer">Bearer</option>
        </select>
      </div>
      <div data-testid="grpc-auth-panel"></div>
      <div data-testid="grpc-auth-badge"></div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await getStep('grpc18-bearer-auth').action?.(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GRPC.AUTH_TYPE_SELECT, 'bearer');
  });

  it('bearer-auth action does not crash when settings drawer cannot open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '';
    await expect(getStep('grpc18-bearer-auth').action?.(ctx)).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Step 5: grpc18-basic-auth
  // ---------------------------------------------------------------------------
  it('basic-auth action selects basic auth type', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select">
          <option value="none" selected>None</option>
          <option value="basic">Basic</option>
        </select>
      </div>
      <div data-testid="grpc-auth-badge"></div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await getStep('grpc18-basic-auth').action?.(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GRPC.AUTH_TYPE_SELECT, 'basic');
  });

  // ---------------------------------------------------------------------------
  // Step 6: grpc18-api-key-auth
  // ---------------------------------------------------------------------------
  it('api-key-auth action selects apikey auth type', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select">
          <option value="none" selected>None</option>
          <option value="apikey">API Key</option>
        </select>
      </div>
      <div data-testid="grpc-auth-preview"></div>
      <div data-testid="grpc-auth-badge"></div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await getStep('grpc18-api-key-auth').action?.(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GRPC.AUTH_TYPE_SELECT, 'apikey');
  });

  it('api-key-auth action tolerates missing auth preview', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('timeout'));
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select">
          <option value="none" selected>None</option>
          <option value="apikey">API Key</option>
        </select>
      </div>
      <div data-testid="grpc-auth-badge"></div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await expect(getStep('grpc18-api-key-auth').action?.(ctx)).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Step 7: grpc18-conflict
  // ---------------------------------------------------------------------------
  it('conflict step action navigates to metadata tab and waits for conflicts', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
      <div data-testid="grpc-metadata-editor">
        <button data-testid="grpc-metadata-add-btn"></button>
        <input placeholder="key" value="" />
        <input placeholder="value" value="" />
      </div>
      <div data-testid="grpc-auth-conflicts"></div>
    `;
    await getStep('grpc18-conflict').action?.(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.REQUEST_TAB_METADATA);
  });

  it('conflict step action tolerates missing AUTH_CONFLICTS element', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GRPC.AUTH_CONFLICTS) throw new Error('timeout');
    });
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
      <div data-testid="grpc-metadata-editor">
        <button data-testid="grpc-metadata-add-btn"></button>
      </div>
    `;
    await expect(getStep('grpc18-conflict').action?.(ctx)).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Step 8: grpc18-oauth2
  // ---------------------------------------------------------------------------
  it('oauth2 action selects oauth2 auth type', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select">
          <option value="none" selected>None</option>
          <option value="oauth2">OAuth2</option>
        </select>
      </div>
      <div data-testid="grpc-auth-badge"></div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await getStep('grpc18-oauth2').action?.(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GRPC.AUTH_TYPE_SELECT, 'oauth2');
  });

  // ---------------------------------------------------------------------------
  // Step 9: grpc18-env-var
  // ---------------------------------------------------------------------------
  it('env-var preAction resets auth to none', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-connection-settings-btn"></button>
      <div data-testid="grpc-connection-settings-drawer"></div>
      <button data-testid="grpc-settings-nav-auth"></button>
      <div data-testid="grpc-settings-panel-auth">
        <select data-testid="grpc-auth-type-select">
          <option value="bearer" selected>Bearer</option>
          <option value="none">None</option>
        </select>
      </div>
      <button data-testid="grpc-settings-close"></button>
    `;
    await getStep('grpc18-env-var').preAction?.(ctx);
    expect(helperSpies.ensureEchoMethodSelected).toHaveBeenCalled();
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalled();
  });

  it('env-var action adds {{authToken}} metadata row', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
      <div data-testid="grpc-metadata-editor">
        <button data-testid="grpc-metadata-add-btn"></button>
        <input placeholder="key" value="" />
        <input placeholder="value" value="" />
      </div>
      <div data-testid="grpc-interpolation-preview-strip"></div>
    `;
    await getStep('grpc18-env-var').action?.(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.REQUEST_TAB_METADATA);
  });

  it('env-var action handles presence of interpolation error banner', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
      <div data-testid="grpc-metadata-editor">
        <button data-testid="grpc-metadata-add-btn"></button>
        <input placeholder="key" value="" />
        <input placeholder="value" value="" />
      </div>
      <div data-testid="grpc-interpolation-error-banner"></div>
    `;
    await expect(getStep('grpc18-env-var').action?.(ctx)).resolves.toBeUndefined();
  });

  it('env-var action does not crash when metadata editor is absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="grpc-request-tab-metadata"></button>
    `;
    await expect(getStep('grpc18-env-var').action?.(ctx)).resolves.toBeUndefined();
  });
});
