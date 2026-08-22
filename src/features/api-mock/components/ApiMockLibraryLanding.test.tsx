/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockLibraryLanding } from './ApiMockLibraryLanding';

describe('ApiMockLibraryLanding', () => {
  it('shows the no-open-server hint and creates a new server', () => {
    const onCreate = vi.fn();
    render(
      <div className="api-mock-root">
        <ApiMockLibraryLanding onCreate={onCreate} />
      </div>,
    );

    expect(screen.getByTestId('api-mock-library-landing')).toBeTruthy();
    expect(screen.getByText('API Mock Studio')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-landing-create'));
    expect(onCreate).toHaveBeenCalled();
  });
});

