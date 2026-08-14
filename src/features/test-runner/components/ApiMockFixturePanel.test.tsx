/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApiMockFixturePanel from './ApiMockFixturePanel';

const loadApiMockWorkspace = vi.fn();

vi.mock('../../api-mock/apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadApiMockWorkspace(...args),
}));

describe('ApiMockFixturePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadApiMockWorkspace.mockResolvedValue({
      servers: [
        { id: 'srv-1', name: 'Users', port: 4600 },
        { id: 'srv-2', name: 'Orders', port: 4601 },
      ],
    });
  });

  it('renders disabled fixture by default and loads workspace servers', async () => {
    const onChange = vi.fn();
    render(<ApiMockFixturePanel value={undefined} onChange={onChange} />);

    expect(screen.getByTestId('har-apimock-fixture')).toBeTruthy();
    expect((screen.getByTestId('har-apimock-fixture-enabled') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByTestId('har-apimock-fixture-server')).toBeNull();

    await waitFor(() => expect(loadApiMockWorkspace).toHaveBeenCalled());
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
    expect((screen.getByTestId('har-apimock-fixture-server') as HTMLSelectElement).value).toBe('srv-1');
    expect(screen.getByText('Users (:4600)')).toBeTruthy();
    expect(screen.getByText('Orders (:4601)')).toBeTruthy();
  });

  it('enables fixture and picks first server when none selected', async () => {
    const onChange = vi.fn();
    render(<ApiMockFixturePanel value={undefined} onChange={onChange} />);
    await waitFor(() => expect(loadApiMockWorkspace).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('har-apimock-fixture-enabled'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        serverId: 'srv-1',
        isolateRun: true,
        overrideBaseUrl: true,
        teardown: 'stop',
        portMode: 'auto',
      }),
    );
  });

  it('falls back to first loaded server when enabling with blank serverId', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: false, serverId: '' }} onChange={onChange} />,
    );
    await waitFor(() => expect(loadApiMockWorkspace).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('har-apimock-fixture-enabled'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, serverId: 'srv-1' }),
    );
  });

  it('uses empty serverId when enabling with no studio servers', async () => {
    loadApiMockWorkspace.mockResolvedValue({ servers: [] });
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: false, serverId: '' }} onChange={onChange} />,
    );
    await waitFor(() => expect(loadApiMockWorkspace).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('har-apimock-fixture-enabled'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, serverId: '' }),
    );
  });

  it('preserves serverId when re-enabling with existing config', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel
        value={{ enabled: false, serverId: 'srv-2', isolateRun: false, overrideBaseUrl: false }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(loadApiMockWorkspace).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('har-apimock-fixture-enabled'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        serverId: 'srv-2',
        isolateRun: false,
        overrideBaseUrl: false,
      }),
    );
  });

  it('clears config when disabling fixture', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    fireEvent.click(screen.getByTestId('har-apimock-fixture-enabled'));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('changes server selection', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    fireEvent.change(screen.getByTestId('har-apimock-fixture-server'), { target: { value: 'srv-2' } });

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

  it('toggles overrideBaseUrl checkbox', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel
        value={{ enabled: true, serverId: 'srv-1', overrideBaseUrl: true }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    const overrideCheckbox = screen.getByTestId('har-apimock-fixture-override') as HTMLInputElement;
    expect(overrideCheckbox.checked).toBe(true);

    fireEvent.click(overrideCheckbox);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, overrideBaseUrl: false }),
    );
  });

  it('treats isolateRun and overrideBaseUrl as true when undefined', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: 'srv-1' }} onChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId('har-apimock-fixture-server')).toBeTruthy());

    expect((screen.getByTestId('har-apimock-fixture-isolate') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('har-apimock-fixture-override') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('har-apimock-fixture-var').textContent).toMatch(/mock base URL/);
  });

  it('shows empty-server placeholder and disables select', async () => {
    loadApiMockWorkspace.mockResolvedValue({ servers: [] });
    const onChange = vi.fn();
    render(
      <ApiMockFixturePanel value={{ enabled: true, serverId: '' }} onChange={onChange} />,
    );

    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());
    expect((screen.getByTestId('har-apimock-fixture-server') as HTMLSelectElement).disabled).toBe(true);
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

    expect((screen.getByTestId('har-apimock-fixture-enabled') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('har-apimock-fixture-server') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId('har-apimock-fixture-isolate') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('har-apimock-fixture-override') as HTMLInputElement).disabled).toBe(true);
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
    expect(screen.getByTestId('har-apimock-fixture-stopped').textContent).toMatch(/Stopped/);
    expect(screen.getByTestId('har-apimock-fixture-freed-port').textContent).toBe('4612');
  });
});
