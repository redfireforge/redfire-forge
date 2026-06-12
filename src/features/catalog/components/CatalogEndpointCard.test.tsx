/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogEndpointCard from './CatalogEndpointCard';
import { makeEndpoint, makeServer, makeParam, makeResponse, makeHostConfig } from './catalogTestFactories';
import type { AuthConfig } from '../../../shared/types';
import type { EndpointCoverage } from '../utils/coverageChecker';

const httpFetchMock = vi.hoisted(() => vi.fn());
const applyAuthMock = vi.hoisted(() => vi.fn());
const copyMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/schemaStubGenerator', () => ({
  generateStubJson: () => '{\n  "stub": true\n}',
}));
vi.mock('../../../shared/utils/jsonHighlighter', () => ({
  highlightJson: (s: string) => s,
}));
vi.mock('../utils/catalogCurlGenerator', () => ({
  buildCatalogCurlCommand: () => Promise.resolve("curl -X POST \\\n  'https://api.example.com/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"a\":1}'"),
  buildCatalogCurlSingleLine: () => Promise.resolve("curl -X POST 'https://api.example.com/users'"),
  buildDefaultCurlCommand: () => Promise.resolve('curl default'),
  resolveBaseUrl: () => 'https://api.example.com',
  buildFullUrl: () => 'https://api.example.com/users/123',
}));
vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: httpFetchMock,
}));
vi.mock('../../../shared/utils/applyAuthHeaders', () => ({
  applyAuthHeaders: applyAuthMock,
}));
vi.mock('../../../shared/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => [false, copyMock],
}));

const noAuth: AuthConfig = { type: 'none' };
const server = makeServer();
const hostConfig = makeHostConfig({ strategy: 'global' });

function renderCard(props: Partial<React.ComponentProps<typeof CatalogEndpointCard>> = {}) {
  const onValuesChange = vi.fn();
  const onExportSingle = vi.fn();
  const onSendToHarness = vi.fn();
  const onToggleWorkflowExpose = vi.fn();
  const onNavigateToRequest = vi.fn();
  render(
    <CatalogEndpointCard
      endpoint={props.endpoint ?? makeEndpoint()}
      servers={[server]}
      hostConfig={props.hostConfig ?? hostConfig}
      auth={props.auth ?? noAuth}
      savedValues={props.savedValues}
      onValuesChange={onValuesChange}
      onExportSingle={onExportSingle}
      onSendToHarness={onSendToHarness}
      onToggleWorkflowExpose={onToggleWorkflowExpose}
      onNavigateToRequest={onNavigateToRequest}
      coverage={props.coverage}
    />,
  );
  return { onValuesChange, onExportSingle, onSendToHarness, onToggleWorkflowExpose, onNavigateToRequest };
}

beforeEach(() => {
  vi.clearAllMocks();
  httpFetchMock.mockResolvedValue({ status: 200, statusText: 'OK', headers: { 'x-foo': 'bar' }, body: '{"ok":true}' });
  applyAuthMock.mockResolvedValue(undefined);
});

describe('CatalogEndpointCard', () => {
  it('renders collapsed header and expands on click', async () => {
    renderCard();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('/users/{id}')).toBeInTheDocument();
    expect(screen.getByText('Get user')).toBeInTheDocument();
    await userEvent.click(screen.getByText('/users/{id}'));
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByText('No parameters')).toBeInTheDocument();
  });

  it('expands via keyboard Enter and space', () => {
    renderCard();
    const header = screen.getByText('/users/{id}').closest('.sw-header')!;
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    fireEvent.keyDown(header, { key: ' ' });
  });

  it('renders deprecated and lock badges', () => {
    renderCard({ endpoint: makeEndpoint({ deprecated: true, security: [{ name: 'apiKey', scopes: [] }] }) });
    expect(screen.getByText('deprecated')).toBeInTheDocument();
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });

  it('shows coverage badge, opens popover and navigates', async () => {
    const coverage: EndpointCoverage = {
      exported: true,
      count: 2,
      locations: [
        { collectionId: 'c1', requestId: 'r1', folderPath: 'Coll / Folder' },
        { collectionId: 'c2', requestId: 'r2', folderPath: 'Coll / Other' },
      ],
    };
    const { onNavigateToRequest } = renderCard({ coverage });
    await userEvent.click(screen.getByText('IN REQUESTS (2)'));
    expect(screen.getByText('Exported to 2 requests')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Coll / Folder'));
    expect(onNavigateToRequest).toHaveBeenCalledWith('c1', 'r1');
  });

  it('toggles coverage popover via keyboard', () => {
    const coverage: EndpointCoverage = {
      exported: true,
      count: 1,
      locations: [{ collectionId: 'c1', requestId: 'r1', folderPath: 'Coll / F' }],
    };
    renderCard({ coverage });
    const badge = screen.getByText('IN REQUESTS');
    fireEvent.keyDown(badge, { key: 'Enter' });
    expect(screen.getByText('Exported to 1 request')).toBeInTheDocument();
    fireEvent.click(screen.getByText('×'));
  });

  it('opens context menu and copies default curl', async () => {
    renderCard();
    const header = screen.getByText('/users/{id}').closest('.sw-header')!;
    fireEvent.contextMenu(header);
    const copyItem = screen.getByText('Copy as cURL');
    await userEvent.click(copyItem);
    await waitFor(() => expect(copyMock).toHaveBeenCalledWith('curl default'));
  });

  it('renders parameters with enum, default and try-it-out inputs', async () => {
    const endpoint = makeEndpoint({
      description: 'Fetch a user',
      parameters: [
        makeParam({ name: 'id', in: 'path', required: true, description: 'User id', example: 'abc' }),
        makeParam({ name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['a', 'b'], default: 'a' } }),
        makeParam({ name: 'X-Tok', in: 'header', required: false }),
      ],
    });
    renderCard({ endpoint });
    fireEvent.click(screen.getByText('/users/{id}'));
    expect(screen.getByText('Fetch a user')).toBeInTheDocument();
    expect(screen.getByText(/Available values:/)).toBeInTheDocument();
    expect(screen.getByText(/Default value:/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('Try it out'));
    const idInput = screen.getByPlaceholderText('abc') as HTMLInputElement;
    await userEvent.type(idInput, '123');
    expect(idInput.value).toBe('123');
    const sel = document.querySelector('select.sw-pinput') as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'b');
    expect(sel.value).toBe('b');
    await userEvent.click(screen.getByText('Cancel'));
  });

  it('calls onValuesChange when a parameter value changes', async () => {
    const endpoint = makeEndpoint({ parameters: [makeParam({ name: 'id', in: 'query' })] });
    const { onValuesChange } = renderCard({ endpoint });
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.type(screen.getByPlaceholderText('id'), 'x');
    await waitFor(() => expect(onValuesChange).toHaveBeenCalled());
  });

  it('renders request body example and edits in try-it-out', async () => {
    const endpoint = makeEndpoint({
      method: 'POST',
      requestBody: { required: true, contentTypes: [{ mediaType: 'application/json', schema: { type: 'object' } }] },
    });
    renderCard({ endpoint });
    fireEvent.click(screen.getByText('/users/{id}'));
    expect(screen.getByText('Request body')).toBeInTheDocument();
    expect(screen.getByText('application/json')).toBeInTheDocument();
    expect(screen.getByText('required')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Try it out'));
    const ta = document.querySelector('textarea.sw-body-editor') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    fireEvent.change(ta, { target: { value: '{"x":1}' } });
    expect(ta.value).toBe('{"x":1}');
  });

  it('executes and shows a successful live response', async () => {
    const endpoint = makeEndpoint({ method: 'POST', requestBody: { required: false, contentTypes: [{ mediaType: 'application/json', schema: {} }] } });
    renderCard({ endpoint });
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.click(screen.getByText('Execute'));
    await waitFor(() => expect(screen.getByText('Server response')).toBeInTheDocument());
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
    expect(screen.getByText('Response headers')).toBeInTheDocument();
  });

  it('shows Save as Test button on a 2xx response', async () => {
    const { onSendToHarness } = renderCard();
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.click(screen.getByText('Execute'));
    await waitFor(() => expect(screen.getByText('Save as Test')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Save as Test'));
    expect(onSendToHarness).toHaveBeenCalledWith(expect.objectContaining({ id: 'ep1' }), true);
  });

  it('renders an auth failure error block', async () => {
    applyAuthMock.mockRejectedValue(new Error('bad token'));
    renderCard({ auth: { type: 'bearer', token: 'tok12345678' } });
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.click(screen.getByText('Execute'));
    await waitFor(() => expect(screen.getByText('Request failed')).toBeInTheDocument());
    expect(screen.getByText(/Auth failed/)).toBeInTheDocument();
  });

  it('renders an ENOTFOUND error hint with empty body', async () => {
    httpFetchMock.mockResolvedValue({ status: 0, statusText: '', headers: {}, body: '', error: 'getaddrinfo ENOTFOUND host' });
    renderCard({ hostConfig: makeHostConfig({ strategy: 'inherited' }) });
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.click(screen.getByText('Execute'));
    await waitFor(() => expect(screen.getByText('Request failed')).toBeInTheDocument());
    expect(screen.getByText(/spec server URL is unreachable/)).toBeInTheDocument();
  });

  it('shows and hides the cURL box and toggles single line', async () => {
    renderCard();
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.click(screen.getByText('cURL'));
    await waitFor(() => expect(screen.getByText('Curl')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Single line'));
    await userEvent.click(screen.getByText('Copy'));
    expect(copyMock).toHaveBeenCalled();
    await userEvent.click(screen.getByText('Hide cURL'));
  });

  it('fires Export, Send to Harness and Workflow expose callbacks', async () => {
    const { onExportSingle, onSendToHarness, onToggleWorkflowExpose } = renderCard();
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    await userEvent.click(screen.getByText('Export to Requests'));
    expect(onExportSingle).toHaveBeenCalled();
    await userEvent.click(screen.getByText('Send to Harness'));
    expect(onSendToHarness).toHaveBeenCalledWith(expect.objectContaining({ id: 'ep1' }));
    const checkbox = screen.getByLabelText(/Expose to Workflow/);
    await userEvent.click(checkbox);
    expect(onToggleWorkflowExpose).toHaveBeenCalled();
  });

  it('shows a host warning for placeholder spec URLs', async () => {
    renderCard({ hostConfig: makeHostConfig({ strategy: 'inherited' }) });
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    expect(screen.getByText(/likely a placeholder/)).toBeInTheDocument();
  });

  it('renders auth status variants', async () => {
    renderCard({ auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secretvalue' } });
    fireEvent.click(screen.getByText('/users/{id}'));
    await userEvent.click(screen.getByText('Try it out'));
    expect(screen.getByText(/X-Key: secretva/)).toBeInTheDocument();
  });

  it('renders spec responses with Model tab', async () => {
    const endpoint = makeEndpoint({
      responses: [
        makeResponse({
          statusCode: '200',
          description: 'A user',
          schema: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              meta: { type: 'object', properties: { k: { type: 'string' } } },
              role: { type: 'string', enum: ['admin', 'user'] },
            },
          },
        }),
      ],
    });
    renderCard({ endpoint });
    fireEvent.click(screen.getByText('/users/{id}'));
    expect(screen.getByText('Responses')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Model'));
    expect(screen.getByText('Example Value')).toBeInTheDocument();
  });
});
