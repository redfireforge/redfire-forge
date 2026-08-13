/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';

const loadApiMockWorkspace = vi.fn();
const saveApiMockWorkspace = vi.fn();

vi.mock('../apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadApiMockWorkspace(...args),
  saveApiMockWorkspace: (...args: unknown[]) => saveApiMockWorkspace(...args),
}));

vi.mock('../../../shared/components/AppModalFrame', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    footer,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="app-modal-frame">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({
    value,
    onChange,
    options,
    'data-testid': testId,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
    'data-testid'?: string;
    'aria-label'?: string;
  }) => (
    <select
      data-testid={testId}
      aria-label={ariaLabel}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { ExportToApiMockModal } from './ExportToApiMockModal';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

const requestItems = [
  { method: 'GET', url: 'https://api.example.com/users', label: 'List users' },
];

const catalogItems = [
  { method: 'POST', path: '/widgets', label: 'Create widget' },
];

describe('ExportToApiMockModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveApiMockWorkspace.mockResolvedValue(undefined);
    loadApiMockWorkspace.mockResolvedValue({
      servers: [makeServer()],
      activeServerId: 'srv-1',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows empty-server message and disables confirm when no servers exist', async () => {
    loadApiMockWorkspace.mockResolvedValue({ servers: [], activeServerId: undefined });

    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/No mock servers found/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('export-to-mock-server')).toBeNull();
    expect(screen.getByTestId('export-to-mock-confirm')).toBeDisabled();
  });

  it('previews requests source routes and uses active server when set', async () => {
    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-to-mock-routes')).toBeInTheDocument();
    });
    expect(screen.getByTestId('export-to-mock-server')).toHaveValue('srv-1');
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByTestId('export-to-mock-confirm')).toHaveTextContent('Export 1 route');
  });

  it('previews catalog source routes', async () => {
    render(
      <ExportToApiMockModal items={catalogItems} sourceKind="catalog" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-to-mock-routes')).toBeInTheDocument();
    });
    expect(screen.getByText('/widgets')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
  });

  it('falls back to first server when activeServerId is missing', async () => {
    loadApiMockWorkspace.mockResolvedValue({
      servers: [makeServer({ id: 'srv-a' }), makeServer({ id: 'srv-b', name: 'Other', port: 4700 })],
      activeServerId: undefined,
    });

    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-to-mock-server')).toHaveValue('srv-a');
    });
  });

  it('selects existing folder when server has folders', async () => {
    loadApiMockWorkspace.mockResolvedValue({
      servers: [makeServer({ folders: [{ id: 'fld-1', name: 'Users', expanded: true, sortOrder: 0 }] })],
      activeServerId: 'srv-1',
    });

    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-to-mock-folder')).toHaveValue('fld-1');
    });
    expect(screen.queryByTestId('export-to-mock-new-folder')).toBeNull();
  });

  it('shows new-folder input when creating a folder and exports into existing folder', async () => {
    loadApiMockWorkspace.mockResolvedValue({
      servers: [makeServer({ folders: [{ id: 'fld-1', name: 'Users', expanded: true, sortOrder: 0 }] })],
      activeServerId: 'srv-1',
    });
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <ExportToApiMockModal
        items={requestItems}
        sourceKind="requests"
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-folder')).toHaveValue('fld-1'));

    fireEvent.change(screen.getByTestId('export-to-mock-folder'), { target: { value: '__new__' } });
    expect(screen.getByTestId('export-to-mock-new-folder')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('export-to-mock-folder'), { target: { value: 'fld-1' } });
    fireEvent.change(screen.getByTestId('export-to-mock-priority'), { target: { value: '25' } });

    fireEvent.click(screen.getByTestId('export-to-mock-confirm'));

    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
    const saved = saveApiMockWorkspace.mock.calls[0][0];
    expect(saved.servers[0].routes).toHaveLength(1);
    expect(saved.servers[0].folders).toHaveLength(1);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('creates a new folder on confirm and auto-closes after success', async () => {
    const onClose = vi.fn();

    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={onClose} />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-folder')).toHaveValue('__new__'));
    fireEvent.change(screen.getByTestId('export-to-mock-new-folder'), { target: { value: 'Imported' } });
    fireEvent.click(screen.getByTestId('export-to-mock-confirm'));

    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
    const saved = saveApiMockWorkspace.mock.calls[0][0];
    expect(saved.servers[0].folders).toHaveLength(1);
    expect(saved.servers[0].folders[0].name).toBe('Imported');
    expect(saved.servers[0].routes[0].folderId).toBe(saved.servers[0].folders[0].id);

    expect(screen.getByText('Exported successfully')).toBeInTheDocument();
    expect(screen.getByTestId('export-to-mock-confirm')).toHaveTextContent('Done');
    expect(screen.getByTestId('export-to-mock-confirm')).toBeDisabled();

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1500 });
  });

  it('uses default priority when priority input is invalid', async () => {
    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-routes')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('export-to-mock-priority'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('export-to-mock-confirm'));

    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
    expect(saveApiMockWorkspace.mock.calls[0][0].servers[0].routes[0].priority).toBe(10);
  });

  it('shows plural route heading for multiple items', async () => {
    const items = [
      { method: 'GET', url: 'https://api.example.com/users' },
      { method: 'POST', url: 'https://api.example.com/users' },
    ];

    render(
      <ExportToApiMockModal items={items} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generated routes (2)')).toBeInTheDocument();
    });
    expect(screen.getByTestId('export-to-mock-confirm')).toHaveTextContent('Export 2 routes');
  });

  it('disables confirm when there are no routes to export', async () => {
    render(
      <ExportToApiMockModal items={[]} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-body')).toBeInTheDocument());
    expect(screen.queryByTestId('export-to-mock-routes')).toBeNull();
    expect(screen.getByTestId('export-to-mock-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('export-to-mock-confirm'));
    expect(saveApiMockWorkspace).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={onClose} />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-cancel')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('export-to-mock-cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('switches target server via server select', async () => {
    loadApiMockWorkspace.mockResolvedValue({
      servers: [
        makeServer({ id: 'srv-a', name: 'Alpha', port: 4600 }),
        makeServer({ id: 'srv-b', name: 'Beta', port: 4700 }),
      ],
      activeServerId: 'srv-a',
    });

    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-server')).toHaveValue('srv-a'));
    fireEvent.change(screen.getByTestId('export-to-mock-server'), { target: { value: 'srv-b' } });
    expect(screen.getByTestId('export-to-mock-server')).toHaveValue('srv-b');
  });

  it('skips folder creation when new folder name is blank', async () => {
    render(
      <ExportToApiMockModal items={requestItems} sourceKind="requests" onClose={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId('export-to-mock-new-folder')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('export-to-mock-new-folder'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('export-to-mock-confirm'));

    await waitFor(() => expect(saveApiMockWorkspace).toHaveBeenCalled());
    expect(saveApiMockWorkspace.mock.calls[0][0].servers[0].folders).toHaveLength(0);
  });
});
