/**
 * @vitest-environment jsdom
 *
 * HttpConfig — basic rendering, headers, URL preview, services, variable hints.
 *
 * Interactive / callback paths (variable insertion, ParamsEditor callbacks,
 * body builder, validation, data source, spec version, mapper, URL hydration)
 * live in `HttpConfig.interactions.test.tsx`. Shared factories live in
 * `__test-utils__/httpConfigTestHelpers.tsx`.
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
import HttpConfig from './HttpConfig';
import { WorkflowService } from '../../types/workflow';
import { Scenario, KeyValue } from '../../../../shared/types';
import { makeHttpData, makeScenario, makeDefaultProps } from './__test-utils__/httpConfigTestHelpers';
vi.mock('../expression/ExpressionInput', async () => {
  const { createExpressionInputModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createExpressionInputModuleMock();
});
vi.mock('../expression/ExpressionTextarea', async () => {
  const { createExpressionTextareaModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createExpressionTextareaModuleMock();
});
vi.mock('../../../../shared/components/data-mapper/BodyBuilderPanel', async () => {
  const { createBodyBuilderSimpleModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createBodyBuilderSimpleModuleMock();
});
vi.mock('../../../../shared/components/data-mapper', async () => {
  const { createDataMapperModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createDataMapperModuleMock();
});
vi.mock('../../../requests/components/ExtractionEditor', async () => {
  const { createExtractionEditorModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createExtractionEditorModuleMock();
});
vi.mock('../../../requests/components/ParamsEditor', async () => {
  const { createParamsEditorModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createParamsEditorModuleMock();
});
vi.mock('../../../scenarios/components/DataSourceEditor', async () => {
  const { createDataSourceEditorModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createDataSourceEditorModuleMock();
});

const defaultProps = makeDefaultProps();

describe('HttpConfig — basic rendering', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders label input with current value', () => {
    render(<HttpConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('Get Users')).toBeTruthy();
  });

  it('calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Get Users'), { target: { value: 'List Users' } });
    expect(onChange).toHaveBeenCalledWith({ label: 'List Users' });
  });

  it('renders method select with current value', () => {
    const { container } = render(<HttpConfig {...defaultProps} />);
    expect(container.querySelector('.wf-config-method-select .cs-text')?.textContent).toBe('GET');
  });

  it('calls onChange when method changes', () => {
    const onChange = vi.fn();
    const { container } = render(<HttpConfig {...defaultProps} onChange={onChange} />);
    selectOption(container.querySelector('.wf-config-method-select')!, 'POST');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders all 5 HTTP method options', () => {
    const { container } = render(<HttpConfig {...defaultProps} />);
    const wrap = container.querySelector('.wf-config-method-select')!;
    fireEvent.click(wrap.querySelector('.cs-trigger')!);
    const labels = Array.from(wrap.querySelectorAll('.cs-item-label')).map(el => el.textContent);
    expect(labels).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });

  it('renders tab buttons for url, headers, body, extract', () => {
    render(<HttpConfig {...defaultProps} />);
    expect(screen.getByText('Params')).toBeTruthy();
    expect(screen.getByText('Headers')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Extract')).toBeTruthy();
  });

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<HttpConfig {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Headers'));
    expect(onTabChange).toHaveBeenCalledWith('headers');
  });

  it('renders Params tab content when activeTab=url', () => {
    render(<HttpConfig {...defaultProps} activeTab="url" />);
    expect(screen.getByText('Query Parameters')).toBeTruthy();
  });

  it('renders headers tab content when activeTab=headers', () => {
    const headers: KeyValue[] = [{ key: 'Authorization', value: 'Bearer token' }];
    render(<HttpConfig {...defaultProps} activeTab="headers" data={makeHttpData({ scenario: makeScenario({ headers }) })} />);
    expect(screen.getByDisplayValue('Authorization')).toBeTruthy();
  });

  it('adds a header row when + Add Header is clicked', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} activeTab="headers" onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Header'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders body tab content when activeTab=body', () => {
    render(<HttpConfig {...defaultProps} activeTab="body" />);
    expect(screen.getByText(/Insert variable/)).toBeTruthy();
  });

  it('renders extract tab with ExtractionEditor when activeTab=extract', () => {
    render(<HttpConfig {...defaultProps} activeTab="extract" />);
    expect(screen.getByTestId('extraction-editor')).toBeTruthy();
  });

  it('shows resolved URL preview', () => {
    render(<HttpConfig {...defaultProps} />);
    const urlPreview = document.querySelector('.wf-config-last-req-url-value');
    expect(urlPreview?.textContent).toBe('http://localhost:3000/api/users');
  });

  it('shows last request URL when provided', () => {
    render(<HttpConfig {...defaultProps} lastQuickTestRequestUrl="http://localhost:3000/api/users?page=1" />);
    expect(screen.getByText('Last request URL (resolved)')).toBeTruthy();
    expect(document.querySelector('.wf-config-last-req-url-value')?.textContent).toBe('http://localhost:3000/api/users?page=1');
  });

  it('shows last run error when provided', () => {
    render(<HttpConfig {...defaultProps} lastRunError="Connection refused" />);
    expect(screen.getByText('Last run error')).toBeTruthy();
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('renders Service select with None option', () => {
    const { container } = render(<HttpConfig {...defaultProps} />);
    const wrap = container.querySelector('.wf-config-service-select')!;
    fireEvent.click(wrap.querySelector('.cs-trigger')!);
    const labels = Array.from(wrap.querySelectorAll('.cs-item-label')).map(el => el.textContent);
    expect(labels).toContain('None (raw URL)');
  });

  it('renders services in the select when provided', () => {
    const services: WorkflowService[] = [
      { id: 'svc1', name: 'Users API', baseUrl: 'http://users.api', auth: { type: 'none' } },
    ];
    const { container } = render(<HttpConfig {...defaultProps} workflowServices={services} />);
    const wrap = container.querySelector('.wf-config-service-select')!;
    fireEvent.click(wrap.querySelector('.cs-trigger')!);
    const labels = Array.from(wrap.querySelectorAll('.cs-item-label')).map(el => el.textContent);
    expect(labels).toContain('Users API');
  });

  it('calls onChange with serviceId when service is selected', () => {
    const onChange = vi.fn();
    const services: WorkflowService[] = [
      { id: 'svc1', name: 'Users API', baseUrl: 'http://users.api', auth: { type: 'none' } },
    ];
    render(<HttpConfig {...defaultProps} onChange={onChange} workflowServices={services} />);
    selectOption(document.querySelector('.wf-config-service-select')!, 'Users API');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 'svc1' }));
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('label');
  });

  it('shows param count badge on Params tab when params exist', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?page=1&limit=10' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    const badges = document.querySelectorAll('.tab-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows hint about Services button when no services', () => {
    render(<HttpConfig {...defaultProps} workflowServices={[]} />);
    expect(screen.getByText(/Services/)).toBeTruthy();
  });

  it('renders Insert… button next to URL', () => {
    render(<HttpConfig {...defaultProps} />);
    const insertBtns = screen.getAllByText('Insert…');
    expect(insertBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('removes a header when × is clicked', () => {
    const onChange = vi.fn();
    const headers: KeyValue[] = [{ key: 'X-Custom', value: 'val' }];
    render(<HttpConfig {...defaultProps} activeTab="headers" onChange={onChange} data={makeHttpData({ scenario: makeScenario({ headers }) })} />);
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('updates header key on change', () => {
    const onChange = vi.fn();
    const headers: KeyValue[] = [{ key: 'X-Custom', value: 'val' }];
    render(<HttpConfig {...defaultProps} activeTab="headers" onChange={onChange} data={makeHttpData({ scenario: makeScenario({ headers }) })} />);
    fireEvent.change(screen.getByDisplayValue('X-Custom'), { target: { value: 'Content-Type' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('updates header value on change', () => {
    const onChange = vi.fn();
    const headers: KeyValue[] = [{ key: 'Accept', value: 'application/json' }];
    render(<HttpConfig {...defaultProps} activeTab="headers" onChange={onChange} data={makeHttpData({ scenario: makeScenario({ headers }) })} />);
    const inputs = screen.getAllByTestId('expression-input');
    fireEvent.change(inputs[inputs.length - 1], { target: { value: 'text/html' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onRequestVariableInsert for header Insert button', () => {
    const onRequestVariableInsert = vi.fn();
    const headers: KeyValue[] = [{ key: 'Auth', value: 'Bearer' }];
    render(<HttpConfig {...defaultProps} activeTab="headers" onRequestVariableInsert={onRequestVariableInsert} data={makeHttpData({ scenario: makeScenario({ headers }) })} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[insertBtns.length - 1]);
    expect(onRequestVariableInsert).toHaveBeenCalled();
  });

  it('updates body on textarea change', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} activeTab="body" onChange={onChange} />);
    const textarea = screen.getByTestId('expression-textarea');
    fireEvent.change(textarea, { target: { value: '{"key":"value"}' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onRequestVariableInsert for body Insert variable button', () => {
    const onRequestVariableInsert = vi.fn();
    render(<HttpConfig {...defaultProps} activeTab="body" onRequestVariableInsert={onRequestVariableInsert} />);
    fireEvent.click(screen.getByText('Insert variable…'));
    expect(onRequestVariableInsert).toHaveBeenCalled();
  });

  it('calls onRequestVariableInsert for URL Insert button', () => {
    const onRequestVariableInsert = vi.fn();
    render(<HttpConfig {...defaultProps} onRequestVariableInsert={onRequestVariableInsert} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);
    expect(onRequestVariableInsert).toHaveBeenCalled();
  });

  it('clears serviceId when None is selected', () => {
    const onChange = vi.fn();
    const services: WorkflowService[] = [
      { id: 'svc1', name: 'Users API', baseUrl: 'http://users.api', auth: { type: 'none' } },
    ];
    render(<HttpConfig {...defaultProps} onChange={onChange} workflowServices={services} data={makeHttpData({ serviceId: 'svc1' })} />);
    selectOption(document.querySelector('.wf-config-service-select')!, 'None (raw URL)');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ serviceId: undefined }));
  });

  it('shows extraction badge when extractions exist', () => {
    const data = makeHttpData({ scenario: makeScenario({ extractions: [{ variable: 'x', source: 'body', expression: '$.id' }] }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    const badges = document.querySelectorAll('.tab-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows header badge when headers have keys', () => {
    const data = makeHttpData({ scenario: makeScenario({ headers: [{ key: 'X-API', value: 'test' }] }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    const badges = document.querySelectorAll('.tab-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders variable hints when provided', () => {
    render(<HttpConfig {...defaultProps} activeTab="url" variableHints={[
      { ref: 'userId', label: 'User ID', type: 'string', description: 'The user ID' },
      { ref: 'node:step1.token', label: 'Token', type: 'string', description: '' },
    ]} />);
    expect(screen.getByText(/Variables you can paste/)).toBeTruthy();
  });

  it('sorts hints with same prefix alphabetically by ref', () => {
    const { container } = render(<HttpConfig {...defaultProps} activeTab="url" variableHints={[
      { ref: 'node:step2.b', label: 'B', type: 'string', description: '' },
      { ref: 'node:step1.a', label: 'A', type: 'string', description: '' },
      { ref: 'globalZ', label: 'Z', type: 'string', description: '' },
      { ref: 'globalA', label: 'GA', type: 'string', description: '' },
    ]} />);
    const items = container.querySelectorAll('.wf-http-var-hints-item');
    expect(items.length).toBe(4);
  });

  it('does not render hints section with empty hints', () => {
    render(<HttpConfig {...defaultProps} activeTab="url" variableHints={[]} />);
    expect(screen.queryByText(/Variables you can paste/)).toBeNull();
  });

  it('parses query params from URL', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users?page=1&limit=10' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} />);
    expect(screen.getByText('Query Parameters')).toBeTruthy();
  });

  it('shows absolute URL as-is in preview', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: 'https://api.example.com/users' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    const urlPreview = document.querySelector('.wf-config-last-req-url-value');
    expect(urlPreview?.textContent).toBe('https://api.example.com/users');
  });

  it('decodes percent-encoded template vars in URL display', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users?id=%7B%7BuserId%7D%7D' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(document.querySelector('.wf-config-last-req-url-value')?.textContent).toContain('userId');
  });

  it('shows base URL as preview when URL is empty', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '' }) });
    render(<HttpConfig {...defaultProps} data={data} effectiveQuickTestBaseUrl="http://localhost:3000" />);
    const urlPreview = document.querySelector('.wf-config-last-req-url-value');
    expect(urlPreview?.textContent).toBe('http://localhost:3000');
  });

  it('shows empty preview when URL and base are both empty', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '' }) });
    render(<HttpConfig {...defaultProps} data={data} effectiveQuickTestBaseUrl="" />);
    expect(document.querySelector('.wf-config-last-req-url')).toBeNull();
  });

  it('prepends slash for relative URL without leading slash', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: 'api/users' }) });
    render(<HttpConfig {...defaultProps} data={data} effectiveQuickTestBaseUrl="http://localhost:3000" />);
    const urlPreview = document.querySelector('.wf-config-last-req-url-value');
    expect(urlPreview?.textContent).toBe('http://localhost:3000/api/users');
  });

  it('simplifies node-scoped refs in URL preview', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users/{{node:"Step 1".userId}}' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    const urlPreview = document.querySelector('.wf-config-last-req-url-value');
    expect(urlPreview?.textContent).toContain('{{userId}}');
    expect(urlPreview?.textContent).not.toContain('node:');
  });

  it('renders service select label when service is selected', () => {
    const onChange = vi.fn();
    const services = [{ id: 'svc1', name: 'My API', baseUrl: 'http://my.api', auth: { type: 'none' as const } }];
    render(<HttpConfig {...defaultProps} onChange={onChange} workflowServices={services} />);
    selectOption(document.querySelector('.wf-config-service-select')!, 'My API');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 'svc1' }));
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('label');
  });

  it('renders extract tab with fetchSample host props when provided', () => {
    const onFetch = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ fetchHostEnabled: true, fetchHostOverride: 'http://override' }) });
    render(<HttpConfig {...defaultProps} activeTab="extract" data={data}
      extractionFetchSample={{ onFetch, fetching: false, error: null }}
    />);
    expect(screen.getByTestId('extraction-editor')).toBeTruthy();
  });

  it('handles query param changes', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?key=val' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);
    expect(screen.getByText('Query Parameters')).toBeTruthy();
  });

  it('does not show Services hint when services are provided', () => {
    const services = [{ id: 'svc1', name: 'API', baseUrl: 'http://api', auth: { type: 'none' as const } }];
    render(<HttpConfig {...defaultProps} workflowServices={services} />);
    expect(screen.queryByText(/click the/i)).toBeNull();
  });

  it('URL insert button calls onRequestVariableInsert with shortRef', () => {
    const onRequest = vi.fn();
    render(<HttpConfig {...defaultProps} onRequestVariableInsert={onRequest} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);
    expect(onRequest).toHaveBeenCalledWith(expect.any(Function), true);
  });

  it('handles malformed URL gracefully in query params', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} />);
    expect(screen.getByTestId('params-editor')).toBeTruthy();
  });

  it('shows raw editor and Data Mapper button on body tab', () => {
    render(<HttpConfig {...defaultProps} activeTab="body" />);
    expect(screen.getByTestId('expression-textarea')).toBeTruthy();
    expect(screen.getByText('⚡ Data Mapper')).toBeTruthy();
  });

  it('renders DataSourceEditor when activeTab=data', () => {
    render(<HttpConfig {...defaultProps} activeTab="data" />);
    expect(screen.getByTestId('data-source-editor')).toBeTruthy();
  });

  it('shows data source row count badge on Data tab', () => {
    const data = makeHttpData({
      scenario: makeScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'col1' }],
          rows: [
            { id: 'r1', enabled: true, values: { c1: 'v1' } },
            { id: 'r2', enabled: false, values: { c1: 'v2' } },
          ],
        },
      } as Partial<Scenario>),
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const badges = document.querySelectorAll('.tab-badge');
    const badgeTexts = Array.from(badges).map(b => b.textContent);
    expect(badgeTexts).toContain('1');
  });

  it('omits datatype chips for minimalist variable hints', () => {
    const { container } = render(<HttpConfig {...defaultProps} activeTab="url" variableHints={[
      { ref: 'plain', label: 'Plain', description: 'no type' },
    ]} />);
    const row = container.querySelector('.wf-http-var-hints-item');
    expect(row).toBeTruthy();
    expect(row?.querySelector('.wf-http-var-hints-type')).toBeNull();
  });
});

describe('HttpConfig — service binding and env override', () => {
  const multiEnvService: WorkflowService[] = [{
    id: 'svc-multi',
    name: 'Multi Env API',
    endpoints: [
      { envId: 'env-dev', url: 'http://dev.api.example.com', enabled: true, authMode: 'inherit', source: 'manual' },
      { envId: 'env-prod', url: 'http://prod.api.example.com', enabled: true, authMode: 'inherit', source: 'manual' },
      { envId: '__adhoc__', url: 'http://adhoc.local', enabled: true, authMode: 'inherit', source: 'manual' },
    ],
  }];

  const environments = [
    { id: 'env-dev', name: 'Development' },
    { id: 'env-prod', name: 'Production' },
  ];

  beforeEach(() => {
    resetAllMocks();
  });

  it('shows environment override when service has multiple enabled endpoints', () => {
    const data = makeHttpData({ serviceId: 'svc-multi' });
    const { container } = render(
      <HttpConfig
        {...defaultProps}
        data={data}
        workflowServices={multiEnvService}
        environments={environments}
        selectedEnvId="env-dev"
      />,
    );
    expect(screen.getByText('Environment')).toBeTruthy();
    const envWrap = container.querySelector('.wf-config-env-override')!;
    fireEvent.click(envWrap.querySelector('.cs-trigger')!);
    const labels = Array.from(envWrap.querySelectorAll('.cs-item-label')).map(el => el.textContent);
    expect(labels.some(t => t?.includes('Use global (Development)'))).toBe(true);
    expect(labels).toContain('Production');
    expect(labels).toContain('adhoc');
  });

  it('uses global label when no selectedEnvId', () => {
    const data = makeHttpData({ serviceId: 'svc-multi' });
    const { container } = render(
      <HttpConfig
        {...defaultProps}
        data={data}
        workflowServices={multiEnvService}
        environments={environments}
      />,
    );
    const envWrap = container.querySelector('.wf-config-env-override')!;
    fireEvent.click(envWrap.querySelector('.cs-trigger')!);
    const labels = Array.from(envWrap.querySelectorAll('.cs-item-label')).map(el => el.textContent);
    expect(labels.some(t => t?.includes('Use global (global)'))).toBe(true);
  });

  it('shows env override badge and calls onChange when override is selected', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ serviceId: 'svc-multi', envOverride: 'env-prod' });
    render(
      <HttpConfig
        {...defaultProps}
        data={data}
        onChange={onChange}
        workflowServices={multiEnvService}
        environments={environments}
        selectedEnvId="env-dev"
      />,
    );
    expect(screen.getAllByText('Production').length).toBeGreaterThan(0);
    selectOption(document.querySelector('.wf-config-env-override')!, 'Development');
    expect(onChange).toHaveBeenCalledWith({ envOverride: 'env-dev' });
  });

  it('clears env override when global option is selected', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ serviceId: 'svc-multi', envOverride: 'env-prod' });
    render(
      <HttpConfig
        {...defaultProps}
        data={data}
        onChange={onChange}
        workflowServices={multiEnvService}
        environments={environments}
        selectedEnvId="env-dev"
      />,
    );
    selectOption(document.querySelector('.wf-config-env-override')!, 'Use global (Development)');
    expect(onChange).toHaveBeenCalledWith({ envOverride: undefined });
  });

  it('falls back to env id label when environment name is unknown', () => {
    const data = makeHttpData({ serviceId: 'svc-multi', envOverride: 'env-unknown' });
    render(
      <HttpConfig
        {...defaultProps}
        data={data}
        workflowServices={multiEnvService}
        environments={environments}
        selectedEnvId="env-dev"
      />,
    );
    expect(screen.getAllByText('env-unknown').length).toBeGreaterThan(0);
  });

  it('strips service base URL when binding to a service', () => {
    const onChange = vi.fn();
    const services: WorkflowService[] = [{
      id: 'svc1',
      name: 'Users API',
      endpoints: [{ envId: 'env-dev', url: 'http://users.api', enabled: true, authMode: 'inherit', source: 'manual' }],
    }];
    const data = makeHttpData({
      scenario: makeScenario({ url: 'http://users.api/v1/users' }),
    });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} workflowServices={services} />);
    selectOption(document.querySelector('.wf-config-service-select')!, 'Users API');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: 'svc1',
      envOverride: undefined,
      scenario: expect.objectContaining({ url: '/v1/users' }),
    }));
  });

  it('prepends service base URL when unbinding from a service', () => {
    const onChange = vi.fn();
    const services: WorkflowService[] = [{
      id: 'svc1',
      name: 'Users API',
      endpoints: [{ envId: 'env-dev', url: 'http://users.api', enabled: true, authMode: 'inherit', source: 'manual' }],
    }];
    const data = makeHttpData({
      serviceId: 'svc1',
      scenario: makeScenario({ url: '/v1/users' }),
    });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} workflowServices={services} />);
    selectOption(document.querySelector('.wf-config-service-select')!, 'None (raw URL)');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: undefined,
      scenario: expect.objectContaining({ url: 'http://users.api/v1/users' }),
    }));
  });

  it('does not prepend base URL on unbind when URL is already absolute http', () => {
    const onChange = vi.fn();
    const services: WorkflowService[] = [{
      id: 'svc1',
      name: 'Users API',
      endpoints: [{ envId: 'env-dev', url: 'http://users.api', enabled: true, authMode: 'inherit', source: 'manual' }],
    }];
    const data = makeHttpData({
      serviceId: 'svc1',
      scenario: makeScenario({ url: 'http://other.api/v1/users' }),
    });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} workflowServices={services} />);
    selectOption(document.querySelector('.wf-config-service-select')!, 'None (raw URL)');
    const patch = onChange.mock.calls[0][0] as { scenario?: Scenario };
    expect(patch.scenario?.url).toBeUndefined();
  });

  it('shows inherit hint with service id when service name is missing', () => {
    const data = makeHttpData({
      serviceId: 'orphan-svc',
      scenario: makeScenario({ auth: { type: 'inherit' } }),
    });
    render(<HttpConfig {...defaultProps} activeTab="auth" data={data} workflowServices={[]} />);
    expect(screen.getByText(/orphan-svc/)).toBeTruthy();
  });

  it('hides env override when service has at most one enabled endpoint', () => {
    const singleEndpointService: WorkflowService[] = [{
      id: 'svc-single',
      name: 'Single',
      endpoints: [{ envId: 'env-dev', url: 'http://single.api', enabled: true, authMode: 'inherit', source: 'manual' }],
    }];
    const data = makeHttpData({ serviceId: 'svc-single' });
    render(
      <HttpConfig
        {...defaultProps}
        data={data}
        workflowServices={singleEndpointService}
        environments={environments}
      />,
    );
    expect(screen.queryByText('Environment')).toBeNull();
  });
});

describe('HttpConfig — auth fields with missing optional properties', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders empty basic auth fields when username/password are undefined', () => {
    const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'basic' } as Scenario['auth'] }) });
    const { container } = render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
    const authSection = container.querySelector('.wf-config-auth-section')!;
    const textInputs = authSection.querySelectorAll('input:not([type="password"])');
    expect(textInputs.length).toBeGreaterThan(0);
    expect(Array.from(textInputs).every(i => (i as HTMLInputElement).value === '')).toBe(true);
  });

  it('renders empty digest auth fields when credentials are undefined', () => {
    const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'digest' } as Scenario['auth'] }) });
    const { container } = render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
    const authSection = container.querySelector('.wf-config-auth-section')!;
    const usernameInput = authSection.querySelector('input:not([type="password"])') as HTMLInputElement;
    expect(usernameInput.value).toBe('');
    expect(authSection.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('renders empty oauth2 client fields when values are undefined', () => {
    const data = makeHttpData({
      scenario: makeScenario({ auth: { type: 'oauth2', tokenUrl: '' } as Scenario['auth'] }),
    });
    const { container } = render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
    const authSection = container.querySelector('.wf-config-auth-section')!;
    const clientIdInput = authSection.querySelector('.form-row.two-col input:not([type="password"])') as HTMLInputElement;
    expect(clientIdInput.value).toBe('');
    const secretInput = authSection.querySelector('input[type="password"]') as HTMLInputElement;
    expect(secretInput.value).toBe('');
  });
});
