/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetadataTab, HeadersTab } from './GraphqlResponseViewerTabs';
import type { GraphqlResponse } from '@shared/types/graphql';

const baseResponse = (): GraphqlResponse => ({
  httpStatus: 200,
  httpHeaders: { 'content-type': 'application/json' },
  latencyMs: 12,
  timestamp: Date.now(),
  data: { ok: true },
});

describe('GraphqlResponseViewerTabs — coverage gaps', () => {
  it('MetadataTab shows GraphQL Error for pure errors with 2xx', () => {
    render(
      <MetadataTab
        response={{
          ...baseResponse(),
          data: null,
          errors: [{ message: 'fail' }],
        }}
        bodySize={10}
      />,
    );
    expect(screen.getByTestId('gql-rv-meta-status').textContent).toBe('GraphQL Error');
  });

  it('MetadataTab shows Partial Success when data and errors coexist', () => {
    render(
      <MetadataTab
        response={{
          ...baseResponse(),
          errors: [{ message: 'partial' }],
        }}
        bodySize={10}
      />,
    );
    expect(screen.getByTestId('gql-rv-meta-status').textContent).toBe('Partial Success');
  });

  it('MetadataTab handles missing httpHeaders', () => {
    render(
      <MetadataTab
        response={{
          ...baseResponse(),
          httpHeaders: undefined as unknown as Record<string, string>,
        }}
        bodySize={0}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('HeadersTab shows empty state when no headers', () => {
    render(<HeadersTab headers={{}} />);
    expect(screen.getByTestId('gql-rv-headers-empty')).toBeTruthy();
  });

  it('MetadataTab renders batch context, APQ, auth, request sections', () => {
    render(
      <MetadataTab
        response={{
          ...baseResponse(),
          batchContext: {
            batchSize: 2,
            operationIndex: 0,
            wireRequestBody: [{ query: '{ a }' }, { query: '{ b }' }],
          },
          apqHash: 'abcdef0123456789abcdef0123456789',
          apqCacheHit: true,
          authSentSource: 'tab',
          authSentLines: ['Authorization: Bearer tok'],
          requestMethod: 'POST',
          requestHeaders: { Authorization: 'Bearer tok', 'X-Trace': '1' },
          requestBody: { query: '{ ping }', variables: {} },
          errors: [{
            message: 'bad field',
            locations: [{ line: 2, column: 3 }],
            path: ['user', 'name'],
            extensions: { code: 'BAD_USER_INPUT' },
          }],
        }}
        bodySize={128}
      />,
    );
    expect(screen.getByTestId('gql-rv-meta-batch')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-meta-apq-hash')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-auth-sent')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-request-method').textContent).toBe('POST');
    expect(screen.getByTestId('gql-rv-request-headers')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-request-body')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-wire-batch-body')).toBeTruthy();
    expect(screen.getByTestId('gql-rv-error-list')).toBeTruthy();
  });

  it('MetadataTab toggles GraphQL view on request body', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(
      <MetadataTab
        response={{
          ...baseResponse(),
          requestBody: { query: 'query { ping }', variables: { id: '1' } },
        }}
        bodySize={64}
      />,
    );
    await user.click(screen.getByTestId('gql-rv-request-body-pretty-btn'));
    expect(screen.getByTestId('gql-rv-request-body-content').textContent).toContain('ping');
  });

  it('MetadataTab shows muted auth line when authSentLines empty', () => {
    render(
      <MetadataTab
        response={{
          ...baseResponse(),
          authSentSource: 'none',
          authSentLines: [],
        }}
        bodySize={10}
      />,
    );
    expect(screen.getByText('No authentication headers were sent')).toBeTruthy();
  });
});
