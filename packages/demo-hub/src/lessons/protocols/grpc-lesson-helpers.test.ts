/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';
import {
  clearGrpcSchemaDriftQuiet,
  closeExtraGrpcTabsQuiet,
  GRPC_DEMO_MESSAGE,
  GRPC_DEMO_TARGET,
  GRPC_ECHO_METHOD_SEL,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcTarget,
  ensureUnaryExecuted,
  grpcLessonSession,
  highlightAndClickStreamControl,
  openFirstGrpcHistoryEntry,
  rebindGrpcMethodQuiet,
  resetGrpcLessonSessionFlags,
  runClientStreamSendLifecycle,
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

  it('ensureGrpcReflected clears leftover TLS before Reflect', async () => {
    mountTargetUi(GRPC_DEMO_TARGET);
    document.body.insertAdjacentHTML(
      'beforeend',
      `
        <span data-testid="grpc-target-status-ok"></span>
        <button data-testid="grpc-tls-badge" aria-label="TLS mode: TLS — configure">TLS</button>
        <button data-testid="grpc-reflect-btn"></button>
      `,
    );
    setGrpcLessonRunFlag('targetSet', true);
    const resetSpy = vi.fn(() => {
      const badge = document.querySelector('[data-testid="grpc-tls-badge"]');
      if (badge) {
        badge.setAttribute('aria-label', 'TLS mode: Plaintext — configure');
        badge.textContent = 'Plaintext';
      }
      return true;
    });
    (window as unknown as Record<string, unknown>).__demoResetGrpcActiveTab = resetSpy;

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.REFLECT_BTN) {
        const tree = document.createElement('div');
        tree.setAttribute('data-testid', 'grpc-explorer-tree');
        document.body.appendChild(tree);
      }
    });
    await ensureGrpcReflected(ctx);
    expect(resetSpy).toHaveBeenCalled();
    expect(document.querySelector(GRPC.EXPLORER_TREE)).toBeTruthy();
    delete (window as unknown as Record<string, unknown>).__demoResetGrpcActiveTab;
  });

  it('ensureGrpcReflected waits for demo bridge before Reflect on plaintext target', async () => {
    mountTargetUi(GRPC_DEMO_TARGET);
    document.body.insertAdjacentHTML(
      'beforeend',
      `
        <span data-testid="grpc-target-status-ok"></span>
        <button data-testid="grpc-tls-badge" aria-label="TLS mode: Plaintext — configure">Plaintext</button>
        <button data-testid="grpc-reflect-btn"></button>
      `,
    );
    setGrpcLessonRunFlag('targetSet', true);
    const resetSpy = vi.fn(() => true);
    // Bridge appears after a few poll ticks (simulates Studio useEffect mount).
    let attempts = 0;
    const ctx = makeCtx();
    vi.mocked(ctx.delay).mockImplementation(async () => {
      attempts += 1;
      if (attempts >= 2) {
        (window as unknown as Record<string, unknown>).__demoResetGrpcActiveTab = resetSpy;
      }
    });
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.REFLECT_BTN) {
        const tree = document.createElement('div');
        tree.setAttribute('data-testid', 'grpc-explorer-tree');
        document.body.appendChild(tree);
      }
    });
    await ensureGrpcReflected(ctx);
    expect(resetSpy).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GRPC.REFLECT_BTN);
    delete (window as unknown as Record<string, unknown>).__demoResetGrpcActiveTab;
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

  it('openFirstGrpcHistoryEntry opens history and selects the first row', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-history" aria-selected="false"></button>
      <div data-testid="grpc-response-status">OK</div>
      <pre data-testid="grpc-response-body">{"message":"${GRPC_DEMO_MESSAGE}"}</pre>
    `;
    setGrpcLessonRunFlag('targetSet', true);
    setGrpcLessonRunFlag('reflected', true);
    setGrpcLessonRunFlag('methodSelected', true);
    setGrpcLessonRunFlag('messageFilled', true);
    setGrpcLessonRunFlag('executed', true);

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.SUB_NAV_HISTORY) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `
            <div data-testid="grpc-history-panel">
              <div data-testid="grpc-history-list">
                <button data-testid="grpc-history-entry-demo-1"></button>
              </div>
              <div data-testid="grpc-history-detail"></div>
            </div>
          `,
        );
      }
      if (sel === GRPC.HISTORY_ENTRY_ROW) {
        const replay = document.createElement('button');
        replay.setAttribute('data-testid', 'grpc-history-replay-btn');
        document.body.append(replay);
      }
    });

    await openFirstGrpcHistoryEntry(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.SUB_NAV_HISTORY);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.HISTORY_ENTRY_ROW);
    expect(document.querySelector(GRPC.HISTORY_REPLAY_BTN)).toBeTruthy();
  });

  it('clearGrpcSchemaDriftQuiet does not bounce to Studio when Advanced is active and no banner', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="false"></button>
      <button data-testid="grpc-sub-nav-advanced" aria-selected="true"></button>
    `;
    const studioBtn = document.querySelector<HTMLButtonElement>('[data-testid="grpc-sub-nav-studio"]')!;
    const clickSpy = vi.spyOn(studioBtn, 'click');
    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('clearGrpcSchemaDriftQuiet clicks prune and dismiss for warning drift', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <div data-testid="grpc-schema-drift-banner">
        <button data-testid="grpc-schema-drift-prune-btn">Prune</button>
        <button data-testid="grpc-schema-drift-dismiss-btn">Dismiss</button>
      </div>
    `;

    document.querySelector('[data-testid="grpc-schema-drift-prune-btn"]')
      ?.addEventListener('click', () => {
        document.querySelector('[data-testid="grpc-schema-drift-prune-btn"]')?.remove();
      });
    document.querySelector('[data-testid="grpc-schema-drift-dismiss-btn"]')
      ?.addEventListener('click', () => {
        document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
      });

    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);
    expect(document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)).toBeNull();
  });

  it('clearGrpcSchemaDriftQuiet falls back to rebind on blocking drift', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <div data-testid="grpc-schema-drift-banner">
        <button data-testid="grpc-schema-drift-rebind-echo-EchoService-BidiStream">Rebind</button>
      </div>
    `;

    document.querySelector('[data-testid="grpc-schema-drift-rebind-echo-EchoService-BidiStream"]')
      ?.addEventListener('click', () => {
        document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
      });

    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);
    expect(document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)).toBeNull();
  });

  it('clearGrpcSchemaDriftQuiet falls back to echo method selection when rebind is absent', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-method-echo-echoservice-echo">Echo</button>
      <div data-testid="grpc-schema-drift-banner"></div>
    `;

    document.querySelector('[data-testid="grpc-method-echo-echoservice-echo"]')
      ?.addEventListener('click', () => {
        document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
      });

    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);
    expect(document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)).toBeNull();
  });

  it('clearGrpcSchemaDriftQuiet falls back to first available method when echo is unavailable', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-method-connectrpc-eliza-v1-elizaservice-say">Say</button>
      <div data-testid="grpc-schema-drift-banner"></div>
    `;

    document.querySelector('[data-testid="grpc-method-connectrpc-eliza-v1-elizaservice-say"]')
      ?.addEventListener('click', () => {
        document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
      });

    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);
    expect(document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)).toBeNull();
  });

  it('clearGrpcSchemaDriftQuiet expands a collapsed service to find a rebind target', async () => {
    // Blocking drift (e.g. Eliza via BSR) with no rebind/dismiss/prune button and
    // no method button, because the service node starts collapsed.
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button class="grpc-explorer-service-btn" data-testid="grpc-service-connectrpc-eliza-v1-elizaservice">ElizaService</button>
      <div data-testid="grpc-schema-drift-banner"></div>
    `;

    const serviceBtn = document.querySelector<HTMLButtonElement>(
      '[data-testid="grpc-service-connectrpc-eliza-v1-elizaservice"]',
    )!;
    // Expanding the service renders its method buttons (simulate React re-render).
    serviceBtn.addEventListener('click', () => {
      serviceBtn.classList.add('grpc-explorer-service-btn--open');
      if (!document.querySelector('[data-testid="grpc-method-connectrpc-eliza-v1-elizaservice-converse"]')) {
        const methodBtn = document.createElement('button');
        methodBtn.setAttribute('data-testid', 'grpc-method-connectrpc-eliza-v1-elizaservice-converse');
        methodBtn.addEventListener('click', () => {
          document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
        });
        document.body.appendChild(methodBtn);
      }
    });

    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);

    expect(serviceBtn.classList.contains('grpc-explorer-service-btn--open')).toBe(true);
    expect(document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)).toBeNull();
  });

  it('clearGrpcSchemaDriftQuiet handles banner re-render after first dismiss', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-method-echo-echoservice-echo">Echo</button>
      <div data-testid="grpc-schema-drift-banner">
        <button data-testid="grpc-schema-drift-dismiss-btn">Dismiss</button>
      </div>
    `;

    let dismissClicks = 0;
    document.querySelector('[data-testid="grpc-schema-drift-dismiss-btn"]')
      ?.addEventListener('click', () => {
        dismissClicks += 1;
        document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
        if (dismissClicks === 1) {
          const banner = document.createElement('div');
          banner.setAttribute('data-testid', 'grpc-schema-drift-banner');
          document.body.appendChild(banner);
        }
      });

    document.querySelector('[data-testid="grpc-method-echo-echoservice-echo"]')
      ?.addEventListener('click', () => {
        document.querySelector('[data-testid="grpc-schema-drift-banner"]')?.remove();
      });

    const ctx = makeCtx();
    await clearGrpcSchemaDriftQuiet(ctx);
    expect(document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)).toBeNull();
    expect(dismissClicks).toBeGreaterThanOrEqual(1);
  });

  it('rebindGrpcMethodQuiet selects first available method when echo is unavailable', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <button data-testid="grpc-method-connectrpc-eliza-v1-elizaservice-say">Say</button>
    `;

    const sayBtn = document.querySelector('[data-testid="grpc-method-connectrpc-eliza-v1-elizaservice-say"]') as HTMLButtonElement;
    const clickSpy = vi.spyOn(sayBtn, 'click');

    const ctx = makeCtx();
    await rebindGrpcMethodQuiet(ctx);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('closeExtraGrpcTabsQuiet preserves active tab and closes others', async () => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-studio" aria-selected="true"></button>
      <div data-testid="grpc-tab-bar">
        <div role="tab" data-testid="grpc-tab-1" aria-selected="false">
          <button data-testid="grpc-tab-close-grpc-tab-1"></button>
        </div>
        <div role="tab" data-testid="grpc-tab-2" aria-selected="false">
          <button data-testid="grpc-tab-close-grpc-tab-2"></button>
        </div>
        <div role="tab" data-testid="grpc-tab-3" aria-selected="true">
          <button data-testid="grpc-tab-close-grpc-tab-3"></button>
        </div>
      </div>
    `;

    const closed: string[] = [];
    document.querySelectorAll<HTMLButtonElement>('[data-testid^="grpc-tab-close-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closed.push(btn.getAttribute('data-testid') ?? '');
        btn.closest('[role="tab"]')?.remove();
      });
    });

    const ctx = makeCtx();
    await closeExtraGrpcTabsQuiet(ctx);

    expect(closed).toContain('grpc-tab-close-grpc-tab-1');
    expect(closed).toContain('grpc-tab-close-grpc-tab-2');
    expect(closed).not.toContain('grpc-tab-close-grpc-tab-3');
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(document.querySelector('[role="tab"]')?.getAttribute('data-testid')).toBe('grpc-tab-3');
  });

  describe('client-stream sequential highlight', () => {
    it('highlightAndClickStreamControl rings the control, clicks it, then removes the ring', async () => {
      document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button>';
      const ctx = makeCtx();
      let ringVisibleAtClick = false;
      vi.mocked(ctx.click).mockImplementation(async () => {
        ringVisibleAtClick = document.querySelectorAll('.demo-spotlight-ring').length === 1;
      });

      const clicked = await highlightAndClickStreamControl(ctx, GRPC.STREAM_START_BTN, {
        holdMs: 5,
        afterClickMs: 7,
      });

      expect(clicked).toBe(true);
      expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
      // The ring is present at click time (viewer sees it) and gone afterwards.
      expect(ringVisibleAtClick).toBe(true);
      expect(document.querySelectorAll('.demo-spotlight-ring')).toHaveLength(0);
      expect(ctx.delay).toHaveBeenCalledWith(5);
      expect(ctx.delay).toHaveBeenCalledWith(7);
    });

    it('highlightAndClickStreamControl skips a disabled control without clicking', async () => {
      document.body.innerHTML = '<button data-testid="grpc-stream-send-all-btn" disabled></button>';
      const ctx = makeCtx();

      const clicked = await highlightAndClickStreamControl(ctx, GRPC.STREAM_SEND_ALL_BTN);

      expect(clicked).toBe(false);
      expect(ctx.click).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.demo-spotlight-ring')).toHaveLength(0);
    });

    it('highlightAndClickStreamControl returns false when the control is missing', async () => {
      const ctx = makeCtx();

      const clicked = await highlightAndClickStreamControl(ctx, GRPC.STREAM_PENDING_END_BTN);

      expect(clicked).toBe(false);
      expect(ctx.click).not.toHaveBeenCalled();
    });

    it('runClientStreamSendLifecycle walks start → send all → end in order', async () => {
      document.body.innerHTML = `
        <button data-testid="grpc-stream-start-btn"></button>
        <button data-testid="grpc-stream-send-all-btn"></button>
        <button data-testid="grpc-stream-pending-end-btn"></button>
      `;
      const ctx = makeCtx();
      const clickOrder: string[] = [];
      vi.mocked(ctx.click).mockImplementation(async (sel) => { clickOrder.push(sel); });

      await runClientStreamSendLifecycle(ctx);

      expect(clickOrder).toEqual([
        GRPC.STREAM_START_BTN,
        GRPC.STREAM_SEND_ALL_BTN,
        GRPC.STREAM_PENDING_END_BTN,
      ]);
      // No leaked rings once the lifecycle completes.
      expect(document.querySelectorAll('.demo-spotlight-ring')).toHaveLength(0);
    });

    it('runClientStreamSendLifecycle tolerates a stream that only exposes Start', async () => {
      document.body.innerHTML = '<button data-testid="grpc-stream-start-btn"></button>';
      const ctx = makeCtx();
      vi.mocked(ctx.waitFor).mockRejectedValue(new Error('control missing'));
      const clickOrder: string[] = [];
      vi.mocked(ctx.click).mockImplementation(async (sel) => { clickOrder.push(sel); });

      await expect(runClientStreamSendLifecycle(ctx)).resolves.toBeUndefined();

      expect(clickOrder).toEqual([GRPC.STREAM_START_BTN]);
    });
  });
});
