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

vi.mock('../adapters', () => ({
  MAX_TABS: 8,
  countUserTabsInStorage: vi.fn(async () => 0),
  userTabsToCloseForLesson: (userCount: number, budget = 1) =>
    Math.max(0, userCount - (8 - budget)),
}));

import { checkEndpoint } from '../utils/checkEndpoint';
import { countUserTabsInStorage } from '../adapters';
const mockCheck = checkEndpoint as ReturnType<typeof vi.fn>;
const mockCountUserTabs = vi.mocked(countUserTabsInStorage);

const DEFAULT_PROPS = {
  endpoint: 'ws://localhost:3100/socket.io/?EIO=4',
  dockerCommand: 'docker compose -f docker/websocket/socketio/docker-compose.yml up',
  onServerReady: vi.fn(),
};

describe('PrerequisiteGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheck.mockResolvedValue(false);
    mockCountUserTabs.mockResolvedValue(0);
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

  it('requires every endpoint in endpoints[] to be up before unlocking', async () => {
    mockCheck.mockImplementation(async (url: string) => url.includes('4444'));
    const onServerReady = vi.fn();
    render(
      <PrerequisiteGate
        endpoints={['http://127.0.0.1:4444/health', 'http://127.0.0.1:4446/health']}
        dockerCommand="docker compose up"
        onServerReady={onServerReady}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(onServerReady).not.toHaveBeenCalled();
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--down');

    mockCheck.mockResolvedValue(true);
    await act(() => vi.advanceTimersByTimeAsync(3100));
    expect(onServerReady).toHaveBeenCalledOnce();
  });

  it('shows tab capacity warning when user has too many tabs for tabBudget 2', async () => {
    mockCheck.mockResolvedValue(true);
    mockCountUserTabs.mockResolvedValue(7);
    const onTabCapacityReady = vi.fn();
    render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={onTabCapacityReady}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('prereq-tab-capacity').textContent).toContain('Close at least');
    expect(onTabCapacityReady).not.toHaveBeenCalled();
  });

  it('calls onTabCapacityReady when enough tab slots are free', async () => {
    mockCheck.mockResolvedValue(true);
    mockCountUserTabs.mockResolvedValue(6);
    const onTabCapacityReady = vi.fn();
    render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={onTabCapacityReady}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    });
    expect(onTabCapacityReady).toHaveBeenCalledOnce();
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

  it('shows tab capacity ok banner when budget > 1 and enough slots are free', async () => {
    mockCheck.mockResolvedValue(true);
    mockCountUserTabs.mockResolvedValue(4);
    const onTabCapacityReady = vi.fn();
    render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={onTabCapacityReady}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    });
    expect(screen.getByTestId('prereq-tab-capacity-ok').textContent).toContain(
      'Enough tab slots available',
    );
    expect(onTabCapacityReady).toHaveBeenCalledOnce();
  });

  it('uses singular tab wording when exactly one tab must be closed', async () => {
    mockCheck.mockResolvedValue(true);
    mockCountUserTabs.mockResolvedValue(7);
    render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const text = screen.getByTestId('prereq-tab-capacity').textContent ?? '';
    expect(text).toContain('2 workspace tab slots');
    expect(text).toContain('Close at least');
    expect(text).toContain('1');
    expect(text).not.toMatch(/Close at least 1 tabs/);
  });

  it('uses plural tabs wording when multiple tabs must be closed', async () => {
    mockCheck.mockResolvedValue(true);
    mockCountUserTabs.mockResolvedValue(8);
    render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const text = screen.getByTestId('prereq-tab-capacity').textContent ?? '';
    expect(text).toContain('2 workspace tab slots');
    expect(text).toMatch(/Close at least[\s\S]*2[\s\S]*tabs/);
  });

  it('does not call onTabCapacityReady repeatedly on subsequent polls', async () => {
    mockCheck.mockResolvedValue(true);
    mockCountUserTabs.mockResolvedValue(4);
    const onTabCapacityReady = vi.fn();
    render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={onTabCapacityReady}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(onTabCapacityReady).toHaveBeenCalledOnce();
  });

  it('checkTabCapacity exits early when component unmounts during count', async () => {
    let resolveCount: (value: number) => void;
    mockCountUserTabs.mockImplementation(
      () => new Promise<number>((resolve) => { resolveCount = resolve; }),
    );
    const onTabCapacityReady = vi.fn();
    const { unmount } = render(
      <PrerequisiteGate
        {...DEFAULT_PROPS}
        tabBudget={2}
        onTabCapacityReady={onTabCapacityReady}
      />,
    );
    act(() => unmount());
    await act(async () => {
      resolveCount(4);
      await Promise.resolve();
    });
    expect(onTabCapacityReady).not.toHaveBeenCalled();
  });

  it('shows checking spinner while probe is in checking state', async () => {
    let resolveCheck: (v: boolean) => void;
    mockCheck.mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveCheck = resolve; }),
    );
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText('Checking server…')).toBeInTheDocument();
    await act(async () => {
      resolveCheck(false);
      await Promise.resolve();
    });
  });

  it('does not flash back to checking on subsequent polls while server stays down', async () => {
    // First probe settles to down, then a follow-up poll is held in-flight so we
    // can assert the UI stays on "down" (no ✗ → ⏳ → ✗ flicker every 3s).
    let resolveSecond: (v: boolean) => void;
    let call = 0;
    mockCheck.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          call += 1;
          if (call === 1) resolve(false);
          else resolveSecond = resolve;
        }),
    );
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--down');

    await act(() => vi.advanceTimersByTimeAsync(3100));
    // Second probe is in-flight — status must still show down, not checking.
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--down');
    expect(screen.queryByLabelText('Checking server…')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond(false);
      await Promise.resolve();
    });
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--down');
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

  it('renders a per-service breakdown with derived labels for multi-endpoint gates', async () => {
    // Docker echo (50052) down, Express proxy (3001) up
    mockCheck.mockImplementation(async (url: string) => url.includes('3001'));
    render(
      <PrerequisiteGate
        endpoints={['http://localhost:50052/health', 'http://localhost:3001/health']}
        dockerCommand="npm run dev:grpc"
        onServerReady={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));

    const rows = screen.getAllByTestId('prereq-service');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Docker echo');
    expect(rows[0].textContent).toContain('localhost:50052');
    expect(rows[0].textContent).toContain('not detected');
    expect(rows[0].className).toContain('prereq-service--down');
    expect(rows[1].textContent).toContain('Express proxy');
    expect(rows[1].className).toContain('prereq-service--up');
  });

  it('reports unreachable service labels via onProbeStatusChange', async () => {
    mockCheck.mockImplementation(async (url: string) => url.includes('3001'));
    const onProbeStatusChange = vi.fn();
    render(
      <PrerequisiteGate
        endpoints={['http://localhost:50052/health', 'http://localhost:3001/health']}
        dockerCommand="npm run dev:grpc"
        onServerReady={vi.fn()}
        onProbeStatusChange={onProbeStatusChange}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(onProbeStatusChange).toHaveBeenCalledWith(['Docker echo']);

    mockCheck.mockResolvedValue(true);
    await act(() => vi.advanceTimersByTimeAsync(3100));
    expect(onProbeStatusChange).toHaveBeenLastCalledWith([]);
  });

  it('prefers explicit endpointLabels over derived names', async () => {
    mockCheck.mockResolvedValue(false);
    render(
      <PrerequisiteGate
        endpoints={['http://localhost:9001/health', 'http://localhost:9002/health']}
        endpointLabels={['Primary', 'Replica']}
        dockerCommand="docker compose up"
        onServerReady={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    const rows = screen.getAllByTestId('prereq-service');
    expect(rows[0].textContent).toContain('Primary');
    expect(rows[1].textContent).toContain('Replica');
  });

  it('omits the per-service breakdown for single-endpoint gates', async () => {
    mockCheck.mockResolvedValue(false);
    render(<PrerequisiteGate {...DEFAULT_PROPS} />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId('prereq-service-list')).toBeNull();
  });

  it('initiallyCleared seeds per-service rows as up (not stuck on checking…)', async () => {
    mockCheck.mockResolvedValue(true);
    render(
      <PrerequisiteGate
        endpoints={['http://127.0.0.1:4444/health', 'http://127.0.0.1:4446/health']}
        dockerCommand="docker compose up"
        onServerReady={vi.fn()}
        initiallyCleared
      />,
    );
    expect(screen.getByTestId('prereq-status').textContent).toContain('Server detected');
    const rows = screen.getAllByTestId('prereq-service');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.textContent).toContain('reachable');
      expect(row.textContent).not.toContain('checking');
    }
    await act(() => vi.advanceTimersByTimeAsync(100));
    for (const row of screen.getAllByTestId('prereq-service')) {
      expect(row.textContent).toContain('reachable');
    }
  });

  it('initiallyCleared re-verify updates service rows when a probe is down', async () => {
    mockCheck.mockImplementation(async (url: string) => url.includes('4444'));
    render(
      <PrerequisiteGate
        endpoints={['http://127.0.0.1:4444/health', 'http://127.0.0.1:4446/health']}
        dockerCommand="docker compose up"
        onServerReady={vi.fn()}
        initiallyCleared
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId('prereq-status').className).toContain('prereq-status--down');
    const rows = screen.getAllByTestId('prereq-service');
    expect(rows[0].textContent).toContain('reachable');
    expect(rows[1].textContent).toContain('not detected');
  });
});
