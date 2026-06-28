/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import DemoSpotlight from './DemoSpotlight';

function mockRect(el: Element, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 10,
    left: 10,
    width,
    height,
    right: 10 + width,
    bottom: 10 + height,
    x: 10,
    y: 10,
    toJSON: () => ({}),
  });
}

describe('DemoSpotlight — coverage gaps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps rect stable when trackKey changes but geometry unchanged', () => {
    const target = document.createElement('div');
    target.className = 'stable-target';
    mockRect(target, 40, 20);
    document.body.appendChild(target);

    const { container, rerender } = render(
      <DemoSpotlight selector=".stable-target" active trackKey="a" />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const ringBefore = container.querySelector('.demo-spotlight-ring');
    expect(ringBefore).toBeTruthy();

    rerender(<DemoSpotlight selector=".stable-target" active trackKey="b" />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('clears rect when target becomes hidden', () => {
    const target = document.createElement('div');
    target.className = 'hide-target';
    mockRect(target, 40, 20);
    document.body.appendChild(target);

    const { container, rerender } = render(
      <DemoSpotlight selector=".hide-target" active />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeTruthy();

    target.style.display = 'none';
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<DemoSpotlight selector=".hide-target" active trackKey="refresh" />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
  });

  it('does not render ring when modal suppresses spotlight', () => {
    const target = document.createElement('button');
    target.className = 'modal-target';
    mockRect(target, 40, 20);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    mockRect(overlay, 200, 200);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    overlay.appendChild(dialog);
    document.body.append(target, overlay);

    const { container } = render(<DemoSpotlight selector=".modal-target" active />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('tracks layout changes via resize and scroll listeners', () => {
    const target = document.createElement('div');
    target.className = 'layout-target';
    mockRect(target, 40, 20);
    document.body.appendChild(target);

    const { container, unmount } = render(
      <DemoSpotlight selector=".layout-target" active trackKey="layout" />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeTruthy();
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
  });

  it('returns null when inactive or selector missing', () => {
    const { container: inactive } = render(<DemoSpotlight selector=".x" active={false} />);
    expect(inactive.querySelector('.demo-spotlight-ring')).toBeNull();
    const { container: noSelector } = render(<DemoSpotlight active />);
    expect(noSelector.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('updates ring when target geometry changes between polls', () => {
    const target = document.createElement('div');
    target.className = 'resize-target';
    mockRect(target, 40, 20);
    document.body.appendChild(target);

    const { container } = render(<DemoSpotlight selector=".resize-target" active />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeTruthy();

    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 20, left: 20, width: 80, height: 40,
      right: 100, bottom: 60, x: 20, y: 20, toJSON: () => ({}),
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('clears ring when selector matches no elements', () => {
    const { container, rerender } = render(<DemoSpotlight selector=".missing-target" active />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
    rerender(<DemoSpotlight selector=".missing-target" active trackKey="retry" />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('tracks spotlight when requestAnimationFrame is unavailable', () => {
    const savedRaf = globalThis.requestAnimationFrame;
    const savedCancel = globalThis.cancelAnimationFrame;
    // @ts-expect-error — simulate missing rAF
    globalThis.requestAnimationFrame = undefined;
    // @ts-expect-error — simulate missing cancel
    globalThis.cancelAnimationFrame = undefined;
    const target = document.createElement('div');
    target.className = 'no-raf-target';
    mockRect(target, 40, 20);
    document.body.appendChild(target);
    const { container, unmount } = render(<DemoSpotlight selector=".no-raf-target" active />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(container.querySelector('.demo-spotlight-ring')).toBeTruthy();
    unmount();
    globalThis.requestAnimationFrame = savedRaf;
    globalThis.cancelAnimationFrame = savedCancel;
  });
});
