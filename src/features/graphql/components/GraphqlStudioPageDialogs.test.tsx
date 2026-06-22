/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GraphqlStudioPageDialogs } from './GraphqlStudioPageDialogs';
import type { AdvancedSettingsValues } from './GraphqlAdvancedSettings';

vi.mock('./GraphqlComplexityGateModal', () => ({
  GraphqlComplexityGateModal: ({
    onSendAnyway,
    onCancel,
  }: {
    onSendAnyway: (remember: boolean) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="gql-complexity-gate-stub">
      <button type="button" data-testid="gate-send" onClick={() => onSendAnyway(false)}>Send</button>
      <button type="button" data-testid="gate-cancel" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('./GqlDedupBanner', () => ({
  GqlDedupBanner: ({
    visible,
    onWait,
  }: {
    visible: boolean;
    onWait: () => void;
  }) => (visible ? (
    <button type="button" data-testid="gql-dedup-stub" onClick={onWait}>Wait</button>
  ) : null),
}));

vi.mock('./GqlConnectionModals', () => ({
  GqlConnectionModals: () => <div data-testid="gql-connection-modals-stub" />,
}));

const advSettings: AdvancedSettingsValues = {
  apqEnabled: false,
  apqUseGet: false,
  apqUnsupportedDetected: false,
  batchEnabled: false,
  batchTimeoutMs: 30_000,
  batchUnsupportedDetected: false,
  dedupEnabled: true,
  complexityBlockEnabled: false,
  complexityBlockThreshold: 1000,
  subscriptionTransport: 'auto',
  sseMode: 'distinct',
  wsEndpointOverride: '',
  historyMaxItems: 100,
  subscriptionBufferSize: 5000,
  maxFileSizeMb: 50,
};

function makeProps(overrides: Partial<Parameters<typeof GraphqlStudioPageDialogs>[0]> = {}) {
  const pendingExecuteAfterGateRef = { current: vi.fn() as (() => void) | null };
  const sessionBypassComplexityGateRef = { current: false };
  const skipComplexityGateRef = { current: false };
  const setComplexityGatePending = vi.fn();
  const setComplexityWarningPending = vi.fn();
  const resolveDedupChoice = vi.fn();

  return {
    complexityGatePending: false,
    complexityResult: null,
    advSettings,
    pendingExecuteAfterGateRef,
    sessionBypassComplexityGateRef,
    skipComplexityGateRef,
    setComplexityGatePending,
    setComplexityWarningPending,
    isDuplicate: false,
    duplicateSourceTabId: null,
    activeTabId: 'tab-1',
    resolveDedupChoice,
    connectionModals: {
      profileModalOpen: false,
      onProfileModalClose: vi.fn(),
      profiles: [],
      endpoint: 'https://api.example.com/graphql',
      auth: null,
      onSaveProfile: vi.fn(),
      onDeleteProfile: vi.fn(),
      onApplyProfileToActiveTab: vi.fn(),
      prevBaseUrlRef: { current: undefined },
      envModalOpen: false,
      onEnvModalClose: vi.fn(),
      environments: [],
      activeEnvironmentId: null,
      onCreateEnvironment: vi.fn(),
      onDeleteEnvironment: vi.fn(),
      onSetActiveEnvironment: vi.fn(),
      onRenameEnvironment: vi.fn(),
      onUpdateVariables: vi.fn(),
      onImportEnvironment: vi.fn(),
      onExportEnvironment: vi.fn(),
    },
    ...overrides,
  };
}

describe('GraphqlStudioPageDialogs', () => {
  it('renders connection modals shell', () => {
    render(<GraphqlStudioPageDialogs {...makeProps()} />);
    expect(screen.getByTestId('gql-connection-modals-stub')).toBeInTheDocument();
  });

  it('shows complexity gate when pending and invokes deferred execute on send', () => {
    const executeFn = vi.fn();
    const pendingExecuteAfterGateRef = { current: executeFn };
    const setComplexityGatePending = vi.fn();
    const setComplexityWarningPending = vi.fn();
    render(
      <GraphqlStudioPageDialogs
        {...makeProps({
          complexityGatePending: true,
          complexityResult: {
            score: 2000,
            level: 'danger',
            shouldBlock: true,
            threshold: 1000,
            fieldBreakdown: [],
          },
          pendingExecuteAfterGateRef,
          setComplexityGatePending,
          setComplexityWarningPending,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('gate-send'));
    expect(setComplexityGatePending).toHaveBeenCalledWith(false);
    expect(setComplexityWarningPending).toHaveBeenCalledWith(false);
    expect(executeFn).toHaveBeenCalledOnce();
  });

  it('shows dedup banner when duplicate is on active tab', () => {
    const resolveDedupChoice = vi.fn();
    render(
      <GraphqlStudioPageDialogs
        {...makeProps({
          isDuplicate: true,
          duplicateSourceTabId: 'tab-1',
          resolveDedupChoice,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-dedup-stub'));
    expect(resolveDedupChoice).toHaveBeenCalledWith('wait');
  });

  it('hides dedup banner when duplicate is on a different tab', () => {
    render(
      <GraphqlStudioPageDialogs
        {...makeProps({
          isDuplicate: true,
          duplicateSourceTabId: 'other-tab',
          activeTabId: 'tab-1',
        })}
      />,
    );
    expect(screen.queryByTestId('gql-dedup-stub')).not.toBeInTheDocument();
  });
});
