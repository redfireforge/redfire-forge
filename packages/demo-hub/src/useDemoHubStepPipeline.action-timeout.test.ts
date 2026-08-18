/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import type { DemoActionContext, DemoStep } from './types';
import { DEMO_ACTION_TIMEOUT_MS, runActionWithTimeout } from './useDemoHubStepPipeline';

function makeCtx(): DemoActionContext {
  return {
    navigateToTab: vi.fn(),
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    selectOption: vi.fn(async () => {}),
    waitFor: vi.fn(async () => {}),
    delay: vi.fn(async () => {}),
  };
}

describe('runActionWithTimeout', () => {
  it('does not warn when action finishes before the timeout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ac = new AbortController();
    const onTimeout = vi.fn();
    const step: DemoStep = {
      id: 'quick-step',
      title: 'Quick',
      description: 'done fast',
      action: async () => {},
    };

    await runActionWithTimeout(step, makeCtx(), ac.signal, onTimeout);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('action timed out'),
    );
    warn.mockRestore();
  });

  it('warns and calls onTimeout when action exceeds the budget', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ac = new AbortController();
    const onTimeout = vi.fn();
    const step: DemoStep = {
      id: 'slow-step',
      title: 'Slow',
      description: 'hangs',
      action: async (ctx) => {
        await ctx.delay(DEMO_ACTION_TIMEOUT_MS + 5_000);
      },
    };
    // Use a ctx.delay that respects real timers via fake timers.
    const ctx = makeCtx();
    ctx.delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const run = runActionWithTimeout(step, ctx, ac.signal, onTimeout);
    await vi.advanceTimersByTimeAsync(DEMO_ACTION_TIMEOUT_MS);
    await run;

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      `[DemoHub] action timed out after ${DEMO_ACTION_TIMEOUT_MS}ms for step slow-step`,
    );
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('honours a longer per-step actionTimeoutMs', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ac = new AbortController();
    const onTimeout = vi.fn();
    const step: DemoStep = {
      id: 'ship',
      title: 'Ship',
      description: 'long tour',
      actionTimeoutMs: 80_000,
      action: async (ctx) => {
        await ctx.delay(50_000);
      },
    };
    const ctx = makeCtx();
    ctx.delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const run = runActionWithTimeout(step, ctx, ac.signal, onTimeout);
    await vi.advanceTimersByTimeAsync(DEMO_ACTION_TIMEOUT_MS);
    expect(onTimeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    await run;

    expect(onTimeout).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('action timed out'));
    warn.mockRestore();
    vi.useRealTimers();
  });
});
