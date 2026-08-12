/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerTabs, API_MOCK_WORKSPACE_PANEL_ID } from './ApiMockServerTabs';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string, name: string, port: number): ApiMockServerDefinitionV1 {
  return {
    id,
    name,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('ApiMockServerTabs', () => {
  it('renders tabs with default stopped status and create/select handlers', () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(<ApiMockServerTabs servers={servers} activeServerId="srv-1" onSelect={onSelect} onCreate={onCreate} onClose={vi.fn()} />);

    const tabs = within(screen.getByTestId('api-mock-server-tabs')).getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-controls', API_MOCK_WORKSPACE_PANEL_ID);
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(tabs[0].getAttribute('title')).toContain('Stopped');

    fireEvent.click(tabs[1]);
    expect(onSelect).toHaveBeenCalledWith('srv-2');
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('renders running and dirty state indicators and closes from the close button', () => {
    const onClose = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600)];
    render(
      <ApiMockServerTabs
        servers={servers}
        activeServerId="srv-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={onClose}
        statusById={{ 'srv-1': 'running' }}
        dirtyById={{ 'srv-1': true }}
      />,
    );

    expect(screen.getByTestId('api-mock-tab-srv-1').getAttribute('title')).toContain('Running');
    expect(screen.getByRole('img', { name: 'Unapplied changes' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-tab-close-srv-1'));
    expect(onClose).toHaveBeenCalledWith('srv-1');
  });

  it('supports Delete/Backspace keyboard close only when a tab is focused', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const servers = [makeServer('srv-1', 'Mock Server 1', 4600), makeServer('srv-2', 'Mock Server 2', 4601)];
    render(<ApiMockServerTabs servers={servers} activeServerId="srv-1" onSelect={onSelect} onCreate={vi.fn()} onClose={onClose} />);

    const list = screen.getByRole('tablist', { name: 'Mock server tabs' });
    fireEvent.keyDown(list, { key: 'Delete' });
    expect(onClose).not.toHaveBeenCalled();

    const tabs = within(list).getAllByRole('tab');
    tabs[1].focus();
    fireEvent.keyDown(list, { key: 'Backspace' });
    expect(onClose).toHaveBeenCalledWith('srv-2');
  });
});
