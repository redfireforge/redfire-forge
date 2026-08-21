/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockWorkspaceNav } from './ApiMockWorkspaceNav';

describe('ApiMockWorkspaceNav', () => {
  it('switches Studio / Runtime / Conflicts views', () => {
    const onChange = vi.fn();
    render(<ApiMockWorkspaceNav view="studio" onChange={onChange} transactionCount={3} conflictCount={2} />);
    expect(screen.getByTestId('api-mock-view-studio').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('api-mock-view-runtime').textContent).toContain('3');
    expect(screen.getByTestId('api-mock-view-conflicts').textContent).toContain('2');
    fireEvent.click(screen.getByTestId('api-mock-view-runtime'));
    expect(onChange).toHaveBeenCalledWith('runtime');
    fireEvent.click(screen.getByTestId('api-mock-view-conflicts'));
    expect(onChange).toHaveBeenCalledWith('conflicts');
  });

  it('import button calls onImport, export dropdown triggers each scope', () => {
    const onImport = vi.fn();
    const onExport = vi.fn();

    render(
      <ApiMockWorkspaceNav
        view="studio"
        onChange={vi.fn()}
        onImport={onImport}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-import-menu'));
    expect(onImport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('api-mock-export'));
    expect(screen.getByTestId('api-mock-export-menu-panel')).toBeTruthy();
    expect(screen.getByTestId('api-mock-export-group-workspace')).toBeTruthy();
    expect(screen.getByTestId('api-mock-export-group-server')).toBeTruthy();
    expect(screen.getByTestId('api-mock-export-group-interop')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-export-workspace'));
    expect(onExport).toHaveBeenCalledWith({ scope: 'workspace', format: 'json' });

    fireEvent.click(screen.getByTestId('api-mock-export'));
    fireEvent.click(screen.getByTestId('api-mock-export-workspace-yaml'));
    expect(onExport).toHaveBeenCalledWith({ scope: 'workspace', format: 'yaml' });

    fireEvent.click(screen.getByTestId('api-mock-export'));
    fireEvent.click(screen.getByTestId('api-mock-export-routes'));
    expect(onExport).toHaveBeenCalledWith({ scope: 'routes', format: 'json' });

    fireEvent.click(screen.getByTestId('api-mock-export'));
    fireEvent.click(screen.getByTestId('api-mock-export-wiremock'));
    expect(onExport).toHaveBeenCalledWith({ scope: 'routes', format: 'wiremock' });

    fireEvent.click(screen.getByTestId('api-mock-export'));
    fireEvent.click(screen.getByTestId('api-mock-export-har'));
    expect(onExport).toHaveBeenCalledWith({ scope: 'servers', format: 'har' });

    fireEvent.click(screen.getByTestId('api-mock-export'));
    expect(screen.getByTestId('api-mock-export-menu-panel')).toBeTruthy();
    const ring = document.createElement('div');
    ring.className = 'demo-spotlight-ring';
    document.body.append(ring);
    fireEvent.mouseDown(ring);
    expect(screen.getByTestId('api-mock-export-menu-panel')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('api-mock-export-menu-panel')).toBeNull();
  });

  it('hides import/export when callbacks are not provided', () => {
    render(<ApiMockWorkspaceNav view="studio" onChange={vi.fn()} />);
    expect(screen.queryByTestId('api-mock-import-menu')).toBeNull();
    expect(screen.queryByTestId('api-mock-export')).toBeNull();
  });
});
