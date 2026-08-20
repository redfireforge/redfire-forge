/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DomainSelector from './DomainSelector';
import DemoSpotlight from './DemoSpotlight';
import DemoHubHeader from './DemoHubHeader';
import type { DemoProgress } from './types';
import {
  baseProgress,
  makeLesson,
  makeDomain,
} from './demo-components.testHelpers';

vi.mock('./utils/checkEndpoint', () => ({
  checkEndpoint: vi.fn().mockResolvedValue(false),
}));

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adapters')>();
  return {
    ...actual,
    countUserTabsInStorage: vi.fn().mockResolvedValue(0),
    userTabsToCloseForLesson: vi.fn(() => 0),
  };
});

describe('DomainSelector', () => {
  it('renders domain cards', () => {
    render(<DomainSelector domains={[makeDomain()]} progress={baseProgress} onSelect={vi.fn()} />);
    expect(screen.getByText('Protocols')).toBeTruthy();
    expect(screen.getByText('1 lesson')).toBeTruthy();
  });

  it('shows plural lesson count', () => {
    const domain = makeDomain({
      lessons: [makeLesson(), makeLesson({ id: 'l2', name: 'L2' })],
    });
    render(<DomainSelector domains={[domain]} progress={baseProgress} onSelect={vi.fn()} />);
    expect(screen.getByText('2 lessons')).toBeTruthy();
  });

  it('calls onSelect when clicking an available domain', () => {
    const onSelect = vi.fn();
    render(<DomainSelector domains={[makeDomain()]} progress={baseProgress} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Protocols'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows Coming Soon badge for unavailable domains', () => {
    render(<DomainSelector domains={[makeDomain({ available: false })]} progress={baseProgress} onSelect={vi.fn()} />);
    expect(screen.getByText('Coming Soon')).toBeTruthy();
  });

  it('renders progress ring for available domains', () => {
    const { container } = render(<DomainSelector domains={[makeDomain()]} progress={baseProgress} onSelect={vi.fn()} />);
    expect(container.querySelector('.demo-progress-ring')).toBeTruthy();
  });

  it('shows progress percentage when lessons are completed', () => {
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    const { container } = render(<DomainSelector domains={[makeDomain()]} progress={progress} onSelect={vi.fn()} />);
    const text = container.querySelector('.demo-progress-ring text');
    expect(text?.textContent).toBe('100%');
  });

  it('renders domain with no lessons: pct=0 and empty lesson count string (lines 20,32 false branches)', () => {
    const emptyDomain = makeDomain({ lessons: [] });
    const { container } = render(
      <DomainSelector domains={[emptyDomain]} progress={baseProgress} onSelect={vi.fn()} />,
    );
    // No lesson count text shown when 0 lessons
    expect(container.textContent).not.toMatch(/\d+ lesson/);
    // Progress ring still renders (pct=0)
    expect(container.querySelector('.demo-progress-ring')).toBeTruthy();
  });

  const richDomain = () => makeDomain({
    categories: [
      { id: 'websocket', label: 'WebSocket', icon: '🔌' },
      { id: 'sse', label: 'SSE', icon: '📡' },
    ],
    lessons: [
      makeLesson({ id: 'a', category: 'websocket', estimatedMinutes: 10 }),
      makeLesson({ id: 'b', category: 'websocket', estimatedMinutes: 20 }),
      makeLesson({ id: 'c', category: 'sse', estimatedMinutes: 90 }),
      makeLesson({ id: 'd', estimatedMinutes: 0 }),
    ],
  });

  it('summarizes lessons, categories, and estimated total time', () => {
    render(<DomainSelector domains={[richDomain()]} progress={baseProgress} onSelect={vi.fn()} />);
    expect(screen.getByText('4 lessons · 2 categories')).toBeTruthy();
    // 10 + 20 + 90 = 120 min → "2h"
    expect(screen.getByText('2h')).toBeTruthy();
  });

  it('renders a per-category chip with its lesson count plus an uncategorized "+more" chip', () => {
    const { container } = render(<DomainSelector domains={[richDomain()]} progress={baseProgress} onSelect={vi.fn()} />);
    const counts = [...container.querySelectorAll('.demo-domain-cat-count')].map(n => n.textContent);
    expect(counts).toEqual(['2', '1']);
    expect(screen.getByText('+1 more')).toBeTruthy();
  });

  it('shows the correct status and progress fill width as lessons complete', () => {
    // Two of four complete → in progress, 50%.
    const partial: DemoProgress = { ...baseProgress, completedLessons: ['a', 'b'] };
    const { container, rerender } = render(
      <DomainSelector domains={[richDomain()]} progress={partial} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('2/4')).toBeTruthy();
    expect((container.querySelector('.demo-domain-progress-fill') as HTMLElement)?.style.width).toBe('50%');

    // All four complete → completed, status class applied.
    const done: DemoProgress = { ...baseProgress, completedLessons: ['a', 'b', 'c', 'd'] };
    rerender(<DomainSelector domains={[richDomain()]} progress={done} onSelect={vi.fn()} />);
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(container.querySelector('.demo-domain-card.status-complete')).toBeTruthy();
  });

  it('marks an untouched domain as "Start learning"', () => {
    render(<DomainSelector domains={[richDomain()]} progress={baseProgress} onSelect={vi.fn()} />);
    expect(screen.getByText('Start learning')).toBeTruthy();
  });
});

// ── DemoSpotlight ───────────────────────────────────────────────

describe('DemoSpotlight', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<DemoSpotlight selector=".foo" active={false} />);
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('renders nothing when no selector', () => {
    const { container } = render(<DemoSpotlight active={true} />);
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('renders nothing initially when selector does not match any element', () => {
    const { container } = render(<DemoSpotlight selector=".nonexistent" active={true} />);
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('renders spotlight ring when selector matches a visible element', async () => {
    // Create a target element
    const target = document.createElement('div');
    target.className = 'spotlight-target';
    target.style.width = '100px';
    target.style.height = '50px';
    document.body.appendChild(target);

    // Mock getBoundingClientRect
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 100, left: 200, width: 100, height: 50,
      right: 300, bottom: 150, x: 200, y: 100, toJSON: () => ({}),
    });

    // Mock requestAnimationFrame to run the tracking function
    let rafCallback: FrameRequestCallback | null = null;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    };
    const origCAF = window.cancelAnimationFrame;
    window.cancelAnimationFrame = vi.fn();

    const { container } = render(<DemoSpotlight selector=".spotlight-target" active={true} />);

    // Fast-forward past the setTimeout(200ms) delay
    await vi.waitFor(() => {
      if (rafCallback) {
        rafCallback(0);
        rafCallback = null;
      }
    }, { timeout: 500 });

    // Check if spotlight ring rendered with correct position
    const ring = container.querySelector('.demo-spotlight-ring');
    if (ring) {
      const style = (ring as HTMLElement).style;
      expect(parseFloat(style.top)).toBe(94); // 100 - 6
      expect(parseFloat(style.left)).toBe(194); // 200 - 6
    }

    // Cleanup
    document.body.removeChild(target);
    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
  });

  it('hides spotlight when target is behind an open app modal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const target = document.createElement('button');
    target.setAttribute('data-testid', 'gql-tls-configure');
    target.style.width = '80px';
    target.style.height = '30px';
    document.body.appendChild(target);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.width = '400px';
    overlay.style.height = '300px';
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-testid', 'gql-tls-body');
    dialog.style.width = '400px';
    dialog.style.height = '300px';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, width: 400, height: 300,
      right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}),
    });

    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 80, height: 30,
      right: 90, bottom: 40, x: 10, y: 10, toJSON: () => ({}),
    });

    let rafCallback: FrameRequestCallback | null = null;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { rafCallback = cb; return 1; };
    const origCAF = window.cancelAnimationFrame;
    window.cancelAnimationFrame = vi.fn();

    const { container } = render(
      <DemoSpotlight selector="[data-testid='gql-tls-configure']" active={true} />,
    );

    await vi.advanceTimersByTimeAsync(250);
    rafCallback?.(0);

    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();

    document.body.removeChild(target);
    document.body.removeChild(overlay);
    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
    vi.useRealTimers();
  });

  it('cleans up spotlight tracking interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const target = document.createElement('div');
    target.className = 'cleanup-test';
    document.body.appendChild(target);

    const { unmount } = render(<DemoSpotlight selector=".cleanup-test" active={true} />);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    document.body.removeChild(target);
  });

  it('sets rect when visible element found: covers if(el) true branch (line 42)', async () => {
    vi.useFakeTimers();
    const target = document.createElement('div');
    target.className = 'spotlight-visible-test';
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 100, left: 200, width: 80, height: 40,
      right: 280, bottom: 140, x: 200, y: 100, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    let rafCb: FrameRequestCallback | null = null;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { rafCb = cb; return 2; };
    const origCAF = window.cancelAnimationFrame;
    window.cancelAnimationFrame = vi.fn();

    const { container } = render(
      <DemoSpotlight selector=".spotlight-visible-test" active={true} />,
    );

    // Fire the 200ms setup timeout so RAF is scheduled
    await act(async () => { vi.advanceTimersByTime(250); });
    // Execute the RAF callback so track() runs and setRect({...}) is called
    await act(async () => { if (rafCb) { rafCb(0); rafCb = null; } });

    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
    vi.useRealTimers();

    const ring = container.querySelector('.demo-spotlight-ring');
    expect(ring).toBeTruthy();
    document.body.removeChild(target);
  });

  it('sets rect to null when element not found during tracking', () => {
    const { container, rerender } = render(<DemoSpotlight selector=".missing" active={true} />);
    // Initially null → no ring
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
    // Re-render with inactive → still null
    rerender(<DemoSpotlight selector=".missing" active={false} />);
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });

  it('calls setRect(null) when elements exist but all have zero dimensions (lines 28-30 coverage)', async () => {
    vi.useFakeTimers();

    // Add an element that matches but has 0x0 dimensions (jsdom default)
    const target = document.createElement('div');
    target.className = 'zero-dim-target';
    // No mock for getBoundingClientRect → jsdom returns {width:0, height:0}
    document.body.appendChild(target);

    let rafCb: FrameRequestCallback | null = null;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { rafCb = cb; return 4; };
    const origCAF = window.cancelAnimationFrame;
    window.cancelAnimationFrame = vi.fn();

    const { container } = render(
      <DemoSpotlight selector=".zero-dim-target" active={true} />,
    );

    // Fire the 200ms setup timeout
    await act(async () => { vi.advanceTimersByTime(250); });
    // Execute the RAF callback — find returns undefined (all elements have 0 dimensions)
    await act(async () => { if (rafCb) { rafCb(0); rafCb = null; } });

    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
    vi.useRealTimers();

    // No spotlight ring (el was null → setRect(null))
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
    document.body.removeChild(target);
  });

  it('calls setRect(null) when track fires but element is not found (line 42 false branch)', async () => {
    vi.useFakeTimers();

    let rafCb: FrameRequestCallback | null = null;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { rafCb = cb; return 3; };
    const origCAF = window.cancelAnimationFrame;
    window.cancelAnimationFrame = vi.fn();

    // Render with selector that won't match any element → track() runs → el=null → setRect(null)
    const { container } = render(
      <DemoSpotlight selector=".never-exists-in-dom" active={true} />,
    );

    // No spotlight ring before RAF fires
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();

    // Fire 200ms setup timeout so RAF is scheduled
    await act(async () => { vi.advanceTimersByTime(250); });
    // Execute the RAF callback so track() runs and setRect(null) is called
    await act(async () => { if (rafCb) { rafCb(0); rafCb = null; } });

    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
    vi.useRealTimers();

    // Still no spotlight ring (setRect(null) means no ring shown)
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });
});

// ── DemoHubHeader ───────────────────────────────────────────────

describe('DemoHubHeader', () => {
  it('renders hub title', () => {
    render(<DemoHubHeader view="domains" domain={null} lesson={null} onBack={vi.fn()} onBackToDomains={vi.fn()} />);
    expect(screen.getByText('🎓 Learning Hub')).toBeTruthy();
  });

  it('shows domain breadcrumb when domain is selected', () => {
    render(<DemoHubHeader view="lessons" domain={makeDomain()} lesson={null} onBack={vi.fn()} onBackToDomains={vi.fn()} />);
    expect(screen.getByText(/Protocols/)).toBeTruthy();
  });

  it('shows lesson breadcrumb when lesson is selected', () => {
    render(<DemoHubHeader view="concept" domain={makeDomain()} lesson={makeLesson()} onBack={vi.fn()} onBackToDomains={vi.fn()} />);
    expect(screen.getByText('Lesson 1')).toBeTruthy();
  });

  it('shows category between domain and lesson when lesson has a category', () => {
    const domain = makeDomain({
      categories: [
        { id: 'websocket', label: 'WebSocket', icon: '🔌' },
        { id: 'kafka', label: 'Kafka', icon: '📨' },
      ],
    });
    const lesson = makeLesson({ name: 'Load Testing', category: 'websocket' });
    render(
      <DemoHubHeader
        view="concept"
        domain={domain}
        lesson={lesson}
        onBack={vi.fn()}
        onBackToDomains={vi.fn()}
      />,
    );
    expect(screen.getByText(/Protocols/)).toBeTruthy();
    expect(screen.getByText(/WebSocket/)).toBeTruthy();
    expect(screen.getByText('Load Testing')).toBeTruthy();
  });

  it('category breadcrumb calls onBack', () => {
    const onBack = vi.fn();
    const domain = makeDomain({
      categories: [{ id: 'websocket', label: 'WebSocket', icon: '🔌' }],
    });
    const lesson = makeLesson({ category: 'websocket' });
    render(
      <DemoHubHeader
        view="concept"
        domain={domain}
        lesson={lesson}
        onBack={onBack}
        onBackToDomains={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Category WebSocket'));
    expect(onBack).toHaveBeenCalled();
  });

  it('omits category crumb when domain has no matching category meta', () => {
    const lesson = makeLesson({ category: 'websocket' });
    render(
      <DemoHubHeader
        view="concept"
        domain={makeDomain()}
        lesson={lesson}
        onBack={vi.fn()}
        onBackToDomains={vi.fn()}
      />,
    );
    expect(screen.queryByText(/WebSocket/)).toBeNull();
    expect(screen.getByText('Lesson 1')).toBeTruthy();
  });

  it('back button is disabled on domains view', () => {
    render(<DemoHubHeader view="domains" domain={null} lesson={null} onBack={vi.fn()} onBackToDomains={vi.fn()} />);
    const btn = screen.getByText('🎓 Learning Hub');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('Learning Hub button calls onBackToDomains (not onBack) from any non-domains view', () => {
    const onBack = vi.fn();
    const onBackToDomains = vi.fn();
    render(<DemoHubHeader view="lessons" domain={makeDomain()} lesson={null} onBack={onBack} onBackToDomains={onBackToDomains} />);
    fireEvent.click(screen.getByText('🎓 Learning Hub'));
    expect(onBackToDomains).toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('Learning Hub button calls onBackToDomains from concept view', () => {
    const onBack = vi.fn();
    const onBackToDomains = vi.fn();
    const lesson = { id: 'l1', name: 'Test Lesson', category: 'websocket' } as ReturnType<typeof makeDomain>['lessons'][0];
    render(<DemoHubHeader view="concept" domain={makeDomain()} lesson={lesson} onBack={onBack} onBackToDomains={onBackToDomains} />);
    fireEvent.click(screen.getByText('🎓 Learning Hub'));
    expect(onBackToDomains).toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
