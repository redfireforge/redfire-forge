/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import AppLiveDemoOverlay from './AppLiveDemoOverlay';

let capturedProps: Record<string, unknown> = {};

vi.mock('@redfireforge/demo-hub/LiveDemo', () => ({
  default: (props: Record<string, unknown>) => {
    capturedProps = props;
    return (
      <div data-testid="live-demo" data-lesson={String((props.lesson as { id: string }).id)}>
        <button type="button" data-testid="trigger-exit" onClick={() => (props.onExit as () => void)()}>
          Exit
        </button>
        <button type="button" data-testid="trigger-complete" onClick={() => (props.onComplete as () => void)()}>
          Complete
        </button>
      </div>
    );
  },
}));

function makeDemoHub(overrides: Record<string, unknown> = {}) {
  return {
    state: { view: 'live', selectedLesson: { id: 'gql-first-query', name: 'First Query' }, stepIndex: 0, isPlaying: false },
    stepPhase: 'reading',
    isDemoBootstrapping: false,
    nextStep: vi.fn(),
    toggleAutoPlay: vi.fn(),
    skipReading: vi.fn(),
    restartDemo: vi.fn(),
    exitLiveDemo: vi.fn(async () => {}),
    confirmLessonComplete: vi.fn(),
    suppressLiveTabExitRef: { current: false },
    ...overrides,
  } as never;
}

describe('AppLiveDemoOverlay', () => {
  it('renders nothing when not in live view', () => {
    const { container } = render(
      <AppLiveDemoOverlay demoHub={makeDemoHub({ state: { view: 'domains' } })} navigateToTab={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing in live view without selectedLesson', () => {
    const { container } = render(
      <AppLiveDemoOverlay
        demoHub={makeDemoHub({ state: { view: 'live', selectedLesson: null, stepIndex: 0, isPlaying: false } })}
        navigateToTab={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders LiveDemo when in live view with a lesson', () => {
    render(<AppLiveDemoOverlay demoHub={makeDemoHub()} navigateToTab={vi.fn()} />);
    expect(screen.getByTestId('live-demo')).toHaveAttribute('data-lesson', 'gql-first-query');
  });

  it('keeps LiveDemo mounted during boot (no concept-cover / Preparing screen)', () => {
    render(
      <AppLiveDemoOverlay
        demoHub={makeDemoHub({ isDemoBootstrapping: true, stepPhase: 'pre' })}
        navigateToTab={vi.fn()}
      />,
    );
    expect(screen.getByTestId('live-demo')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-content-veil')).toBeNull();
    expect(screen.queryByTestId('demo-boot-concept-cover')).toBeNull();
  });

  it('onExit exits live mode before pinning demo-hub, then pins again after cleanup', async () => {
    const navigateToTab = vi.fn();
    const exitLiveDemo = vi.fn(async () => {});
    const suppressLiveTabExitRef = { current: false };
    render(
      <AppLiveDemoOverlay
        demoHub={makeDemoHub({ exitLiveDemo, suppressLiveTabExitRef })}
        navigateToTab={navigateToTab}
      />,
    );
    await userEvent.click(screen.getByTestId('trigger-exit'));
    expect(suppressLiveTabExitRef.current).toBe(true);
    expect(exitLiveDemo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(navigateToTab).toHaveBeenCalledTimes(2));
    expect(navigateToTab).toHaveBeenCalledWith('demo-hub');
    expect(exitLiveDemo.mock.invocationCallOrder[0]).toBeLessThan(navigateToTab.mock.invocationCallOrder[0]);
  });

  it('onComplete calls confirmLessonComplete and pins demo-hub before/after exit', async () => {
    const navigateToTab = vi.fn();
    const exitLiveDemo = vi.fn(async () => {});
    const confirmLessonComplete = vi.fn();
    render(
      <AppLiveDemoOverlay
        demoHub={makeDemoHub({ exitLiveDemo, confirmLessonComplete })}
        navigateToTab={navigateToTab}
      />,
    );
    await userEvent.click(screen.getByTestId('trigger-complete'));
    expect(confirmLessonComplete).toHaveBeenCalledTimes(1);
    expect(exitLiveDemo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(navigateToTab).toHaveBeenCalledTimes(2));
    expect(navigateToTab).toHaveBeenCalledWith('demo-hub');
  });

  it('passes lesson playback props to LiveDemo', () => {
    const demoHub = makeDemoHub({
      state: { view: 'live', selectedLesson: { id: 'gql-vars' }, stepIndex: 2, isPlaying: true },
      stepPhase: 'action',
    });
    render(<AppLiveDemoOverlay demoHub={demoHub} navigateToTab={vi.fn()} />);
    expect(capturedProps.lesson).toEqual({ id: 'gql-vars' });
    expect(capturedProps.stepIndex).toBe(2);
    expect(capturedProps.isPlaying).toBe(true);
    expect(capturedProps.stepPhase).toBe('action');
    expect(capturedProps.onNext).toBe(demoHub.nextStep);
    expect(capturedProps.onTogglePlay).toBe(demoHub.toggleAutoPlay);
    expect(capturedProps.onSkipReading).toBe(demoHub.skipReading);
    expect(capturedProps.onRestart).toBe(demoHub.restartDemo);
  });
});
