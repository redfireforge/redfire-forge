/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../test-utils/customSelectHelper';
import { WebSocketMockServer, WebSocketMockRulesPane, useMockServerUi } from './WebSocketMockServer';
import type { UseWebSocketMockServerReturn } from './useWebSocketMockServer';
import type { WsMockRule, WsMockLogEntry } from '../../shared/websocket/types';

function makeMockReturn(overrides: Partial<UseWebSocketMockServerReturn> = {}): UseWebSocketMockServerReturn {
  return {
    status: { running: false, port: 9876, clientCount: 0, clients: [] },
    logs: [],
    rules: [],
    config: { port: 9876, fallback: 'echo' },
    starting: false,
    setRules: vi.fn(),
    setConfig: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn().mockResolvedValue(0),
    clearLogs: vi.fn(),
    pushRulesToServer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('WebSocketMockServer', () => {
  it('renders stopped state with start button', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-status-label').textContent).toContain('Stopped');
    expect(screen.getByTestId('mock-start-btn')).toBeTruthy();
  });

  it('renders running state with stop button', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 2, clients: [
        { id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 5 },
        { id: 'c2', connectedAt: '2026-06-09T10:01:00Z', messageCount: 3 },
      ] },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-status-label').textContent).toContain('Running on :9876');
    expect(screen.getByTestId('mock-client-count').textContent).toContain('2 clients');
    expect(screen.getByTestId('mock-stop-btn')).toBeTruthy();
  });

  it('calls start when start button clicked', async () => {
    const startFn = vi.fn().mockResolvedValue(undefined);
    const mock = makeMockReturn({ start: startFn });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-start-btn'));
    expect(startFn).toHaveBeenCalledOnce();
  });

  it('calls stop when stop button clicked', () => {
    const stopFn = vi.fn().mockResolvedValue(undefined);
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
      stop: stopFn,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-stop-btn'));
    expect(stopFn).toHaveBeenCalledOnce();
  });

  it('shows error message when present', () => {
    const mock = makeMockReturn({
      status: { running: false, port: 9876, clientCount: 0, clients: [], error: 'EADDRINUSE' },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-error').textContent).toContain('EADDRINUSE');
  });

  it('shows empty rules message with fallback mode', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    const el = screen.getByTestId('mock-empty-rules');
    expect(el.textContent).toContain('No mock rules yet');
    expect(el.textContent).toContain('echo');
  });

  it('renders rules with names', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Ping Rule', enabled: true, match: { type: 'exact', pattern: 'ping' }, response: { type: 'static', data: 'pong' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-rule-r1')).toBeTruthy();
    expect(screen.getByText('Ping Rule')).toBeTruthy();
  });

  it('toggles rule enabled state', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    expect(setRules).toHaveBeenCalledWith([expect.objectContaining({ id: 'r1', enabled: false })]);
  });

  it('deletes a rule', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-delete-r1'));
    expect(setRules).toHaveBeenCalledWith([]);
  });

  it('adds a new rule', () => {
    const setRules = vi.fn();
    const mock = makeMockReturn({ setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-add-rule'));
    expect(setRules).toHaveBeenCalledWith([expect.objectContaining({ enabled: true, name: 'Rule 1' })]);
  });

  it('reuses Rule 1 name after the previous Rule 1 was deleted', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule 1', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    const { rerender } = render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-delete-r1'));
    expect(setRules).toHaveBeenCalledWith([]);

    // Simulate parent applying the empty list, then add again
    const emptyMock = makeMockReturn({ rules: [], setRules });
    rerender(<WebSocketMockServer mock={emptyMock} />);
    fireEvent.click(screen.getByTestId('mock-add-rule'));
    expect(setRules).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'Rule 1' })]);
  });

  it('shows test result for matching rule', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Ping', enabled: true, match: { type: 'exact', pattern: 'ping' }, response: { type: 'static', data: 'pong' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-test-input'), { target: { value: 'ping' } });
    const result = screen.getByTestId('mock-test-result');
    expect(result.textContent).toContain('Ping');
    expect(result.textContent).toContain('static');
  });

  it('shows fallback test result when no rule matches', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Exact', enabled: true, match: { type: 'exact', pattern: 'xyz' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-test-input'), { target: { value: 'hello' } });
    const result = screen.getByTestId('mock-test-result');
    expect(result.textContent).toContain('No rule matched');
    expect(result.textContent).toContain('echo');
  });

  it('renders activity log entries', () => {
    const logs: WsMockLogEntry[] = [
      { id: 1, ts: '2026-06-09T10:00:00Z', event: 'server-start', data: 'Started' },
      { id: 2, ts: '2026-06-09T10:00:01Z', event: 'client-connect', clientId: 'abc', data: '::1' },
    ];
    const mock = makeMockReturn({ logs });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-log-2')).toBeTruthy();
    expect(screen.getByTestId('mock-log-1')).toBeTruthy();
  });

  it('shows broadcast input when running', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [
        { id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 0 },
      ] },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-broadcast-input')).toBeTruthy();
  });

  it('calls broadcast on send click', () => {
    const broadcastFn = vi.fn().mockResolvedValue(1);
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [
        { id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 0 },
      ] },
      broadcast: broadcastFn,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-broadcast-input'), { target: { value: 'hello all' } });
    fireEvent.click(screen.getByTestId('mock-broadcast-btn'));
    expect(broadcastFn).toHaveBeenCalledWith('hello all');
  });

  it('port input is editable when server is stopped', () => {
    const mock = makeMockReturn({
      status: { running: false, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-port-input') as HTMLInputElement).readOnly).toBe(false);
  });

  it('port input is read-only when server is running', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-port-input') as HTMLInputElement).readOnly).toBe(true);
  });

  it('port input calls onPortChange on blur with a valid port', () => {
    const onPortChange = vi.fn();
    const mock = makeMockReturn({
      status: { running: false, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} onPortChange={onPortChange} />);
    const input = screen.getByTestId('mock-port-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    // onPortChange not yet called — waiting for commit (blur / Enter)
    expect(onPortChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onPortChange).toHaveBeenCalledWith(9999);
  });

  it('port input resets to config.port on blur with an invalid value', () => {
    const onPortChange = vi.fn();
    const mock = makeMockReturn({
      status: { running: false, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} onPortChange={onPortChange} />);
    const input = screen.getByTestId('mock-port-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '80' } }); // too low
    fireEvent.blur(input);
    expect(onPortChange).not.toHaveBeenCalled();
    expect(input.value).toBe('9876');
  });

  it('clears logs on clear button click', () => {
    const clearLogs = vi.fn();
    const logs: WsMockLogEntry[] = [
      { id: 1, ts: '2026-06-09T10:00:00Z', event: 'server-start', data: 'Started' },
    ];
    const mock = makeMockReturn({ logs, clearLogs });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-clear-log'));
    expect(clearLogs).toHaveBeenCalledOnce();
  });

  // ── Port display ─────────────────────────────────────────────────
  // The port is now tab-assigned and read-only — users cannot change it.

  it('start button is enabled when server is stopped and not starting', () => {
    const mock = makeMockReturn({
      status: { running: false, port: 9876, clientCount: 0, clients: [] },
      starting: false,
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-start-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('start button is disabled while starting', () => {
    const mock = makeMockReturn({
      status: { running: false, port: 9876, clientCount: 0, clients: [] },
      starting: true,
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('port input displays the configured port', () => {
    const mock = makeMockReturn({
      config: { port: 9877, fallback: 'echo' },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-port-input') as HTMLInputElement).value).toBe('9877');
  });

  // ── Fallback change ─────────────────────────────────────────────────

  it('calls setConfig with new fallback mode', () => {
    const setConfig = vi.fn();
    const mock = makeMockReturn({ setConfig });
    render(<WebSocketMockServer mock={mock} />);
    selectOption(screen.getByTestId('mock-fallback-select'), 'Ignore');
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ fallback: 'ignore' }));
  });

  it('pushes rules to server when fallback changes while running', () => {
    const pushRulesToServer = vi.fn().mockResolvedValue(undefined);
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
      pushRulesToServer,
      rules,
    });
    render(<WebSocketMockServer mock={mock} />);
    selectOption(screen.getByTestId('mock-fallback-select'), 'Close connection');
    expect(pushRulesToServer).toHaveBeenCalledWith(rules, 'close');
  });

  // ── Broadcast via Enter key ─────────────────────────────────────────

  it('calls broadcast when Enter is pressed in broadcast input', () => {
    const broadcastFn = vi.fn().mockResolvedValue(1);
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [
        { id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 0 },
      ] },
      broadcast: broadcastFn,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-broadcast-input'), { target: { value: 'test msg' } });
    fireEvent.keyDown(screen.getByTestId('mock-broadcast-input'), { key: 'Enter' });
    expect(broadcastFn).toHaveBeenCalledWith('test msg');
  });

  it('does not broadcast when text is empty', () => {
    const broadcastFn = vi.fn().mockResolvedValue(0);
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [
        { id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 0 },
      ] },
      broadcast: broadcastFn,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-broadcast-btn'));
    expect(broadcastFn).not.toHaveBeenCalled();
  });

  it('enables broadcast button with text even when no clients are connected', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-broadcast-input'), { target: { value: 'msg' } });
    expect((screen.getByTestId('mock-broadcast-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables broadcast button when text is empty regardless of client count', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-broadcast-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // ── Rule editor interactions ────────────────────────────────────────

  it('opens rule editor when rule header is clicked', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'My Rule', enabled: true, match: { type: 'exact', pattern: 'hello' }, response: { type: 'static', data: 'world' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-expand-r1'));
    expect(screen.getByTestId('rule-editor-r1')).toBeTruthy();
  });

  it('opens rule editor when rule name text is clicked', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'My Rule', enabled: true, match: { type: 'exact', pattern: 'hello' }, response: { type: 'static', data: 'world' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('My Rule'));
    expect(screen.getByTestId('rule-editor-r1')).toBeTruthy();
  });

  it('closes rule editor when header is clicked again', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-expand-r1'));
    expect(screen.getByTestId('rule-editor-r1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('rule-expand-r1'));
    expect(screen.queryByTestId('rule-editor-r1')).toBeNull();
  });

  it('does not toggle expand when enable switch is clicked', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    expect(screen.queryByTestId('rule-editor-r1')).toBeNull();
    expect(setRules).toHaveBeenCalled();
  });

  it('updates rule name in editor', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    fireEvent.change(screen.getByTestId('rule-name-r1'), { target: { value: 'Updated Rule' } });
    expect(setRules).toHaveBeenCalledWith([expect.objectContaining({ name: 'Updated Rule' })]);
  });

  it('updates match type in editor', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    selectOption(screen.getByTestId('rule-match-type-r1'), 'Exact');
    expect(setRules).toHaveBeenCalledWith([expect.objectContaining({ match: { type: 'exact', pattern: '' } })]);
  });

  it('shows pattern input when match type is not "any"', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'exact', pattern: 'hello' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-match-pattern-r1')).toBeTruthy();
  });

  it('hides pattern input when match type is "any"', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.queryByTestId('rule-match-pattern-r1')).toBeNull();
  });

  it('shows textarea for static response type', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'static', data: 'hi' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-response-data-r1')).toBeTruthy();
  });

  it('shows textarea for template response type', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'template', data: '{{ts}}' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-response-data-r1')).toBeTruthy();
  });

  it('shows close code/reason inputs for close response type', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'close', closeCode: 1000, closeReason: 'done' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-close-code-r1')).toBeTruthy();
    expect(screen.getByTestId('rule-close-reason-r1')).toBeTruthy();
  });

  it('shows delay input in editor', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo', delay: 500 } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-delay-r1')).toBeTruthy();
    expect((screen.getByTestId('rule-delay-r1') as HTMLInputElement).value).toBe('500');
  });

  // ── Rule move ───────────────────────────────────────────────────────

  it('disables move up for first rule', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'First', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
      { id: 'r2', name: 'Second', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    const upBtn = screen.getByTestId('mock-rule-r1').querySelector('[title="Move up"]') as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
  });

  it('disables move down for last rule', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'First', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
      { id: 'r2', name: 'Second', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    const downBtn = screen.getByTestId('mock-rule-r2').querySelector('[title="Move down"]') as HTMLButtonElement;
    expect(downBtn.disabled).toBe(true);
  });

  it('moves rule up when up button is clicked', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'First', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
      { id: 'r2', name: 'Second', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    const upBtn = screen.getByTestId('mock-rule-r2').querySelector('[title="Move up"]') as HTMLButtonElement;
    fireEvent.click(upBtn);
    expect(setRules).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'r2' }),
      expect.objectContaining({ id: 'r1' }),
    ]);
  });

  it('moves rule down when down button is clicked', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'First', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
      { id: 'r2', name: 'Second', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    const downBtn = screen.getByTestId('mock-rule-r1').querySelector('[title="Move down"]') as HTMLButtonElement;
    fireEvent.click(downBtn);
    expect(setRules).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'r2' }),
      expect.objectContaining({ id: 'r1' }),
    ]);
  });

  // ── Push rules to server when running ───────────────────────────────

  it('pushes rules when toggling rule while running', () => {
    const pushRulesToServer = vi.fn().mockResolvedValue(undefined);
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
      pushRulesToServer,
      setRules,
      rules,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    expect(pushRulesToServer).toHaveBeenCalled();
  });

  // ── Client display ──────────────────────────────────────────────────

  it('renders client list with details when running', () => {
    const mock = makeMockReturn({
      status: {
        running: true, port: 9876, clientCount: 2,
        clients: [
          { id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 5, remoteAddress: '::1' },
          { id: 'c2', connectedAt: '2026-06-09T10:01:00Z', messageCount: 3 },
        ],
      },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-clients')).toBeTruthy();
    expect(screen.getByTestId('mock-client-c1')).toBeTruthy();
    expect(screen.getByTestId('mock-client-c2')).toBeTruthy();
  });

  it('shows singular "client" for 1 client', () => {
    const mock = makeMockReturn({
      status: {
        running: true, port: 9876, clientCount: 1,
        clients: [{ id: 'c1', connectedAt: '2026-06-09T10:00:00Z', messageCount: 0 }],
      },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-client-count').textContent).toContain('1 client');
    expect(screen.getByTestId('mock-client-count').textContent).not.toContain('clients');
  });

  // ── Starting state ──────────────────────────────────────────────────

  it('disables start button when starting', () => {
    const mock = makeMockReturn({ starting: true });
    render(<WebSocketMockServer mock={mock} />);
    const btn = screen.getByTestId('mock-start-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Starting');
  });

  // ── Empty log ───────────────────────────────────────────────────────

  it('shows empty log message when no logs', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('mock-log').textContent).toContain('No activity yet');
  });

  // ── Rule summary display ────────────────────────────────────────────

  it('shows truncated pattern in rule summary for long patterns', () => {
    const longPattern = 'a'.repeat(50);
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'exact', pattern: longPattern }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    const ruleEl = screen.getByTestId('mock-rule-r1');
    expect(ruleEl.textContent).toContain('…');
  });

  it('shows delay in rule summary when present', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo', delay: 200 } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    const ruleEl = screen.getByTestId('mock-rule-r1');
    expect(ruleEl.textContent).toContain('+200ms');
  });

  // ── Delete editing rule resets editingRuleId ────────────────────────

  it('closes editor when edited rule is deleted', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    const { rerender } = render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-editor-r1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('rule-delete-r1'));
    // After delete, rules would be empty — re-render with empty rules
    const mockEmpty = makeMockReturn({ rules: [], setRules });
    rerender(<WebSocketMockServer mock={mockEmpty} />);
    expect(screen.queryByTestId('rule-editor-r1')).toBeNull();
  });

  it('renders pattern input for non-any match types', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Exact Rule', enabled: true, match: { type: 'exact', pattern: 'ping' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Exact Rule'));
    expect(screen.getByTestId('rule-match-pattern-r1')).toBeTruthy();
    expect((screen.getByTestId('rule-match-pattern-r1') as HTMLInputElement).value).toBe('ping');
  });

  it('renders pattern input with regex placeholder', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Regex Rule', enabled: true, match: { type: 'regex', pattern: '.*' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Regex Rule'));
    const input = screen.getByTestId('rule-match-pattern-r1') as HTMLInputElement;
    expect(input.placeholder).toContain('hello');
  });

  it('renders pattern input with jsonpath placeholder', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'JP Rule', enabled: true, match: { type: 'jsonpath', pattern: '$.type' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('JP Rule'));
    const input = screen.getByTestId('rule-match-pattern-r1') as HTMLInputElement;
    expect(input.placeholder).toContain('$.type');
  });

  it('renders textarea for static response type', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Static', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'static', data: 'pong' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Static'));
    expect(screen.getByTestId('rule-response-data-r1')).toBeTruthy();
    expect((screen.getByTestId('rule-response-data-r1') as HTMLTextAreaElement).value).toBe('pong');
  });

  it('renders textarea for template response type', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Tpl', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'template', data: '{{message}}' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Tpl'));
    const textarea = screen.getByTestId('rule-response-data-r1') as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('{{timestamp}}');
  });

  it('renders close code and reason inputs for close response type', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'CloseRule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'close', closeCode: 1001, closeReason: 'bye' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('CloseRule'));
    expect(screen.getByTestId('rule-close-code-r1')).toBeTruthy();
    expect((screen.getByTestId('rule-close-code-r1') as HTMLInputElement).value).toBe('1001');
    expect(screen.getByTestId('rule-close-reason-r1')).toBeTruthy();
    expect((screen.getByTestId('rule-close-reason-r1') as HTMLInputElement).value).toBe('bye');
  });

  it('updates pattern via onChange', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'PatRule', enabled: true, match: { type: 'exact', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('PatRule'));
    fireEvent.change(screen.getByTestId('rule-match-pattern-r1'), { target: { value: 'new-pattern' } });
    expect(setRules).toHaveBeenCalled();
  });

  it('updates response data via onChange on textarea', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'DataRule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'static', data: '' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('DataRule'));
    fireEvent.change(screen.getByTestId('rule-response-data-r1'), { target: { value: 'new-data' } });
    expect(setRules).toHaveBeenCalled();
  });

  it('updates close code via onChange', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'CC', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'close', closeCode: 1000 } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('CC'));
    fireEvent.change(screen.getByTestId('rule-close-code-r1'), { target: { value: '3000' } });
    expect(setRules).toHaveBeenCalled();
  });

  it('updates close reason via onChange', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'CR', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'close', closeReason: '' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('CR'));
    fireEvent.change(screen.getByTestId('rule-close-reason-r1'), { target: { value: 'goodbye' } });
    expect(setRules).toHaveBeenCalled();
  });

  it('commits port on Enter key', () => {
    const onPortChange = vi.fn();
    const mock = makeMockReturn({ config: { port: 9876, fallback: 'echo' } });
    render(<WebSocketMockServer mock={mock} onPortChange={onPortChange} />);
    const portInput = screen.getByTestId('mock-port-input') as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: '9999' } });
    fireEvent.keyDown(portInput, { key: 'Enter' });
    fireEvent.blur(portInput);
    expect(onPortChange).toHaveBeenCalledWith(9999);
  });

  it('resets port input on Escape key', () => {
    const mock = makeMockReturn({ config: { port: 9876, fallback: 'echo' } });
    render(<WebSocketMockServer mock={mock} />);
    const portInput = screen.getByTestId('mock-port-input') as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: '9999' } });
    fireEvent.keyDown(portInput, { key: 'Escape' });
    expect(portInput.value).toBe('9876');
  });

  it('swallows stop errors', async () => {
    const stop = vi.fn().mockRejectedValue(new Error('stop failed'));
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
      stop,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-stop-btn'));
    await new Promise((r) => setTimeout(r, 10));
    expect(stop).toHaveBeenCalled();
  });

  it('does not broadcast empty text', () => {
    const broadcast = vi.fn();
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [{ id: 'c1', connectedAt: '', messageCount: 0 }] },
      broadcast,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-broadcast-btn'));
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('does not push rules when toggling while server is stopped', () => {
    const pushRulesToServer = vi.fn();
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules, pushRulesToServer, status: { running: false, port: 9876, clientCount: 0, clients: [] } });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    expect(setRules).toHaveBeenCalled();
    expect(pushRulesToServer).not.toHaveBeenCalled();
  });

  it('swallows broadcast errors', async () => {
    const broadcast = vi.fn().mockRejectedValue(new Error('broadcast failed'));
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [{ id: 'c1', connectedAt: '', messageCount: 0 }] },
      broadcast,
    });
    render(<WebSocketMockServer mock={mock} />);
    const input = screen.getByTestId('mock-broadcast-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('mock-broadcast-btn'));
    await new Promise((r) => setTimeout(r, 10));
    expect(broadcast).toHaveBeenCalled();
  });

  it('shows enabled rule count in strip stats', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Only', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    expect(document.querySelector('.ws-mock-strip-stat')?.textContent).toMatch(/Rules\s+1\s+active/);
  });

  it('swallows start errors', async () => {
    const start = vi.fn().mockRejectedValue(new Error('start failed'));
    const mock = makeMockReturn({ start });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('mock-start-btn'));
    await new Promise((r) => setTimeout(r, 10));
    expect(start).toHaveBeenCalled();
  });

  it('renders close response fields in rule editor', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'CloseRule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'close', closeCode: 1000, closeReason: 'bye' } },
    ];
    const mock = makeMockReturn({ rules, setRules: vi.fn() });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('CloseRule'));
    expect(screen.getByTestId('rule-close-code-r1')).toBeTruthy();
    expect(screen.getByTestId('rule-close-reason-r1')).toBeTruthy();
  });

  it('updates response type via select onChange', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'TypeRule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('TypeRule'));
    selectOption(screen.getByTestId('rule-response-type-r1'), 'Static');
    expect(setRules).toHaveBeenCalled();
  });

  it('updates delay via onChange', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'DelayRule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo', delay: 0 } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('DelayRule'));
    fireEvent.change(screen.getByTestId('rule-delay-r1'), { target: { value: '250' } });
    expect(setRules).toHaveBeenCalled();
  });
});

function MockRulesPaneHarness({ mock }: { mock: UseWebSocketMockServerReturn }) {
  const ui = useMockServerUi(mock);
  return <WebSocketMockRulesPane ui={ui} showTabs={true} />;
}

describe('WebSocketMockRulesPane (tabbed layout)', () => {
  it('switches between rules and server log tabs', () => {
    const logs: WsMockLogEntry[] = [
      { id: 1, ts: '2026-06-09T10:00:00Z', event: 'start' },
    ];
    const mock = makeMockReturn({ logs });
    render(<MockRulesPaneHarness mock={mock} />);
    expect(screen.getByTestId('mock-tab-rules')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mock-tab-log'));
    expect(screen.getByTestId('mock-log')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mock-tab-rules'));
    expect(screen.getByTestId('mock-add-rule')).toBeTruthy();
  });
});
