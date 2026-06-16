/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ConceptSlide, { renderMarkdown } from './ConceptSlide';
import DomainSelector from './DomainSelector';
import DemoSpotlight from './DemoSpotlight';
import DemoHubHeader from './DemoHubHeader';
import LessonPlayer from './LessonPlayer';
import LessonList from './LessonList';
import LiveDemo from './LiveDemo';
import type { ConceptContent, DemoDomain, DemoLesson, DemoProgress } from './types';

vi.mock('./utils/checkEndpoint', () => ({
  checkEndpoint: vi.fn().mockResolvedValue(false),
}));

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

  it('sets rect to null when element not found during tracking', () => {
    const { container, rerender } = render(<DemoSpotlight selector=".missing" active={true} />);
    // Initially null → no ring
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
    // Re-render with inactive → still null
    rerender(<DemoSpotlight selector=".missing" active={false} />);
    expect(container.querySelector('.demo-spotlight-ring')).toBeNull();
  });
});

// ── DemoHubHeader ───────────────────────────────────────────────

describe('DemoHubHeader', () => {
  it('renders hub title', () => {
    render(<DemoHubHeader view="domains" domain={null} lesson={null} onBack={vi.fn()} />);
    expect(screen.getByText('🎓 Learning Hub')).toBeTruthy();
  });

  it('shows domain breadcrumb when domain is selected', () => {
    render(<DemoHubHeader view="lessons" domain={makeDomain()} lesson={null} onBack={vi.fn()} />);
    expect(screen.getByText(/Protocols/)).toBeTruthy();
  });

  it('shows lesson breadcrumb when lesson is selected', () => {
    render(<DemoHubHeader view="concept" domain={makeDomain()} lesson={makeLesson()} onBack={vi.fn()} />);
    expect(screen.getByText('Lesson 1')).toBeTruthy();
  });

  it('back button is disabled on domains view', () => {
    render(<DemoHubHeader view="domains" domain={null} lesson={null} onBack={vi.fn()} />);
    const btn = screen.getByText('🎓 Learning Hub');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('calls onBack from lessons view', () => {
    const onBack = vi.fn();
    render(<DemoHubHeader view="lessons" domain={makeDomain()} lesson={null} onBack={onBack} />);
    fireEvent.click(screen.getByText('🎓 Learning Hub'));
    expect(onBack).toHaveBeenCalled();
  });
});

// ── LessonPlayer ────────────────────────────────────────────────

describe('LessonPlayer', () => {
  it('renders concept slide and step list', () => {
    render(
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
    render(
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
    render(
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
    render(
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

  it('renders PrerequisiteGate when dockerEndpoint is set', () => {
    render(
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
    render(
      <LessonPlayer
        lesson={makeLesson()}
        onStartDemo={vi.fn()}
      />,
    );
    expect(document.querySelector('.prereq-gate')).toBeNull();
  });

  it('enables start button when docker gate becomes ready', async () => {
    vi.useFakeTimers();
    const { checkEndpoint } = await import('./utils/checkEndpoint');
    (checkEndpoint as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false).mockResolvedValue(true);

    const onStart = vi.fn();
    render(
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
});

// ── LessonList ──────────────────────────────────────────────────

describe('LessonList', () => {
  it('renders lesson items', () => {
    render(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Lesson 1')).toBeTruthy();
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('shows completed status', () => {
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    render(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Restart')).toBeTruthy();
    // Lesson number should still be visible even when completed
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows Resume badge for in-progress lessons', () => {
    const progress: DemoProgress = { ...baseProgress, lessonSteps: { l1: 2 } };
    render(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Resume')).toBeTruthy();
  });

  it('calls onSelect when lesson clicked', () => {
    const onSelect = vi.fn();
    render(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={onSelect}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Lesson 1'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={onBack}
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
    render(
      <LessonList
        domain={domain}
        progress={baseProgress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
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
    expect(screen.getByTitle('Pause (Space)')).toBeTruthy();
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
      top: 10, left: 10, width: 100, height: 50,
      right: 110, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
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
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText('🟢 Live')).toBeTruthy();
    expect(container.querySelector('.demo-live-mode-badge.live')).toBeTruthy();

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

  it('action badge does not call onSkipReading when clicked', () => {
    const onSkipReading = vi.fn();
    render(<LiveDemo {...liveProps} stepPhase="action" onSkipReading={onSkipReading} />);
    fireEvent.click(screen.getByText(/Acting/));
    expect(onSkipReading).not.toHaveBeenCalled();
  });

  it('drag handle starts drag on mousedown and moves panel', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const header = container.querySelector('.demo-live-panel-header--draggable') as HTMLElement;
    expect(header).toBeTruthy();

    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 150, clientY: 120 }));
    fireEvent(window, new MouseEvent('mouseup'));

    const panel = container.querySelector('.demo-live-panel') as HTMLElement;
    expect(panel).toBeTruthy();
  });

  it('drag ignores mousedown on buttons inside header', () => {
    const { container } = render(<LiveDemo {...liveProps} />);
    const exitBtn = screen.getByText('✕');
    fireEvent.mouseDown(exitBtn, { clientX: 100, clientY: 100 });
    const panel = container.querySelector('.demo-live-panel') as HTMLElement;
    expect(panel.style.top).toBe('');
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
});
