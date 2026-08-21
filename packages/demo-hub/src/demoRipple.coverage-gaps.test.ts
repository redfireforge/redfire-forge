/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getManualSpotlightEventName,
  isManualSpotlightActive,
  purgeAllSpotlightRings,
  showClickRipple,
  showSpotlightRing,
} from './demoRipple';

describe('demoRipple', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows and removes click ripple on animation end', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 20,
      width: 40,
      height: 30,
      right: 60,
      bottom: 40,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    showClickRipple(target);
    const ring = document.querySelector('.demo-click-ripple') as HTMLElement;
    expect(ring).toBeTruthy();
    expect(ring.style.top).toBe('25px');
    expect(ring.style.left).toBe('40px');

    ring.dispatchEvent(new Event('animationend'));
    expect(document.querySelector('.demo-click-ripple')).toBeNull();
  });

  it('tracks manual spotlight state and emits events', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      left: 100,
      width: 80,
      height: 40,
      right: 180,
      bottom: 90,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);

    expect(isManualSpotlightActive()).toBe(false);

    const eventName = getManualSpotlightEventName();
    const detailSpy = vi.fn();
    window.addEventListener(eventName, (e: Event) => {
      detailSpy((e as CustomEvent<number>).detail);
    });

    const dispose = showSpotlightRing(target);
    const ring = document.querySelector('.demo-spotlight-ring') as HTMLElement;
    expect(ring).toBeTruthy();
    expect(ring.style.top).toBe('44px');
    expect(ring.style.left).toBe('94px');
    expect(ring.style.width).toBe('92px');
    expect(ring.style.height).toBe('52px');
    expect(isManualSpotlightActive()).toBe(true);
    expect(detailSpy).toHaveBeenCalledWith(1);

    dispose();
    expect(isManualSpotlightActive()).toBe(false);
    expect(document.querySelector('.demo-spotlight-ring')).toBeNull();
    expect(detailSpy).toHaveBeenLastCalledWith(0);

    // Disposer is idempotent and does not push count below zero.
    dispose();
    expect(isManualSpotlightActive()).toBe(false);
  });

  it('showSpotlightRing({ steady: true }) adds the non-pulse modifier class', () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    target.getBoundingClientRect = () =>
      ({ top: 10, left: 10, width: 40, height: 20, right: 50, bottom: 30, x: 10, y: 10, toJSON: () => '' }) as DOMRect;

    const dispose = showSpotlightRing(target, { steady: true });
    const ring = document.querySelector('.demo-spotlight-ring');
    expect(ring?.classList.contains('demo-spotlight-ring--steady')).toBe(true);
    expect(ring?.classList.contains('demo-spotlight-ring--local')).toBe(true);
    dispose();
  });

  it('guards spotlight helpers when document is unavailable', () => {
    const originalDocument = globalThis.document;
    vi.stubGlobal('document', undefined);

    expect(isManualSpotlightActive()).toBe(false);

    const fakeEl = {
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    } as unknown as HTMLElement;
    expect(() => showSpotlightRing(fakeEl)).toThrow();

    vi.stubGlobal('document', originalDocument);
  });

  it('purges tracked spotlight disposers on interrupted step cleanup', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 12,
      left: 16,
      width: 40,
      height: 24,
      right: 56,
      bottom: 36,
      x: 16,
      y: 12,
      toJSON: () => ({}),
    } as DOMRect);

    const dispose = showSpotlightRing(target);
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
    expect(isManualSpotlightActive()).toBe(true);

    purgeAllSpotlightRings();
    expect(document.querySelector('.demo-spotlight-ring')).toBeNull();
    expect(isManualSpotlightActive()).toBe(false);

    // Ensure no counter underflow or throw when disposer runs after purge.
    expect(() => dispose()).not.toThrow();
    expect(isManualSpotlightActive()).toBe(false);
  });

  it('auto-disposes when the tracked element is detached from the DOM', () => {
    vi.useFakeTimers();
    const target = document.createElement('div');
    document.body.appendChild(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 12,
      left: 16,
      width: 40,
      height: 24,
      right: 56,
      bottom: 36,
      x: 16,
      y: 12,
      toJSON: () => ({}),
    } as DOMRect);

    showSpotlightRing(target);
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
    expect(isManualSpotlightActive()).toBe(true);

    target.remove();
    vi.advanceTimersByTime(150);

    expect(document.querySelector('.demo-spotlight-ring')).toBeNull();
    expect(isManualSpotlightActive()).toBe(false);
    vi.useRealTimers();
  });
});
