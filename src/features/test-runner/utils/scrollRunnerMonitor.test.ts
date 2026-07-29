/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findScrollParent, scrollRunnerMonitorIntoView } from './scrollRunnerMonitor';

describe('scrollRunnerMonitor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('findScrollParent returns the nearest overflow-y auto ancestor', () => {
    const pane = document.createElement('div');
    Object.defineProperty(pane, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 400, configurable: true });
    pane.style.overflowY = 'auto';

    const child = document.createElement('div');
    pane.appendChild(child);
    document.body.appendChild(pane);

    expect(findScrollParent(child)).toBe(pane);
  });

  it('scrollRunnerMonitorIntoView calls scrollIntoView on the target', () => {
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    document.body.appendChild(el);

    scrollRunnerMonitorIntoView(el);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('nudge scrollTop when bottom sits below the scroll parent fold', () => {
    const pane = document.createElement('div');
    pane.style.overflowY = 'auto';
    Object.defineProperty(pane, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(pane, 'scrollTop', { value: 0, writable: true, configurable: true });
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, bottom: 400, right: 800, width: 800, height: 400,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    const top = document.createElement('div');
    top.scrollIntoView = vi.fn();
    pane.appendChild(top);

    const bottom = document.createElement('div');
    vi.spyOn(bottom, 'getBoundingClientRect').mockReturnValue({
      top: 420, left: 0, bottom: 500, right: 800, width: 800, height: 80,
      x: 0, y: 420, toJSON: () => ({}),
    } as DOMRect);
    pane.appendChild(bottom);
    document.body.appendChild(pane);

    scrollRunnerMonitorIntoView(top, bottom, 'instant');

    expect(pane.scrollTop).toBeGreaterThan(0);
  });
});
