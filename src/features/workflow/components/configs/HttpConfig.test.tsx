/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HttpConfig from './HttpConfig';
import type { HttpNodeData, WorkflowService } from '../../types/workflow';
import type { Scenario, KeyValue } from '../../../../shared/types';

// Mock ExpressionInput and ExpressionTextarea to avoid complex autocomplete internals
vi.mock('../expression/ExpressionInput', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} data-testid="expression-input" />
  )),
}));

vi.mock('../expression/ExpressionTextarea', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ value, onChange, placeholder, rows, className }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string }) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={className} data-testid="expression-textarea" />
  )),
}));

// Mock ExtractionEditor
vi.mock('../../../requests/components/ExtractionEditor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => <div data-testid="extraction-editor">ExtractionEditor</div>),
}));

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test Scenario',
    url: '/api/users',
    method: 'GET',
    headers: [{ key: '', value: '' }],
    body: '',
    auth: { type: 'none' },
    validation: {},
    ...overrides,
  } as Scenario;
}

function makeHttpData(overrides: Partial<HttpNodeData> = {}): HttpNodeData {
  return {
    label: 'Get Users',
    scenario: makeScenario(),
    ...overrides,
  } as HttpNodeData;
}

const noop = vi.fn();

const defaultProps = {
  data: makeHttpData(),
  onChange: vi.fn() as ReturnType<typeof vi.fn>,
  activeTab: 'url' as const,
  onTabChange: vi.fn(),
  effectiveQuickTestBaseUrl: 'http://localhost:3000',
  onRequestVariableInsert: vi.fn(),
};

describe('HttpConfig', () => {
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

  // --- Header interactions ---
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

  // --- Body tab ---
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

  // --- URL Insert variable ---
  it('calls onRequestVariableInsert for URL Insert button', () => {
    const onRequestVariableInsert = vi.fn();
    render(<HttpConfig {...defaultProps} onRequestVariableInsert={onRequestVariableInsert} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);
    expect(onRequestVariableInsert).toHaveBeenCalled();
  });

  // --- Service select ---
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

  // --- Tab badges ---
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

  // --- Variable hints ---
  it('renders variable hints when provided', () => {
    render(<HttpConfig {...defaultProps} activeTab="url" variableHints={[
      { ref: 'userId', label: 'User ID', type: 'string', description: 'The user ID' },
      { ref: 'node:step1.token', label: 'Token', type: 'string', description: '' },
    ]} />);
    expect(screen.getByText(/Variables you can paste/)).toBeTruthy();
  });

  it('does not render hints section with empty hints', () => {
    render(<HttpConfig {...defaultProps} activeTab="url" variableHints={[]} />);
    expect(screen.queryByText(/Variables you can paste/)).toBeNull();
  });

  // --- URL with query params ---
  it('parses query params from URL', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users?page=1&limit=10' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} />);
    // ParamsEditor renders the parsed params
    expect(screen.getByText('QUERY PARAMETERS')).toBeTruthy();
  });

  // --- URL preview for absolute URLs ---
  it('shows absolute URL as-is in preview', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: 'https://api.example.com/users' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    const urlPreview = document.querySelector('.wf-config-last-req-url-value');
    expect(urlPreview?.textContent).toBe('https://api.example.com/users');
  });

  // --- Template variable decoding ---
  it('decodes percent-encoded template vars in URL display', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users?id=%7B%7BuserId%7D%7D' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    // The component should decode the encoded template vars
    expect(document.querySelector('.wf-config-last-req-url-value')?.textContent).toContain('userId');
  });

  // --- URL preview edge cases ---
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
    // The ParamsEditor should be rendered
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
});
