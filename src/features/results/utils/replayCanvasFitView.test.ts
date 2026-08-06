/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  REPLAY_CANVAS_FIT_VIEW_OPTIONS,
  runReplayFitView,
  scheduleReplayFitView,
} from './replayCanvasFitView';

describe('runReplayFitView / scheduleReplayFitView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when instance is null', () => {
    expect(scheduleReplayFitView(null)).toBe(false);
    expect(scheduleReplayFitView(undefined)).toBe(false);
    expect(runReplayFitView(null)).toBe(false);
  });

  it('uses setViewport with computed bounds when pane size is known', () => {
    const setViewport = vi.fn();
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];
    const pane = document.createElement('div');
    pane.className = 'react-flow';
    Object.defineProperty(pane, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 600, configurable: true });
    const wrap = document.createElement('div');
    wrap.className = 'results-explorer-canvas-wrap';
    wrap.appendChild(pane);
    document.body.appendChild(wrap);

    expect(runReplayFitView({ fitView, setViewport, getNodes: () => nodes }, undefined, wrap)).toBe(true);
    expect(setViewport).toHaveBeenCalled();
    expect(setViewport.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        zoom: expect.any(Number),
      }),
    );
    expect(setViewport.mock.calls[0][1]).toEqual({ duration: REPLAY_CANVAS_FIT_VIEW_OPTIONS.duration });
    expect(fitView).not.toHaveBeenCalled();
  });

  it('prefers instance.getNodesBounds and a container that is itself the react-flow pane', () => {
    const setViewport = vi.fn();
    const fitView = vi.fn();
    const getNodesBounds = vi.fn(() => ({ x: 10, y: 20, width: 300, height: 120 }));
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 10, height: 10 }];
    const pane = document.createElement('div');
    pane.className = 'react-flow';
    Object.defineProperty(pane, 'clientWidth', { value: 700, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 500, configurable: true });

    expect(runReplayFitView({ fitView, setViewport, getNodesBounds, getNodes: () => nodes }, undefined, pane)).toBe(true);
    expect(getNodesBounds).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a', width: 10, height: 10 }),
    ]);
    expect(setViewport).toHaveBeenCalled();
    expect(fitView).not.toHaveBeenCalled();
  });

  it('falls back to fitView when pane size is unavailable', () => {
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];
    expect(runReplayFitView({ fitView, getNodes: () => nodes })).toBe(true);
    expect(fitView).toHaveBeenCalledWith({
      padding: REPLAY_CANVAS_FIT_VIEW_OPTIONS.padding,
      duration: REPLAY_CANVAS_FIT_VIEW_OPTIONS.duration,
      maxZoom: REPLAY_CANVAS_FIT_VIEW_OPTIONS.maxZoom,
      minZoom: REPLAY_CANVAS_FIT_VIEW_OPTIONS.minZoom,
      includeHiddenNodes: REPLAY_CANVAS_FIT_VIEW_OPTIONS.includeHiddenNodes,
    });
  });

  it('falls back to fitView when nodes exist but computed bounds are still zero', () => {
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];

    expect(runReplayFitView({
      fitView,
      getNodes: () => nodes,
      getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    })).toBe(true);

    expect(fitView).toHaveBeenCalled();
  });

  it('falls back to the diagram pane selector when the provided container has no usable pane', () => {
    const setViewport = vi.fn();
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];
    const container = document.createElement('div');
    const zeroPane = document.createElement('div');
    zeroPane.className = 'react-flow';
    Object.defineProperty(zeroPane, 'clientWidth', { value: 0, configurable: true });
    Object.defineProperty(zeroPane, 'clientHeight', { value: 0, configurable: true });
    container.appendChild(zeroPane);

    const fallbackPane = document.createElement('div');
    fallbackPane.className = 'react-flow';
    Object.defineProperty(fallbackPane, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(fallbackPane, 'clientHeight', { value: 480, configurable: true });
    const diagram = document.createElement('div');
    diagram.className = 'results-explorer-diagram';
    diagram.appendChild(fallbackPane);
    document.body.appendChild(diagram);

    expect(runReplayFitView({ fitView, setViewport, getNodes: () => nodes }, undefined, container)).toBe(true);
    expect(setViewport).toHaveBeenCalled();
    expect(fitView).not.toHaveBeenCalled();
  });

  it('schedules fit after animation frames when bounds are ready', () => {
    const setViewport = vi.fn();
    const fitView = vi.fn();
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];
    const pane = document.createElement('div');
    pane.className = 'react-flow';
    Object.defineProperty(pane, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 600, configurable: true });
    const wrap = document.createElement('div');
    wrap.className = 'results-explorer-canvas-wrap';
    wrap.appendChild(pane);
    document.body.appendChild(wrap);

    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    expect(scheduleReplayFitView({ fitView, setViewport, getNodes: () => nodes }, undefined, wrap)).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();

    callbacks[0]?.(0);
    callbacks[1]?.(0);
    expect(setViewport).toHaveBeenCalled();
  });

  it('retries until nodes become measurable before fitting', () => {
    const setViewport = vi.fn();
    const fitView = vi.fn();
    const measurableNodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 220, height: 80 }];
    let callCount = 0;
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    scheduleReplayFitView({
      fitView,
      setViewport,
      getNodes: () => {
        callCount += 1;
        return callCount < 3 ? [] : measurableNodes;
      },
    });

    const pane = document.createElement('div');
    pane.className = 'react-flow';
    Object.defineProperty(pane, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 600, configurable: true });
    const wrap = document.createElement('div');
    wrap.className = 'results-explorer-canvas-wrap';
    wrap.appendChild(pane);
    document.body.appendChild(wrap);

    callbacks[0]?.(0);
    callbacks[1]?.(0);
    callbacks[2]?.(0);
    callbacks[3]?.(0);

    expect(setViewport).toHaveBeenCalled();
    expect(fitView).not.toHaveBeenCalled();
  });

  it('forces fit after max attempts when node dimensions stay zero', () => {
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
  });

  it('falls back to fitView when getNodes returns empty array', () => {
    const fitView = vi.fn();
    expect(runReplayFitView({ fitView, getNodes: () => [] })).toBe(true);
    expect(fitView).toHaveBeenCalled();
  });

  it('uses measured dimensions when width/height missing on nodes', () => {
    const fitView = vi.fn();
    const nodes = [{
      id: 'a',
      position: { x: 0, y: 0 },
      measured: { width: 180, height: 60 },
    }];
    expect(runReplayFitView({ fitView, getNodes: () => nodes })).toBe(true);
    expect(fitView).toHaveBeenCalled();
  });

  it('falls back to fitView when getNodes is undefined', () => {
    const fitView = vi.fn();
    expect(runReplayFitView({ fitView })).toBe(true);
    expect(fitView).toHaveBeenCalled();
  });
});
