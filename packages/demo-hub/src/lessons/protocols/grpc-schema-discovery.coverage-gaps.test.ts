/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const helperSpies = vi.hoisted(() => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
  clearGrpcSchemaDriftQuiet: vi.fn(async () => {}),
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  ensureEchoMethodSelected: vi.fn(async () => {}),
  ensureGrpcReflected: vi.fn(async () => {}),
  ensureGrpcStudioSubNavQuiet: vi.fn(async () => {}),
  ensureGrpcTarget: vi.fn(async () => {}),
  guardGrpcReflectedQuiet: vi.fn(async () => {}),
  guardGrpcTargetQuiet: vi.fn(async () => {}),
  openFreshGrpcTabQuietWithOptions: vi.fn(async () => {}),
  rebindGrpcMethodQuiet: vi.fn(async () => {}),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: helperSpies.navigateToGrpcStudio,
}));

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    clearGrpcSchemaDriftQuiet: helperSpies.clearGrpcSchemaDriftQuiet,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    ensureEchoMethodSelected: helperSpies.ensureEchoMethodSelected,
    ensureGrpcReflected: helperSpies.ensureGrpcReflected,
    ensureGrpcStudioSubNavQuiet: helperSpies.ensureGrpcStudioSubNavQuiet,
    ensureGrpcTarget: helperSpies.ensureGrpcTarget,
    guardGrpcReflectedQuiet: helperSpies.guardGrpcReflectedQuiet,
    guardGrpcTargetQuiet: helperSpies.guardGrpcTargetQuiet,
    openFreshGrpcTabQuietWithOptions: helperSpies.openFreshGrpcTabQuietWithOptions,
    rebindGrpcMethodQuiet: helperSpies.rebindGrpcMethodQuiet,
  };
});

import { grpcSchemaDiscoveryLesson } from './grpc-schema-discovery';

class FakeDataTransfer {
  items = {
    add: vi.fn(),
  };

  files: File[] = [];
}

class FakeDragEvent extends Event {
  dataTransfer?: FakeDataTransfer;

  constructor(type: string, init?: EventInit & { dataTransfer?: FakeDataTransfer }) {
    super(type, init);
    this.dataTransfer = init?.dataTransfer;
  }
}

function getStep(stepId: string) {
  const step = grpcSchemaDiscoveryLesson.steps.find((entry) => entry.id === stepId);
  if (!step) throw new Error(`Missing step ${stepId}`);
  return step;
}

function mountManageModalDom() {
  document.body.innerHTML = `
    <button data-testid="grpc-manage-schemas-btn"></button>
    <div data-testid="grpc-proto-manage-modal">
      <button data-testid="grpc-proto-cancel-btn"></button>
      <button data-testid="grpc-proto-tab-proto-files"></button>
      <button data-testid="grpc-proto-tab-protoset"></button>
      <button data-testid="grpc-proto-tab-url"></button>
      <button data-testid="grpc-proto-tab-bsr"></button>
      <button data-testid="grpc-proto-tab-schema-browser"></button>
      <div data-testid="grpc-proto-root-manager"></div>
      <div data-testid="grpc-proto-root-list">
        <button data-testid="grpc-proto-root-item-shared"><span>shared</span></button>
      </div>
      <div data-testid="grpc-proto-canonical-preview"></div>
      <div data-testid="grpc-proto-selected-root"></div>
      <div data-testid="grpc-proto-upload-zone"></div>
      <div data-testid="grpc-proto-file-list"></div>
      <button data-testid="grpc-proto-load-btn"></button>
      <div data-testid="grpc-proto-protoset-zone"></div>
      <div data-testid="grpc-proto-protoset-name"></div>
      <input type="file" accept=".proto" />
      <input type="file" accept=".pb,.protoset" />
      <input data-testid="grpc-proto-url-input" />
      <input data-testid="grpc-proto-bsr-module-input" />
      <input data-testid="grpc-proto-bsr-version-input" />
      <div data-testid="grpc-schema-browser"></div>
      <div data-testid="grpc-schema-browser-tree"></div>
      <div data-testid="grpc-schema-browser-detail"></div>
      <div data-testid="grpc-schema-method-signature"></div>
      <input data-testid="grpc-schema-browser-search" />
      <button data-testid="grpc-schema-copy-grpcurl-btn"></button>
      <button data-testid="grpc-schema-open-tab-btn"></button>
      <div data-testid="grpc-method-api-apiservice-lookup"></div>
      <div data-testid="grpc-method-echo-echoservice-echo"></div>
    </div>
    <div data-testid="grpc-explorer-tree"></div>
    <div data-testid="grpc-explorer-footer"></div>
    <div data-testid="grpc-explorer-source">protoset</div>
    <input data-testid="grpc-explorer-search" />
    <div data-testid="grpc-service-explorer"></div>
    <div data-testid="grpc-call-panel"></div>
    <div data-testid="grpc-proto-form"></div>
    <button data-testid="grpc-request-tab-form" aria-pressed="true"></button>
    <textarea data-testid="grpc-request-json"></textarea>
    <button data-testid="grpc-send-btn"></button>
    <div data-testid="grpc-response-body"></div>
    <div data-testid="grpc-target-status-ok"></div>
    <button data-testid="grpc-reflect-btn"></button>
  `;
}

describe('grpc-schema-discovery coverage gaps', () => {
  beforeEach(() => {
    Object.assign(globalThis, { DataTransfer: FakeDataTransfer });
    Object.assign(globalThis, { DragEvent: FakeDragEvent });
    mountManageModalDom();
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
  });

  it('executes intro through source callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc16-intro').preAction?.(ctx);
    await getStep('grpc16-target').preAction?.(ctx);
    await getStep('grpc16-target').action?.(ctx);
    await getStep('grpc16-reflect').preAction?.(ctx);
    await getStep('grpc16-reflect').action?.(ctx);
    await getStep('grpc16-source').preAction?.(ctx);
    await getStep('grpc16-source').action?.(ctx);

    expect(helperSpies.navigateToGrpcStudio).toHaveBeenCalledTimes(2);
    expect(helperSpies.closeGrpcSettingsDrawerQuiet).toHaveBeenCalledTimes(2);
    expect(helperSpies.ensureGrpcStudioSubNavQuiet).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcTarget).toHaveBeenCalledTimes(1);
    expect(helperSpies.guardGrpcTargetQuiet).toHaveBeenCalled();
    expect(helperSpies.clearGrpcSchemaDriftQuiet).toHaveBeenCalled();
    expect(helperSpies.guardGrpcReflectedQuiet).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcReflected).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.EXPLORER_SEARCH, 'Echo');
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.EXPLORER_SEARCH, '');
  });

  it('executes manage-open, proto-roots, and tabs callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc16-manage-open').preAction?.(ctx);
    await getStep('grpc16-manage-open').action?.(ctx);
    await getStep('grpc16-proto-roots').preAction?.(ctx);
    await getStep('grpc16-proto-roots').action?.(ctx);
    await getStep('grpc16-tabs').preAction?.(ctx);
    await getStep('grpc16-tabs').action?.(ctx);

    expect(helperSpies.guardGrpcReflectedQuiet).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_PROTOSET);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_URL);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_BSR);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_PROTO_FILES);
  });

  it('opens the manage modal when it is initially absent', async () => {
    const ctx = makeCtx();
    document.querySelector(GRPC.PROTO_MANAGE_MODAL)?.remove();

    await getStep('grpc16-manage-open').action?.(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.MANAGE_SCHEMAS_BTN, 10_000);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.MANAGE_SCHEMAS_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.PROTO_MANAGE_MODAL, 10_000);
  });

  it('closes the manage modal via ctx.click when cancel control is missing', async () => {
    const ctx = makeCtx();
    document.querySelector(GRPC.PROTO_CANCEL_BTN)?.remove();

    await getStep('grpc16-intro').preAction?.(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_CANCEL_BTN);
  });

  it('executes proto-files, select-root, and proto-load callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc16-proto-files').preAction?.(ctx);
    await getStep('grpc16-proto-files').action?.(ctx);
    await getStep('grpc16-select-root').preAction?.(ctx);
    await getStep('grpc16-select-root').action?.(ctx);

    const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN)!;
    loadBtn.disabled = true;
    await getStep('grpc16-proto-load').preAction?.(ctx);
    await getStep('grpc16-proto-load').action?.(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.PROTO_UPLOAD_ZONE, 10_000);
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.PROTO_CANONICAL_PREVIEW, 10_000);
    expect(document.querySelector(GRPC.PROTO_FILE_LIST)).not.toBeNull();
  });

  it('executes proto-files root creation branch when shared root is missing', async () => {
    const ctx = makeCtx();
    document.querySelector('[data-testid="grpc-proto-root-item-shared"]')?.remove();
    const addInput = document.createElement('input');
    addInput.setAttribute('data-testid', 'grpc-proto-root-add-input');
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'grpc-proto-root-add-btn');
    const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL)!;
    modal.appendChild(addInput);
    modal.appendChild(addBtn);

    await getStep('grpc16-proto-files').action?.(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.PROTO_UPLOAD_ZONE, 10_000);
  });

  it('executes schema-browser, copy-grpcurl, and open-method callbacks', async () => {
    const ctx = makeCtx();

    await getStep('grpc16-schema-browser').preAction?.(ctx);
    await getStep('grpc16-schema-browser').action?.(ctx);
    await getStep('grpc16-copy-grpcurl').preAction?.(ctx);
    await getStep('grpc16-copy-grpcurl').action?.(ctx);
    await getStep('grpc16-open-method').preAction?.(ctx);
    await getStep('grpc16-open-method').action?.(ctx);

    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_SCHEMA_BROWSER);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.SCHEMA_BROWSER_SEARCH, 'Lookup');
    expect(ctx.click).toHaveBeenCalledWith(GRPC.SEND_BTN);
    const jsonEditor = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON);
    expect(jsonEditor?.value).toBe('{"ref":{"id":"A-100"}}');
  });

  it('executes protoset, url, bsr, and drift callbacks', async () => {
    const ctx = makeCtx();
    const source = document.querySelector<HTMLElement>(GRPC.EXPLORER_SOURCE)!;
    source.textContent = 'protoset';

    await getStep('grpc16-protoset').preAction?.(ctx);
    await getStep('grpc16-protoset').action?.(ctx);

    source.textContent = 'reflection';
    await getStep('grpc16-url').preAction?.(ctx);
    await getStep('grpc16-url').action?.(ctx);

    source.textContent = 'bsr';
    await getStep('grpc16-bsr').preAction?.(ctx);
    await getStep('grpc16-bsr').action?.(ctx);

    await getStep('grpc16-drift').preAction?.(ctx);
    await getStep('grpc16-drift').action?.(ctx);

    expect(helperSpies.openFreshGrpcTabQuietWithOptions).toHaveBeenCalled();
    expect(helperSpies.rebindGrpcMethodQuiet).toHaveBeenCalledWith(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_PROTOSET);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_URL);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.PROTO_TAB_BSR);
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.PROTO_URL_INPUT, 'http://localhost:5173/grpc-samples/url/echo.proto');
    expect(ctx.fill).toHaveBeenCalledWith(GRPC.PROTO_BSR_MODULE_INPUT, 'buf.build/connectrpc/eliza');
    expect(ctx.waitFor).toHaveBeenCalledWith(GRPC.SERVICE_EXPLORER, 6_000);
  });

  it('returns early from protoset load when manage schema load reports an error', async () => {
    const ctx = makeCtx();
    const loadError = document.createElement('div');
    loadError.setAttribute('data-testid', 'grpc-proto-load-error');
    loadError.textContent = 'bad protoset';
    document.body.appendChild(loadError);
    const source = document.querySelector<HTMLElement>(GRPC.EXPLORER_SOURCE)!;
    source.textContent = 'reflection';

    await expect(getStep('grpc16-protoset').action?.(ctx)).resolves.toBeUndefined();
  });
});
