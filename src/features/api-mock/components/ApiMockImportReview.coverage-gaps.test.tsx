/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('ApiMockImportReview coverage gaps', () => {
  it('renders error diagnostics from conversion results', async () => {
    vi.doMock('../../../shared/api-mock/sourceToRule', () => ({
      convertSourceToRule: () => ({
        route: {
          id: 'route-1',
          name: 'Imported',
          enabled: false,
          method: 'GET',
          path: { kind: 'exact', value: '/users' },
          priority: 10,
          predicates: { id: 'pg', combinator: 'all', children: [] },
          responseMode: 'rules',
          responses: [],
          tags: [],
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        },
        diagnostics: [{ code: 'AMS-IMPORT-FAIL', severity: 'error', path: '/', message: 'broken import' }],
      }),
    }));

    const { ApiMockImportReview } = await import('./ApiMockImportReview');
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /users' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    const notice = screen.getByText(/broken import/i).closest('.am-notice');
    expect(notice).toHaveClass('danger');
  });
});
