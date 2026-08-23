/**
 * @vitest-environment jsdom
 *
 * Coverage-focused tests for WsConnectionTabContent: draft seeding, persistence,
 * relocated editors, tab fallbacks, connection hints and toolbar handlers.
 * Split from WsConnectionTabContent.test.tsx to keep each file under 900 lines.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { WsConnectionTabContent, type WsConnectionTabContentHandle, type WsConnectionTabContentProps } from './WsConnectionTabContent';
import * as hookModule from './useWebSocketStudio';
import type { UseWebSocketStudioReturn } from './useWebSocketStudio';
import * as recordingModule from './useWebSocketRecording';
import type { UseWebSocketRecordingReturn } from './useWebSocketRecording';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import * as mockServerModule from './useWebSocketMockServer';
import { createDefaultDraft } from '@shared/websocket/types';
import {
  makeStudioReturn,
  makeProfilesReturn,
  makeTemplatesReturn,
  makeMockServerReturn,
  makeRecordingReturn,
} from './WebSocketStudioPage.test-factories';

const originalConsoleError = console.error;

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; getScrollElement: () => unknown; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        start: i * opts.estimateSize(),
        size: opts.estimateSize(),
        key: i,
      })),
    getTotalSize: () => opts.count * opts.estimateSize(),
    scrollToIndex: vi.fn(),
  }),
}));

function makeProps(overrides?: Partial<WsConnectionTabContentProps>): WsConnectionTabContentProps {
  return {
    tabId: 'test-tab',
    envVarMap: {},
    profilesHook: makeProfilesReturn(),
    templatesHook: makeTemplatesReturn(),
    mockPort: 9876,
    onConnectionStateChange: vi.fn(),
    onUrlChange: vi.fn(),
    controlledMode: 'client',
    controlledLeftTab: 'connect',
    controlledRightTab: 'events',
    ...overrides,
  };
}

let mockStudio: UseWebSocketStudioReturn;
let mockRecording: UseWebSocketRecordingReturn;
let mockProfiles: UseWebSocketProfilesReturn;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const message = args.map((part) => String(part)).join(' ');
    if (message.includes('not wrapped in act(')) {
      return;
    }
    originalConsoleError(...args);
  });
  mockStudio = makeStudioReturn();
  mockRecording = makeRecordingReturn();
  mockProfiles = makeProfilesReturn();
  vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
  vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
  vi.spyOn(mockServerModule, 'useWebSocketMockServer').mockReturnValue(makeMockServerReturn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WsConnectionTabContent — coverage', () => {
  describe('draft seeding, persistence and relocated editors', () => {
    it('seeds the draft and protocol from initialDraft/initialUrl/initialProtocol on mount', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({
            initialUrl: 'ws://seed:9000',
            initialProtocol: 'graphql-ws',
            initialDraft: {
              subprotocols: 'graphql-ws',
              headers: [{ key: 'X-Seed', value: '1', enabled: true }],
              queryParams: [{ key: 'q', value: '2', enabled: true }],
              auth: { type: 'none' },
            },
          })}
        />,
      );
      expect(mockStudio.setDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'ws://seed:9000',
          subprotocols: 'graphql-ws',
          headers: [{ key: 'X-Seed', value: '1', enabled: true }],
          queryParams: [{ key: 'q', value: '2', enabled: true }],
          auth: { type: 'none' },
        }),
      );
      expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    });

    it('exposes the full draft snapshot via the ref handle', () => {
      const ref = createRef<WsConnectionTabContentHandle>();
      render(<WsConnectionTabContent ref={ref} {...makeProps()} />);
      expect(ref.current!.getDraft()).toBe(mockStudio.draft);
    });

    it('fires onDraftChange when a persistable draft field changes', () => {
      const onDraftChange = vi.fn();
      const { rerender } = render(
        <WsConnectionTabContent {...makeProps({ onDraftChange })} />,
      );
      expect(onDraftChange).not.toHaveBeenCalled();
      mockStudio = makeStudioReturn({
        draft: {
          ...createDefaultDraft(),
          headers: [{ key: 'X-New', value: 'v', enabled: true }],
        },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      rerender(<WsConnectionTabContent {...makeProps({ onDraftChange })} />);
      expect(onDraftChange).toHaveBeenCalledWith('test-tab');
    });

    it('clears headers via the relocated Headers editor (shell mode)', () => {
      mockStudio = makeStudioReturn({
        draft: { ...createDefaultDraft(), headers: [{ key: 'a', value: 'b', enabled: true }] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'headers' })}
        />,
      );
      fireEvent.click(screen.getByTestId('headers-delete-all-btn'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ headers: [] });
    });

    it('clears query params via the relocated Params editor (shell mode)', () => {
      mockStudio = makeStudioReturn({
        draft: { ...createDefaultDraft(), queryParams: [{ key: 'q', value: '1', enabled: true }] },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'params' })}
        />,
      );
      fireEvent.click(screen.getByTestId('query-params-delete-all-btn'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ queryParams: [] });
    });

    it('renders the relocated Auth panel (shell mode)', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'auth' })}
        />,
      );
      expect(document.querySelector('.ws-studio-content')).toBeTruthy();
    });
  });

  describe('tab fallbacks, connection hints and toolbar handlers', () => {
    it('falls back to the connect/events tabs when controlled tabs are undefined', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledLeftTab: undefined, controlledRightTab: undefined })}
        />,
      );
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.getByTestId('left-tab-connect')).toBeTruthy();
      expect(screen.getByTestId('search-input')).toBeTruthy();
    });

    it('seeds nothing from an initialDraft whose fields are all undefined', () => {
      render(<WsConnectionTabContent {...makeProps({ initialDraft: {} })} />);
      expect(mockStudio.setDraft).not.toHaveBeenCalled();
      expect(mockStudio.setProtocolMode).not.toHaveBeenCalled();
    });

    it('reports a connected hint when the socket transitions to closing', () => {
      const onConnectionStateChange = vi.fn();
      const { rerender } = render(
        <WsConnectionTabContent {...makeProps({ onConnectionStateChange })} />,
      );
      mockStudio = makeStudioReturn({ connection: { state: 'closing' } });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      rerender(<WsConnectionTabContent {...makeProps({ onConnectionStateChange })} />);
      expect(onConnectionStateChange).toHaveBeenCalledWith('test-tab', 'connected', 'auto');
    });

    it('renders no right pane when the controlled mode is unknown', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: undefined })}
        />,
      );
      expect(screen.getByTestId('ws-studio-shell')).toBeTruthy();
      expect(screen.queryByTestId('search-input')).toBeNull();
    });

    it('starts a recording from the Events toolbar', () => {
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('start-recording-btn'));
      expect(mockRecording.startRecording).toHaveBeenCalledWith(
        mockStudio.draft.url,
        mockStudio.protocolMode,
      );
    });

    it('stops a recording from the Events toolbar', () => {
      mockRecording = makeRecordingReturn({ state: 'recording' });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('stop-recording-btn'));
      expect(mockRecording.stopRecording).toHaveBeenCalled();
    });

    it('loads a recording file from the Events toolbar', async () => {
      render(<WsConnectionTabContent {...makeProps()} />);
      const input = screen.getByTestId('recording-file-input') as HTMLInputElement;
      const file = new File(['{}'], 'rec.json', { type: 'application/json' });
      fireEvent.change(input, { target: { files: [file] } });
      expect(mockRecording.loadRecording).toHaveBeenCalledWith(file);
    });

    it('starts a replay when a recording has been loaded', () => {
      mockRecording = makeRecordingReturn({
        state: 'idle',
        loadedRecording: {
          _format: 'ws-recording-v1',
          metadata: {
            url: 'ws://rec',
            protocol: 'auto',
            startedAt: new Date().toISOString(),
            durationMs: 0,
            messageCount: 0,
          },
          events: [],
        },
      });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('start-replay-btn'));
      expect(mockStudio.clearMessages).toHaveBeenCalled();
      expect(mockRecording.startReplay).toHaveBeenCalledWith(mockStudio.appendReplayFrame);
    });

    it('stops a replay from the replay bar', () => {
      mockRecording = makeRecordingReturn({ state: 'replaying' });
      vi.spyOn(recordingModule, 'useWebSocketRecording').mockReturnValue(mockRecording);
      render(<WsConnectionTabContent {...makeProps()} />);
      fireEvent.click(screen.getByTestId('replay-exit-btn'));
      expect(mockRecording.stopReplay).toHaveBeenCalled();
      expect(mockStudio.clearMessages).toHaveBeenCalled();
    });

    it('applies a URL and protocol from local connection history', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledLeftTab: 'connect',
            history: [{ url: 'ws://history:9000', protocol: 'graphql-ws' }],
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      fireEvent.click(screen.getByTestId('url-history-item'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ url: 'ws://history:9000' });
      expect(mockStudio.setProtocolMode).toHaveBeenCalledWith('graphql-ws');
    });

    it('does not change the protocol when the history entry uses auto', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledLeftTab: 'connect',
            history: [{ url: 'ws://history:auto', protocol: 'auto' }],
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('url-history-trigger'));
      fireEvent.click(screen.getByTestId('url-history-item'));
      expect(mockStudio.setDraft).toHaveBeenCalledWith({ url: 'ws://history:auto' });
      expect(mockStudio.setProtocolMode).not.toHaveBeenCalled();
    });

    it('updates the draft auth via the relocated Auth panel', () => {
      render(
        <WsConnectionTabContent
          {...makeProps({ controlledMode: 'client', controlledLeftTab: 'auth' })}
        />,
      );
      // useCustomTypeDropdown renders a hidden native <select> kept specifically
      // for test/demo automation (see AuthConfigPanel.tsx) instead of a CustomSelect.
      fireEvent.change(
        document.querySelector('.auth-type-hidden-select') as HTMLSelectElement,
        { target: { value: 'bearer' } },
      );
      expect(mockStudio.setDraft).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.objectContaining({ type: 'bearer' }) }),
      );
    });

    it('switches back to the Connect tab after loading a profile draft', () => {
      const onModeChange = vi.fn();
      const onLeftTabChange = vi.fn();
      const profile = {
        id: 'p1', name: 'SwitchTest', url: 'wss://api.example.com',
        headers: [], queryParams: [], subprotocols: '',
        autoReconnect: false, maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000, maxMessages: 1000,
        createdAt: '', updatedAt: '',
      };
      mockProfiles = makeProfilesReturn({
        profiles: [profile],
        loadProfileAsDraft: vi.fn().mockReturnValue(createDefaultDraft()),
      });
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledMode: 'saved',
            profilesHook: mockProfiles,
            onModeChange,
            onLeftTabChange,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('profile-card-p1'));
      fireEvent.click(screen.getByTestId('load-btn-p1'));
      expect(onModeChange).toHaveBeenCalledWith('client');
      expect(onLeftTabChange).toHaveBeenCalledWith('connect');
    });

    it('cancels the reconnect and returns to Connect when editing a failed connection', () => {
      const onModeChange = vi.fn();
      const onLeftTabChange = vi.fn();
      mockStudio = makeStudioReturn({
        reconnectState: {
          active: false,
          attempt: 3,
          maxAttempts: 3,
          lastError: 'boom',
          lostAt: Date.now(),
        },
      });
      vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
      render(
        <WsConnectionTabContent
          {...makeProps({
            controlledMode: 'client',
            controlledLeftTab: 'connect',
            onModeChange,
            onLeftTabChange,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('edit-connection-btn'));
      expect(mockStudio.cancelReconnect).toHaveBeenCalled();
      expect(onModeChange).toHaveBeenCalledWith('client');
      expect(onLeftTabChange).toHaveBeenCalledWith('connect');
    });
  });
});
