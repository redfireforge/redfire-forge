/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogOverview from './CatalogOverview';
import { makeEntry, makeEndpoint, makeFolder, makeServer, makeVersion } from './catalogTestFactories';

describe('CatalogOverview', () => {
  it('renders title, version, description, meta and action buttons', async () => {
    const onReimport = vi.fn();
    const onVersionHistory = vi.fn();
    const onExportSpec = vi.fn();
    render(
      <CatalogOverview
        entry={makeEntry({ name: 'Petstore', description: 'Pets API' })}
        onReimport={onReimport}
        onVersionHistory={onVersionHistory}
        onExportSpec={onExportSpec}
      />,
    );

    expect(screen.getByText('Petstore')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Pets API')).toBeInTheDocument();
    expect(screen.getByText('Last Imported')).toBeInTheDocument();
    expect(screen.getByText('Spec Size')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Re-import' }));
    await userEvent.click(screen.getByRole('button', { name: 'Export Spec' }));
    await userEvent.click(screen.getByRole('button', { name: 'Version History' }));
    expect(onReimport).toHaveBeenCalled();
    expect(onExportSpec).toHaveBeenCalled();
    expect(onVersionHistory).toHaveBeenCalled();
  });

  it('renders servers, method stats, deprecated note, tags and security schemes', () => {
    const entry = makeEntry({
      description: undefined,
      currentVersionId: 'missing',
      servers: [
        makeServer({ url: '/v1', resolvedUrl: 'https://api.example.com/v1', description: 'Main' }),
        makeServer({ url: 'https://other.example.com', resolvedUrl: undefined, description: undefined }),
      ],
      folders: [
        makeFolder({
          id: 'fa',
          name: 'Accounts',
          endpoints: [
            makeEndpoint({ id: 'a1', method: 'GET' }),
            makeEndpoint({ id: 'a2', method: 'POST' }),
            makeEndpoint({ id: 'a3', method: 'DELETE', deprecated: true }),
          ],
        }),
      ],
      endpoints: [makeEndpoint({ id: 'u1', method: 'PUT', deprecated: true })],
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'JWT bearer' },
        apiKey: { type: 'apiKey' },
      },
    });
    render(
      <CatalogOverview entry={entry} onReimport={vi.fn()} onVersionHistory={vi.fn()} onExportSpec={vi.fn()} />,
    );

    // currentVersion missing -> no version pill, spec size shows em dash
    expect(screen.queryByText('v1.0.0')).not.toBeInTheDocument();
    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/v1')).toBeInTheDocument();
    expect(screen.getByText('(/v1)')).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();

    // method stat bars rendered for present methods
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('PUT')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();

    // 2 deprecated -> plural note
    expect(screen.getByText('2 deprecated endpoints')).toBeInTheDocument();

    // By Tag: folder + untagged
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Untagged')).toBeInTheDocument();

    // Security schemes
    expect(screen.getByText('Security Schemes')).toBeInTheDocument();
    expect(screen.getByText('bearerAuth')).toBeInTheDocument();
    expect(screen.getByText('http / bearer')).toBeInTheDocument();
    expect(screen.getByText('JWT bearer')).toBeInTheDocument();
    // "apiKey" appears as both the scheme name and the scheme type
    expect(screen.getAllByText('apiKey').length).toBeGreaterThanOrEqual(2);
  });

  it('shows singular deprecated note and omits empty sections', () => {
    const entry = makeEntry({
      servers: [],
      folders: [makeFolder({ endpoints: [makeEndpoint({ id: 'x', method: 'GET', deprecated: true })] })],
      endpoints: [],
      securitySchemes: {},
      versions: [makeVersion()],
    });
    render(
      <CatalogOverview entry={entry} onReimport={vi.fn()} onVersionHistory={vi.fn()} onExportSpec={vi.fn()} />,
    );
    expect(screen.getByText('1 deprecated endpoint')).toBeInTheDocument();
    expect(screen.queryByText('Servers')).not.toBeInTheDocument();
    expect(screen.queryByText('Security Schemes')).not.toBeInTheDocument();
    expect(screen.queryByText('Untagged')).not.toBeInTheDocument();
  });
});
