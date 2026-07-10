/**
 * @vitest-environment jsdom
 * Coverage gaps for WebSocketMockServer — drag/drop, search, uptime, edge branches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DragEvent as ReactDragEvent } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  WebSocketMockServer,
  WebSocketMockServerBar,
  WebSocketMockClientsPane,
  useMockServerUi,
  type MockUi,
} from './WebSocketMockServer';
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

function makeRules(): WsMockRule[] {
  return [
    { id: 'r1', name: 'Alpha Rule', enabled: true, match: { type: 'exact', pattern: 'ping' }, response: { type: 'static', data: 'pong' } },
    { id: 'r2', name: 'Beta Rule', enabled: false, match: { type: 'contains', pattern: 'hello' }, response: { type: 'template', data: '{{msg}}' } },
    { id: 'r3', name: 'Gamma', enabled: true, match: { type: 'regex', pattern: '.*' }, response: { type: 'close', closeCode: 1000 } },
  ];
}

function UiBarHarness({ mock }: { mock: UseWebSocketMockServerReturn }) {
  const ui = useMockServerUi(mock);
  return <WebSocketMockServerBar ui={ui} onPortChange={vi.fn()} />;
}

function UiClientsHarness({ mock }: { mock: UseWebSocketMockServerReturn }) {
  const ui = useMockServerUi(mock);
  return <WebSocketMockClientsPane ui={ui} />;
}

describe('WebSocketMockServer coverage gaps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not broadcast whitespace-only text via Enter', () => {
    const broadcast = vi.fn();
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [{ id: 'c1', connectedAt: '', messageCount: 0 }] },
      broadcast,
    });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.change(screen.getByTestId('mock-broadcast-input'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByTestId('mock-broadcast-input'), { key: 'Enter' });
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('clears broadcast text after successful broadcast', async () => {
    const broadcast = vi.fn().mockResolvedValue(1);
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 1, clients: [{ id: 'c1', connectedAt: '', messageCount: 0 }] },
      broadcast,
    });
    render(<WebSocketMockServer mock={mock} />);
    const input = screen.getByTestId('mock-broadcast-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('mock-broadcast-btn'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(broadcast).toHaveBeenCalledWith('hello');
    expect(input.value).toBe('');
  });

  it('filters rules by search query across name, type, pattern, and response', () => {
    const mock = makeMockReturn({ rules: makeRules() });
    render(<WebSocketMockServer mock={mock} />);
    const search = screen.getByTestId('ws-mock-search');
    fireEvent.change(search, { target: { value: 'alpha' } });
    expect(screen.getByTestId('mock-rule-r1')).toBeTruthy();
    expect(screen.queryByTestId('mock-rule-r2')).toBeNull();
    expect(screen.queryByTestId('mock-rule-r3')).toBeNull();

    fireEvent.change(search, { target: { value: 'contains' } });
    expect(screen.getByTestId('mock-rule-r2')).toBeTruthy();

    fireEvent.change(search, { target: { value: 'hello' } });
    expect(screen.getByTestId('mock-rule-r2')).toBeTruthy();

    fireEvent.change(search, { target: { value: 'close' } });
    expect(screen.getByTestId('mock-rule-r3')).toBeTruthy();
  });

  it('reorders rules via drag and drop', () => {
    const setRules = vi.fn();
    const rules = makeRules();
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);

    const handle = screen.getByTestId('ws-mock-drag-r1');
    const target = screen.getByTestId('mock-rule-r3');

    fireEvent.dragStart(handle);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    expect(setRules).toHaveBeenCalled();
    const reordered = setRules.mock.calls.at(-1)?.[0] as WsMockRule[];
    expect(reordered[0]?.id).toBe('r2');
  });

  it('applies dragging and drop-target CSS classes during drag', () => {
    const mock = makeMockReturn({ rules: makeRules() });
    render(<WebSocketMockServer mock={mock} />);

    const sourceCard = screen.getByTestId('mock-rule-r1');
    const targetCard = screen.getByTestId('mock-rule-r3');

    fireEvent.dragStart(screen.getByTestId('ws-mock-drag-r1'));
    expect(sourceCard.className).toContain('mock-server-rule-card--dragging');

    fireEvent.dragOver(targetCard);
    expect(targetCard.className).toContain('mock-server-rule-card--drop-target');

    fireEvent.dragEnd(screen.getByTestId('ws-mock-drag-r1'));
    expect(sourceCard.className).not.toContain('mock-server-rule-card--dragging');
  });

  it('cancels drop when dragging onto the same rule', () => {
    const setRules = vi.fn();
    const mock = makeMockReturn({ rules: makeRules(), setRules });
    render(<WebSocketMockServer mock={mock} />);
    const card = screen.getByTestId('mock-rule-r1');
    fireEvent.dragStart(screen.getByTestId('ws-mock-drag-r1'));
    fireEvent.drop(card);
    expect(setRules).not.toHaveBeenCalled();
  });

  it('handleMoveRule no-ops for unknown rule id', () => {
    const setRules = vi.fn();
    const mock = makeMockReturn({ rules: makeRules(), setRules });

    function MoveHarness() {
      const ui = useMockServerUi(mock);
      return (
        <button type="button" data-testid="move-bad" onClick={() => ui.handleMoveRule('missing', 'up')}>
          move
        </button>
      );
    }
    render(<MoveHarness />);
    fireEvent.click(screen.getByTestId('move-bad'));
    expect(setRules).not.toHaveBeenCalled();
  });

  it('handleMoveRule no-ops when swap index is out of bounds', () => {
    const setRules = vi.fn();
    const rules = makeRules().slice(0, 1);
    const mock = makeMockReturn({ rules, setRules });

    function MoveHarness() {
      const ui = useMockServerUi(mock);
      return (
        <>
          <button type="button" data-testid="move-up" onClick={() => ui.handleMoveRule('r1', 'up')}>up</button>
          <button type="button" data-testid="move-down" onClick={() => ui.handleMoveRule('r1', 'down')}>down</button>
        </>
      );
    }
    render(<MoveHarness />);
    fireEvent.click(screen.getByTestId('move-up'));
    fireEvent.click(screen.getByTestId('move-down'));
    expect(setRules).not.toHaveBeenCalled();
  });

  it('shows uptime ticker when server is running', async () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<UiBarHarness mock={mock} />);
    const uptimeStat = Array.from(document.querySelectorAll('.ws-mock-strip-stat'))
      .find((el) => el.textContent?.includes('Uptime'));
    expect(uptimeStat).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(uptimeStat?.querySelector('b')?.textContent).toBeTruthy();
  });

  it('uses config.port in URL preview when port input is invalid', () => {
    const mock = makeMockReturn({ config: { port: 9876, fallback: 'echo' } });
    render(<UiBarHarness mock={mock} />);
    const portInput = screen.getByTestId('mock-port-input') as HTMLInputElement;
    const urlInput = screen.getByLabelText('Mock server URL') as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: 'not-a-port' } });
    expect(urlInput.value).toBe('ws://localhost:9876');
  });

  it('shows stopped clients empty state', () => {
    const mock = makeMockReturn();
    render(<UiClientsHarness mock={mock} />);
    expect(screen.getByText(/Server stopped/)).toBeTruthy();
  });

  it('shows no-clients empty state when running', () => {
    const mock = makeMockReturn({
      status: { running: true, port: 9876, clientCount: 0, clients: [] },
    });
    render(<UiClientsHarness mock={mock} />);
    expect(screen.getByText(/No clients connected yet/)).toBeTruthy();
  });

  it('renders disabled rule toggle label title', () => {
    const mock = makeMockReturn({ rules: makeRules() });
    render(<WebSocketMockServer mock={mock} />);
    expect(screen.getByTestId('rule-toggle-label-r2').getAttribute('title')).toBe('Disabled');
    expect(screen.getByTestId('rule-toggle-label-r1').getAttribute('title')).toBe('Enabled');
  });

  it('renders response data textarea with empty default when data is undefined', () => {
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Static', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'static' } },
    ];
    const mock = makeMockReturn({ rules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Static'));
    expect((screen.getByTestId('rule-response-data-r1') as HTMLTextAreaElement).value).toBe('');
  });

  it('falls back close code to 1000 when input is invalid', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Close', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'close' } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Close'));
    fireEvent.change(screen.getByTestId('rule-close-code-r1'), { target: { value: 'abc' } });
    expect(setRules).toHaveBeenCalledWith([
      expect.objectContaining({ response: expect.objectContaining({ closeCode: 1000 }) }),
    ]);
  });

  it('clamps delay between 0 and 10000', () => {
    const setRules = vi.fn();
    const rules: WsMockRule[] = [
      { id: 'r1', name: 'Delay', enabled: true, match: { type: 'any', pattern: '' }, response: { type: 'echo', delay: 0 } },
    ];
    const mock = makeMockReturn({ rules, setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Delay'));
    fireEvent.change(screen.getByTestId('rule-delay-r1'), { target: { value: '99999' } });
    expect(setRules).toHaveBeenCalledWith([
      expect.objectContaining({ response: expect.objectContaining({ delay: 10000 }) }),
    ]);
    fireEvent.change(screen.getByTestId('rule-delay-r1'), { target: { value: 'bad' } });
    expect(setRules).toHaveBeenCalledWith([
      expect.objectContaining({ response: expect.objectContaining({ delay: 0 }) }),
    ]);
  });

  it('renders log entries with ruleName and data fields', () => {
    const logs: WsMockLogEntry[] = [
      {
        id: 42,
        ts: '2026-06-09T10:00:00Z',
        event: 'rule-match',
        clientId: 'client-1',
        ruleName: 'Ping Rule',
        data: 'matched payload',
      },
    ];
    const mock = makeMockReturn({ logs });
    render(<WebSocketMockServer mock={mock} />);
    const entry = screen.getByTestId('mock-log-42');
    expect(entry.textContent).toContain('Ping Rule');
    expect(entry.textContent).toContain('matched payload');
    expect(entry.textContent).toContain('[client-1]');
  });

  it('toggles only the targeted rule when multiple rules exist', () => {
    const setRules = vi.fn();
    const mock = makeMockReturn({ rules: makeRules(), setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    const next = setRules.mock.calls.at(-1)?.[0] as WsMockRule[];
    expect(next.find((r) => r.id === 'r1')?.enabled).toBe(false);
    expect(next.find((r) => r.id === 'r2')?.enabled).toBe(false);
    expect(next.find((r) => r.id === 'r3')?.enabled).toBe(true);
  });

  it('updates only the targeted rule via handleUpdateRule', () => {
    const setRules = vi.fn();
    const mock = makeMockReturn({ rules: makeRules(), setRules });
    render(<WebSocketMockServer mock={mock} />);
    fireEvent.click(screen.getByText('Alpha Rule'));
    fireEvent.change(screen.getByTestId('rule-name-r1'), { target: { value: 'Renamed' } });
    const next = setRules.mock.calls.at(-1)?.[0] as WsMockRule[];
    expect(next.find((r) => r.id === 'r1')?.name).toBe('Renamed');
    expect(next.find((r) => r.id === 'r2')?.name).toBe('Beta Rule');
  });

  it('handleDragOver keeps previous drop target when dragging over same rule', () => {
    const mock = makeMockReturn({ rules: makeRules() });

    function DragHarness() {
      const ui = useMockServerUi(mock);
      return (
        <button
          type="button"
          data-testid="drag-over-self"
          onClick={() => {
            ui.handleDragStart('r1');
            const evt = { preventDefault: vi.fn() } as unknown as ReactDragEvent<HTMLDivElement>;
            ui.handleDragOver(evt, 'r1');
          }}
        >
          drag
        </button>
      );
    }
    render(<DragHarness />);
    fireEvent.click(screen.getByTestId('drag-over-self'));
    expect(screen.getByTestId('drag-over-self')).toBeTruthy();
  });

  it('handleDrop clears drag state when rule ids are not found', () => {
    const setRules = vi.fn();
    const mock = makeMockReturn({ rules: makeRules(), setRules });

    function DropHarness({ uiRef }: { uiRef: { current: MockUi | null } }) {
      const ui = useMockServerUi(mock);
      uiRef.current = ui;
      return null;
    }

    const uiRef = { current: null as MockUi | null };
    render(<DropHarness uiRef={uiRef} />);
    act(() => {
      uiRef.current!.handleDragStart('ghost-id');
      const evt = { preventDefault: vi.fn() } as unknown as ReactDragEvent<HTMLDivElement>;
      uiRef.current!.handleDrop(evt, 'r1');
    });
    expect(setRules).not.toHaveBeenCalled();
  });
});
