/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PrerequisiteGate from './PrerequisiteGate';

// Mock checkEndpoint so tests don't make real network calls
vi.mock('../utils/checkEndpoint', () => ({
  checkEndpoint: vi.fn(),
}));

import { checkEndpoint } from '../utils/checkEndpoint';
const mockCheck = checkEndpoint as ReturnType<typeof vi.fn>;

const DEFAULT_PROPS = {
  endpoint: 'ws://localhost:3100/socket.io/?EIO=4',
  dockerCommand: 'docker compose -f docker/websocket/socketio/docker-compose.yml up',
  onServerReady: vi.fn(),
};

describe('PrerequisiteGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheck.mockResolvedValue(false);
    DEFAULT_PROPS.onServerReady = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the docker command', async () => {
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-command').textContent).toContain('docker compose');
  });

  it('shows "down" instruction text when server is not detected', async () => {
    mockCheck.mockResolvedValue(false);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-status').textContent).toContain('not detected');
  });

  it('shows "ready" status label when server is up', async () => {
    mockCheck.mockResolvedValue(true);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-status').textContent).toContain('ready to start');
  });

  it('calls onServerReady once when server first becomes reachable', async () => {
    mockCheck.mockResolvedValue(true);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(DEFAULT_PROPS.onServerReady).toHaveBeenCalledOnce();
  });

  it('does not call onServerReady repeatedly on subsequent polls', async () => {
    mockCheck.mockResolvedValue(true);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    // Advance past multiple poll intervals
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(DEFAULT_PROPS.onServerReady).toHaveBeenCalledOnce();
  });

  it('polls again after 3 seconds', async () => {
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    const callsAfterInit = mockCheck.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3100));
    expect(mockCheck.mock.calls.length).toBeGreaterThan(callsAfterInit);
  });

  it('shows "up" status icon when server is running', async () => {
    mockCheck.mockResolvedValue(true);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--up');
  });

  it('shows "down" status when server is not reachable', async () => {
    mockCheck.mockResolvedValue(false);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--down');
  });

  // ─── Branch-coverage: lines 30, 33 ─────────────────────────────
  // Line 30: `if (!mountedRef.current) return` — TRUE when probe runs after unmount.
  // Line 33: `if (!mountedRef.current) return` — TRUE when unmount happens during checkEndpoint.

  it('probe exits early when component unmounts before checkEndpoint resolves (lines 30, 33)', async () => {
    // Make checkEndpoint take 500ms so we can unmount during the await
    let resolveCheck: (v: boolean) => void;
    mockCheck.mockImplementation(
      () => new Promise<boolean>(resolve => { resolveCheck = resolve; }),
    );

    const { unmount } = render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    // Probe is now mid-flight (awaiting checkEndpoint)
    // Unmount — mountedRef.current becomes false, interval is cleared
    act(() => unmount());

    // Resolve checkEndpoint AFTER unmount — the probe continues but hits line 33's guard
    await act(async () => {
      resolveCheck(true);
      await vi.advanceTimersByTimeAsync(50);
    });

    // onServerReady MUST NOT have been called (probe bailed out at line 33)
    expect(DEFAULT_PROPS.onServerReady).not.toHaveBeenCalled();
  });

  it('interval probe exits early via line 30 guard when component is already unmounted', async () => {
    // Fast-resolving check so initial probe completes, then unmount, then interval fires
    mockCheck.mockResolvedValue(false);
    const { unmount } = render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    // Let initial probe complete
    await act(() => vi.advanceTimersByTimeAsync(100));
    // Unmount → mountedRef.current = false, interval cleared
    act(() => unmount());

    // Even if somehow probe ran again, it would hit line 30's guard.
    // This ensures the cleanup path is exercised.
    const callCountAfterUnmount = mockCheck.mock.calls.length;
    // Advancing timers after unmount should NOT trigger more checks (interval is cleared)
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(mockCheck.mock.calls.length).toBe(callCountAfterUnmount);
  });
});
