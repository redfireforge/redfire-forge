/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_DEMO_TARGET,
  GRPC_ECHO_METHOD_SEL,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcTarget,
  ensureUnaryExecuted,
  grpcLessonSession,
  resetGrpcLessonSessionFlags,
} from './grpc-lesson-helpers';
import {
  __resetGrpcLessonRunForTests,
  beginGrpcLessonRun,
  setGrpcLessonRunFlag,
} from './grpc-lesson-contract/runtime';

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
}));

describe('grpc-lesson-helpers', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
    beginGrpcLessonRun('grpc-first-call');
    resetGrpcLessonSessionFlags();
    document.body.innerHTML = '';
  });

  function mountTargetUi(value = ''): void {
    document.body.innerHTML = `
      <input data-testid="grpc-target-input" value="${value}" />
    `;
    const input = document.querySelector<HTMLInputElement>('[data-testid="grpc-target-input"]')!;
    input.addEventListener('input', () => {
      const ok = document.querySelector('[data-testid="grpc-target-status-ok"]');
      if (input.value === GRPC_DEMO_TARGET && !ok) {
        const badge = document.createElement('span');
        badge.setAttribute('data-testid', 'grpc-target-status-ok');
        document.body.appendChild(badge);
      }
    });
  }

  it('ensureGrpcTarget fills target and sets session flag', async () => {
    mountTargetUi();
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, value) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await ensureGrpcTarget(ctx);
    expect(document.querySelector(GRPC.TARGET_STATUS_OK)).toBeTruthy();
    expect(grpcLessonSession.targetSet).toBe(true);
    await ensureGrpcTarget(ctx);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });

  it('ensureGrpcReflected clicks reflect when tree is missing', async () => {
    mountTargetUi(GRPC_DEMO_TARGET);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<span data-testid="grpc-target-status-ok"></span><button data-testid="grpc-reflect-btn"></button>',
    );
    setGrpcLessonRunFlag('targetSet', true);
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.REFLECT_BTN) {
        const tree = document.createElement('div');
        tree.setAttribute('data-testid', 'grpc-explorer-tree');
        document.body.appendChild(tree);
      }
    });
    await ensureGrpcReflected(ctx);
    expect(document.querySelector(GRPC.EXPLORER_TREE)).toBeTruthy();
    expect(grpcLessonSession.reflected).toBe(true);
  });

  it('ensureEchoMethodSelected expands service and selects method', async () => {
    document.body.innerHTML = `
      <span data-testid="grpc-target-status-ok"></span>
      <div data-testid="grpc-explorer-tree"></div>
      <button data-testid="grpc-service-echo-echoservice"></button>
      <button data-testid="grpc-method-echo-echoservice-echo"></button>
    `;
    setGrpcLessonRunFlag('targetSet', true);
    setGrpcLessonRunFlag('reflected', true);
    const methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL)!;
    makeVisible(methodBtn);
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC_ECHO_METHOD_SEL) {
        const form = document.createElement('div');
        form.setAttribute('data-testid', 'grpc-proto-form');
        document.body.appendChild(form);
      }
    });
    await ensureEchoMethodSelected(ctx);
    expect(document.querySelector(GRPC.PROTO_FORM)).toBeTruthy();
    expect(grpcLessonSession.methodSelected).toBe(true);
  });

  it('ensureUnaryExecuted sends and waits for response body', async () => {
    document.body.innerHTML = `
      <div data-testid="grpc-proto-form"></div>
      <input data-testid="grpc-proto-field-input-message" value="${GRPC_DEMO_MESSAGE}" />
      <button data-testid="grpc-send-btn"></button>
    `;
    setGrpcLessonRunFlag('targetSet', true);
    setGrpcLessonRunFlag('reflected', true);
    setGrpcLessonRunFlag('methodSelected', true);
    setGrpcLessonRunFlag('messageFilled', true);
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.SEND_BTN) {
        const status = document.createElement('div');
        status.setAttribute('data-testid', 'grpc-response-status');
        status.textContent = 'OK';
        const body = document.createElement('pre');
        body.setAttribute('data-testid', 'grpc-response-body');
        body.textContent = `{"message":"${GRPC_DEMO_MESSAGE}"}`;
        document.body.append(status, body);
      }
    });
    await ensureUnaryExecuted(ctx);
    expect(document.querySelector(GRPC.RESPONSE_BODY)?.textContent).toContain(GRPC_DEMO_MESSAGE);
    expect(grpcLessonSession.executed).toBe(true);
  });
});
