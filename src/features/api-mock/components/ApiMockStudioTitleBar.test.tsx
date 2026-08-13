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
  it('renders title, subtitle, and server tabs', () => {
    render(
      <ApiMockStudioTitleBar
        servers={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('API Mock Studio')).toBeTruthy();
    expect(screen.getByTestId('mock-server-tabs')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-import-menu')).toBeNull();
    expect(screen.queryByTestId('api-mock-export')).toBeNull();
  });
});
