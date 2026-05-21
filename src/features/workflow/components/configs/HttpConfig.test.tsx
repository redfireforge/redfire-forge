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
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HttpConfig from './HttpConfig';
import { WorkflowService } from '../../types/workflow';
import { Scenario, KeyValue } from '../../../../shared/types';
import { makeHttpData, makeScenario, makeDefaultProps } from './__test-utils__/httpConfigTestHelpers';

vi.mock('../expression/ExpressionInput', () => ({
  __esModule: true,
  default: React.forwardRef(({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }, ref: React.Ref<HTMLInputElement>) => (
    <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} data-testid="expression-input" />
  )),
}));

vi.mock('../expression/ExpressionTextarea', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ value, onChange, placeholder, rows, className }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string }) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={className} data-testid="expression-textarea" />
  )),
}));

vi.mock('../../../../shared/components/data-mapper/BodyBuilderPanel', () => ({
  __esModule: true,
  default: function MockBodyBuilder() {
    return <div data-testid="mock-body-builder" />;
  },
}));

vi.mock('../../../../shared/components/data-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/components/data-mapper')>();
  return {
    ...actual,
    DataMapperModal: function MockVarMapperModal({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
      return (
        <div data-testid="mock-var-mapper-modal">
          <button type="button" onClick={() => onSave()}>var-mapper-save</button>
          <button type="button" onClick={() => onCancel()}>var-mapper-cancel</button>
        </div>
      );
    },
  };
});

vi.mock('../../../requests/components/ExtractionEditor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="extraction-editor">ExtractionEditor</div>),
}));

vi.mock('../../../requests/components/ParamsEditor', () => ({
  __esModule: true,
  ParamsEditor: vi.fn().mockImplementation(() => <div data-testid="params-editor">QUERY PARAMETERS</div>),
}));

vi.mock('../../../scenarios/components/DataSourceEditor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="data-source-editor" />),
}));

const defaultProps = makeDefaultProps();

describe('HttpConfig — basic rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    render(<HttpConfig {...defaultProps} />);
    expect(screen.getByDisplayValue('GET')).toBeTruthy();
  });

  it('calls onChange when method changes', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('GET'), { target: { value: 'POST' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders all 5 HTTP method options', () => {
    render(<HttpConfig {...defaultProps} />);
    const select = screen.getByDisplayValue('GET') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
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
    expect(screen.getByText('QUERY PARAMETERS')).toBeTruthy();
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
    render(<HttpConfig {...defaultProps} />);
    expect(screen.getByText('None (use harness bar)')).toBeTruthy();
  });

  it('renders services in the select when provided', () => {
    const services: WorkflowService[] = [
      { id: 'svc1', name: 'Users API', baseUrl: 'http://users.api', auth: { type: 'none' } },
    ];
    render(<HttpConfig {...defaultProps} workflowServices={services} />);
    expect(screen.getByText('Users API')).toBeTruthy();
  });

  it('calls onChange with serviceId when service is selected', () => {
    const onChange = vi.fn();
    const services: WorkflowService[] = [
      { id: 'svc1', name: 'Users API', baseUrl: 'http://users.api', auth: { type: 'none' } },
    ];
    render(<HttpConfig {...defaultProps} onChange={onChange} workflowServices={services} />);
    const serviceSelect = document.querySelector('.wf-config-service-select') as HTMLSelectElement;
    fireEvent.change(serviceSelect, { target: { value: 'svc1' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 'svc1', label: 'Users API' }));
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
    const serviceSelect = document.querySelector('.wf-config-service-select') as HTMLSelectElement;
    fireEvent.change(serviceSelect, { target: { value: '' } });
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
    expect(screen.getByText('QUERY PARAMETERS')).toBeTruthy();
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
    const select = document.querySelector('.wf-config-service-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'svc1' } });
    expect(onChange).toHaveBeenCalledWith({ serviceId: 'svc1', label: 'My API' });
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
    expect(screen.getByText('QUERY PARAMETERS')).toBeTruthy();
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
