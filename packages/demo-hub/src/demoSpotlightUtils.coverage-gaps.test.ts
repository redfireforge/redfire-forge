/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findVisibleAppModal,
  installDemoUserScrollListeners,
  isElementVisibleInViewport,
  scrollDemoTargetIntoView,
} from './demoSpotlightUtils';

function mockRect(el: Element, top: number, left: number, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
}

describe('demoSpotlightUtils — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('isElementVisibleInViewport rejects elements outside viewport padding', () => {
    const el = document.createElement('div');
    mockRect(el, -50, 0, 10, 10);
    document.body.appendChild(el);
    expect(isElementVisibleInViewport(el)).toBe(false);
  });

  it('isElementVisibleInViewport accounts for demo-live-panel overlap', () => {
    const panel = document.createElement('div');
    panel.className = 'demo-live-panel';
    mockRect(panel, 400, 600, 200, 200);
    const el = document.createElement('div');
    mockRect(el, 450, 650, 40, 20);
    document.body.append(panel, el);
    expect(isElementVisibleInViewport(el)).toBe(false);
  });

  it('isElementVisibleInViewport rejects when clipped by scroll parent', () => {
    const scroll = document.createElement('div');
    scroll.style.overflowY = 'auto';
    Object.defineProperty(scroll, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true });
    mockRect(scroll, 100, 0, 300, 100);
    const el = document.createElement('div');
    mockRect(el, 50, 10, 80, 20);
    scroll.appendChild(el);
    document.body.appendChild(scroll);
    expect(isElementVisibleInViewport(el)).toBe(false);
  });

  it('scrollDemoTargetIntoView uses block start and end inside scroll parent', () => {
    const scroll = document.createElement('div');
    scroll.style.overflowY = 'auto';
    Object.defineProperty(scroll, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 200, configurable: true });
    mockRect(scroll, 100, 0, 400, 200);
    scroll.scrollTo = vi.fn();

    const row = document.createElement('td');
    mockRect(row, 320, 20, 300, 24);
    scroll.appendChild(row);
    document.body.appendChild(scroll);

    scrollDemoTargetIntoView(row, { block: 'start' });
    scrollDemoTargetIntoView(row, { block: 'end' });
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('scrollDemoTargetIntoView falls back to scrollIntoView without scroll parent', () => {
    const el = document.createElement('div');
    mockRect(el, 100, 100, 50, 20);
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    scrollDemoTargetIntoView(el, { block: 'end' });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
  });

  it('scrollDemoTargetIntoView adjusts visible bottom when demo panel overlaps scroll parent', () => {
    const panel = document.createElement('div');
    panel.className = 'demo-live-panel';
    mockRect(panel, 300, 500, 200, 200);

    const scroll = document.createElement('div');
    scroll.style.overflowY = 'auto';
    Object.defineProperty(scroll, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 200, configurable: true });
    mockRect(scroll, 100, 400, 300, 250);
    scroll.scrollTo = vi.fn();

    const row = document.createElement('td');
    mockRect(row, 320, 420, 200, 24);
    scroll.appendChild(row);
    document.body.append(panel, scroll);

    scrollDemoTargetIntoView(row, { block: 'center' });
    expect(scroll.scrollTo).toHaveBeenCalled();
  });

  it('installDemoUserScrollListeners handles scroll and touchmove on metadata panel', () => {
    vi.useFakeTimers();
    const cleanup = installDemoUserScrollListeners();
    const scroll = document.createElement('div');
    scroll.className = 'gql-rv-metadata';
    document.body.appendChild(scroll);

    scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
    scroll.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
    cleanup();
    vi.useRealTimers();
  });

  it('findVisibleAppModal skips non-HTMLElement overlays', () => {
    const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgOverlay.setAttribute('class', 'modal-overlay');
    document.body.appendChild(svgOverlay);
    expect(findVisibleAppModal()).toBeNull();
  });
});
