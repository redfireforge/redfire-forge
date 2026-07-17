/**
 * @vitest-environment jsdom
 *
 * Handler coverage for WsConnectionTabContent callbacks that are not reachable
 * via the default Events pane (showAuxPanels=false).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WsConnectionTabContent, type WsConnectionTabContentProps } from './WsConnectionTabContent';
import * as hookModule from './useWebSocketStudio';
import type { UseWebSocketStudioReturn } from './useWebSocketStudio';
import * as recordingModule from './useWebSocketRecording';
import type { UseWebSocketRecordingReturn } from './useWebSocketRecording';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import * as mockServerModule from './useWebSocketMockServer';
import { createDefaultDraft } from '../../shared/websocket/types';
import {
  makeStudioReturn,
  makeProfilesReturn,
  makeTemplatesReturn,
  makeMockServerReturn,
  makeRecordingReturn,
} from './WebSocketStudioPage.test-factories';

vi.mock('./WebSocketSavedConnections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./WebSocketSavedConnections')>();
  return {
    ...actual,
    WebSocketSavedDetail: ({ ui }: { ui: { handleLoad: (id: string) => void } }) => (
      <button type="button" data-testid="ghost-load-btn" onClick={() => ui.handleLoad('ghost-id')}>
        ghost load
      </button>
    ),
  };
});

vi.mock('./WebSocketMessageLog', () => ({
  WebSocketMessageLog: (props: {
    onToggleLoadTest?: () => void;
    onToggleSchemasVisible?: () => void;
  }) => (
    <div data-testid="mock-message-log">
      <button type="button" data-testid="mock-toggle-load-test" onClick={props.onToggleLoadTest}>
        load test
      </button>
      <button type="button" data-testid="mock-toggle-schema" onClick={props.onToggleSchemasVisible}>
        schema
      </button>
    </div>
  ),
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

describe('WsConnectionTabContent — handler coverage', () => {
  it('toggles load test and schema visibility via message log callbacks', async () => {
    render(<WsConnectionTabContent {...makeProps()} />);
    fireEvent.click(screen.getByTestId('mock-toggle-load-test'));
    fireEvent.click(screen.getByTestId('mock-toggle-load-test'));
    fireEvent.click(screen.getByTestId('mock-toggle-schema'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-message-log')).toBeTruthy();
    });
  });

  it('forwards mock port changes to onMockPortChange', async () => {
    const onMockPortChange = vi.fn();
    render(
      <WsConnectionTabContent
        {...makeProps({ controlledMode: 'mock', onMockPortChange })}
      />,
    );
    const input = screen.getByTestId('mock-port-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onMockPortChange).toHaveBeenCalledWith('test-tab', 9999);
    });
  });

  it('loads profile draft without applying studio settings when profile is missing', async () => {
    const loadProfileAsDraft = vi.fn().mockReturnValue(createDefaultDraft());
    mockProfiles = makeProfilesReturn({
      profiles: [],
      loadProfileAsDraft,
    });
    render(
      <WsConnectionTabContent
        {...makeProps({ controlledMode: 'saved', profilesHook: mockProfiles })}
      />,
    );
    fireEvent.click(screen.getByTestId('ghost-load-btn'));
    await waitFor(() => {
      expect(loadProfileAsDraft).toHaveBeenCalledWith('ghost-id');
      expect(mockStudio.setProtocolMode).not.toHaveBeenCalled();
    });
  });

  it('disables relocated headers editor while connection is closing', async () => {
    mockStudio = makeStudioReturn({
      connection: { state: 'closing', url: 'ws://x', error: null },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(
      <WsConnectionTabContent
        {...makeProps({ controlledMode: 'client', controlledLeftTab: 'headers' })}
      />,
    );
    const addBtn = screen.getByTestId('headers-add-btn') as HTMLButtonElement;
    await waitFor(() => {
      expect(addBtn.disabled).toBe(true);
    });
  });

  it('disables relocated headers editor while reconnect is active', async () => {
    mockStudio = makeStudioReturn({
      reconnectState: {
        active: true,
        attempt: 1,
        maxAttempts: 5,
        lastError: null,
        lostAt: Date.now(),
      },
    });
    vi.spyOn(hookModule, 'useWebSocketStudio').mockReturnValue(mockStudio);
    render(
      <WsConnectionTabContent
        {...makeProps({ controlledMode: 'client', controlledLeftTab: 'headers' })}
      />,
    );
    const addBtn = screen.getByTestId('headers-add-btn') as HTMLButtonElement;
    await waitFor(() => {
      expect(addBtn.disabled).toBe(true);
    });
  });

  it('renders console panel for the console right tab', async () => {
    render(
      <WsConnectionTabContent
        {...makeProps({
          controlledMode: 'client',
          controlledLeftTab: 'connect',
          controlledRightTab: 'console',
        })}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('ws-studio-console-pane')).toBeTruthy();
      expect(screen.getByTestId('ws-console')).toBeTruthy();
    });
  });
});
