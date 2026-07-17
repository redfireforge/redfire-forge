import { describe, it, expect, vi, afterEach } from 'vitest';
import { REPLAY_CANVAS_FIT_VIEW_OPTIONS, scheduleReplayFitView } from './replayCanvasFitView';

describe('scheduleReplayFitView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when instance is null', () => {
    expect(scheduleReplayFitView(null)).toBe(false);
    expect(scheduleReplayFitView(undefined)).toBe(false);
  });

  it('calls fitView with nodes after animation frames when bounds are ready', () => {
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    expect(scheduleReplayFitView({ fitView, getNodes: () => nodes })).toBe(true);
    expect(fitView).not.toHaveBeenCalled();

    callbacks[0]?.(0);
    callbacks[1]?.(0);
    expect(fitView).toHaveBeenCalledWith({
      ...REPLAY_CANVAS_FIT_VIEW_OPTIONS,
      nodes,
    });
  });

  it('forces fitView after max attempts when node dimensions stay zero', () => {
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    scheduleReplayFitView({ fitView, getNodes: () => nodes });

    callbacks[0]?.(0);
    for (let i = 1; i < 16; i++) {
      callbacks[i]?.(0);
    }

    expect(fitView).toHaveBeenCalled();
    expect(fitView.mock.calls.at(-1)?.[0]).toMatchObject({
      ...REPLAY_CANVAS_FIT_VIEW_OPTIONS,
      nodes,
    });
  });

  it('returns false when getNodes returns empty array', () => {
    const fitView = vi.fn();
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    expect(scheduleReplayFitView({ fitView, getNodes: () => [] })).toBe(true);
    callbacks[0]?.(0);
    callbacks[1]?.(0);
    expect(fitView).not.toHaveBeenCalled();
  });

  it('uses measured dimensions when width/height missing on nodes', () => {
    const fitView = vi.fn();
    const nodes = [{
      id: 'a',
      position: { x: 0, y: 0 },
      measured: { width: 180, height: 60 },
    }];
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    scheduleReplayFitView({ fitView, getNodes: () => nodes });
    callbacks[0]?.(0);
    callbacks[1]?.(0);
    expect(fitView).toHaveBeenCalled();
  });

  it('works when getNodes is undefined (empty nodes path)', () => {
    const fitView = vi.fn();
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    scheduleReplayFitView({ fitView });
    callbacks[0]?.(0);
    callbacks[1]?.(0);
    expect(fitView).not.toHaveBeenCalled();
  });
});
