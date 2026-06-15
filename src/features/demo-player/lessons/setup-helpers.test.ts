/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startMockServer,
  stopMockServer,
  switchToClientMode,
  disconnectWebSocket,
  clearEvents,
  resetAuth,
  wsSetup,
  wsCleanup,
  wsAuthCleanup,
  closeExtraConnectionTabs,
  fillControlledInput,
  connectToMockServer,
} from './setup-helpers';
import type { DemoActionContext } from '../types';

function makeCtx(): DemoActionContext {
  return {
    navigateToTab: vi.fn(),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    delay: vi.fn().mockResolvedValue(undefined),
  };
}

describe('setup-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('startMockServer', () => {
    it('clicks mock mode and start button when enabled', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'mock-start-btn');
      document.body.appendChild(btn);
      const clickSpy = vi.spyOn(btn, 'click');

      const ctx = makeCtx();
      await startMockServer(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalledWith(1000);
    });

    it('does not click disabled start button', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'mock-start-btn');
      btn.disabled = true;
      document.body.appendChild(btn);
      const clickSpy = vi.spyOn(btn, 'click');

      const ctx = makeCtx();
      await startMockServer(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('handles missing start button', async () => {
      const ctx = makeCtx();
      await startMockServer(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalledWith(400);
    });
  });

  describe('stopMockServer', () => {
    it('clicks mock mode and stop button', async () => {
      const ctx = makeCtx();
      await stopMockServer(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });

    it('clicks stop button when found and enabled', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'mock-stop-btn');
      const clickSpy = vi.spyOn(btn, 'click');
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await stopMockServer(ctx);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not click disabled stop button', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'mock-stop-btn');
      btn.disabled = true;
      const clickSpy = vi.spyOn(btn, 'click');
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await stopMockServer(ctx);
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('switchToClientMode', () => {
    it('clicks client mode button', async () => {
      const ctx = makeCtx();
      await switchToClientMode(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });
  });

  describe('disconnectWebSocket', () => {
    it('does nothing when no disconnect button', async () => {
      const ctx = makeCtx();
      await disconnectWebSocket(ctx);
      // Should not throw
    });

    it('clicks disconnect button when found and enabled', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'disconnect-btn');
      const clickSpy = vi.spyOn(btn, 'click');
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await disconnectWebSocket(ctx);
      expect(clickSpy).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });

    it('does not click disabled disconnect button', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'disconnect-btn');
      btn.disabled = true;
      const clickSpy = vi.spyOn(btn, 'click');
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await disconnectWebSocket(ctx);
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('clearEvents', () => {
    it('does nothing when no clear button', async () => {
      const ctx = makeCtx();
      await clearEvents(ctx);
      // Should not throw
    });

    it('clicks clear button when found and enabled', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'clear-btn');
      const clickSpy = vi.spyOn(btn, 'click');
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await clearEvents(ctx);
      expect(clickSpy).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });

    it('does not click disabled clear button', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'clear-btn');
      btn.disabled = true;
      const clickSpy = vi.spyOn(btn, 'click');
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await clearEvents(ctx);
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('resetAuth', () => {
    it('clicks auth tab and selects none', async () => {
      const ctx = makeCtx();
      await resetAuth(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.selectOption).toHaveBeenCalled();
    });
  });

  describe('wsSetup', () => {
    it('calls startMockServer then switchToClientMode', async () => {
      const ctx = makeCtx();
      await wsSetup(ctx);
      // Should call click for mock mode, delay, then click for client mode
      expect(ctx.click).toHaveBeenCalledTimes(2);
      expect(ctx.delay).toHaveBeenCalled();
    });
  });

  describe('wsCleanup', () => {
    it('runs disconnect, clear, stop, and switch', async () => {
      const ctx = makeCtx();
      await wsCleanup(ctx);
      // 3 clicks: mock mode (stopMockServer), then client mode (switchToClientMode),
      // plus the click from stopMockServer
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });
  });

  describe('wsAuthCleanup', () => {
    it('runs disconnect, clear, resetAuth, stop, and switch', async () => {
      const ctx = makeCtx();
      await wsAuthCleanup(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.selectOption).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });
  });

  describe('closeExtraConnectionTabs', () => {
    it('does nothing when only 1 tab exists', async () => {
      const tabBar = document.createElement('div');
      tabBar.setAttribute('data-testid', 'conn-tab-bar');
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-testid', 'conn-tab-1');
      tabBar.appendChild(tab);
      document.body.appendChild(tabBar);

      const ctx = makeCtx();
      await closeExtraConnectionTabs(ctx);
      expect(ctx.delay).not.toHaveBeenCalled();
    });

    it('closes extra tabs when multiple exist', async () => {
      const tabBar = document.createElement('div');
      tabBar.setAttribute('data-testid', 'conn-tab-bar');
      const tab1 = document.createElement('div');
      tab1.setAttribute('role', 'tab');
      tab1.setAttribute('data-testid', 'conn-tab-1');
      const tab2 = document.createElement('div');
      tab2.setAttribute('role', 'tab');
      tab2.setAttribute('data-testid', 'conn-tab-2');
      const closeBtn = document.createElement('button');
      closeBtn.setAttribute('data-testid', 'conn-tab-close-2');
      closeBtn.addEventListener('click', () => tab2.remove());
      tabBar.appendChild(tab1);
      tabBar.appendChild(tab2);
      document.body.appendChild(tabBar);
      document.body.appendChild(closeBtn);

      const ctx = makeCtx();
      await closeExtraConnectionTabs(ctx, 3);
      expect(ctx.delay).toHaveBeenCalledWith(300);
      expect(tabBar.querySelectorAll('[role="tab"]').length).toBe(1);
    });

    it('stops when close button is not found', async () => {
      const tabBar = document.createElement('div');
      tabBar.setAttribute('data-testid', 'conn-tab-bar');
      const tab1 = document.createElement('div');
      tab1.setAttribute('role', 'tab');
      tab1.setAttribute('data-testid', 'conn-tab-1');
      const tab2 = document.createElement('div');
      tab2.setAttribute('role', 'tab');
      tab2.setAttribute('data-testid', 'conn-tab-2');
      tabBar.appendChild(tab1);
      tabBar.appendChild(tab2);
      document.body.appendChild(tabBar);

      const ctx = makeCtx();
      await closeExtraConnectionTabs(ctx);
      expect(ctx.delay).not.toHaveBeenCalled();
    });

    it('handles tab without data-testid', async () => {
      const tabBar = document.createElement('div');
      tabBar.setAttribute('data-testid', 'conn-tab-bar');
      const tab1 = document.createElement('div');
      tab1.setAttribute('role', 'tab');
      tab1.setAttribute('data-testid', 'conn-tab-1');
      const tab2 = document.createElement('div');
      tab2.setAttribute('role', 'tab');
      tabBar.appendChild(tab1);
      tabBar.appendChild(tab2);
      document.body.appendChild(tabBar);

      const ctx = makeCtx();
      await closeExtraConnectionTabs(ctx, 2);
      expect(ctx.delay).not.toHaveBeenCalled();
    });

    it('does nothing when no tab bar exists', async () => {
      const ctx = makeCtx();
      await closeExtraConnectionTabs(ctx);
      expect(ctx.delay).not.toHaveBeenCalled();
    });

    it('closes multiple tabs in sequence', async () => {
      const tabBar = document.createElement('div');
      tabBar.setAttribute('data-testid', 'conn-tab-bar');
      const tab1 = document.createElement('div');
      tab1.setAttribute('role', 'tab');
      tab1.setAttribute('data-testid', 'conn-tab-1');
      const tab2 = document.createElement('div');
      tab2.setAttribute('role', 'tab');
      tab2.setAttribute('data-testid', 'conn-tab-2');
      const tab3 = document.createElement('div');
      tab3.setAttribute('role', 'tab');
      tab3.setAttribute('data-testid', 'conn-tab-3');
      const closeBtn3 = document.createElement('button');
      closeBtn3.setAttribute('data-testid', 'conn-tab-close-3');
      closeBtn3.addEventListener('click', () => { tab3.remove(); closeBtn3.remove(); });
      const closeBtn2 = document.createElement('button');
      closeBtn2.setAttribute('data-testid', 'conn-tab-close-2');
      closeBtn2.addEventListener('click', () => { tab2.remove(); closeBtn2.remove(); });
      tabBar.appendChild(tab1);
      tabBar.appendChild(tab2);
      tabBar.appendChild(tab3);
      document.body.appendChild(tabBar);
      document.body.appendChild(closeBtn2);
      document.body.appendChild(closeBtn3);

      const ctx = makeCtx();
      await closeExtraConnectionTabs(ctx, 5);
      expect(tabBar.querySelectorAll('[role="tab"]').length).toBe(1);
      expect(ctx.delay).toHaveBeenCalledTimes(2);
    });
  });

  describe('fillControlledInput', () => {
    it('sets native value and dispatches events', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const inputHandler = vi.fn();
      const changeHandler = vi.fn();
      input.addEventListener('input', inputHandler);
      input.addEventListener('change', changeHandler);

      fillControlledInput(input, 'test-value');
      expect(input.value).toBe('test-value');
      expect(inputHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('connectToMockServer', () => {
    it('navigates to connect tab, fills URL, and clicks connect', async () => {
      const ctx = makeCtx();
      await connectToMockServer(ctx);
      expect(ctx.click).toHaveBeenCalledTimes(2);
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });

    it('uses custom URL when provided', async () => {
      const ctx = makeCtx();
      await connectToMockServer(ctx, 'ws://custom:1234');
      const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillCalls[0][1]).toBe('ws://custom:1234');
    });

    it('uses custom delay when provided', async () => {
      const ctx = makeCtx();
      await connectToMockServer(ctx, 'ws://localhost:9876', 500);
      const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls;
      expect(delayCalls.some((c: number[]) => c[0] === 500)).toBe(true);
    });
  });
});
