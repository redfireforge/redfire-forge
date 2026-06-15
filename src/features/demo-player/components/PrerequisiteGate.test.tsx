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
});
