/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketMockServer } from './WebSocketMockServer';
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
    expect(el.textContent).toContain('No rules configured');
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
    expect(setRules).toHaveBeenCalledWith([expect.objectContaining({ enabled: true })]);
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

  it('disables port input when running', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} />);
    expect((screen.getByTestId('mock-port-input') as HTMLInputElement).disabled).toBe(true);
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

  // ── Port validation ─────────────────────────────────────────────────

  it('disables start button when port is invalid (too low)', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-port-input'), { target: { value: '100' } });
    expect((screen.getByTestId('mock-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables start button when port is NaN', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-port-input'), { target: { value: 'abc' } });
    expect((screen.getByTestId('mock-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables start button when port is valid', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-port-input'), { target: { value: '8080' } });
    expect((screen.getByTestId('mock-start-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls setConfig with port when valid port is entered', () => {
    const setConfig = vi.fn();
    const mock = makeMockReturn({ setConfig });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-port-input'), { target: { value: '3000' } });
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ port: 3000 }));
  });

  it('does not call setConfig when port > 65535', () => {
    const setConfig = vi.fn();
    const mock = makeMockReturn({ setConfig });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-port-input'), { target: { value: '70000' } });
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('adds invalid class when port is out of range', () => {
    const mock = makeMockReturn();
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-port-input'), { target: { value: '100' } });
    expect((screen.getByTestId('mock-port-input') as HTMLInputElement).className).toContain('invalid');
  });

  // ── Fallback change ─────────────────────────────────────────────────

  it('calls setConfig with new fallback mode', () => {
    const setConfig = vi.fn();
    const mock = makeMockReturn({ setConfig });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-fallback-select'), { target: { value: 'ignore' } });
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
    fireEvent.change(screen.getByTestId('mock-fallback-select'), { target: { value: 'close' } });
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

  it('disables broadcast button when no clients', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-broadcast-input'), { target: { value: 'msg' } });
    expect((screen.getByTestId('mock-broadcast-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // ── Rule editor interactions ────────────────────────────────────────

  it('opens rule editor when rule name is clicked', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'My Rule', enabled: true, match: { type: 'exact', pattern: 'hello' }, response: { type: 'static', data: 'world' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('My Rule'));
    expect(screen.getByTestId('rule-editor-r1')).toBeTruthy();
  });

  it('closes rule editor when clicked again', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Rule', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.getByTestId('rule-editor-r1')).toBeTruthy();
    fireEvent.click(screen.getByText('Rule'));
    expect(screen.queryByTestId('rule-editor-r1')).toBeNull();
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
    fireEvent.change(screen.getByTestId('rule-match-type-r1'), { target: { value: 'exact' } });
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
});
