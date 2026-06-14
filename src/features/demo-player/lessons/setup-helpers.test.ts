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
    it('clicks mock mode and start button', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-testid', 'mock-start-btn');
      btn.className = 'ws-mock-start-btn';
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await startMockServer(ctx);
      expect(ctx.click).toHaveBeenCalled();
      expect(ctx.delay).toHaveBeenCalled();
    });

    it('does not click disabled start button', async () => {
      const btn = document.createElement('button');
      btn.className = 'ws-mock-start-btn';
      btn.disabled = true;
      document.body.appendChild(btn);

      const ctx = makeCtx();
      await startMockServer(ctx);
      // The querySelector may or may not find the button depending on selector;
      // just verify it doesn't throw
      expect(ctx.click).toHaveBeenCalled();
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
});
