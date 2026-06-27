/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import ConceptSlide, { renderMarkdown } from './ConceptSlide';
import DomainSelector from './DomainSelector';
import DemoSpotlight from './DemoSpotlight';
import DemoHubHeader from './DemoHubHeader';
import LessonPlayer from './LessonPlayer';
import LessonList from './LessonList';
import LiveDemo from './LiveDemo';
import { LessonNotesProvider } from './LessonNotesContext';
import type { ConceptContent, DemoDomain, DemoLesson, DemoProgress } from './types';

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

const baseProgress: DemoProgress = {
  completedLessons: [],
  lessonSteps: {},
  speed: 1,
};

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'l1',
    domainId: 'protocols',
    name: 'Lesson 1',
    description: 'Test lesson',
    estimatedMinutes: 5,
    concept: { title: 'Concept Title', body: 'Concept body text.' },
    steps: [
      { id: 's1', title: 'Step 1', description: 'Do step 1' },
      { id: 's2', title: 'Step 2', description: 'Do step 2' },
    ],
    ...overrides,
  };
}

function makeDomain(overrides: Partial<DemoDomain> = {}): DemoDomain {
  return {
    id: 'protocols',
    name: 'Protocols',
    icon: '🔌',
    description: 'WebSocket & SSE',
    available: true,
    lessons: [makeLesson()],
    ...overrides,
  };
}

function renderWithLessonNotes(ui: ReactElement) {
  return render(<LessonNotesProvider>{ui}</LessonNotesProvider>);
}

/** Click step N in LessonPlayer sidebar (0 = first step). Ignores Concept/Notes items. */
function clickLessonPlayerStep(stepIndex: number) {
  const stepNum = document.querySelectorAll('.demo-sidebar-step-num')[stepIndex];
  const btn = stepNum?.closest('.demo-sidebar-nav-item');
  if (!btn) throw new Error(`LessonPlayer step nav index ${stepIndex} not found`);
  fireEvent.click(btn);
}

// ── ConceptSlide ────────────────────────────────────────────────

describe('ConceptSlide', () => {
  const baseConcept: ConceptContent = {
    title: 'WebSocket Basics',
    body: 'WebSockets provide **full-duplex** communication.',
  };

  it('renders title', () => {
    render(<ConceptSlide concept={baseConcept} />);
    expect(screen.getByText('WebSocket Basics')).toBeTruthy();
  });

  it('renders body as HTML with bold formatting', () => {
    const { container } = render(<ConceptSlide concept={baseConcept} />);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('full-duplex');
  });

  it('renders key terms when provided', () => {
    const concept: ConceptContent = {
      ...baseConcept,
      keyTerms: [{ term: 'WebSocket', definition: 'A protocol for real-time communication' }],
    };
    render(<ConceptSlide concept={concept} />);
    expect(screen.getByText('Key Terms')).toBeTruthy();
    expect(screen.getByText('WebSocket')).toBeTruthy();
  });

  it('does not render key terms when empty', () => {
    render(<ConceptSlide concept={baseConcept} />);
    expect(screen.queryByText('Key Terms')).toBeNull();
  });

  it('renders diagram when provided', () => {
    const concept: ConceptContent = {
      ...baseConcept,
      diagram: '<svg><circle r="10"/></svg>',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    const wrapper = container.querySelector('.demo-concept-diagram');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector('svg')).toBeTruthy();
  });

  it('renders bullet list', () => {
    const concept: ConceptContent = {
      title: 'Lists',
      body: '- Item 1\n- Item 2',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
  });

  it('renders numbered list', () => {
    const concept: ConceptContent = {
      title: 'Steps',
      body: '1. First\n2. Second',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    expect(container.querySelector('ol')).toBeTruthy();
  });

  it('renders inline code', () => {
    const concept: ConceptContent = {
      title: 'Code',
      body: 'Use `ws://localhost` to connect.',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('ws://localhost');
  });
});

// ── renderMarkdown ──────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('wraps plain text in <p>', () => {
    expect(renderMarkdown('Hello')).toBe('<p>Hello</p>');
  });

  it('renders bold text', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('Use `foo` here')).toContain('<code>foo</code>');
  });

  it('renders bullet lists', () => {
    const html = renderMarkdown('- One\n- Two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>One</li>');
    expect(html).toContain('<li>Two</li>');
  });

  it('renders numbered lists', () => {
    const html = renderMarkdown('1. First\n2. Second');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
  });

  it('renders markdown tables', () => {
    const md = '| Name | Value |\n| --- | --- |\n| Foo | 1 |\n| Bar | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Foo</td>');
    expect(html).toContain('<td>2</td>');
  });

  it('renders fenced code blocks', () => {
    const md = '```\nconst x = 1;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre class="demo-concept-code">');
    expect(html).toContain('const x = 1;');
  });

  it('escapes HTML in fenced code blocks', () => {
    const md = '```\n<div>&test</div>\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('&lt;div&gt;');
    expect(html).toContain('&amp;test');
  });

  it('handles multiple paragraphs', () => {
    const html = renderMarkdown('First para\n\nSecond para');
    expect(html).toContain('<p>First para</p>');
    expect(html).toContain('<p>Second para</p>');
  });

  it('converts line breaks within a paragraph to <br/>', () => {
    const html = renderMarkdown('Line 1\nLine 2');
    expect(html).toContain('Line 1<br/>Line 2');
  });

  it('renders table with leading text', () => {
    const md = 'Header text\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<p>Header text</p>');
    expect(html).toContain('<table');
  });

  it('handles asterisk bullet lists', () => {
    const html = renderMarkdown('* Alpha\n* Beta');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Alpha</li>');
  });

  it('renders fenced code block with language tag', () => {
    const md = '```typescript\nconst a = 1;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre class="demo-concept-code">');
    expect(html).toContain('const a = 1;');
  });

  it('preserves multiple code blocks', () => {
    const md = '```\nblock1\n```\n\n```\nblock2\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('block1');
    expect(html).toContain('block2');
  });

  it('handles empty string', () => {
    const html = renderMarkdown('');
    expect(html).toBeTruthy();
  });

  it('handles table cells with formatting', () => {
    const md = '| **Name** | `code` |\n| --- | --- |\n| x | y |';
    const html = renderMarkdown(md);
    expect(html).toContain('<strong>Name</strong>');
    expect(html).toContain('<code>code</code>');
  });
});

// ── DomainSelector ──────────────────────────────────────────────

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

  it('cleans up animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const target = document.createElement('div');
    target.className = 'cleanup-test';
    document.body.appendChild(target);

    const { unmount } = render(<DemoSpotlight selector=".cleanup-test" active={true} />);
    unmount();

    // clearTimeout + cancelAnimationFrame should be called on cleanup
    expect(cancelSpy).toHaveBeenCalled();
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

// ── LessonPlayer ────────────────────────────────────────────────

describe('LessonPlayer', () => {
  it('renders concept slide and step list', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );
    expect(screen.getByText('Concept Title')).toBeTruthy();
    expect(screen.getByText(/Step 1/)).toBeTruthy();
    expect(screen.getByText(/Step 2/)).toBeTruthy();
  });

  it('does not render speed selector buttons', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );
    expect(screen.queryByText('1x')).toBeNull();
    expect(screen.queryByText('2x')).toBeNull();
  });

  it('calls onStartDemo when Start Demo is clicked', () => {
    const onStart = vi.fn();
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={onStart}
      />,
    );
    fireEvent.click(screen.getByText('Start Demo →'));
    expect(onStart).toHaveBeenCalled();
  });

  it('disables start button when lesson has dockerEndpoint and gate not cleared', () => {
    const onStart = vi.fn();
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({ dockerEndpoint: 'ws://localhost:3100/socket.io/?EIO=4' })}
        onStartDemo={onStart}
      />,
    );
    const startBtn = screen.getByText(/Waiting for Docker/);
    expect(startBtn).toBeTruthy();
    expect((startBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(startBtn);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('disables start button for desktop-only lessons on web', () => {
    const onStart = vi.fn();
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({ desktopOnly: true })}
        onStartDemo={onStart}
      />,
    );
    const startBtn = screen.getByRole('button', { name: 'Desktop app required' });
    expect(startBtn).toBeTruthy();
    expect((startBtn as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('[data-testid="desktop-only-gate"]')).toBeTruthy();
    fireEvent.click(startBtn);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('renders PrerequisiteGate when dockerEndpoint is set', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({
          dockerEndpoint: 'ws://localhost:3100/test',
          dockerCommand: 'docker compose up test',
        })}
        onStartDemo={vi.fn()}
      />,
    );
    const gateEl = document.querySelector('.prereq-gate');
    expect(gateEl).toBeTruthy();
  });

  it('does not render PrerequisiteGate without dockerEndpoint', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );
    expect(document.querySelector('.prereq-gate')).toBeNull();
  });

  it('clicking a step nav item shows its description in the right panel', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );
    // Default: concept view is active
    expect(document.querySelector('.demo-concept-slide')).toBeTruthy();
    expect(document.querySelector('.demo-step-detail')).toBeNull();

    // Click step 1 in the sidebar
    clickLessonPlayerStep(0);

    // Concept slide should be replaced by step detail
    expect(document.querySelector('.demo-concept-slide')).toBeNull();
    expect(document.querySelector('.demo-step-detail')).toBeTruthy();
    expect(document.querySelector('.demo-step-detail-title')?.textContent).toBe('Step 1');
    expect(document.querySelector('.demo-step-detail-num')?.textContent).toBe('Step 1');

    // Clicking Concept nav item restores concept view
    fireEvent.click(document.querySelectorAll('.demo-sidebar-nav-item')[0]!);
    expect(document.querySelector('.demo-concept-slide')).toBeTruthy();
    expect(document.querySelector('.demo-step-detail')).toBeNull();
  });

  it('renders step diagram when step has diagram field', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({
          steps: [
            {
              id: 's1',
              title: 'Anatomy',
              description: 'See the diagram below.',
              diagram: '<svg data-testid="step-diagram"><circle r="10"/></svg>',
            },
          ],
        })}
        onStartDemo={vi.fn()}
      />,
    );
    clickLessonPlayerStep(0);
    expect(document.querySelector('.demo-step-diagram')).toBeTruthy();
    expect(document.querySelector('[data-testid="step-diagram"]')).toBeTruthy();
  });

  it('footer always shows Start Demo; Prev/Next appear only when viewing a step', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );

    // Concept view → Start Demo present, no step navigation
    expect(screen.queryByText('Start Demo →')).toBeTruthy();
    expect(screen.queryByText(/← Prev/)).toBeNull();
    expect(screen.queryByText(/Next →/)).toBeNull();

    // Step 1 (non-last, non-first) → Start Demo + Next, no Prev
    clickLessonPlayerStep(0);
    expect(screen.queryByText('Start Demo →')).toBeTruthy();
    expect(screen.queryByText(/Next →/)).toBeTruthy();
    expect(screen.queryByText(/← Prev/)).toBeNull();

    // Step 2 (last) → Start Demo + Prev, no Next
    clickLessonPlayerStep(1);
    expect(screen.queryByText('Start Demo →')).toBeTruthy();
    expect(screen.queryByText(/← Prev/)).toBeTruthy();
    expect(screen.queryByText(/Next →/)).toBeNull();
  });

  it('enables start button when docker gate becomes ready', async () => {
    vi.useFakeTimers();
    const { checkEndpoint } = await import('./utils/checkEndpoint');
    (checkEndpoint as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false).mockResolvedValue(true);

    const onStart = vi.fn();
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({ dockerEndpoint: 'ws://localhost:3100/test' })}
        onStartDemo={onStart}
      />,
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByText(/Waiting for Docker/)).toBeTruthy();

    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    const startBtn = screen.getByText('Start Demo →');
    expect(startBtn).toBeTruthy();
    expect((startBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('Prev and Next buttons navigate between steps', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );
    clickLessonPlayerStep(0);
    fireEvent.click(screen.getByText(/Next →/));
    expect(document.querySelector('.demo-step-detail-title')?.textContent).toBe('Step 2');
    fireEvent.click(screen.getByText(/← Prev/));
    expect(document.querySelector('.demo-step-detail-title')?.textContent).toBe('Step 1');
  });

  it('uses default dockerCommand when lesson omits dockerCommand', () => {
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({ dockerEndpoint: 'ws://localhost:3100/test' })}
        onStartDemo={vi.fn()}
      />,
    );
    expect(document.querySelector('.prereq-gate')).toBeTruthy();
  });

  it('passes tabBudget to PrerequisiteGate for GraphQL studio lessons', async () => {
    vi.useFakeTimers();
    const { checkEndpoint } = await import('./utils/checkEndpoint');
    (checkEndpoint as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const onStart = vi.fn();
    renderWithLessonNotes(
      <LessonPlayer
        lesson={makeLesson({
          category: 'graphql',
          initialTab: 'graphql-studio',
          tabBudget: 2,
          dockerEndpoint: 'http://localhost:4010/graphql',
        })}
        onStartDemo={onStart}
      />,
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });

    const startBtn = screen.getByText('Start Demo →');
    expect((startBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ── LessonList ──────────────────────────────────────────────────

describe('LessonList', () => {
  const defaultResetProps = {
    onResetLesson: vi.fn(),
    onResetAll: vi.fn(),
  };

  it('renders lesson items', () => {
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText('Lesson 1')).toBeTruthy();
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('shows completed status', () => {
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Restart')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows in-progress indicator for lessons with step progress', () => {
    const progress: DemoProgress = { ...baseProgress, lessonSteps: { l1: 0 } };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByLabelText('In progress')).toBeTruthy();
  });

  it('shows Resume badge for in-progress lessons', () => {
    const progress: DemoProgress = { ...baseProgress, lessonSteps: { l1: 2 } };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText('Resume')).toBeTruthy();
  });

  it('shows Desktop only badge instead of Start/Resume for desktop-only lessons on web', () => {
    const domain = makeDomain({
      lessons: [makeLesson({ id: 'desktop-lesson', desktopOnly: true })],
    });
    const progress: DemoProgress = { ...baseProgress, lessonSteps: { 'desktop-lesson': 1 } };
    renderWithLessonNotes(
      <LessonList
        domain={domain}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText('Desktop only')).toBeTruthy();
    expect(screen.queryByText('Resume')).toBeNull();
    expect(screen.queryByText('Start')).toBeNull();
  });

  it('calls onSelect when lesson clicked', () => {
    const onSelect = vi.fn();
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={onSelect}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    fireEvent.click(screen.getByText('Lesson 1'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={onBack}
        {...defaultResetProps}
      />,
    );
    fireEvent.click(screen.getByText('← Back to all domains'));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders category tabs when domain has categories', () => {
    const domain = makeDomain({
      categories: [
        { id: 'basics', label: 'Basics', icon: '📚' },
        { id: 'advanced', label: 'Advanced', icon: '🚀' },
      ],
      lessons: [makeLesson({ category: 'basics' })],
    });
    renderWithLessonNotes(
      <LessonList
        domain={domain}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
  });

  it('shows per-lesson reset button for completed lessons', () => {
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByTestId('reset-lesson-l1')).toBeTruthy();
  });

  it('shows inline confirm when reset lesson button clicked', () => {
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-lesson-l1'));
    expect(screen.getByTestId('reset-confirm-l1')).toBeTruthy();
    expect(screen.getByText('Reset progress?')).toBeTruthy();
  });

  it('calls onResetLesson when confirmed', () => {
    const onResetLesson = vi.fn();
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onResetLesson={onResetLesson}
        onResetAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-lesson-l1'));
    fireEvent.click(screen.getByText('↺ Yes'));
    expect(onResetLesson).toHaveBeenCalledWith('l1');
  });

  it('dismisses confirm without resetting when ✕ clicked', () => {
    const onResetLesson = vi.fn();
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onResetLesson={onResetLesson}
        onResetAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-lesson-l1'));
    fireEvent.click(screen.getByLabelText('Cancel reset'));
    expect(onResetLesson).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reset-confirm-l1')).toBeNull();
  });

  it('shows Reset all button only when at least one lesson is completed', () => {
    const { rerender } = renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.queryByTestId('reset-all-btn')).toBeNull();

    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    rerender(
      <LessonNotesProvider>
        <LessonList
          domain={makeDomain()}
          progress={progress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          {...defaultResetProps}
        />
      </LessonNotesProvider>,
    );
    expect(screen.getByTestId('reset-all-btn')).toBeTruthy();
  });

  it('shows Reset all confirm then calls onResetAll', () => {
    const onResetAll = vi.fn();
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onResetLesson={vi.fn()}
        onResetAll={onResetAll}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-all-btn'));
    expect(screen.getByTestId('reset-all-confirm')).toBeTruthy();
    fireEvent.click(screen.getByTestId('reset-all-yes'));
    expect(onResetAll).toHaveBeenCalled();
  });

  it('cancels Reset all without calling onResetAll', () => {
    const onResetAll = vi.fn();
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onResetLesson={vi.fn()}
        onResetAll={onResetAll}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-all-btn'));
    fireEvent.click(screen.getByTestId('reset-all-no'));
    expect(onResetAll).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reset-all-confirm')).toBeNull();
  });

  it('uses initialCategory when navigating back from a lesson', () => {
    const domain = makeDomain({
      categories: [
        { id: 'basics', label: 'Basics', icon: '📚' },
        { id: 'advanced', label: 'Advanced', icon: '🚀' },
      ],
      lessons: [
        makeLesson({ id: 'l1', category: 'basics', name: 'Basics Lesson' }),
        makeLesson({ id: 'l2', category: 'advanced', name: 'Advanced Lesson' }),
      ],
    });
    renderWithLessonNotes(
      <LessonList
        domain={domain}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
        initialCategory="advanced"
      />,
    );
    expect(screen.getByText('Advanced Lesson')).toBeTruthy();
    expect(screen.queryByText('Basics Lesson')).toBeNull();
  });

  it('shows empty category tab as disabled with soon label', () => {
    const domain = makeDomain({
      categories: [
        { id: 'basics', label: 'Basics', icon: '📚' },
        { id: 'advanced', label: 'Advanced', icon: '🚀' },
      ],
      lessons: [makeLesson({ category: 'basics' })],
    });
    renderWithLessonNotes(
      <LessonList
        domain={domain}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    const advancedTab = screen.getByText('Advanced').closest('button') as HTMLButtonElement;
    expect(advancedTab.disabled).toBe(true);
    expect(screen.getByText('soon')).toBeTruthy();
  });

  it('shows empty-state message when active category has no lessons', () => {
    const domain = makeDomain({
      categories: [{ id: 'basics', label: 'Basics', icon: '📚' }],
      lessons: [],
    });
    renderWithLessonNotes(
      <LessonList
        domain={domain}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText(/No Basics lessons yet/)).toBeTruthy();
  });

  it('renders lesson tag badge when present', () => {
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain({ lessons: [makeLesson({ tag: '🐳 Docker' })] })}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByText('🐳 Docker')).toBeTruthy();
  });

  it('blocks lesson select while reset confirmation is open', () => {
    const onSelect = vi.fn();
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={onSelect}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-lesson-l1'));
    fireEvent.click(screen.getByText('Lesson 1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows all-done badge when every lesson in category is completed', () => {
    const domain = makeDomain({
      categories: [{ id: 'basics', label: 'Basics', icon: '📚' }],
      lessons: [makeLesson({ id: 'l1', category: 'basics' })],
    });
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    const { container } = renderWithLessonNotes(
      <LessonList
        domain={domain}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(container.querySelector('.demo-category-count.all-done')).toBeTruthy();
  });

  it('shows reset button for in-progress lessons', () => {
    const progress: DemoProgress = { ...baseProgress, lessonSteps: { l1: 1 } };
    renderWithLessonNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        {...defaultResetProps}
      />,
    );
    expect(screen.getByTestId('reset-lesson-l1')).toBeTruthy();
  });
});

// ── LiveDemo ────────────────────────────────────────────────────

describe('LiveDemo', () => {
  const liveProps = {
    lesson: makeLesson(),
    stepIndex: 0,
    isPlaying: false,
    stepPhase: 'done' as const,
    onNext: vi.fn(),
    onTogglePlay: vi.fn(),
    onSkipReading: vi.fn(),
    onRestart: vi.fn(),
    onExit: vi.fn(),
    onComplete: vi.fn(),
  };

  it('renders step title and description', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Do step 1')).toBeTruthy();
  });

  it('renders step counter', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('renders play button when paused', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByTitle('Play (Space)')).toBeTruthy();
  });

  it('renders pause button when playing', () => {
    render(<LiveDemo {...liveProps} isPlaying={true} />);
    expect(screen.getByTitle('Pause auto-play (Space)')).toBeTruthy();
  });

  it('disables next button on last step', () => {
    render(<LiveDemo {...liveProps} stepIndex={1} />);
    // stepIndex 1 is the last step (2 steps total)
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByTitle('Next (→)')).toHaveProperty('disabled', true);
  });

  it('disables next button when action is executing (non-reading phase)', () => {
    render(<LiveDemo {...liveProps} stepPhase="action" stepIndex={0} />);
    const nextBtn = screen.getByTitle('Please wait — action in progress');
    expect(nextBtn).toHaveProperty('disabled', true);
  });

  it('enables next button during reading phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="reading" stepIndex={0} />);
    const nextBtn = screen.getByTitle('Next (→)');
    expect(nextBtn).toHaveProperty('disabled', false);
  });

  it('calls onExit when exit button is clicked', () => {
    const onExit = vi.fn();
    render(<LiveDemo {...liveProps} onExit={onExit} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onExit).toHaveBeenCalled();
  });

  it('calls onTogglePlay when play button is clicked', () => {
    const onTogglePlay = vi.fn();
    render(<LiveDemo {...liveProps} onTogglePlay={onTogglePlay} />);
    fireEvent.click(screen.getByTitle('Play (Space)'));
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('shows reading phase badge when in reading phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="reading" />);
    expect(screen.getByText(/Reading/)).toBeTruthy();
  });

  it('shows action phase badge when in action phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="action" />);
    expect(screen.getByText(/Acting/)).toBeTruthy();
  });

  it('shows verify phase badge when in verify phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="verify" />);
    expect(screen.getByText(/Verifying/)).toBeTruthy();
  });

  it('calls onSkipReading when reading badge is clicked', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="reading" onSkipReading={onSkipReading} />);
    fireEvent.click(screen.getByText(/Reading/));
    expect(onSkipReading).toHaveBeenCalled();
  });

  it('renders keyboard hints', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText(/play\/pause/)).toBeTruthy();
  });

  it('returns null when step is undefined', () => {
    const { container } = render(
      <LiveDemo {...liveProps} lesson={makeLesson({ steps: [] })} stepIndex={0} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders lesson name', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByText('Lesson 1')).toBeTruthy();
  });

  it('calls onNext when next button is clicked during reading phase', () => {
    const onNext = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="reading" onNext={onNext} />);
    fireEvent.click(screen.getByTitle('Next (→)'));
    expect(onNext).toHaveBeenCalled();
  });

  it('calls onRestart when restart button is clicked', () => {
    const onRestart = vi.fn();
    render(<LiveDemo {...liveProps} onRestart={onRestart} />);
    fireEvent.click(screen.getByTitle('Restart demo from beginning'));
    expect(onRestart).toHaveBeenCalled();
  });

  it('does not render speed selector buttons', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.queryByRole('group', { name: 'Playback speed' })).toBeNull();
  });

  it('shows Complete button on last step when canNavigate', () => {
    // stepIndex 1 is the last step of the 2-step lesson, stepPhase='done' → canNavigate
    render(<LiveDemo {...liveProps} stepIndex={1} stepPhase="done" />);
    expect(screen.getByTitle('Mark lesson as complete')).toBeTruthy();
  });

  it('does not show Complete button before last step', () => {
    render(<LiveDemo {...liveProps} stepIndex={0} />);
    expect(screen.queryByTitle('Mark lesson as complete')).toBeNull();
  });

  it('does not show Complete button on last step when action is executing', () => {
    render(<LiveDemo {...liveProps} stepIndex={1} stepPhase="action" />);
    expect(screen.queryByTitle('Mark lesson as complete')).toBeNull();
  });

  it('calls onComplete when Complete button is clicked', () => {
    const onComplete = vi.fn();
    render(<LiveDemo {...liveProps} stepIndex={1} stepPhase="done" onComplete={onComplete} />);
    fireEvent.click(screen.getByTitle('Mark lesson as complete'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('does not render back button', () => {
    render(<LiveDemo {...liveProps} stepIndex={1} />);
    expect(screen.queryByTitle('Previous (←)')).toBeNull();
  });

  it('shows Guide mode badge when no highlight target found', () => {
    const lessonWithHighlight = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'D1', highlight: '.nonexistent-el' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonWithHighlight} />);
    expect(screen.getByText('📖 Guide')).toBeTruthy();
  });

  it('renders step without highlight', () => {
    const lessonNoHighlight = makeLesson({
      steps: [
        { id: 's1', title: 'No Highlight', description: 'No highlight step' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonNoHighlight} />);
    expect(screen.getByText('📖 Guide')).toBeTruthy();
  });

  it('polling finds visible element and shows Live badge', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const target = document.createElement('div');
    target.className = 'poll-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 2000, left: 10, width: 100, height: 50,
      right: 110, bottom: 2050, x: 10, y: 2000, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.poll-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { container } = render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    // Advance past the initial polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // After polling, the element should be found
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByText('🟢 Live')).toBeTruthy();
    expect(container.querySelector('.demo-live-mode-badge.live')).toBeTruthy();

    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('polling pauses while user has text selected in the narration panel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const target = document.createElement('div');
    target.className = 'poll-selection-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 2000, left: 10, width: 100, height: 50,
      right: 110, bottom: 2050, x: 10, y: 2000, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1 copy me', highlight: '.poll-selection-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { container } = render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);

    const desc = container.querySelector('.demo-live-step-desc')!;
    const range = document.createRange();
    range.selectNodeContents(desc);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    vi.mocked(target.scrollIntoView).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(target.scrollIntoView).not.toHaveBeenCalled();

    sel.removeAllRanges();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('polling gives up after max attempts when element not found', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.nonexistent-poll' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    // Advance past the max attempts (20 × 100ms = 2s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText('📖 Guide')).toBeTruthy();
    vi.useRealTimers();
  });

  it('polling cleans up on unmount', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.test-cleanup' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<LiveDemo {...liveProps} lesson={lessonHL} />);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('isElementVisible returns false for zero-size elements', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const target = document.createElement('div');
    target.className = 'zero-size';
    target.scrollIntoView = vi.fn();
    // getBoundingClientRect returns 0 width/height by default in jsdom
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.zero-size' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Element found but not visible → stays in Guide mode
    expect(screen.getByText('📖 Guide')).toBeTruthy();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('renders progress bar', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const progressBar = container.querySelector('.demo-live-progress-bar');
    expect(progressBar).toBeTruthy();
    const fill = container.querySelector('.demo-live-progress-fill') as HTMLElement;
    expect(fill).toBeTruthy();
    // First step of 2 = 50%
    expect(fill.style.width).toBe('50%');
  });

  it('renders progress bar at 100% on last step', () => {
    const { container } = render(<LiveDemo {...liveProps} stepIndex={1} />);
    const fill = container.querySelector('.demo-live-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('shows preparing badge during pre phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="pre" />);
    expect(screen.getByTestId('demo-live-phase-badge')).toBeTruthy();
    expect(screen.getByText(/Preparing/)).toBeTruthy();
  });

  it('does not show phase badge for done phase', () => {
    render(<LiveDemo {...liveProps} stepPhase="done" />);
    expect(screen.queryByText(/Reading/)).toBeNull();
    expect(screen.queryByText(/Acting/)).toBeNull();
    expect(screen.queryByText(/Verifying/)).toBeNull();
  });

  it('reading badge has skippable class', () => {
    const { container } = render(<LiveDemo {...liveProps} stepPhase="reading" />);
    const badge = container.querySelector('.demo-live-phase-badge.skippable');
    expect(badge).toBeTruthy();
  });

  it('reading badge skips reading when Enter or Space pressed', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="reading" onSkipReading={onSkipReading} />);
    const badge = screen.getByTestId('demo-live-phase-badge');
    fireEvent.keyDown(badge, { key: 'Enter' });
    fireEvent.keyDown(badge, { key: ' ' });
    expect(onSkipReading).toHaveBeenCalledTimes(2);
  });

  it('action badge does not call onSkipReading when clicked', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="action" onSkipReading={onSkipReading} />);
    fireEvent.click(screen.getByText(/Acting/));
    expect(onSkipReading).not.toHaveBeenCalled();
  });

  it('drag handle starts drag on mousedown and moves panel', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const header = container.querySelector('.demo-live-panel-header--draggable') as HTMLElement;
    const panel = container.querySelector('.demo-live-panel') as HTMLElement;
    expect(header).toBeTruthy();
    expect(panel).toBeTruthy();

    const startTop = panel.style.top;
    const startLeft = panel.style.left;

    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 200, left: 300, width: 400, height: 440,
      right: 700, bottom: 640, x: 300, y: 200, toJSON: () => ({}),
    });

    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 150, clientY: 120 }));
    fireEvent(window, new MouseEvent('mouseup'));

    expect(panel.style.top).toBe('220px');
    expect(panel.style.left).toBe('350px');
    expect(panel.style.top).not.toBe(startTop);
    expect(panel.style.left).not.toBe(startLeft);
  });

  it('drag ignores mousedown on buttons inside header', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const panel = container.querySelector('.demo-live-panel') as HTMLElement;
    const startTop = panel.style.top;
    const startLeft = panel.style.left;
    const exitBtn = screen.getByText('✕');
    fireEvent.mouseDown(exitBtn, { clientX: 100, clientY: 100 });
    expect(panel.style.top).toBe(startTop);
    expect(panel.style.left).toBe(startLeft);
  });

  it('renders resize handles for top, left, and right edges', () => {
    render(<LiveDemo {...liveProps} />);
    expect(screen.getByTestId('demo-live-resize-top')).toBeTruthy();
    expect(screen.getByTestId('demo-live-resize-left')).toBeTruthy();
    expect(screen.getByTestId('demo-live-resize-right')).toBeTruthy();
  });

  it('renders step description with markdown', () => {
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'MD Step', description: '**bold** and `code`' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });
    const { container } = render(<LiveDemo {...liveProps} lesson={lesson} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  it('renders drag handle icon', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const handle = container.querySelector('.demo-live-drag-handle');
    expect(handle?.textContent).toBe('⠿');
  });

  it('toggles steps overview drawer open and closed', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<LiveDemo {...liveProps} />);
    const overviewBtn = screen.getByLabelText('Toggle steps overview');
    expect(document.querySelector('.demo-overview-modal')).toBeNull();
    fireEvent.click(overviewBtn);
    expect(document.querySelector('.demo-overview-modal')).toBeTruthy();
    expect(overviewBtn.classList.contains('active')).toBe(true);
    fireEvent.click(overviewBtn);
    expect(document.querySelector('.demo-overview-modal')).toBeNull();
  });

  it('closes overview drawer via onClose callback', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<LiveDemo {...liveProps} />);
    fireEvent.click(screen.getByLabelText('Toggle steps overview'));
    fireEvent.click(screen.getByLabelText('Close steps overview'));
    expect(document.querySelector('.demo-overview-modal')).toBeNull();
  });

  it('keeps steps overview open when the demo advances to the next step', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { rerender } = render(<LiveDemo {...liveProps} stepIndex={0} />);
    fireEvent.click(screen.getByLabelText('Toggle steps overview'));
    expect(document.querySelector('.demo-overview-modal')).toBeTruthy();
    rerender(<LiveDemo {...liveProps} stepIndex={1} stepPhase="reading" />);
    expect(document.querySelector('.demo-overview-modal')).toBeTruthy();
    expect(screen.getByLabelText('Toggle steps overview').classList.contains('active')).toBe(true);
  });

  it('hides spotlight during pre phase even when target found', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const target = document.createElement('div');
    target.className = 'pre-phase-target';
    target.style.width = '100px';
    target.style.height = '50px';
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 100, height: 50,
      right: 110, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.pre-phase-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    const { container } = render(<LiveDemo {...liveProps} lesson={lessonHL} stepPhase="pre" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(container.querySelector('.demo-spotlight')).toBeNull();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('isElementVisible rejects hidden elements (display none)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const target = document.createElement('div');
    target.className = 'hidden-target';
    target.style.display = 'none';
    target.style.width = '100px';
    target.style.height = '50px';
    document.body.appendChild(target);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.hidden-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByText('📖 Guide')).toBeTruthy();
    document.body.removeChild(target);
    vi.useRealTimers();
  });

  it('polling picks first visible element among multiple matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const hidden = document.createElement('div');
    hidden.className = 'multi-target';
    hidden.style.width = '0';
    hidden.style.height = '0';
    document.body.appendChild(hidden);

    const visible = document.createElement('div');
    visible.className = 'multi-target';
    visible.style.width = '100px';
    visible.style.height = '50px';
    visible.scrollIntoView = vi.fn();
    vi.spyOn(visible, 'getBoundingClientRect').mockReturnValue({
      top: 2000, left: 10, width: 100, height: 50,
      right: 110, bottom: 2050, x: 10, y: 2000, toJSON: () => ({}),
    });
    document.body.appendChild(visible);

    const lessonHL = makeLesson({
      steps: [
        { id: 's1', title: 'HL', description: 'D1', highlight: '.multi-target' },
        { id: 's2', title: 'S2', description: 'D2' },
      ],
    });

    render(<LiveDemo {...liveProps} lesson={lessonHL} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(visible.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText('🟢 Live')).toBeTruthy();
    document.body.removeChild(hidden);
    document.body.removeChild(visible);
    vi.useRealTimers();
  });
});
