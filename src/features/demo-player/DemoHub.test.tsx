/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DemoHub from './DemoHub';
import type { useDemoHub } from './useDemoHub';
import type { DemoDomain, DemoLesson, DemoProgress } from './types';

// Mock child components to isolate DemoHub rendering logic
vi.mock('./DemoHubHeader', () => ({
  default: ({ view, onBack }: { view: string; onBack: () => void }) => (
    <div data-testid="hub-header" data-view={view}>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));
vi.mock('./DomainSelector', () => ({
  default: ({ onSelect, domains }: { onSelect: (d: DemoDomain) => void; domains: DemoDomain[] }) => (
    <div data-testid="domain-selector">
      {domains.map(d => (
        <button key={d.id} onClick={() => onSelect(d)}>{d.name}</button>
      ))}
    </div>
  ),
}));
vi.mock('./LessonList', () => ({
  default: ({ onSelect, domain, onBack }: { onSelect: (l: DemoLesson) => void; domain: DemoDomain; onBack: () => void }) => (
    <div data-testid="lesson-list">
      <span>{domain.name}</span>
      {domain.lessons.map(l => (
        <button key={l.id} onClick={() => onSelect(l)}>{l.name}</button>
      ))}
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));
vi.mock('./LessonPlayer', () => ({
  default: ({ lesson, onStartDemo }: {
    lesson: DemoLesson; onStartDemo: () => void;
  }) => (
    <div data-testid="lesson-player">
      <span>{lesson.name}</span>
      <button onClick={onStartDemo}>Start</button>
    </div>
  ),
}));

function makeDomain(overrides: Partial<DemoDomain> = {}): DemoDomain {
  return {
    id: 'protocols',
    name: 'Protocols',
    icon: '🔌',
    description: 'Test',
    available: true,
    lessons: [],
    ...overrides,
  };
}

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'l1',
    domainId: 'protocols',
    name: 'Lesson 1',
    description: 'desc',
    estimatedMinutes: 3,
    concept: { title: 'T', body: 'B' },
    steps: [{ id: 's1', title: 'S1', description: 'D1' }],
    ...overrides,
  };
}

const baseProgress: DemoProgress = {
  completedLessons: [],
  lessonSteps: {},
  speed: 1,
};

function makeHub(overrides: Partial<ReturnType<typeof useDemoHub>> = {}): ReturnType<typeof useDemoHub> {
  return {
    state: {
      view: 'domains',
      selectedDomain: null,
      selectedLesson: null,
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
    },
    hubOpen: true,
    hubVisible: true,
    stepPhase: 'done',
    progress: baseProgress,
    openHub: vi.fn(),
    closeHub: vi.fn(),
    selectDomain: vi.fn(),
    selectLesson: vi.fn(),
    goBack: vi.fn(),
    startLiveDemo: vi.fn(),
    exitLiveDemo: vi.fn(),
    goToStep: vi.fn(),
    nextStep: vi.fn(),
    toggleAutoPlay: vi.fn(),
    restartDemo: vi.fn(),
    skipReading: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useDemoHub>;
}

describe('DemoHub', () => {
  it('renders DomainSelector when view is domains', () => {
    render(<DemoHub hub={makeHub()} />);
    expect(screen.getByTestId('domain-selector')).toBeTruthy();
    expect(screen.queryByTestId('lesson-list')).toBeNull();
    expect(screen.queryByTestId('lesson-player')).toBeNull();
  });

  it('renders LessonList when view is lessons with domain selected', () => {
    const domain = makeDomain();
    const hub = makeHub({
      state: { view: 'lessons', selectedDomain: domain, selectedLesson: null, stepIndex: 0, isPlaying: false, speed: 1 },
    });
    render(<DemoHub hub={hub} />);
    expect(screen.getByTestId('lesson-list')).toBeTruthy();
    expect(screen.queryByTestId('domain-selector')).toBeNull();
    expect(screen.queryByTestId('lesson-player')).toBeNull();
  });

  it('renders LessonPlayer when view is concept with lesson selected', () => {
    const domain = makeDomain();
    const lesson = makeLesson();
    const hub = makeHub({
      state: { view: 'concept', selectedDomain: domain, selectedLesson: lesson, stepIndex: 0, isPlaying: false, speed: 1 },
    });
    render(<DemoHub hub={hub} />);
    expect(screen.getByTestId('lesson-player')).toBeTruthy();
    expect(screen.queryByTestId('domain-selector')).toBeNull();
    expect(screen.queryByTestId('lesson-list')).toBeNull();
  });

  it('does not render LessonList when view is lessons but no domain selected', () => {
    const hub = makeHub({
      state: { view: 'lessons', selectedDomain: null, selectedLesson: null, stepIndex: 0, isPlaying: false, speed: 1 },
    });
    render(<DemoHub hub={hub} />);
    expect(screen.queryByTestId('lesson-list')).toBeNull();
  });

  it('does not render LessonPlayer when view is concept but no lesson selected', () => {
    const hub = makeHub({
      state: { view: 'concept', selectedDomain: makeDomain(), selectedLesson: null, stepIndex: 0, isPlaying: false, speed: 1 },
    });
    render(<DemoHub hub={hub} />);
    expect(screen.queryByTestId('lesson-player')).toBeNull();
  });

  it('passes view and goBack to DemoHubHeader', () => {
    const hub = makeHub();
    render(<DemoHub hub={hub} />);
    const header = screen.getByTestId('hub-header');
    expect(header.getAttribute('data-view')).toBe('domains');
  });

  it('renders nothing extra for live view', () => {
    const hub = makeHub({
      state: { view: 'live', selectedDomain: null, selectedLesson: null, stepIndex: 0, isPlaying: true, speed: 1 },
    });
    render(<DemoHub hub={hub} />);
    expect(screen.queryByTestId('domain-selector')).toBeNull();
    expect(screen.queryByTestId('lesson-list')).toBeNull();
    expect(screen.queryByTestId('lesson-player')).toBeNull();
  });

  it('renders hub container with correct class', () => {
    const { container } = render(<DemoHub hub={makeHub()} />);
    expect(container.querySelector('.demo-hub')).toBeTruthy();
  });
});
