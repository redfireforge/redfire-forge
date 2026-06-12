// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RustExecutorTestPanel from './RustExecutorTestPanel';
import type {
  RustExecutionPlan,
  RustProgressBatch,
  RustCompletionSummary,
} from '../utils/rustBridge';

const h = vi.hoisted(() => ({
  isRustExecutorAvailable: vi.fn(),
  resetAvailabilityCache: vi.fn(),
  startRustLoadTest: vi.fn(),
  abortRustLoadTest: vi.fn(),
}));

vi.mock('../utils/rustBridge', () => ({
  isRustExecutorAvailable: h.isRustExecutorAvailable,
  resetAvailabilityCache: h.resetAvailabilityCache,
  startRustLoadTest: h.startRustLoadTest,
  abortRustLoadTest: h.abortRustLoadTest,
}));

type StartArgs = [
  RustExecutionPlan,
  (b: RustProgressBatch) => void,
  (s: RustCompletionSummary) => void,
  ((err: unknown) => void)?,
];

function makeBatch(overrides: Partial<RustProgressBatch> = {}): RustProgressBatch {
  return {
    completed: 1,
    total: 3,
    results: [{}] as RustProgressBatch['results'],
    elapsedMs: 5,
    currentInFlight: 1,
    targetConcurrency: 1,
    breakerTripped: false,
    ...overrides,
  };
}

// Mutable clock the spy returns; tests can manipulate it via the abort mock.
const clock = { now: 0 };

/** Drive the async test runner to completion under fake timers. */
async function runToCompletion() {
  fireEvent.click(screen.getByRole('button', { name: /Run All Tests/i }));
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

describe('RustExecutorTestPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clock.now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
    // jsdom lacks scrollTo on elements; the panel calls it inside setTimeout.
    (HTMLElement.prototype as unknown as { scrollTo: () => void }).scrollTo = vi.fn();

    h.isRustExecutorAvailable.mockReset().mockResolvedValue(true);
    h.resetAvailabilityCache.mockReset();
    h.abortRustLoadTest.mockReset().mockResolvedValue(undefined);

    // Default: every execution reports one result and trips the breaker on stop-first plans.
    h.startRustLoadTest.mockReset().mockImplementation(
      async (...args: StartArgs) => {
        const [plan, onProgress, onComplete] = args;
        const stopFirst =
          'circuitBreaker' in plan && plan.circuitBreaker.policy === 'stop-first';
        onProgress(makeBatch({ breakerTripped: stopFirst }));
        onComplete({
          totalResults: stopFirst ? 1 : 3,
          durationMs: 10,
          breakerTripped: stopFirst,
        });
        return { unlisten: vi.fn() };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the initial pending state', () => {
    render(<RustExecutorTestPanel />);
    expect(screen.getByText('Rust Executor Integration Tests')).toBeInTheDocument();
    expect(screen.getByText('Phase 2B')).toBeInTheDocument();
    expect(screen.getByText('Click "Run All Tests" to begin.')).toBeInTheDocument();
    // all six tests pending
    expect(screen.getAllByText('PENDING')).toHaveLength(6);
    expect(screen.getByText('Availability Check')).toBeInTheDocument();
    expect(screen.getByText('Circuit Breaker')).toBeInTheDocument();
  });

  it('shows the running state while availability is pending', async () => {
    // Availability never resolves -> stays running.
    h.isRustExecutorAvailable.mockReturnValue(new Promise(() => {}));
    render(<RustExecutorTestPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Run All Tests/i }));
    // flush the synchronous state updates before the first await
    await act(async () => {});

    expect(screen.getByRole('button', { name: /Running\.\.\./i })).toBeDisabled();
    // Test 1 shows RUNNING
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('runs all six tests to success', async () => {
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    expect(screen.getAllByText('PASS')).toHaveLength(6);
    expect(screen.getByText('6 passed')).toBeInTheDocument();
    expect(screen.getByText(/All tests completed\./)).toBeInTheDocument();
    expect(h.resetAvailabilityCache).toHaveBeenCalled();
    // each non-availability test calls startRustLoadTest -> 5 invocations
    expect(h.startRustLoadTest).toHaveBeenCalledTimes(5);
    expect(h.abortRustLoadTest).toHaveBeenCalledTimes(1);
    // button is re-enabled
    expect(screen.getByRole('button', { name: /Run All Tests/i })).not.toBeDisabled();
  });

  it('fails availability and aborts the remaining tests when Rust is not available', async () => {
    h.isRustExecutorAvailable.mockResolvedValue(false);
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getByText('Not available (not running in Tauri?)')).toBeInTheDocument();
    expect(screen.getByText(/Aborting remaining tests/)).toBeInTheDocument();
    // execution tests were never started
    expect(h.startRustLoadTest).not.toHaveBeenCalled();
    // remaining five stay pending
    expect(screen.getAllByText('PENDING')).toHaveLength(5);
  });

  it('fails availability when the check throws', async () => {
    h.isRustExecutorAvailable.mockRejectedValue(new Error('ipc down'));
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getAllByText(/ipc down/).length).toBeGreaterThanOrEqual(1);
    expect(h.startRustLoadTest).not.toHaveBeenCalled();
  });

  it('marks execution tests as failed when no results are returned', async () => {
    h.startRustLoadTest.mockImplementation(async (...args: StartArgs) => {
      const [, onProgress, onComplete] = args;
      onProgress(makeBatch({ results: [] }));
      // breaker never trips -> circuit-breaker test also fails
      onComplete({ totalResults: 0, durationMs: 5, breakerTripped: false });
      return { unlisten: vi.fn() };
    });
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    // Pool, Sequential, Load Profile fail (no results); Abort passes; Breaker fails.
    expect(screen.getByText(/failed/)).toBeInTheDocument();
    expect(screen.getAllByText('FAIL').length).toBeGreaterThanOrEqual(4);
    // breaker "did not trip" detail
    expect(screen.getByText(/Breaker did not trip/)).toBeInTheDocument();
  });

  it('handles the onError callback during execution', async () => {
    h.startRustLoadTest.mockImplementation(async (...args: StartArgs) => {
      const [, , , onError] = args;
      if (onError) onError(new Error('exec failed'));
      return { unlisten: vi.fn() };
    });
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    // error appears in the log for the execution tests
    expect(screen.getByText(/\[error\] Error: exec failed/)).toBeInTheDocument();
    expect(screen.getAllByText('FAIL').length).toBeGreaterThanOrEqual(1);
  });

  it('catches synchronous failures from startRustLoadTest', async () => {
    h.startRustLoadTest.mockImplementation(() => {
      throw new Error('sync boom');
    });
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    // catch branches surface the error string in the FAIL details
    expect(screen.getAllByText(/sync boom/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('FAIL').length).toBeGreaterThanOrEqual(1);
  });

  it('marks the abort test failed when abort takes too long', async () => {
    // Advance the clock past the 55s threshold when abort is invoked.
    h.abortRustLoadTest.mockImplementation(async () => {
      clock.now += 60000;
    });
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    expect(screen.getByText(/Abort took too long/)).toBeInTheDocument();
  });

  it('marks the circuit breaker failed when it never trips but reports via summary', async () => {
    h.startRustLoadTest.mockImplementation(async (...args: StartArgs) => {
      const [plan, onProgress, onComplete] = args;
      const stopFirst =
        'circuitBreaker' in plan && plan.circuitBreaker.policy === 'stop-first';
      // For the breaker plan: progress does NOT trip, and summary does NOT trip.
      onProgress(makeBatch({ breakerTripped: false }));
      onComplete({
        totalResults: stopFirst ? 2 : 3,
        durationMs: 10,
        breakerTripped: false,
      });
      return { unlisten: vi.fn() };
    });
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    expect(screen.getByText(/Breaker did not trip\. 2 result/)).toBeInTheDocument();
  });

  it('passes the circuit breaker when only the completion summary reports a trip', async () => {
    h.startRustLoadTest.mockImplementation(async (...args: StartArgs) => {
      const [plan, onProgress, onComplete] = args;
      const stopFirst =
        'circuitBreaker' in plan && plan.circuitBreaker.policy === 'stop-first';
      onProgress(makeBatch({ breakerTripped: false }));
      onComplete({
        totalResults: stopFirst ? 4 : 3,
        durationMs: 10,
        breakerTripped: stopFirst,
      });
      return { unlisten: vi.fn() };
    });
    render(<RustExecutorTestPanel />);
    await runToCompletion();

    expect(screen.getByText(/Breaker tripped after 4 result/)).toBeInTheDocument();
  });
});
