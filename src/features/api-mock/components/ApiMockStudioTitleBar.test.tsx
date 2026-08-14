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
  it('renders server tabs without a page title', () => {
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
    // No handler wired — the saved-server entry point stays hidden.
    expect(screen.queryByTestId('api-mock-open-library')).toBeNull();
  });

  it('opens the saved-server library and shows how many servers are closed', () => {
    const onOpenLibrary = vi.fn();
    render(
      <ApiMockStudioTitleBar
        servers={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        onOpenLibrary={onOpenLibrary}
        savedCount={5}
        parkedCount={2}
      />,
    );

    expect(screen.getByTestId('api-mock-open-library')).toHaveTextContent('5');
    expect(screen.getByTestId('api-mock-parked-count')).toHaveTextContent('2 closed');
    fireEvent.click(screen.getByTestId('api-mock-open-library'));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it('hides the closed-server hint when every saved server is open', () => {
    render(
      <ApiMockStudioTitleBar
        servers={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        onOpenLibrary={vi.fn()}
        savedCount={3}
        parkedCount={0}
      />,
    );

    expect(screen.queryByTestId('api-mock-parked-count')).toBeNull();
  });

  it('shows a zero count while the library is still loading its tally', () => {
    render(
      <ApiMockStudioTitleBar
        servers={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        onOpenLibrary={vi.fn()}
      />,
    );

    expect(screen.getByTestId('api-mock-open-library')).toHaveTextContent('0');
    expect(screen.queryByTestId('api-mock-parked-count')).toBeNull();
  });
});
