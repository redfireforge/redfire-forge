/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import type { ApiMockExportResult } from '../apiMockExportActions';

vi.mock('./ApiMockServerSettingsModal', () => ({
  ApiMockServerSettingsModal: ({ onClose, statusLabel }: { onClose: () => void; statusLabel: string }) => (
    <div>
      <span data-testid="mock-settings-status">{statusLabel}</span>
      <button data-testid="mock-settings-close" onClick={onClose}>close-settings</button>
    </div>
  ),
}));
vi.mock('./ApiMockSimulateModal', () => ({
  ApiMockSimulateModal: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="mock-simulate-close" onClick={onClose}>close-simulate</button>
  ),
}));
vi.mock('./ApiMockImportReview', () => ({
  ApiMockImportReview: ({ onCancel }: { onCancel: () => void }) => (
    <button data-testid="mock-import-inner-cancel" onClick={onCancel}>inner-cancel</button>
  ),
}));
vi.mock('./ApiMockExportConfirm', () => ({
  ApiMockExportConfirm: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="mock-export-confirm-close" onClick={onClose}>export-close</button>
  ),
}));

import { ApiMockStudioModals } from './ApiMockStudioModals';

const ts = '2026-08-14T00:00:00.000Z';
const server = {
  id: 'srv-1',
  name: 'Store API',
  enabled: true,
  host: '127.0.0.1',
  port: 4600,
  basePath: '',
  folders: [],
  routes: [],
  samples: [],
  variables: [],
  settings: {},
  createdAt: ts,
  updatedAt: ts,
} as unknown as ApiMockServerDefinitionV1;

const exportResult: ApiMockExportResult = {
  filename: 'workspace.json',
  format: 'json',
  scope: 'workspace',
  text: '{}',
  redacted: true,
  sensitiveValues: [],
  lossNotes: [],
  cliCommand: 'redfireforge mock simulate workspace.json',
  liveMessage: 'Workspace exported.',
};

const closed = {
  settingsOpen: false,
  setSettingsOpen: vi.fn(),
  runtimeStatus: 'stopped',
  simulateOpen: false,
  setSimulateOpen: vi.fn(),
  selectedRoute: undefined,
  simulateSeed: undefined,
  setSimulateSeed: vi.fn(),
  importOpen: false,
  setImportOpen: vi.fn(),
  importSource: 'curl' as const,
  exportResult: null,
  onCloseExport: vi.fn(),
  onImportRoutes: vi.fn(),
  folders: [],
};

describe('ApiMockStudioModals', () => {
  it('renders nothing without an active server', () => {
    render(<ApiMockStudioModals activeServer={undefined} {...closed} />);
    expect(screen.queryByTestId('api-mock-import-close')).toBeNull();
  });

  it('closes Import from the footer Cancel control', () => {
    const setImportOpen = vi.fn();
    render(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        importOpen
        setImportOpen={setImportOpen}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-import-close'));
    expect(setImportOpen).toHaveBeenCalledWith(false);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(setImportOpen).toHaveBeenCalled();
  });

  it('renders settings, simulate, and Import inner cancel', () => {
    const setSettingsOpen = vi.fn();
    const setSimulateOpen = vi.fn();
    const setSimulateSeed = vi.fn();
    const setImportOpen = vi.fn();
    const { rerender } = render(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        settingsOpen
        setSettingsOpen={setSettingsOpen}
      />,
    );
    expect(screen.getByTestId('mock-settings-status')).toHaveTextContent('Stopped');
    fireEvent.click(screen.getByTestId('mock-settings-close'));
    expect(setSettingsOpen).toHaveBeenCalledWith(false);
    rerender(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        settingsOpen
        runtimeStatus="running"
        setSettingsOpen={setSettingsOpen}
      />,
    );
    expect(screen.getByTestId('mock-settings-status')).toHaveTextContent('Running');
    rerender(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        settingsOpen
        runtimeStatus="error"
        setSettingsOpen={setSettingsOpen}
      />,
    );
    expect(screen.getByTestId('mock-settings-status')).toHaveTextContent('Error');
    rerender(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        simulateOpen
        setSimulateOpen={setSimulateOpen}
        setSimulateSeed={setSimulateSeed}
        selectedRoute={undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('mock-simulate-close'));
    expect(setSimulateOpen).toHaveBeenCalledWith(false);
    expect(setSimulateSeed).toHaveBeenCalledWith(undefined);
    rerender(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        importOpen
        setImportOpen={setImportOpen}
      />,
    );
    fireEvent.click(screen.getByTestId('mock-import-inner-cancel'));
    expect(setImportOpen).toHaveBeenCalledWith(false);
  });

  it('renders the export confirmation and forwards Close', () => {
    const onCloseExport = vi.fn();
    render(
      <ApiMockStudioModals
        activeServer={server}
        {...closed}
        exportResult={exportResult}
        onCloseExport={onCloseExport}
      />,
    );
    fireEvent.click(screen.getByTestId('mock-export-confirm-close'));
    expect(onCloseExport).toHaveBeenCalled();
  });
});
