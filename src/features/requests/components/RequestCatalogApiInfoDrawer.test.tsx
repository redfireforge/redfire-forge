/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogRequestMeta } from '../../../shared/types';
import RequestCatalogApiInfoDrawer from './RequestCatalogApiInfoDrawer';

afterEach(() => {
  cleanup();
});

describe('RequestCatalogApiInfoDrawer', () => {
  const fullMeta: CatalogRequestMeta = {
    originalPath: '/users/{id}',
    operationId: 'getUserById',
    description: 'Fetches profile',
    sourceSpec: 'https://cdn/spec.yaml',
    catalogVersion: '1.9.3',
    catalogEntryId: 'ce-aaa',
    catalogEndpointId: 'ep-bbb',
    deprecated: true,
    tags: ['users', 'v2'],
    parameters: [{
      name: 'id',
      in: 'path',
      required: true,
      type: 'string',
      description: 'User pk',
    }],
    expectedResponses: [
      { statusCode: '200', description: 'OK' },
      { statusCode: '404', description: 'Missing' },
      { statusCode: '500', description: 'Oops' },
    ],
    security: ['oauth2'],
  };

  it('renders enriched sections and emits close action', () => {
    const onClose = vi.fn();

    render(
      <RequestCatalogApiInfoDrawer
        method="GET"
        catalogMeta={fullMeta}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(/API Reference/)).toBeInTheDocument();
    expect(screen.getByText('GET /users/{id}')).toBeInTheDocument();
    expect(screen.getByText('getUserById')).toBeInTheDocument();
    expect(screen.getByText(/Deprecated/)).toBeInTheDocument();
    expect(screen.getByText('Fetches profile')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('omits sparse tables when arrays are empty', () => {
    render(
      <RequestCatalogApiInfoDrawer
        method="POST"
        catalogMeta={{
          originalPath: '/x',
          tags: [],
          parameters: undefined,
          expectedResponses: undefined,
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText('Parameters')).toBeNull();
    expect(screen.queryByText('Responses')).toBeNull();
    expect(screen.queryByText('Tags')).toBeNull();
  });

  it('shows placeholder cells for unspecified parameter fields', () => {
    render(
      <RequestCatalogApiInfoDrawer
        method="PUT"
        catalogMeta={{
          originalPath: '/y',
          tags: [],
          parameters: [{
            name: 'q',
            in: 'query',
            required: false,
          }],
          expectedResponses: [],
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders legacy catalog metadata without crashing when tags and tables are missing', () => {
    render(
      <RequestCatalogApiInfoDrawer
        method="PATCH"
        catalogMeta={{
          originalPath: '/legacy',
        } as CatalogRequestMeta}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('PATCH /legacy')).toBeInTheDocument();
    expect(screen.queryByText('Tags')).toBeNull();
    expect(screen.queryByText('Parameters')).toBeNull();
    expect(screen.queryByText('Responses')).toBeNull();
  });
});
