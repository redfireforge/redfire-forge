/**
 * @vitest-environment jsdom
 *
 * HttpConfig — interactive paths: variable insertion at cursor, ParamsEditor
 * callbacks, body insert, body builder, validation badges, data source,
 * fetchSample host, spec version, mapper modal, URL hydration.
 *
 * Basic rendering tests live in `HttpConfig.test.tsx`. Shared factories live in
 * `__test-utils__/httpConfigTestHelpers.tsx`.
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HttpConfig from './HttpConfig';
import { KeyValue, Scenario } from '../../../../shared/types';
import { makeHttpData, makeScenario, makeDefaultProps } from './__test-utils__/httpConfigTestHelpers';
import {
  httpConfigMockState,
  resetHttpConfigMockState,
} from './__test-utils__/httpConfigTestMocks';

vi.mock('../expression/ExpressionInput', async () => {
  const { createExpressionInputModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createExpressionInputModuleMock();
});
vi.mock('../expression/ExpressionTextarea', async () => {
  const { createExpressionTextareaModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createExpressionTextareaModuleMock();
});
vi.mock('../../../../shared/components/data-mapper/BodyBuilderPanel', async () => {
  const { createBodyBuilderInteractiveModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createBodyBuilderInteractiveModuleMock();
});
vi.mock('../../../../shared/components/data-mapper', async () => {
  const { createDataMapperModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createDataMapperModuleMock();
});
vi.mock('../../../requests/components/ExtractionEditor', async () => {
  const { createExtractionEditorModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createExtractionEditorModuleMock({ captureProps: true });
});
vi.mock('../../../requests/components/ParamsEditor', async () => {
  const { createParamsEditorModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createParamsEditorModuleMock({ captureProps: true });
});
vi.mock('../../../scenarios/components/DataSourceEditor', async () => {
  const { createDataSourceEditorModuleMock } = await import('./__test-utils__/httpConfigTestMocks');
  return createDataSourceEditorModuleMock({ interactive: true });
});

const lastExtractionEditorProps = httpConfigMockState.lastExtractionEditorProps;
const lastParamsEditorProps = httpConfigMockState.lastParamsEditorProps;

const defaultProps = makeDefaultProps();

describe('HttpConfig — interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetHttpConfigMockState();
  });

  it('inserts variable at cursor position in URL', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users' }) });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} onRequestVariableInsert={onRequest} />);

    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);

    const applyFn = onRequest.mock.calls[0][0] as (snippet: string) => void;

    const urlInput = document.querySelector('.wf-config-url-input') as HTMLInputElement;
    if (urlInput) {
      Object.defineProperty(urlInput, 'selectionStart', { value: 4, writable: true });
      Object.defineProperty(urlInput, 'selectionEnd', { value: 4, writable: true });
    }

    applyFn('{{userId}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/api{{userId}}/users' }),
    }));
  });

  it('appends variable to URL when no cursor position', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/path' }) });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} onRequestVariableInsert={onRequest} />);

    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);

    const applyFn = onRequest.mock.calls[0][0] as (snippet: string) => void;

    const urlInput = document.querySelector('.wf-config-url-input') as HTMLInputElement;
    if (urlInput) {
      Object.defineProperty(urlInput, 'selectionStart', { value: null, writable: true });
    }

    applyFn('{{token}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/api/path{{token}}' }),
    }));
  });

  it('handles param changes via ParamsEditor onChange', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?key=val' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);

    const paramsOnChange = lastParamsEditorProps.onChange as (entries: { key: string; value: string; enabled: boolean; description: string }[]) => void;
    paramsOnChange([
      { key: 'page', value: '1', enabled: true, description: '' },
      { key: '', value: '', enabled: true, description: '' },
    ]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: expect.stringContaining('page=1') }),
    }));
  });

  it('handles param changes that rebuild URL with template vars', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?id=123' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);

    const paramsOnChange = lastParamsEditorProps.onChange as (entries: { key: string; value: string; enabled: boolean; description: string }[]) => void;
    paramsOnChange([
      { key: 'id', value: '{{userId}}', enabled: true, description: '' },
    ]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/api?id={{userId}}' }),
    }));
  });

  it('handles params with all empty trailing rows', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?a=1' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);

    const paramsOnChange = lastParamsEditorProps.onChange as (entries: { key: string; value: string; enabled: boolean; description: string }[]) => void;
    paramsOnChange([
      { key: 'a', value: '1', enabled: true, description: '' },
      { key: '', value: '', enabled: true, description: '' },
      { key: '', value: '', enabled: true, description: '' },
    ]);

    expect(onChange).toHaveBeenCalled();
  });

  it('calls onInsertVariable via ParamsEditor', () => {
    const onRequest = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?key=val' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onRequestVariableInsert={onRequest} />);

    const onInsertVariable = lastParamsEditorProps.onInsertVariable as (rowIndex: number, paramKey: string) => void;
    onInsertVariable(0, 'key');

    expect(onRequest).toHaveBeenCalledWith(expect.any(Function), false, 'key');

    const applyFn = onRequest.mock.calls[0][0] as (snippet: string) => void;
    applyFn('{{token}}');
  });

  it('header Insert button apply callback updates header value', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    const headers: KeyValue[] = [{ key: 'Auth', value: 'Bearer old' }];
    render(<HttpConfig {...defaultProps} activeTab="headers" onChange={onChange} onRequestVariableInsert={onRequest} data={makeHttpData({ scenario: makeScenario({ headers }) })} />);

    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[insertBtns.length - 1]);

    const applyFn = onRequest.mock.calls[0][0] as (snippet: string) => void;
    applyFn('{{authToken}}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({
        headers: [{ key: 'Auth', value: '{{authToken}}' }],
      }),
    }));
  });

  it('body Insert variable button apply callback appends to body', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: '{"key": "' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" onChange={onChange} onRequestVariableInsert={onRequest} data={data} />);

    fireEvent.click(screen.getByText('Insert variable…'));
    const applyFn = onRequest.mock.calls[0][0] as (snippet: string) => void;
    applyFn('{{value}}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ body: '{"key": "{{value}}' }),
    }));
  });

  it('passes fetchSample host config to ExtractionEditor', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ fetchHostEnabled: true, fetchHostOverride: 'http://custom' }) });
    render(<HttpConfig {...defaultProps} activeTab="extract" data={data} onChange={onChange}
      extractionFetchSample={{ onFetch: vi.fn(), fetching: false, error: null }}
      effectiveQuickTestBaseUrl="http://base.url"
    />);

    const fetchSample = lastExtractionEditorProps.fetchSample as Record<string, unknown>;
    expect(fetchSample).toBeTruthy();
    const host = fetchSample.host as Record<string, unknown>;
    expect(host.enabled).toBe(true);
    expect(host.override).toBe('http://custom');
    expect(host.resolvedBaseUrl).toBe('http://base.url');

    (host.setEnabled as (v: boolean) => void)(false);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ fetchHostEnabled: false }),
    }));

    onChange.mockClear();
    (host.setOverride as (v: string) => void)('http://new-host');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ fetchHostOverride: 'http://new-host' }),
    }));
  });

  it('does not encode query key/value containing template vars', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);

    const paramsOnChange = lastParamsEditorProps.onChange as (entries: { key: string; value: string; enabled: boolean; description: string }[]) => void;
    paramsOnChange([
      { key: '{{paramName}}', value: '{{paramValue}}', enabled: true, description: '' },
    ]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/api?{{paramName}}={{paramValue}}' }),
    }));
  });

  it('excludes disabled params from rebuilt URL', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?a=1' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);

    const paramsOnChange = lastParamsEditorProps.onChange as (entries: { key: string; value: string; enabled: boolean; description: string }[]) => void;
    paramsOnChange([
      { key: 'a', value: '1', enabled: false, description: '' },
      { key: 'b', value: '2', enabled: true, description: '' },
    ]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/api?b=2' }),
    }));
  });

  it('encodes query key and value without template vars', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} />);

    const paramsOnChange = lastParamsEditorProps.onChange as (entries: { key: string; value: string; enabled: boolean; description: string }[]) => void;
    paramsOnChange([
      { key: 'q', value: 'hello world', enabled: true, description: '' },
    ]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/api?q=hello%20world' }),
    }));
  });

  it('updates extractions via ExtractionEditor onChange', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} activeTab="extract" onChange={onChange} />);
    const patch = [{ name: 'v1', source: 'body' as const, expression: '$.id' }];
    (lastExtractionEditorProps.onChange as (e: typeof patch) => void)(patch);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ extractions: patch }),
    }));
  });

  it('forwards DataSourceEditor draft updates through update()', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} activeTab="data" onChange={onChange} />);
    fireEvent.click(screen.getByText('ds-patch-draft'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ url: '/from-ds' }),
    }));
  });

  it('opens and closes variable binding mapper when template slots exist', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: 'https://api/x/{{orderId}}/y' }) });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Visual Variables/ }));
    expect(screen.getByTestId('mock-var-mapper-modal')).toBeTruthy();
    fireEvent.click(screen.getByText('var-mapper-save'));
    expect(screen.queryByTestId('mock-var-mapper-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Visual Variables/ }));
    fireEvent.click(screen.getByText('var-mapper-cancel'));
    expect(screen.queryByTestId('mock-var-mapper-modal')).toBeNull();
  });

  it('shows catalog pinning controls whenever a spec linkage exists', () => {
    const onChange = vi.fn();
    const data = makeHttpData({
      sourceSpecVersionId: 'spec-1',
      specVersionMode: 'latest',
      sourceSpecVersionLabel: '3.4.5',
    });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} />);
    const modeSelect = document.querySelector('.wf-config-version-select') as HTMLSelectElement;
    expect(modeSelect).toBeTruthy();
    expect(modeSelect.value).toBe('latest');
    fireEvent.change(modeSelect, { target: { value: 'pinned' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ specVersionMode: 'pinned' }));
    expect(document.querySelector('.wf-config-version-label')?.textContent).toContain('3.4.5');
  });

  it('renders pinned copy without supplementary label badges when unspecified', () => {
    const data = makeHttpData({
      sourceSpecVersionId: 'spec-2',
      specVersionMode: 'pinned',
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const pinned = Array.from(document.querySelectorAll('.wf-config-version-select option')).find(o => (o as HTMLOptionElement).value === 'pinned');
    expect(pinned?.textContent).toBe('Pinned');
    expect(document.querySelector('.wf-config-version-label')).toBeNull();
  });

  it('uses plural copy when multiple upstream template slots are detected', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: 'https://svc/{{slotA}}/x/{{slotB}}/y' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(screen.getByRole('button', { name: /Visual Variables \(2 slots\)/ })).toBeInTheDocument();
  });

  it('normalizes percent-encoded braces via onChange hydration', async () => {
    const onChange = vi.fn();
    const encoded = '/api/route?marker=%7B%7Bx%7D%7D';
    render(<HttpConfig {...defaultProps} data={makeHttpData({ scenario: makeScenario({ url: encoded }) })} onChange={onChange} />);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ scenario: expect.objectContaining({ url: '/api/route?marker={{x}}' }) }),
      ),
    );
  });

  it('updates URL when the URL input changes', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} onChange={onChange} />);
    const urlInput = document.querySelector('.wf-config-url-input') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: '/api/changed' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: expect.objectContaining({ url: '/api/changed' }) }),
    );
  });

  it('clamps timeout values, including non-numeric entries, to the 0-300 range', () => {
    const onChange = vi.fn();
    render(<HttpConfig {...defaultProps} onChange={onChange} />);
    const timeoutInput = document.querySelector('.wf-config-timeout-input') as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '999' } });
    expect(onChange).toHaveBeenCalledWith({ timeoutSec: 300 });
    onChange.mockClear();
    fireEvent.change(timeoutInput, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith({ timeoutSec: 0 });
    onChange.mockClear();
    fireEvent.change(timeoutInput, { target: { value: '-5' } });
    expect(onChange).toHaveBeenCalledWith({ timeoutSec: 0 });
  });

  it('renders the Pretty button as a no-op when the body is invalid JSON', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: 'not-json' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Pretty'));
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ scenario: expect.objectContaining({ body: expect.any(String) }) }),
    );
  });

  it('pretty-prints a valid JSON body when Pretty is clicked', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: '{"a":1}' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Pretty'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: expect.objectContaining({ body: '{\n  "a": 1\n}' }),
      }),
    );
  });

  it('opens and closes the body Data Mapper modal', () => {
    const data = makeHttpData({ scenario: makeScenario({ body: '{"a":1}' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} />);
    fireEvent.click(screen.getByText('⚡ Data Mapper'));
    expect(screen.getAllByTestId('mock-var-mapper-modal').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('var-mapper-cancel')[0]);
    expect(screen.queryByTestId('mock-var-mapper-modal')).toBeNull();
  });

  it('persists a body coming from the Data Mapper save action', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: '{"a":1}' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('⚡ Data Mapper'));
    fireEvent.click(screen.getAllByText('var-mapper-save')[0]);
    expect(screen.queryByTestId('mock-var-mapper-modal')).toBeNull();
  });

  it('shows the empty validation state when validationProps are not provided', () => {
    render(<HttpConfig {...defaultProps} activeTab="validation" />);
    expect(screen.getByText(/Validation is not available in this context/i)).toBeTruthy();
  });

  it('shows the validation badge when the scenario has expected JSON in full mode', () => {
    const data = makeHttpData({
      scenario: makeScenario({
        validation: { mode: 'full', expectedJson: '{"ok":true}' },
      } as Partial<Scenario>),
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const dot = document.querySelector('.tab-badge-dot');
    expect(dot).toBeTruthy();
  });

  it('shows the validation badge when assertions exist', () => {
    const data = makeHttpData({
      scenario: makeScenario({
        validation: { assertions: [{ path: '$.x', op: 'eq', value: 1 }] },
      } as unknown as Partial<Scenario>),
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const dot = document.querySelector('.tab-badge-dot');
    expect(dot).toBeTruthy();
  });

  it('passes onInsertVariable through ParamsEditor and runs its apply callback', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ url: '/api?id=1' }) });
    render(<HttpConfig {...defaultProps} activeTab="url" data={data} onChange={onChange} onRequestVariableInsert={onRequest} />);
    const onInsertVariable = lastParamsEditorProps.onInsertVariable as (rowIndex: number, paramKey: string) => void;
    onInsertVariable(0, 'id');
    const apply = onRequest.mock.calls[0][0] as (snippet: string) => void;
    apply('{{userId}}');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: expect.objectContaining({ url: expect.stringContaining('{{userId}}') }),
      }),
    );
  });
});
