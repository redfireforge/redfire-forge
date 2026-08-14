/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockLibraryLanding } from './ApiMockLibraryLanding';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockLibraryEntry } from '../apiMockServerLibrary';

function makeEntry(open = false): ApiMockLibraryEntry {
  return {
    open,
    ruleCount: 2,
    exampleCount: 1,
    server: {
      id: 'srv-1',
      name: 'Users API',
      enabled: true,
      host: '127.0.0.1',
      port: 4600,
      basePath: '',
      folders: [],
      routes: [],
      samples: [],
      variables: [],
      settings: { ...DEFAULT_SETTINGS },
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
  };
}

describe('ApiMockLibraryLanding', () => {
  it('lists saved servers and opens one from the landing', () => {
    const onOpen = vi.fn();
    render(
      <div className="api-mock-root">
        <ApiMockLibraryLanding
          entries={[makeEntry()]}
          atTabLimit={false}
          onOpen={onOpen}
          onDelete={vi.fn()}
          onCreate={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByTestId('api-mock-library-landing')).toBeTruthy();
    expect(screen.getByText('No mock server open')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-library-open-srv-1'));
    expect(onOpen).toHaveBeenCalledWith('srv-1');
  });
});
