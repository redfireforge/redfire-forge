/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ApiMockDiagnosticsPanel } from './ApiMockDiagnosticsPanel';

const SAMPLE = {
  generation: 4, routeCount: 2, predicateCount: 3, openConnections: 1, inFlight: 0,
  matchDuration: { lastMs: 2, p95Ms: 5, count: 9 },
  outcomes: { matched: 7, unmatched: 2, ambiguous: 0, fault: 0, error: 0, proxied: 0 },
  journal: { drops: 3, truncations: 1, size: 8, maxEntries: 50 },
  templateErrors: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ApiMockDiagnosticsPanel', () => {
  it('shows empty, error, and populated counter states', async () => {
    render(<ApiMockDiagnosticsPanel />);
    expect(screen.getByTestId('api-mock-diagnostics-empty')).toBeTruthy();

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 404, json: async () => ({ ok: false, error: { message: 'missing' } }),
    })));
    render(<ApiMockDiagnosticsPanel serverId="srv-1" running />);
    await waitFor(() => expect(screen.getByTestId('api-mock-diagnostics-error')).toBeTruthy());
  });

  it('renders generation and journal drop counters', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, data: SAMPLE }),
    })));
    const { unmount } = render(<ApiMockDiagnosticsPanel serverId="srv-1" running />);
    await waitFor(() => expect(screen.getByTestId('api-mock-diag-generation').textContent).toBe('4'));
    expect(screen.getByTestId('api-mock-diag-drops').textContent).toBe('3');
    expect(screen.getByTestId('api-mock-diag-outcomes').textContent).toMatch(/matched.*7/);
    unmount();
  });

  it('keeps last counters when a later poll fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          ok: true,
          data: {
            generation: 1, routeCount: 1, predicateCount: 0, openConnections: 0, inFlight: 0,
            matchDuration: { lastMs: 0, p95Ms: 0, count: 0 },
            outcomes: { matched: 0, unmatched: 0, ambiguous: 0, fault: 0, error: 0, proxied: 0 },
            journal: { drops: 0, truncations: 0, size: 0, maxEntries: 10 },
            templateErrors: 0,
          },
        }),
      })
      .mockResolvedValue({
        ok: false, status: 500,
        json: async () => ({ ok: false, error: { message: 'down' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<ApiMockDiagnosticsPanel serverId="srv-1" running />);
    await waitFor(() => expect(screen.getByTestId('api-mock-diag-generation').textContent).toBe('1'));
  });

  it('ignores a late response after unmount', async () => {
    let finish: (value: unknown) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const { unmount } = render(<ApiMockDiagnosticsPanel serverId="srv-1" running />);
    expect(screen.getByTestId('api-mock-diagnostics-loading')).toBeTruthy();
    unmount();
    finish({
      ok: true, status: 200,
      json: async () => ({
        ok: true,
        data: {
          generation: 9, routeCount: 0, predicateCount: 0, openConnections: 0, inFlight: 0,
          matchDuration: { lastMs: 0, p95Ms: 0, count: 0 },
          outcomes: { matched: 0, unmatched: 0, ambiguous: 0, fault: 0, error: 0, proxied: 0 },
          journal: { drops: 0, truncations: 0, size: 0, maxEntries: 10 },
          templateErrors: 0,
        },
      }),
    });
    await Promise.resolve();
  });

  it('polls diagnostics again on the interval', async () => {
    const ticks: Array<() => void> = [];
    vi.spyOn(window, 'setInterval').mockImplementation((fn: TimerHandler) => {
      ticks.push(fn as () => void);
      return 11 as unknown as number;
    });
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, data: SAMPLE }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<ApiMockDiagnosticsPanel serverId="srv-1" running />);
    await waitFor(() => expect(screen.getByTestId('api-mock-diag-generation').textContent).toBe('4'));
    await act(async () => { ticks[0](); });
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it('clears counters when switching servers so the previous snapshot cannot leak', async () => {
    vi.spyOn(window, 'setInterval').mockImplementation(() => 11 as unknown as number);
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ ok: true, data: SAMPLE }),
      })
      .mockImplementation(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<ApiMockDiagnosticsPanel serverId="srv-1" running />);
    await waitFor(() => expect(screen.getByTestId('api-mock-diag-generation').textContent).toBe('4'));
    rerender(<ApiMockDiagnosticsPanel serverId="srv-2" running />);
    expect(screen.getByTestId('api-mock-diagnostics-loading')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-diag-generation')).toBeNull();
  });

  it('fetches once when the listener is stopped and does not poll', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, data: SAMPLE }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ApiMockDiagnosticsPanel serverId="srv-1" running={false} />);
    await waitFor(() => expect(screen.getByTestId('api-mock-diag-generation').textContent).toBe('4'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders fallback outcome colors, warning counters, and a zero-capacity journal', async () => {
    const data = {
      ...SAMPLE,
      openConnections: 2,
      inFlight: 1,
      templateErrors: 3,
      matchDuration: { ...SAMPLE.matchDuration, p95Ms: 11 },
      outcomes: { custom: 1 },
      journal: { drops: 1, truncations: 1, size: 5, maxEntries: 0 },
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, data }),
    })));

    render(<ApiMockDiagnosticsPanel serverId="srv-1" running={false} />);

    await waitFor(() => expect(screen.getByTestId('api-mock-diag-journal-size').textContent).toBe('5/0'));
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText('custom')).toBeTruthy();
    expect(document.querySelectorAll('.am-diag-metric--warn')).toHaveLength(6);
  });
});
