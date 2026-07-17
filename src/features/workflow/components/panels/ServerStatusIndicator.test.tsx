/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ServerStatusIndicator from './ServerStatusIndicator';
import * as platform from '../../../../shared/utils/platform';

type FetchOutcome = 'ok' | 'bad' | 'throw';
let fetchQueue: FetchOutcome[] = [];
const okData = { port: 8080, timestamp: '2026-01-01T00:00:00Z' };

async function flush(ms = 2000): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('ServerStatusIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchQueue = [];
    global.fetch = vi.fn(() => {
      return new Promise<Response>((resolve, reject) => {
        setTimeout(() => {
          const next = fetchQueue.shift() ?? 'throw';
          if (next === 'throw') {
            reject(new Error('down'));
            return;
          }
          if (next === 'bad') {
            resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
            return;
          }
          resolve({ ok: true, json: () => Promise.resolve(okData) } as Response);
        }, 0);
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows checking state on first render', async () => {
    fetchQueue = ['ok'];
    render(<ServerStatusIndicator />);
    expect(screen.getByText('⟳ Checking...')).toBeTruthy();
    await flush(0);
  });

  it('shows online state with port after a successful check', async () => {
    fetchQueue = ['ok'];
    render(<ServerStatusIndicator />);
    await flush();
    expect(screen.getByText('✓ Server Running')).toBeTruthy();
    expect(screen.getByText(':8080')).toBeTruthy();
  });

  it('shows offline when server responds not ok', async () => {
    fetchQueue = ['bad'];
    render(<ServerStatusIndicator />);
    await flush();
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();
  });

  it('shows offline when fetch throws', async () => {
    fetchQueue = ['throw'];
    render(<ServerStatusIndicator />);
    await flush();
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();
  });

  it('stops polling after two consecutive failures then restarts on click', async () => {
    fetchQueue = ['throw', 'throw'];
    render(<ServerStatusIndicator />);
    await flush(); // mount check fails (#1)
    await flush(15000); // interval fires, fails (#2) -> interval cleared
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();

    // Click to retry — succeeds and restarts polling
    fetchQueue = ['ok'];
    await act(async () => {
      screen.getByText('✗ Server Offline').closest('.wf-server-status')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('✓ Server Running')).toBeTruthy();

    // Restarted poll: success branch
    fetchQueue = ['ok'];
    await flush(15000);
    expect(screen.getByText('✓ Server Running')).toBeTruthy();

    // Restarted poll: not-ok branch
    fetchQueue = ['bad'];
    await flush(15000);
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();

    // Restarted poll: throw branch x2 -> clears interval
    fetchQueue = ['throw', 'throw'];
    await flush(15000);
    await flush(15000);
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();
  });

  it('handles click when server responds not ok', async () => {
    fetchQueue = ['throw'];
    render(<ServerStatusIndicator />);
    await flush();
    fetchQueue = ['bad'];
    await act(async () => {
      screen.getByText('✗ Server Offline').closest('.wf-server-status')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();
  });

  it('handles click when fetch throws', async () => {
    fetchQueue = ['throw'];
    render(<ServerStatusIndicator />);
    await flush();
    fetchQueue = ['throw'];
    await act(async () => {
      screen.getByText('✗ Server Offline').closest('.wf-server-status')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('✗ Server Offline')).toBeTruthy();
  });

  it('shows Native Desktop in Tauri mode when server is offline', async () => {
    vi.spyOn(platform, 'isTauri').mockReturnValue(true);
    fetchQueue = ['throw'];
    render(<ServerStatusIndicator />);
    await flush();
    expect(screen.getByText('⚡ Native Desktop')).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('shows Server Running in Tauri mode when server is online', async () => {
    vi.spyOn(platform, 'isTauri').mockReturnValue(true);
    fetchQueue = ['ok'];
    render(<ServerStatusIndicator />);
    await flush();
    expect(screen.getByText('✓ Server Running')).toBeTruthy();
    vi.restoreAllMocks();
  });
});
