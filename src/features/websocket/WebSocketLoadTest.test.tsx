/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketLoadTest } from './WebSocketLoadTest';
import type { UseWebSocketLoadTestReturn } from './useWebSocketLoadTest';
import type { WsLoadTestResult } from '../../shared/websocket/types';
import { createDefaultLoadTestConfig } from './wsLoadTestMetrics';

vi.mock('../../shared/utils/fileSaver', () => ({ saveJsonFile: vi.fn() }));

function makeLT(overrides: Partial<UseWebSocketLoadTestReturn> = {}): UseWebSocketLoadTestReturn {
  return {
    state: 'idle',
    config: createDefaultLoadTestConfig(),
    setConfig: vi.fn(),
    progress: { elapsedMs: 0, totalSent: 0, totalReceived: 0, targetRate: 0, actualRate: 0, errorCount: 0 },
    result: null,
    start: vi.fn(),
    stop: vi.fn(),
    clearResult: vi.fn(),
    loadResult: vi.fn(),
    ...overrides,
  };
}

function makeResult(overrides: Partial<WsLoadTestResult> = {}): WsLoadTestResult {
  return {
    config: createDefaultLoadTestConfig(),
    startedAt: '2026-06-09T10:00:00Z',
    endedAt: '2026-06-09T10:00:10Z',
    durationMs: 10000,
    totalSent: 100,
    totalReceived: 98,
    errorCount: 2,
    bytesSent: 5000,
    bytesReceived: 4900,
    avgSendRate: 10,
    avgReceiveRate: 9.8,
    latency: { min: 5, max: 120, mean: 25, p50: 20, p95: 80, p99: 110, samples: 98 },
    throughputHistory: [
      { ts: 1000, sent: 10, received: 9 },
      { ts: 2000, sent: 10, received: 10 },
    ],
    latencyHistogram: [
      { bucket: '0-5ms', count: 10 },
      { bucket: '5-10ms', count: 30 },
      { bucket: '10-25ms', count: 40 },
      { bucket: '25-50ms', count: 15 },
      { bucket: '50-100ms', count: 3 },
    ],
    ...overrides,
  };
}

describe('WebSocketLoadTest', () => {
  it('renders config form in idle state', () => {
    const lt = makeLT();
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-config')).toBeTruthy();
    expect(screen.getByTestId('lt-start-btn')).toBeTruthy();
    expect(screen.getByTestId('lt-message-template')).toBeTruthy();
  });

  it('disables start button when not connected', () => {
    const lt = makeLT();
    render(<WebSocketLoadTest loadTest={lt} isConnected={false} />);
    expect((screen.getByTestId('lt-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows not-connected warning when disconnected', () => {
    const lt = makeLT();
    render(<WebSocketLoadTest loadTest={lt} isConnected={false} />);
    expect(screen.getByTestId('lt-not-connected')).toBeTruthy();
  });

  it('calls start on button click', () => {
    const startFn = vi.fn();
    const lt = makeLT({ start: startFn, config: { ...createDefaultLoadTestConfig(), rate: 5 } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-start-btn'));
    expect(startFn).toHaveBeenCalledOnce();
  });

  it('shows confirmation for high rate (>100)', () => {
    const startFn = vi.fn();
    const lt = makeLT({ start: startFn, config: { ...createDefaultLoadTestConfig(), rate: 500 } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-start-btn'));
    expect(startFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('lt-confirm')).toBeTruthy();
  });

  it('confirms and starts after high-rate warning', () => {
    const startFn = vi.fn();
    const lt = makeLT({ start: startFn, config: { ...createDefaultLoadTestConfig(), rate: 500 } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-start-btn'));
    fireEvent.click(screen.getByTestId('lt-confirm-yes'));
    expect(startFn).toHaveBeenCalledOnce();
  });

  it('cancels high-rate confirmation', () => {
    const lt = makeLT({ config: { ...createDefaultLoadTestConfig(), rate: 500 } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-start-btn'));
    fireEvent.click(screen.getByTestId('lt-confirm-no'));
    expect(screen.queryByTestId('lt-confirm')).toBeNull();
  });

  it('renders running state with progress', () => {
    const lt = makeLT({
      state: 'running',
      progress: {
        elapsedMs: 5000,
        totalSent: 50,
        totalReceived: 48,
        targetRate: 10,
        actualRate: 10,
        errorCount: 0,
      },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-running')).toBeTruthy();
    expect(screen.getByTestId('lt-stop-btn')).toBeTruthy();
  });

  it('calls stop on stop button click', () => {
    const stopFn = vi.fn();
    const lt = makeLT({ state: 'running', stop: stopFn });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-stop-btn'));
    expect(stopFn).toHaveBeenCalledOnce();
  });

  it('shows the live stats panel inline while running when provided', () => {
    const lt = makeLT({ state: 'running' });
    render(
      <WebSocketLoadTest
        loadTest={lt}
        isConnected={true}
        statsPanel={<div data-testid="fake-stats">live stats</div>}
      />,
    );
    const liveStats = screen.getByTestId('lt-live-stats');
    expect(liveStats).toBeTruthy();
    expect(liveStats.querySelector('[data-testid="fake-stats"]')).toBeTruthy();
  });

  it('does not render the live stats section when no statsPanel is provided', () => {
    const lt = makeLT({ state: 'running' });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.queryByTestId('lt-live-stats')).toBeNull();
  });

  it('does not show the live stats panel in the config view', () => {
    const lt = makeLT({ state: 'idle' });
    render(
      <WebSocketLoadTest
        loadTest={lt}
        isConnected={true}
        statsPanel={<div data-testid="fake-stats">live stats</div>}
      />,
    );
    expect(screen.queryByTestId('lt-live-stats')).toBeNull();
  });

  it('renders results after completion', () => {
    const result = makeResult();
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-results')).toBeTruthy();
    expect(screen.getByTestId('lt-result-cards')).toBeTruthy();
  });

  it('renders latency histogram when samples exist', () => {
    const result = makeResult();
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-histogram')).toBeTruthy();
  });

  it('renders export and new test buttons in results', () => {
    const clearFn = vi.fn();
    const result = makeResult();
    const lt = makeLT({ state: 'done', result, clearResult: clearFn });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-export-btn')).toBeTruthy();
    expect(screen.getByTestId('lt-clear-btn')).toBeTruthy();
    fireEvent.click(screen.getByTestId('lt-clear-btn'));
    expect(clearFn).toHaveBeenCalledOnce();
  });

  it('re-runs the same test from results via Run Again', () => {
    const startFn = vi.fn();
    const result = makeResult();
    const lt = makeLT({ state: 'done', result, start: startFn });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const runAgain = screen.getByTestId('lt-run-again-btn') as HTMLButtonElement;
    expect(runAgain.disabled).toBe(false);
    fireEvent.click(runAgain);
    expect(startFn).toHaveBeenCalledOnce();
  });

  it('disables Run Again and shows a hint when disconnected in results', () => {
    const startFn = vi.fn();
    const result = makeResult();
    const lt = makeLT({ state: 'done', result, start: startFn });
    render(<WebSocketLoadTest loadTest={lt} isConnected={false} />);
    const runAgain = screen.getByTestId('lt-run-again-btn') as HTMLButtonElement;
    expect(runAgain.disabled).toBe(true);
    expect(screen.getByTestId('lt-done-disconnected')).toBeTruthy();
    fireEvent.click(runAgain);
    expect(startFn).not.toHaveBeenCalled();
  });

  it('selects profile via pills', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-profile-ramp'));
    expect(setConfig).toHaveBeenCalledWith({ profile: 'ramp' });
  });

  it('shows burst count input for burst profile', () => {
    const lt = makeLT({ config: { ...createDefaultLoadTestConfig(), profile: 'burst' } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-burst-count')).toBeTruthy();
  });

  it('shows expected message count in summary', () => {
    const lt = makeLT({ config: { ...createDefaultLoadTestConfig(), rate: 10, durationSec: 5 } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const summary = screen.getByTestId('lt-summary');
    expect(summary.textContent).toContain('50');
  });

  it('resets config on reset button click', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-reset-btn'));
    expect(setConfig).toHaveBeenCalled();
  });

  it('shows error count in results when errors occurred', () => {
    const result = makeResult({ errorCount: 5 });
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const cards = screen.getByTestId('lt-result-cards');
    expect(cards.textContent).toContain('5');
    expect(cards.textContent).toContain('Errors');
  });

  it('SparklineSvg returns null for fewer than 2 data points', () => {
    const result = makeResult({ throughputHistory: [{ ts: 1000, sent: 5, received: 3 }] });
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    // No sparkline rendered
    expect(screen.queryByTestId('lt-results')!.querySelector('.ws-lt-sparkline')).toBeNull();
  });

  it('renders sparkline when throughput data has 2+ points', () => {
    const result = makeResult();
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-results').querySelector('.ws-lt-sparkline')).toBeTruthy();
  });

  it('HistogramBar shows empty state when no latency data', () => {
    const result = makeResult({
      latencyHistogram: [],
      latency: { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, samples: 0 },
    });
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    // latency section should not render when samples = 0
    expect(screen.queryByTestId('lt-histogram')).toBeNull();
  });

  it('formatDuration shows minutes for values >= 60s', () => {
    const lt = makeLT({
      state: 'running',
      progress: { elapsedMs: 90000, totalSent: 100, totalReceived: 50, targetRate: 10, actualRate: 10, errorCount: 0 },
      config: { ...createDefaultLoadTestConfig(), durationSec: 120 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const running = screen.getByTestId('lt-running');
    expect(running.textContent).toContain('1m');
  });

  it('formatRate shows k/s for rates >= 1000', () => {
    const lt = makeLT({
      state: 'running',
      progress: { elapsedMs: 5000, totalSent: 5000, totalReceived: 4800, targetRate: 1000, actualRate: 1000, errorCount: 0 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const running = screen.getByTestId('lt-running');
    expect(running.textContent).toContain('1k/s');
  });

  it('formatRate shows Max for Infinity', () => {
    const lt = makeLT({
      state: 'running',
      progress: { elapsedMs: 1000, totalSent: 10, totalReceived: 8, targetRate: Infinity, actualRate: 500, errorCount: 0 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const running = screen.getByTestId('lt-running');
    expect(running.textContent).toContain('Max');
  });

  it('updates message template via textarea', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const textarea = screen.getByTestId('lt-message-template') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"test":true}' } });
    expect(setConfig).toHaveBeenCalledWith({ messageTemplate: '{"test":true}' });
  });

  it('shows ramp end rate input when ramp profile selected', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig, config: { ...createDefaultLoadTestConfig(), profile: 'ramp' } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-rate-end')).toBeTruthy();
  });

  it('changes ramp end rate', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig, config: { ...createDefaultLoadTestConfig(), profile: 'ramp' } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.change(screen.getByTestId('lt-rate-end'), { target: { value: '50' } });
    expect(setConfig).toHaveBeenCalledWith({ rateEnd: 50 });
  });

  it('sets duration via preset buttons', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    // Click the 30s preset
    const btns = screen.getByTestId('lt-config').querySelectorAll('.ws-lt-duration-btn');
    const btn30 = Array.from(btns).find((b) => b.textContent === '30s');
    expect(btn30).toBeTruthy();
    fireEvent.click(btn30!);
    expect(setConfig).toHaveBeenCalledWith({ durationSec: 30 });
  });

  it('shows burst count input when burst profile selected', () => {
    const lt = makeLT({ config: { ...createDefaultLoadTestConfig(), profile: 'burst' } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-burst-count')).toBeTruthy();
  });

  it('changes burst count', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig, config: { ...createDefaultLoadTestConfig(), profile: 'burst' } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.change(screen.getByTestId('lt-burst-count'), { target: { value: '500' } });
    expect(setConfig).toHaveBeenCalledWith({ burstCount: 500 });
  });

  it('shows stopping state text', () => {
    const lt = makeLT({
      state: 'stopping',
      progress: { elapsedMs: 5000, totalSent: 50, totalReceived: 45, targetRate: 10, actualRate: 10, errorCount: 0 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-running').textContent).toContain('Stopping');
  });

  it('computes progress bar for burst profile from message counts', () => {
    const lt = makeLT({
      state: 'running',
      config: { ...createDefaultLoadTestConfig(), profile: 'burst', burstCount: 100 },
      progress: { elapsedMs: 1000, totalSent: 50, totalReceived: 40, targetRate: Infinity, actualRate: 50, errorCount: 0 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const bar = screen.getByTestId('lt-running').querySelector('.ws-lt-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('renders latency section with histogram', () => {
    const result = makeResult();
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-histogram')).toBeTruthy();
  });

  it('renders bytes row in results', () => {
    const result = makeResult({ bytesSent: 10240, bytesReceived: 20480 });
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const results = screen.getByTestId('lt-results');
    expect(results.textContent).toContain('10.0 KB');
    expect(results.textContent).toContain('20.0 KB');
  });

  it('export button calls saveJsonFile', async () => {
    const { saveJsonFile } = await import('../../shared/utils/fileSaver');
    const result = makeResult();
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-export-btn'));
    expect(saveJsonFile).toHaveBeenCalled();
  });

  it('shows error count in running metrics when errors > 0', () => {
    const lt = makeLT({
      state: 'running',
      progress: { elapsedMs: 3000, totalSent: 30, totalReceived: 25, targetRate: 10, actualRate: 10, errorCount: 3 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-running').textContent).toContain('Errors');
  });

  it('shows not connected warning when disconnected', () => {
    const lt = makeLT();
    render(<WebSocketLoadTest loadTest={lt} isConnected={false} />);
    expect(screen.getByTestId('lt-not-connected')).toBeTruthy();
  });

  it('format button formats valid JSON template', () => {
    const setConfig = vi.fn();
    const lt = makeLT({
      setConfig,
      config: { ...createDefaultLoadTestConfig(), messageTemplate: '{"type":"ping","seq":{{counter}}}' },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-format-btn'));
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({
      messageTemplate: expect.stringContaining('{{counter}}'),
    }));
  });

  it('format button shows error for invalid JSON', () => {
    const setConfig = vi.fn();
    const lt = makeLT({
      setConfig,
      config: { ...createDefaultLoadTestConfig(), messageTemplate: 'not valid json {{{' },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-format-btn'));
    expect(setConfig).not.toHaveBeenCalled();
    expect(screen.getByTestId('lt-format-btn').textContent).toContain('Invalid');
  });

  it('format button preserves {{timestamp}} and {{random}} markers', () => {
    const setConfig = vi.fn();
    const lt = makeLT({
      setConfig,
      config: { ...createDefaultLoadTestConfig(), messageTemplate: '{"ts":"{{timestamp}}","r":"{{random}}"}' },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-format-btn'));
    const formatted = (setConfig as ReturnType<typeof vi.fn>).mock.calls[0][0].messageTemplate as string;
    expect(formatted).toContain('{{timestamp}}');
    expect(formatted).toContain('{{random}}');
  });

  it('import button opens file dialog', () => {
    const result = makeResult();
    const lt = makeLT({ state: 'done', result });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    const importBtn = screen.getByTestId('lt-import-btn');
    expect(importBtn).toBeTruthy();
    fireEvent.click(importBtn);
  });

  it('handleImportResult loads valid JSON file', async () => {
    const loadResultFn = vi.fn();
    const result = makeResult();
    const lt = makeLT({ state: 'done', result, loadResult: loadResultFn });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const validData = JSON.stringify(makeResult({ totalSent: 999 }));
    const file = new File([validData], 'test.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    fireEvent.change(fileInput);

    await new Promise((r) => setTimeout(r, 50));
    expect(loadResultFn).toHaveBeenCalled();
  });

  it('handleImportResult ignores malformed JSON', async () => {
    const loadResultFn = vi.fn();
    const result = makeResult();
    const lt = makeLT({ state: 'done', result, loadResult: loadResultFn });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    fireEvent.change(fileInput);

    await new Promise((r) => setTimeout(r, 50));
    expect(loadResultFn).not.toHaveBeenCalled();
  });

  it('disables start button when message template is empty', () => {
    const lt = makeLT({ config: { ...createDefaultLoadTestConfig(), messageTemplate: '  ' } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect((screen.getByTestId('lt-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows high rate warning for ramp with high end rate', () => {
    const startFn = vi.fn();
    const lt = makeLT({
      start: startFn,
      config: { ...createDefaultLoadTestConfig(), profile: 'ramp', rate: 1, rateEnd: 500 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-start-btn'));
    expect(startFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('lt-confirm')).toBeTruthy();
    expect(screen.getByTestId('lt-confirm').textContent).toContain('Ramp');
  });

  it('changes rate input', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.change(screen.getByTestId('lt-rate'), { target: { value: '25' } });
    expect(setConfig).toHaveBeenCalledWith({ rate: 25 });
  });

  it('changes duration input', () => {
    const setConfig = vi.fn();
    const lt = makeLT({ setConfig });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.change(screen.getByTestId('lt-duration'), { target: { value: '15' } });
    expect(setConfig).toHaveBeenCalledWith({ durationSec: 15 });
  });

  it('stop button is disabled while in stopping state', () => {
    const lt = makeLT({
      state: 'stopping',
      progress: { elapsedMs: 3000, totalSent: 30, totalReceived: 28, targetRate: 10, actualRate: 10, errorCount: 0 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect((screen.getByTestId('lt-stop-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('burst profile skips high-rate confirmation', () => {
    const startFn = vi.fn();
    const lt = makeLT({
      start: startFn,
      config: { ...createDefaultLoadTestConfig(), profile: 'burst', rate: 500, burstCount: 1000 },
    });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    fireEvent.click(screen.getByTestId('lt-start-btn'));
    expect(startFn).toHaveBeenCalledOnce();
  });

  it('shows high rate warning in summary for constant profile > 100', () => {
    const lt = makeLT({ config: { ...createDefaultLoadTestConfig(), rate: 200 } });
    render(<WebSocketLoadTest loadTest={lt} isConnected={true} />);
    expect(screen.getByTestId('lt-summary').textContent).toContain('high rate');
  });
});
