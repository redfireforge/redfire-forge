/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from '../../api-mock/apiMockGalleryImport';
import {
  API_MOCK_RUNTIME_CHANGED_EVENT,
  API_MOCK_WORKSPACE_PERSISTED_EVENT,
} from '../../api-mock/apiMockPersistence';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '@shared/components/CustomSelect';
import {
  getCustomSelectValue,
  isCustomSelectDisabled,
  selectOptionByTestId,
} from '@test-utils/customSelectHelper';
import ApiMockFixturePanel from './ApiMockFixturePanel';

const loadApiMockFixtureServers = vi.fn();

vi.mock('../utils/apiMockFixtureServers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/apiMockFixtureServers')>();
  return {
    ...actual,
    loadApiMockFixtureServers: (...args: unknown[]) => loadApiMockFixtureServers(...args),
  };
});

vi.mock('../../api-mock/apiMockPersistence', () => ({
  API_MOCK_WORKSPACE_PERSISTED_EVENT: 'api-mock:workspace-persisted',
  API_MOCK_RUNTIME_CHANGED_EVENT: 'api-mock:runtime-changed',
}));

describe('ApiMockFixturePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadApiMockFixtureServers.mockResolvedValue([
      { id: 'srv-1', name: 'Users', port: 4600, status: 'stopped' },
      { id: 'srv-2', name: 'Orders', port: 4601, status: 'stopped' },
    ]);
  });

  it('renders without throwing when value is undefined', () => {
    expect(() => {
      render(<ApiMockFixturePanel value={undefined} onChange={vi.fn()} />);
    }).not.toThrow();
    expect(screen.getByTestId('har-apimock-fixture')).toBeTruthy();
    expect(screen.queryByText('Start with run')).toBeNull();
    expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy();
    expect(screen.getByTestId('har-apimock-fixture-isolate-row')).toBeTruthy();
  });

  it('shows Server first and loads workspace servers', async () => {
    const onChange = vi.fn();
    render(<ApiMockFixturePanel value={undefined} onChange={onChange} />);

    expect(screen.getByTestId('har-apimock-fixture')).toBeTruthy();
    expect(screen.getByText('API Mock fixture')).toBeTruthy();
    expect(screen.getByText('Server')).toBeTruthy();
    expect(screen.queryByText('Start with run')).toBeNull();

    await waitFor(() => expect(loadApiMockFixtureServers).toHaveBeenCalled());
    await waitFor(() => expect(getCustomSelectValue(screen.getByTestId('har-apimock-fixture-server'))).toMatch(/Users/));
  });

  it('shows server controls when enabled with existing config', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1', isolateRun: true, overrideBaseUrl: true }}
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());
    const server = screen.getByTestId('har-apimock-fixture-server');
    expect(server.getAttribute('data-value')).toBe('srv-1');
    expect(getCustomSelectValue(server)).toMatch(/Users \(:4600\)/);
    expect(getCustomSelectValue(server)).toMatch(/Stopped/);
    expect(screen.getByTestId('har-apimock-fixture-server-dot').getAttribute('data-state')).toBe('stopped');
    expect(screen.getByTestId('har-apimock-fixture-server-status').textContent).toMatch(/Stopped/);
  });

  it('shows Running when the companion reports a live listener', async () => {
    loadApiMockFixtureServers.mockResolvedValue([
      { id: 'srv-1', name: 'Users', port: 4600, status: 'running' },
    ]);
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server-dot').getAttribute('data-state')).toBe('running'));
    expect(getCustomSelectValue(screen.getByTestId('har-apimock-fixture-server'))).toMatch(/Running/);
    expect(screen.getByTestId('har-apimock-fixture-server-status').textContent).toMatch(/running/i);
  });

  it('heals a blank serverId to the first Studio server', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: '' }} onChange={onChange} />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        serverId: 'srv-1',
        isolateRun: true,
        overrideBaseUrl: true,
        teardown: 'stop',
        portMode: 'auto',
      }),
    ));
  });

  it('does not heal when there are no Studio servers', async () => {
    loadApiMockFixtureServers.mockResolvedValue([]);
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: '' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps an existing serverId instead of overwriting it', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-2', isolateRun: false, overrideBaseUrl: false }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(getCustomSelectValue(screen.getByTestId('har-apimock-fixture-server'))).toMatch(/Orders/));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('changes server selection', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    selectOptionByTestId('har-apimock-fixture-server', 'Orders (:4601)');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, serverId: 'srv-2' }),
    );
  });

  it('toggles isolateRun checkbox', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1', isolateRun: true }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    const isolateCheckbox = screen.getByTestId('har-apimock-fixture-isolate') as HTMLInputElement;
    expect(isolateCheckbox.checked).toBe(true);

    fireEvent.click(isolateCheckbox);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, isolateRun: false }),
    );
  });

  it('treats isolateRun as true when undefined', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    expect((screen.getByTestId('har-apimock-fixture-isolate') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('har-apimock-fixture-override')).toBeNull();
  });

  it('does not change the heal effect dependency length when the fixture hydrates', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ApiMockFixturePanel value={undefined} onChange={vi.fn()} />,
    );
    rerender(
      <ApiMockFixturePanel
        value={{
          enabled: true,
          serverId: 'srv-b11d65d0',
          isolateRun: true,
          portMode: 'auto',
          overrideBaseUrl: true,
          teardown: 'stop',
        }}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(loadApiMockFixtureServers).toHaveBeenCalled());
    expect(err.mock.calls.flat().join('\n')).not.toMatch(/changed size between renders/);
    err.mockRestore();
  });

  it('reloads servers when the workspace changes and heals a blank serverId', async () => {
    loadApiMockFixtureServers
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { id: 'srv-live', name: 'Store API', port: 4612, status: 'stopped' },
      ]);
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: '' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());

    window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_CHANGED_EVENT));

    await waitFor(() => expect(screen.getByText('Store API (:4612)')).toBeTruthy());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, serverId: 'srv-live' }),
    ));
  });

  it('reloads servers when Studio persists a workspace', async () => {
    loadApiMockFixtureServers
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { id: 'srv-studio', name: 'Mock Server 1', port: 4500, status: 'stopped' },
      ]);
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: '' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());

    window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_PERSISTED_EVENT));

    await waitFor(() => expect(screen.getByText('Mock Server 1 (:4500)')).toBeTruthy());
    expect(isCustomSelectDisabled(screen.getByTestId('har-apimock-fixture-server'))).toBe(false);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, serverId: 'srv-studio' }),
    ));
  });

  it('shows No Studio servers when the workspace is deleted', async () => {
    loadApiMockFixtureServers
      .mockResolvedValueOnce([
        { id: 'srv-1', name: 'Users', port: 4600, status: 'stopped' },
      ])
      .mockResolvedValue([]);
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Users (:4600)')).toBeTruthy());

    window.dispatchEvent(new CustomEvent(API_MOCK_WORKSPACE_PERSISTED_EVENT));

    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());
  });

  it('reloads listener status when Studio start/stop publishes', async () => {
    loadApiMockFixtureServers
      .mockResolvedValueOnce([
        { id: 'srv-1', name: 'Users', port: 4600, status: 'stopped' },
      ])
      .mockResolvedValue([
        { id: 'srv-1', name: 'Users', port: 4600, status: 'running' },
      ]);
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server-dot').getAttribute('data-state')).toBe('stopped'));

    window.dispatchEvent(new CustomEvent(API_MOCK_RUNTIME_CHANGED_EVENT));

    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server-dot').getAttribute('data-state')).toBe('running'));
  });

  it('reloads when the runner tab becomes visible', async () => {
    loadApiMockFixtureServers.mockResolvedValue([
      { id: 'srv-later', name: 'Late Server', port: 4501, status: 'stopped' },
    ]);
    const { rerender } = render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: '' }}
        onChange={vi.fn()}
        visible={false}
      />,
    );
    expect(loadApiMockFixtureServers).not.toHaveBeenCalled();
    expect(screen.getByText('No Studio servers')).toBeTruthy();

    rerender(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: '' }}
        onChange={vi.fn()}
        visible={true}
      />,
    );
    await waitFor(() => expect(loadApiMockFixtureServers).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Late Server (:4501)')).toBeTruthy());
  });

  it('ignores a select value that is not in the workspace list', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    screen.getByTestId('har-apimock-fixture-server').dispatchEvent(
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'srv-gallery-store' } }),
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows empty-server placeholder and disables select', async () => {
    loadApiMockFixtureServers.mockResolvedValue([]);
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: '' }} onChange={onChange} />,
    );

    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());
    expect(isCustomSelectDisabled(screen.getByTestId('har-apimock-fixture-server'))).toBe(true);
  });

  it('disables all controls when panel is disabled', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1' }}
        onChange={onChange}
        disabled
      />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    expect(isCustomSelectDisabled(screen.getByTestId('har-apimock-fixture-server'))).toBe(true);
    expect((screen.getByTestId('har-apimock-fixture-isolate') as HTMLInputElement).disabled).toBe(true);
  });

  it('renders starting, running, and stopped fixture status lines', async () => {
    const { rerender } = render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1' }}
        onChange={vi.fn()}
        status={{ phase: 'starting' }}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-start').textContent).toMatch(/Starting mock listener/));

    rerender(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1' }}
        onChange={vi.fn()}
        status={{ phase: 'running', port: 4612, serverId: 'srv-1' }}
      />,
    );
    expect(screen.getByTestId('har-apimock-fixture-start').textContent).toContain('Started mock on :4612');
    expect(screen.getByTestId('har-apimock-fixture-port').textContent).toBe('4612');

    rerender(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1' }}
        onChange={vi.fn()}
        status={{ phase: 'stopped', port: 4612, serverId: 'srv-1' }}
      />,
    );
    expect(screen.getByTestId('har-apimock-fixture-start').textContent).toContain('Started mock on :4612');
    expect(screen.getByTestId('har-apimock-fixture-stopped').textContent).toMatch(/Stopped/);
    expect(screen.getByTestId('har-apimock-fixture-freed-port').textContent).toBe('4612');
    expect(screen.getByTestId('har-apimock-fixture-start').parentElement?.textContent).toMatch(
      /Started mock on :4612\s*·\s*Stopped · port 4612 freed/,
    );
  });
});
