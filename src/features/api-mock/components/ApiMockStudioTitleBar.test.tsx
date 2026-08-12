/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockStudioTitleBar } from './ApiMockStudioTitleBar';

vi.mock('./ApiMockServerTabs', () => ({
  ApiMockServerTabs: () => <div data-testid="mock-server-tabs">tabs</div>,
}));

describe('ApiMockStudioTitleBar', () => {
  it('opens/closes import menu, handles inside and outside click, and triggers actions', () => {
    const onImportCurl = vi.fn();
    const onExport = vi.fn();

    render(
      <ApiMockStudioTitleBar
        servers={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        onImportCurl={onImportCurl}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-import-menu'));
    expect(screen.getByTestId('api-mock-import-menu-panel')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('api-mock-import-menu-panel'));
    expect(screen.getByTestId('api-mock-import-menu-panel')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-import-curl'));
    expect(onImportCurl).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('api-mock-import-menu-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-import-menu'));
    expect(screen.getByTestId('api-mock-import-menu-panel')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('api-mock-import-menu-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-export'));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
