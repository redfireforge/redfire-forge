/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { useGrpcStudioPageConnectionState } from './useGrpcStudioPageConnectionState';
import { GrpcStudioPageConnectionChrome } from './GrpcStudioPageConnectionChrome';

type ConnectionBarProps = {
  target: string;
  targetInvalid?: boolean;
  transportMode?: string;
  saveRequestDisabled?: boolean;
  onTargetChange?: (value: string) => void;
  onConnectionToggle?: () => void;
  onSettingsClick?: () => void;
};

type TargetPanelProps = {
  target: string;
  fallbackTarget?: string;
  tlsMode?: string;
};

const connectionBarSpy = vi.hoisted(() => vi.fn<[ConnectionBarProps], React.ReactElement>());
const targetPanelSpy = vi.hoisted(() => vi.fn<[TargetPanelProps], React.ReactElement>());

vi.mock('../components/GrpcConnectionBar', () => ({
  GrpcConnectionBar: (props: ConnectionBarProps) => {
    connectionBarSpy(props);
    return React.createElement('button', {
      'data-testid': 'mock-connection-bar',
      onClick: props.onConnectionToggle,
    }, 'connection-bar');
  },
}));

vi.mock('../components/GrpcTargetPanel', () => ({
  GrpcTargetPanel: (props: TargetPanelProps) => {
    targetPanelSpy(props);
    return React.createElement('div', { 'data-testid': 'mock-target-panel' });
  },
}));

function makeStudio(overrides: Partial<UseGrpcStudioReturn> = {}): UseGrpcStudioReturn {
  return {
    activeTab: {
      id: 'tab-1',
      target: 'localhost:9090',
      transportMode: 'spring-servlet',
      service: 'echo.EchoService',
      method: 'Echo',
      timeoutMs: 30_000,
      tlsMode: 'plaintext',
      connectionId: null,
      envVarOverrides: {},
      body: '{}',
      metadata: [],
      auth: undefined,
      targetConnection: { state: 'idle' },
    },
    activeTabId: 'tab-1',
    profiles: [],
    updateTab: vi.fn(),
    toggleTargetConnection: vi.fn(),
    ...overrides,
  } as UseGrpcStudioReturn;
}

function makeConnection(
  overrides: Partial<ReturnType<typeof useGrpcStudioPageConnectionState>> = {},
): ReturnType<typeof useGrpcStudioPageConnectionState> {
  return {
    activeTab: makeStudio().activeTab,
    activeConnection: {
      targetValidation: { valid: true, message: '' },
      tlsMode: 'plaintext',
    },
    connectionEditingDisabled: false,
    handleDeadlineBadgeClick: vi.fn(),
    handleFocusAuthTab: vi.fn(),
    handleSettingsClick: vi.fn(),
    handleTlsBadgeClick: vi.fn(),
    reflectionLoadedCount: 2,
    resolvedActiveAuthState: { auth: undefined },
    resolvedTlsMode: 'plaintext',
    rawConnectionTarget: 'localhost:50051',
    tlsState: { valid: true },
    ...overrides,
  } as ReturnType<typeof useGrpcStudioPageConnectionState>;
}

describe('GrpcStudioPageConnectionChrome coverage gaps', () => {
  beforeEach(() => {
    connectionBarSpy.mockClear();
    targetPanelSpy.mockClear();
  });

  it('passes transport mode and disables save when method is unset', () => {
    const studio = makeStudio({
      activeTab: {
        ...makeStudio().activeTab,
        service: '',
        method: '',
      },
    });
    const connection = makeConnection({ activeTab: studio.activeTab });

    render(
      <GrpcStudioPageConnectionChrome
        studio={studio}
        envVarMap={{}}
        workspaceDefaults={{}}
        pageDefaults={{}}
        connection={connection}
        onSaveRequestClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
      />,
    );

    const barProps = connectionBarSpy.mock.calls.at(-1)![0];
    expect(barProps.transportMode).toBe('spring-servlet');
    expect(barProps.saveRequestDisabled).toBe(true);
    expect(barProps.targetInvalid).toBe(false);
    expect(targetPanelSpy.mock.calls.at(-1)![0].fallbackTarget).toBe('');
  });

  it('uses raw connection target fallback when tab target is blank', () => {
    const studio = makeStudio({
      activeTab: {
        ...makeStudio().activeTab,
        target: '   ',
      },
    });
    const connection = makeConnection({
      activeTab: studio.activeTab,
      rawConnectionTarget: 'localhost:8081',
    });

    render(
      <GrpcStudioPageConnectionChrome
        studio={studio}
        envVarMap={{ grpcHost: 'localhost:9090' }}
        workspaceDefaults={{ grpcHost: 'localhost:9090' }}
        pageDefaults={{ target: 'localhost:9090' }}
        connection={connection}
        onSaveRequestClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
      />,
    );

    expect(targetPanelSpy.mock.calls.at(-1)![0].fallbackTarget).toBe('localhost:8081');
  });

  it('wires target edits and connection toggle to studio handlers', () => {
    const studio = makeStudio();
    const connection = makeConnection({ activeTab: studio.activeTab });

    render(
      <GrpcStudioPageConnectionChrome
        studio={studio}
        envVarMap={{}}
        workspaceDefaults={{}}
        pageDefaults={{}}
        connection={connection}
        onSaveRequestClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
      />,
    );

    const barProps = connectionBarSpy.mock.calls.at(-1)![0];
    barProps.onTargetChange?.('localhost:50051');
    expect(studio.updateTab).toHaveBeenCalledWith('tab-1', { target: 'localhost:50051' });

    fireEvent.click(screen.getByTestId('mock-connection-bar'));
    expect(studio.toggleTargetConnection).toHaveBeenCalledWith('tab-1');
  });

  it('marks target invalid when connection validation fails', () => {
    const studio = makeStudio();
    const connection = makeConnection({
      activeTab: studio.activeTab,
      activeConnection: {
        targetValidation: { valid: false, message: 'bad target' },
        tlsMode: 'plaintext',
      },
    });

    render(
      <GrpcStudioPageConnectionChrome
        studio={studio}
        envVarMap={{}}
        workspaceDefaults={{}}
        pageDefaults={{}}
        connection={connection}
        onSaveRequestClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
      />,
    );

    expect(connectionBarSpy.mock.calls.at(-1)![0].targetInvalid).toBe(true);
  });

  it('falls back to connection tls mode when tab tls mode is unset', () => {
    const studio = makeStudio({
      activeTab: {
        ...makeStudio().activeTab,
        tlsMode: undefined,
      },
    });
    const connection = makeConnection({
      activeTab: studio.activeTab,
      activeConnection: {
        targetValidation: { valid: true, message: '' },
        tlsMode: 'tls',
      },
    });

    render(
      <GrpcStudioPageConnectionChrome
        studio={studio}
        envVarMap={{}}
        workspaceDefaults={{}}
        pageDefaults={{}}
        connection={connection}
        onSaveRequestClick={vi.fn()}
        onImportGrpcurlClick={vi.fn()}
      />,
    );

    expect(targetPanelSpy.mock.calls.at(-1)![0].tlsMode).toBe('tls');
  });
});
