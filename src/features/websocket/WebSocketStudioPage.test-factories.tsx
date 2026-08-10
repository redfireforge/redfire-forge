/**
 * Shared factory functions for WebSocket feature tests.
 * Imported by WebSocketStudioPage.test.tsx, .shell.test.tsx,
 * WsConnectionTabContent.test.tsx, and WsConnectionTabContent.coverage.test.tsx.
 */
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { WebSocketStudioPage } from './WebSocketStudioPage';
import type { UseWebSocketStudioReturn } from './useWebSocketStudio';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
import type { UseWebSocketHistoryReturn } from '../../app/hooks/useWebSocketHistory';
import type { UseWebSocketMockServerReturn } from './useWebSocketMockServer';
import type { UseWebSocketRecordingReturn } from './useWebSocketRecording';
import { createDefaultDraft, createDefaultReconnectState, createDefaultTlsConfig } from '../../shared/websocket/types';

export function makeStudioReturn(overrides?: Partial<UseWebSocketStudioReturn>): UseWebSocketStudioReturn {
  return {
    draft: createDefaultDraft(),
    setDraft: vi.fn(),
    connection: { state: 'disconnected' },
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    sendPing: vi.fn(),
    messages: [],
    filteredMessages: [],
    maxMessages: 10000,
    setMaxMessages: vi.fn(),
    isMaxReached: false,
    searchText: '',
    setSearchText: vi.fn(),
    searchMode: 'text' as const,
    setSearchMode: vi.fn(),
    directionFilter: 'all',
    setDirectionFilter: vi.fn(),
    sizeFilter: 'all' as const,
    setSizeFilter: vi.fn(),
    timeFilter: 'all' as const,
    setTimeFilter: vi.fn(),
    contentTypeFilter: 'all' as const,
    setContentTypeFilter: vi.fn(),
    clearMessages: vi.fn(),
    appendReplayFrame: vi.fn(),
    bookmarkedIds: new Set<string>(),
    bookmarkedMessages: [],
    toggleBookmark: vi.fn(),
    sentCount: 0,
    receivedCount: 0,
    uptime: null,
    transportMode: 'direct',
    autoReconnect: false,
    setAutoReconnect: vi.fn(),
    reconnectState: createDefaultReconnectState(),
    cancelReconnect: vi.fn(),
    reconnectIntervalMs: 3000,
    setReconnectIntervalMs: vi.fn(),
    maxReconnectAttempts: 5,
    setMaxReconnectAttempts: vi.fn(),
    backoffMultiplier: 1.5,
    setBackoffMultiplier: vi.fn(),
    retryNow: vi.fn(),
    protocolMode: 'auto' as const,
    setProtocolMode: vi.fn(),
    detectedProtocol: null,
    tlsConfig: createDefaultTlsConfig(),
    setTlsConfig: vi.fn(),
    sioServerParams: null,
    ...overrides,
  };
}

export function makeProfilesReturn(overrides?: Partial<UseWebSocketProfilesReturn>): UseWebSocketProfilesReturn {
  return {
    profiles: [],
    loading: false,
    error: null,
    saveProfile: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
    clearAllProfiles: vi.fn().mockResolvedValue(undefined),
    duplicateProfile: vi.fn().mockResolvedValue(undefined),
    importProfiles: vi.fn().mockResolvedValue({ imported: 0, errors: [] }),
    exportProfiles: vi.fn().mockReturnValue('[]'),
    loadProfileAsDraft: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

export function makeTemplatesReturn(overrides?: Partial<UseWebSocketTemplatesReturn>): UseWebSocketTemplatesReturn {
  return {
    templates: [],
    loading: false,
    error: null,
    saveTemplate: vi.fn().mockResolvedValue(undefined),
    updateTemplate: vi.fn().mockResolvedValue(undefined),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    clearAllTemplates: vi.fn().mockResolvedValue(undefined),
    loadTemplate: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

export function makeHistoryReturn(overrides?: Partial<UseWebSocketHistoryReturn>): UseWebSocketHistoryReturn {
  return {
    history: [],
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearHistory: vi.fn(),
    ...overrides,
  };
}

export function makeMockServerReturn(overrides?: Partial<UseWebSocketMockServerReturn>): UseWebSocketMockServerReturn {
  return {
    status: { running: false, port: 9876, clientCount: 0, clients: [] },
    logs: [],
    rules: [],
    config: { port: 9876, fallback: 'echo' },
    starting: false,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn().mockResolvedValue(0),
    setRules: vi.fn(),
    setConfig: vi.fn(),
    clearLogs: vi.fn(),
    pushRulesToServer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function makeRecordingReturn(overrides?: Partial<UseWebSocketRecordingReturn>): UseWebSocketRecordingReturn {
  return {
    state: 'idle',
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    recordMessage: vi.fn(),
    recordStateChange: vi.fn(),
    loadRecording: vi.fn().mockResolvedValue(true),
    startReplay: vi.fn(),
    pauseReplay: vi.fn(),
    resumeReplay: vi.fn(),
    stopReplay: vi.fn(),
    replaySpeed: 1,
    setReplaySpeed: vi.fn(),
    replayProgress: null,
    loadedRecording: null,
    ...overrides,
  };
}

export async function renderStudioPage(props: Record<string, unknown> = {}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<WebSocketStudioPage {...props} />);
  });
  return result;
}
