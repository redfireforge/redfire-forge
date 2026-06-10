/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketConnectPanel } from './WebSocketConnectPanel';
import type { WsConnectionDraft, WsConnectionSnapshot } from '../../shared/websocket/types';

function defaultProps(overrides?: {
  draft?: Partial<WsConnectionDraft>;
  connection?: Partial<WsConnectionSnapshot>;
  uptime?: number | null;
  sentCount?: number;
  receivedCount?: number;
}) {
  return {
    draft: { url: '', subprotocols: '', headers: [], queryParams: [], ...overrides?.draft },
    setDraft: vi.fn(),
    connection: { state: 'disconnected' as const, ...overrides?.connection },
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    uptime: overrides?.uptime ?? null,
    sentCount: overrides?.sentCount ?? 0,
    receivedCount: overrides?.receivedCount ?? 0,
  };
}

describe('WebSocketConnectPanel', () => {
  describe('URL input', () => {
    it('renders URL input with placeholder', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.getByPlaceholderText(/ws:\/\/localhost/)).toBeTruthy();
    });

    it('calls setDraft on URL change', () => {
      const props = defaultProps();
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.change(screen.getByLabelText('WebSocket URL'), { target: { value: 'ws://test' } });
      expect(props.setDraft).toHaveBeenCalledWith({ url: 'ws://test' });
    });

    it('shows URL validation hint for invalid URLs', () => {
      render(<WebSocketConnectPanel {...defaultProps({ draft: { url: 'http://bad' } })} />);
      expect(screen.getByTestId('url-hint')).toBeTruthy();
      expect(screen.getByTestId('url-hint').textContent).toContain('must start with ws://');
    });

    it('does not show hint for valid ws:// URL', () => {
      render(<WebSocketConnectPanel {...defaultProps({ draft: { url: 'ws://good' } })} />);
      expect(screen.queryByTestId('url-hint')).toBeNull();
    });

    it('does not show hint for valid wss:// URL', () => {
      render(<WebSocketConnectPanel {...defaultProps({ draft: { url: 'wss://secure' } })} />);
      expect(screen.queryByTestId('url-hint')).toBeNull();
    });

    it('does not show hint for empty URL', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.queryByTestId('url-hint')).toBeNull();
    });

    it('shows clear button when URL is non-empty', () => {
      render(<WebSocketConnectPanel {...defaultProps({ draft: { url: 'ws://test' } })} />);
      expect(screen.getByLabelText('Clear URL')).toBeTruthy();
    });

    it('clears URL on clear button click', () => {
      const props = defaultProps({ draft: { url: 'ws://test' } });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByLabelText('Clear URL'));
      expect(props.setDraft).toHaveBeenCalledWith({ url: '' });
    });

    it('allows URL editing in error state', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://bad-host' },
        connection: { state: 'error', lastError: 'Connection refused' },
      })} />);
      expect((screen.getByLabelText('WebSocket URL') as HTMLInputElement).disabled).toBe(false);
    });

    it('disables URL input when connected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      expect((screen.getByLabelText('WebSocket URL') as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('subprotocols', () => {
    it('renders subprotocols input', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.getByLabelText('Subprotocols')).toBeTruthy();
    });

    it('calls setDraft on subprotocols change', () => {
      const props = defaultProps();
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.change(screen.getByLabelText('Subprotocols'), { target: { value: 'graphql-ws' } });
      expect(props.setDraft).toHaveBeenCalledWith({ subprotocols: 'graphql-ws' });
    });
  });

  describe('connect/disconnect buttons', () => {
    it('disables Connect when URL is empty', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect((screen.getByTestId('connect-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables Connect when URL is invalid', () => {
      render(<WebSocketConnectPanel {...defaultProps({ draft: { url: 'http://bad' } })} />);
      expect((screen.getByTestId('connect-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables Connect with valid URL', () => {
      render(<WebSocketConnectPanel {...defaultProps({ draft: { url: 'ws://localhost:8765' } })} />);
      expect((screen.getByTestId('connect-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('enables Connect in error state for retry', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://localhost:8765' },
        connection: { state: 'error', lastError: 'Failed' },
      })} />);
      expect((screen.getByTestId('connect-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('calls onConnect on Connect click', () => {
      const props = defaultProps({ draft: { url: 'ws://localhost:8765' } });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByTestId('connect-btn'));
      expect(props.onConnect).toHaveBeenCalled();
    });

    it('disables Connect in closing state', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://localhost:8765' },
        connection: { state: 'closing' },
      })} />);
      expect((screen.getByTestId('connect-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows Connecting label during connecting', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connecting' },
      })} />);
      expect(screen.getByTestId('connect-btn').textContent).toContain('Connecting');
    });

    it('disables Disconnect when disconnected', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect((screen.getByTestId('disconnect-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables Disconnect when connected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      expect((screen.getByTestId('disconnect-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('calls onDisconnect on click', () => {
      const props = defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByTestId('disconnect-btn'));
      expect(props.onDisconnect).toHaveBeenCalled();
    });

    it('connects on Enter key in URL field', () => {
      const props = defaultProps({ draft: { url: 'ws://localhost:8765' } });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.keyDown(screen.getByLabelText('WebSocket URL'), { key: 'Enter' });
      expect(props.onConnect).toHaveBeenCalled();
    });
  });

  describe('status bar', () => {
    it('shows Disconnected badge', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.getByTestId('status-badge').textContent).toContain('Disconnected');
    });

    it('shows Connected badge', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      expect(screen.getByTestId('status-badge').textContent).toContain('Connected');
    });

    it('shows Error badge', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        connection: { state: 'error', lastError: 'Connection refused' },
      })} />);
      expect(screen.getByTestId('status-badge').textContent).toContain('Error');
    });

    it('shows latency when available', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected', latencyMs: 42 },
      })} />);
      expect(screen.getByTestId('latency').textContent).toContain('42ms');
    });

    it('shows uptime when connected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
        uptime: 135000,
      })} />);
      expect(screen.getByTestId('uptime').textContent).toContain('2m 15s');
    });

    it('shows sent/received counters', () => {
      render(<WebSocketConnectPanel {...defaultProps({ sentCount: 12, receivedCount: 34 })} />);
      expect(screen.getByTestId('counters').textContent).toContain('↑ 12');
      expect(screen.getByTestId('counters').textContent).toContain('↓ 34');
    });

    it('shows negotiated protocol', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected', protocol: 'graphql-ws' },
      })} />);
      expect(screen.getByTestId('protocol').textContent).toContain('graphql-ws');
    });
  });

  describe('headers key-value list', () => {
    it('renders headers section', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.getByTestId('headers-section')).toBeTruthy();
    });

    it('adds a header row on click', () => {
      const props = defaultProps();
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByTestId('headers-add-btn'));
      expect(props.setDraft).toHaveBeenCalledWith({
        headers: [{ key: '', value: '', enabled: true }],
      });
    });

    it('renders existing header rows', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'ws://test',
          headers: [
            { key: 'Authorization', value: 'Bearer token', enabled: true },
            { key: 'X-Custom', value: 'abc', enabled: false },
          ],
        },
      })} />);
      expect(screen.getByTestId('headers-row-0')).toBeTruthy();
      expect(screen.getByTestId('headers-row-1')).toBeTruthy();
    });

    it('updates header key on change', () => {
      const props = defaultProps({
        draft: {
          url: 'ws://test',
          headers: [{ key: 'old', value: 'val', enabled: true }],
        },
      });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.change(screen.getByLabelText('Headers key 1'), { target: { value: 'new' } });
      expect(props.setDraft).toHaveBeenCalledWith({
        headers: [{ key: 'new', value: 'val', enabled: true }],
      });
    });

    it('removes header on click', () => {
      const props = defaultProps({
        draft: {
          url: 'ws://test',
          headers: [
            { key: 'A', value: '1', enabled: true },
            { key: 'B', value: '2', enabled: true },
          ],
        },
      });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByLabelText('Remove headers 1'));
      expect(props.setDraft).toHaveBeenCalledWith({
        headers: [{ key: 'B', value: '2', enabled: true }],
      });
    });

    it('disables header inputs when connected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'ws://test',
          headers: [{ key: 'A', value: '1', enabled: true }],
        },
        connection: { state: 'connected' },
      })} />);
      expect((screen.getByLabelText('Headers key 1') as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('query parameters key-value list', () => {
    it('renders query params section', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.getByTestId('query-params-section')).toBeTruthy();
    });

    it('adds a query param row on click', () => {
      const props = defaultProps();
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByTestId('query-params-add-btn'));
      expect(props.setDraft).toHaveBeenCalledWith({
        queryParams: [{ key: '', value: '', enabled: true }],
      });
    });

    it('renders existing param rows', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'ws://test',
          queryParams: [{ key: 'token', value: 'abc', enabled: true }],
        },
      })} />);
      expect(screen.getByTestId('query-params-row-0')).toBeTruthy();
    });
  });

  describe('error display', () => {
    it('shows error message when in error state', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        connection: { state: 'error', lastError: 'Connection refused' },
      })} />);
      expect(screen.getByTestId('connection-error').textContent).toContain('Connection refused');
    });

    it('does not show error when not in error state', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.queryByTestId('connection-error')).toBeNull();
    });
  });

  describe('save as profile button', () => {
    it('renders when onSaveAsProfile is provided', () => {
      const props = { ...defaultProps(), onSaveAsProfile: vi.fn() };
      render(<WebSocketConnectPanel {...props} />);
      expect(screen.getByTestId('save-as-profile-btn')).toBeTruthy();
    });

    it('is not rendered when onSaveAsProfile is omitted', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.queryByTestId('save-as-profile-btn')).toBeNull();
    });

    it('is disabled when URL is empty', () => {
      const props = { ...defaultProps(), onSaveAsProfile: vi.fn() };
      render(<WebSocketConnectPanel {...props} />);
      expect((screen.getByTestId('save-as-profile-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('is disabled when URL is invalid', () => {
      const props = { ...defaultProps({ draft: { url: 'http://bad' } }), onSaveAsProfile: vi.fn() };
      render(<WebSocketConnectPanel {...props} />);
      expect((screen.getByTestId('save-as-profile-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('is enabled when URL is valid', () => {
      const props = { ...defaultProps({ draft: { url: 'wss://good.com' } }), onSaveAsProfile: vi.fn() };
      render(<WebSocketConnectPanel {...props} />);
      expect((screen.getByTestId('save-as-profile-btn') as HTMLButtonElement).disabled).toBe(false);
    });

    it('calls onSaveAsProfile on click', () => {
      const onSave = vi.fn();
      const props = { ...defaultProps({ draft: { url: 'wss://good.com' } }), onSaveAsProfile: onSave };
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByTestId('save-as-profile-btn'));
      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('config lock', () => {
    it('disables all inputs when configLocked is true', () => {
      const props = {
        ...defaultProps({ draft: { url: 'wss://test.com' } }),
        configLocked: true,
      };
      render(<WebSocketConnectPanel {...props} />);
      expect((screen.getByLabelText('WebSocket URL') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByLabelText('Subprotocols') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('headers-add-btn') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('query-params-add-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('hides clear button when configLocked', () => {
      const props = {
        ...defaultProps({ draft: { url: 'wss://test.com' } }),
        configLocked: true,
      };
      render(<WebSocketConnectPanel {...props} />);
      expect(screen.queryByLabelText('Clear URL')).toBeNull();
    });

    it('disables header row inputs when configLocked', () => {
      const props = {
        ...defaultProps({
          draft: {
            url: 'wss://test.com',
            headers: [{ key: 'Auth', value: 'Bearer x', enabled: true }],
          },
        }),
        configLocked: true,
      };
      render(<WebSocketConnectPanel {...props} />);
      expect((screen.getByLabelText('Headers key 1') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByLabelText('Headers value 1') as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('auto-reconnect', () => {
    it('renders auto-reconnect toggle', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect(screen.getByTestId('auto-reconnect-toggle')).toBeTruthy();
    });

    it('reflects autoReconnect prop value', () => {
      render(<WebSocketConnectPanel {...defaultProps()} autoReconnect={true} />);
      expect((screen.getByTestId('auto-reconnect-toggle') as HTMLInputElement).checked).toBe(true);
    });

    it('calls onAutoReconnectChange on toggle', () => {
      const onAutoReconnectChange = vi.fn();
      render(
        <WebSocketConnectPanel
          {...defaultProps()}
          autoReconnect={false}
          onAutoReconnectChange={onAutoReconnectChange}
        />,
      );
      fireEvent.click(screen.getByTestId('auto-reconnect-toggle'));
      expect(onAutoReconnectChange).toHaveBeenCalledWith(true);
    });

    it('shows reconnect banner when reconnecting', () => {
      render(
        <WebSocketConnectPanel
          {...defaultProps({ connection: { state: 'disconnected' } })}
          reconnectState={{ active: true, attempt: 2, maxAttempts: 5, nextRetryAt: Date.now() + 3000 }}
        />,
      );
      expect(screen.getByTestId('reconnect-banner')).toBeTruthy();
      expect(screen.getByTestId('reconnect-banner').textContent).toContain('2/5');
    });

    it('hides reconnect banner when not reconnecting', () => {
      render(
        <WebSocketConnectPanel
          {...defaultProps()}
          reconnectState={{ active: false, attempt: 0, maxAttempts: 5, nextRetryAt: null }}
        />,
      );
      expect(screen.queryByTestId('reconnect-banner')).toBeNull();
    });

    it('calls onCancelReconnect on cancel click', () => {
      const onCancelReconnect = vi.fn();
      render(
        <WebSocketConnectPanel
          {...defaultProps({ connection: { state: 'disconnected' } })}
          reconnectState={{ active: true, attempt: 1, maxAttempts: 5, nextRetryAt: Date.now() + 3000 }}
          onCancelReconnect={onCancelReconnect}
        />,
      );
      fireEvent.click(screen.getByTestId('cancel-reconnect-btn'));
      expect(onCancelReconnect).toHaveBeenCalled();
    });

    it('shows reconnect failed message after max attempts', () => {
      render(
        <WebSocketConnectPanel
          {...defaultProps()}
          reconnectState={{ active: false, attempt: 5, maxAttempts: 5, nextRetryAt: null }}
        />,
      );
      expect(screen.getByTestId('reconnect-failed')).toBeTruthy();
      expect(screen.getByTestId('reconnect-failed').textContent).toContain('5 attempts');
    });

    it('disables inputs during reconnect', () => {
      render(
        <WebSocketConnectPanel
          {...defaultProps({ draft: { url: 'ws://test' } })}
          reconnectState={{ active: true, attempt: 1, maxAttempts: 5, nextRetryAt: Date.now() + 3000 }}
        />,
      );
      expect((screen.getByLabelText('WebSocket URL') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('connect-btn') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('close with code dropdown', () => {
    it('renders disconnect caret button', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      expect(screen.getByTestId('disconnect-caret')).toBeTruthy();
    });

    it('opens close code dropdown on caret click', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      expect(screen.queryByTestId('close-code-dropdown')).toBeNull();
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      expect(screen.getByTestId('close-code-dropdown')).toBeTruthy();
    });

    it('shows close code input and presets', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      expect(screen.getByTestId('close-code-input')).toBeTruthy();
      expect(screen.getByTestId('close-code-presets')).toBeTruthy();
      expect(screen.getByTestId('close-reason-input')).toBeTruthy();
    });

    it('calls onDisconnect with code and reason on Close button click', () => {
      const props = defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      });
      render(<WebSocketConnectPanel {...props} />);
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      fireEvent.change(screen.getByTestId('close-code-input'), { target: { value: '1001' } });
      fireEvent.change(screen.getByTestId('close-reason-input'), { target: { value: 'Going away' } });
      fireEvent.click(screen.getByTestId('close-with-code-btn'));
      expect(props.onDisconnect).toHaveBeenCalledWith({ code: 1001, reason: 'Going away' });
    });

    it('disables Close button when code is invalid', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      fireEvent.change(screen.getByTestId('close-code-input'), { target: { value: '999' } });
      expect((screen.getByTestId('close-with-code-btn') as HTMLButtonElement).disabled).toBe(true);
    });

    it('closes dropdown on Cancel click', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      expect(screen.getByTestId('close-code-dropdown')).toBeTruthy();
      const cancelBtn = screen.getByTestId('close-code-dropdown').querySelectorAll('button');
      const cancel = Array.from(cancelBtn).find(b => b.textContent === 'Cancel');
      fireEvent.click(cancel!);
      expect(screen.queryByTestId('close-code-dropdown')).toBeNull();
    });

    it('closes dropdown on Escape key', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      expect(screen.getByTestId('close-code-dropdown')).toBeTruthy();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('close-code-dropdown')).toBeNull();
    });

    it('disables caret when disconnected', () => {
      render(<WebSocketConnectPanel {...defaultProps()} />);
      expect((screen.getByTestId('disconnect-caret') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows reason byte counter', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} />);
      fireEvent.click(screen.getByTestId('disconnect-caret'));
      expect(screen.getByText(/\/123 bytes/)).toBeTruthy();
    });
  });

  describe('protocol selector', () => {
    it('renders protocol select dropdown', () => {
      render(<WebSocketConnectPanel {...defaultProps()} protocolMode="auto" />);
      expect(screen.getByTestId('protocol-select')).toBeTruthy();
    });

    it('shows protocol badge when connected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} protocolMode="raw" />);
      const badge = screen.getByTestId('protocol-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe('Raw');
    });

    it('hides protocol badge when disconnected', () => {
      render(<WebSocketConnectPanel {...defaultProps()} protocolMode="raw" />);
      expect(screen.queryByTestId('protocol-badge')).toBeNull();
    });

    it('shows Auto-detect label in protocol badge when auto mode and detected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} protocolMode="auto" detectedProtocol={{ protocol: 'stomp', confidence: 'high', reason: 'test' }} />);
      const badge = screen.getByTestId('protocol-badge');
      expect(badge.textContent).toBe('STOMP');
    });
  });

  describe('transport badge', () => {
    it('shows Native badge when connected in native mode', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} transportMode="native" />);
      const badge = screen.getByTestId('transport-badge');
      expect(badge.textContent).toBe('Native');
      expect(badge.className).toContain('ws-transport-native');
    });

    it('shows Proxy badge when connected in proxy mode', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} transportMode="proxy" />);
      const badge = screen.getByTestId('transport-badge');
      expect(badge.textContent).toBe('Proxy');
      expect(badge.className).toContain('ws-transport-proxy');
    });

    it('shows Direct badge when connected in direct mode', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'ws://test' },
        connection: { state: 'connected' },
      })} transportMode="direct" />);
      const badge = screen.getByTestId('transport-badge');
      expect(badge.textContent).toBe('Direct');
      expect(badge.className).toContain('ws-transport-direct');
    });

    it('hides transport badge when disconnected', () => {
      render(<WebSocketConnectPanel {...defaultProps()} transportMode="native" />);
      expect(screen.queryByTestId('transport-badge')).toBeNull();
    });
  });

  describe('env variable warnings', () => {
    it('shows no-env warning when URL has templates but no env selected', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'wss://{{host}}/ws' },
      })} />);
      expect(screen.getByTestId('env-no-env-warning')).toBeTruthy();
      expect(screen.queryByTestId('env-unresolved-warning')).toBeNull();
    });

    it('shows unresolved warning when env is available but var not found', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'wss://{{unknown}}/ws' },
      })} resolvedUrl="wss://{{unknown}}/ws" envVarMap={{ host: 'api.example.com' }} />);
      expect(screen.getByTestId('env-unresolved-warning')).toBeTruthy();
      expect(screen.queryByTestId('env-no-env-warning')).toBeNull();
    });

    it('shows env preview when env vars are resolved', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'wss://{{host}}/ws' },
      })} resolvedUrl="wss://api.example.com/ws" envVarMap={{ host: 'api.example.com' }} />);
      expect(screen.getByTestId('env-preview')).toBeTruthy();
      expect(screen.getByTestId('env-preview').textContent).toContain('wss://api.example.com/ws');
      expect(screen.queryByTestId('env-unresolved-warning')).toBeNull();
    });

    it('enables Connect for {{wsBaseUrl}}/ws when resolved URL is valid', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: '{{wsBaseUrl}}/ws' },
      })} resolvedUrl="wss://api.example.com/ws" envVarMap={{ wsBaseUrl: 'wss://api.example.com' }} />);
      const btn = screen.getByTestId('connect-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('no warnings when URL has no templates', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'wss://localhost/ws' },
      })} />);
      expect(screen.queryByTestId('env-no-env-warning')).toBeNull();
      expect(screen.queryByTestId('env-unresolved-warning')).toBeNull();
    });

    it('detects templates in headers for no-env warning', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'wss://localhost/ws',
          headers: [{ enabled: true, key: 'Authorization', value: 'Bearer {{token}}' }],
        },
      })} />);
      expect(screen.getByTestId('env-no-env-warning')).toBeTruthy();
    });

    it('detects templates in query params for no-env warning', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'wss://localhost/ws',
          queryParams: [{ enabled: true, key: 'auth', value: '{{token}}' }],
        },
      })} />);
      expect(screen.getByTestId('env-no-env-warning')).toBeTruthy();
    });

    it('does not show unresolved warning when header vars are resolvable', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'wss://localhost/ws',
          headers: [{ enabled: true, key: 'X-Base', value: '{{baseUrl}}' }],
        },
      })} resolvedUrl="wss://localhost/ws" envVarMap={{ baseUrl: 'https://api.example.com' }} />);
      expect(screen.queryByTestId('env-unresolved-warning')).toBeNull();
      expect(screen.queryByTestId('env-no-env-warning')).toBeNull();
    });

    it('shows unresolved warning for unresolvable header vars with env', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'wss://localhost/ws',
          headers: [{ enabled: true, key: 'Authorization', value: 'Bearer {{unknown}}' }],
        },
      })} resolvedUrl="wss://localhost/ws" envVarMap={{ baseUrl: 'https://api.example.com' }} />);
      expect(screen.getByTestId('env-unresolved-warning')).toBeTruthy();
    });

    it('shows unresolved warning for unresolvable query param vars with env', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: {
          url: 'wss://localhost/ws',
          queryParams: [{ enabled: true, key: 'auth', value: '{{missingVar}}' }],
        },
      })} resolvedUrl="wss://localhost/ws" envVarMap={{ baseUrl: 'https://api.example.com' }} />);
      expect(screen.getByTestId('env-unresolved-warning')).toBeTruthy();
    });

    it('never shows both warnings simultaneously', () => {
      render(<WebSocketConnectPanel {...defaultProps({
        draft: { url: 'wss://{{host}}/ws' },
      })} resolvedUrl="wss://{{host}}/ws" envVarMap={{ baseUrl: 'https://api.example.com' }} />);
      const unresolved = screen.queryByTestId('env-unresolved-warning');
      const noEnv = screen.queryByTestId('env-no-env-warning');
      expect(unresolved).toBeTruthy();
      expect(noEnv).toBeNull();
    });
  });

  describe('connection history', () => {
    const historyEntries = [
      { url: 'ws://localhost:8765', protocol: 'raw' as const, lastUsed: '2024-01-01T00:00:00Z', connectCount: 3 },
      { url: 'wss://api.example.com/ws', protocol: 'auto' as const, lastUsed: '2024-01-02T00:00:00Z', connectCount: 1 },
    ];

    it('shows history trigger when history has entries', () => {
      render(<WebSocketConnectPanel {...defaultProps()} history={historyEntries} />);
      expect(screen.getByTestId('url-history-trigger')).toBeTruthy();
    });

    it('shows Clear History button in dropdown', () => {
      const onClear = vi.fn();
      render(<WebSocketConnectPanel {...defaultProps()} history={historyEntries} onClearHistory={onClear} />);
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      expect(screen.getByTestId('url-history-clear-btn')).toBeTruthy();
      expect(screen.getByTestId('url-history-clear-btn').textContent).toBe('Clear History');
    });

    it('calls onClearHistory and closes dropdown on click', () => {
      const onClear = vi.fn();
      render(<WebSocketConnectPanel {...defaultProps()} history={historyEntries} onClearHistory={onClear} />);
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      fireEvent.click(screen.getByTestId('url-history-clear-btn'));
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('url-history-dropdown')).toBeNull();
    });

    it('does not show Clear History button when onClearHistory is not provided', () => {
      render(<WebSocketConnectPanel {...defaultProps()} history={historyEntries} />);
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      expect(screen.queryByTestId('url-history-clear-btn')).toBeNull();
    });
  });
});
