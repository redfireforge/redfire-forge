/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleReplayFitView } from './replayCanvasFitView';

describe('replayCanvasFitView — coverage gaps', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when instance is null', () => {
    expect(scheduleReplayFitView(null)).toBe(false);
  });

  it('falls back to fitView when getNodes is empty', () => {
    const fitView = vi.fn();
    const result = scheduleReplayFitView({ fitView, getNodes: () => [] });
    expect(result).toBe(true);
    expect(fitView).toHaveBeenCalled();
  });

  it('forces fitView after max attempts when bounds stay zero', () => {
    const fitView = vi.fn();
    const nodes = [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }];
    let calls = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      calls += 1;
      cb(0);
      return calls;
    });
    scheduleReplayFitView({ fitView, getNodes: () => nodes as never });
    expect(fitView).toHaveBeenCalled();
  });
});
