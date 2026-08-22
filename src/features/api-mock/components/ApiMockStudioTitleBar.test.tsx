/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockStudioTitleBar } from './ApiMockStudioTitleBar';

vi.mock('./ApiMockServerTabs', () => ({
  ApiMockServerTabs: () => <div data-testid="mock-server-tabs">tabs</div>,
}));

describe('ApiMockStudioTitleBar', () => {
  it('renders server tabs without a page title or a saved-server button', () => {
    render(
      <ApiMockStudioTitleBar
        servers={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('API Mock Studio')).toBeNull();
    expect(screen.queryByText(/Independent local mock/)).toBeNull();
    expect(screen.getByTestId('mock-server-tabs')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-import-menu')).toBeNull();
    expect(screen.queryByTestId('api-mock-export')).toBeNull();
    // Saved-server browsing lives in the left sidebar now.
    expect(screen.queryByTestId('api-mock-open-library')).toBeNull();
  });
});
