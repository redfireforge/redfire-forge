/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollRunnerProgressIntoView } from './th-demo-helpers';

describe('scrollRunnerProgressIntoView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is a no-op when Live Progress is missing', () => {
    expect(() => scrollRunnerProgressIntoView()).not.toThrow();
  });

  it('scrolls the Live Progress section into view', () => {
    const progress = document.createElement('div');
    progress.setAttribute('data-testid', 'har-live-progress');
    const scrollIntoView = vi.fn();
    progress.scrollIntoView = scrollIntoView;
    document.body.appendChild(progress);

    scrollRunnerProgressIntoView();

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'instant',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('prefers har-runner-monitor wrapper when present', () => {
    const monitor = document.createElement('div');
    monitor.setAttribute('data-testid', 'har-runner-monitor');
    const progress = document.createElement('div');
    progress.setAttribute('data-testid', 'har-live-progress');
    const scrollIntoView = vi.fn();
    progress.scrollIntoView = scrollIntoView;
    monitor.appendChild(progress);
    document.body.appendChild(monitor);

    scrollRunnerProgressIntoView();

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('adjusts overflow scroll parent when completion sits below the fold', () => {
    const pane = document.createElement('div');
    pane.style.overflowY = 'auto';
    Object.defineProperty(pane, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(pane, 'scrollTop', { value: 0, writable: true, configurable: true });
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, bottom: 400, right: 800, width: 800, height: 400,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    const progress = document.createElement('div');
    progress.setAttribute('data-testid', 'har-live-progress');
    progress.scrollIntoView = vi.fn();
    pane.appendChild(progress);

    const completion = document.createElement('div');
    completion.setAttribute('data-testid', 'har-completion');
    vi.spyOn(completion, 'getBoundingClientRect').mockReturnValue({
      top: 420, left: 0, bottom: 480, right: 800, width: 800, height: 60,
      x: 0, y: 420, toJSON: () => ({}),
    } as DOMRect);
    pane.appendChild(completion);
    document.body.appendChild(pane);

    scrollRunnerProgressIntoView();

    expect(pane.scrollTop).toBeGreaterThan(0);
  });
});
