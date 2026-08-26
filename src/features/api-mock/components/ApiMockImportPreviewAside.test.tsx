/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockImportPreviewAside } from './ApiMockImportPreviewAside';
import type { PreviewState } from './apiMockImportReviewHelpers';

function makePreview(overrides: Partial<PreviewState> = {}): PreviewState {
  return {
    routes: [{
      id: 'r1',
      name: 'Users',
      enabled: false,
      method: 'GET',
      path: { kind: 'exact', value: '/users/{id}' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{
        id: 'v1', name: 'default', enabled: true, isDefault: true, status: 200,
        headers: [], cookies: [],
        body: { kind: 'json', content: '{"ok":true}', contentType: 'application/json' },
        behavior: { delayMs: 0, jitterMs: 0 },
      }],
      tags: [], createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
    }] as never,
    diagnostics: [],
    lossReport: [],
    ...overrides,
  };
}

describe('ApiMockImportPreviewAside', () => {
  it('shows HAR guidance when harIsParsed', () => {
    render(
      <ApiMockImportPreviewAside
        harIsParsed
        harPreview={{ accepted: [], filtered: [], truncated: false, error: 'bad json' } as never}
        preview={null}
      />,
    );
    expect(screen.getByText(/Fix the HAR JSON error/i)).toBeTruthy();
  });

  it('shows empty guidance when no preview routes', () => {
    render(<ApiMockImportPreviewAside harIsParsed={false} harPreview={null} preview={null} />);
    expect(screen.getByText(/Parse a source to preview/i)).toBeTruthy();
  });

  it('renders request/response preview cards including path params and multi-route numbering', () => {
    const preview = makePreview({
      routes: [
        makePreview().routes[0],
        {
          ...makePreview().routes[0],
          id: 'r2',
          method: 'POST',
          path: { kind: 'exact', value: '/orders' },
          responses: [{
            ...makePreview().routes[0].responses[0],
            status: 404,
            body: { kind: 'json', content: '{}', contentType: 'text/plain' },
          }],
        } as never,
      ],
    });
    render(<ApiMockImportPreviewAside harIsParsed={false} harPreview={null} preview={preview} />);
    expect(screen.getByTestId('api-mock-import-preview-request-0')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-preview-response-1')).toBeTruthy();
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('covers redirect and server-error status badges', () => {
    const preview = makePreview({
      routes: [{
        ...makePreview().routes[0],
        responses: [{
          ...makePreview().routes[0].responses[0],
          status: 302,
        }],
      } as never, {
        ...makePreview().routes[0],
        id: 'r3',
        responses: [{
          ...makePreview().routes[0].responses[0],
          status: 503,
          body: { kind: 'text', content: '', contentType: 'text/plain' },
        }],
      } as never],
    });
    render(<ApiMockImportPreviewAside harIsParsed={false} harPreview={null} preview={preview} />);
    expect(screen.getByText('Redirect')).toBeTruthy();
    expect(screen.getByText('Server Error')).toBeTruthy();
  });

  it('shows HAR select-entries guidance when parse succeeded', () => {
    render(
      <ApiMockImportPreviewAside
        harIsParsed
        harPreview={{ accepted: [{ index: 0 } as never], filtered: [], truncated: false } as never}
        preview={null}
      />,
    );
    expect(screen.getByText(/Select entries and click Import as draft/i)).toBeTruthy();
  });

  it('uses defaults when response/body/contentType are missing', () => {
    const preview = makePreview({
      routes: [{
        ...makePreview().routes[0],
        responses: [],
      } as never],
    });
    render(<ApiMockImportPreviewAside harIsParsed={false} harPreview={null} preview={preview} />);
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('{}')).toBeTruthy();
    expect(screen.getByText('application/json')).toBeTruthy();
  });
});
