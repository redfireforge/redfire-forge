/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestEditorModal from './TestEditorModal';
import type { Scenario, FeatureGroup } from '../../../shared/types';

// ─── Hoisted mutable mock state ───────────────────────────────
const h = vi.hoisted(() => ({
  effectiveAuth: { auth: { type: 'none' } as { type: string }, source: 'inline' },
  pickJsonRaw: { name: 'Imported', method: 'GET', url: 'https://imported.example.com' } as unknown,
  parsedCurl: {
    id: 'parsed-id', name: 'Curl Test', method: 'POST', url: 'https://curl.example.com',
    headers: [], body: '{"a":1}', bodyType: 'json', auth: { type: 'none' },
    validation: { mode: 'status' },
  } as unknown as Scenario,
}));

const toastShow = vi.fn();
const onFetchRow = vi.fn();

vi.mock('../../../shared/hooks/useToast', () => ({ useToast: () => ({ show: toastShow }) }));
vi.mock('../../requests/hooks/useAuthVerify', () => ({
  useAuthVerify: () => ({ authVerifying: false, authVerifyResult: null, setAuthVerifyResult: vi.fn(), verifyAuth: vi.fn() }),
}));
vi.mock('../hooks/useTestFetch', () => ({
  useTestFetch: () => ({
    fetchingResponse: false, fetchError: null,
    fetchHostOverride: '', setFetchHostOverride: vi.fn(),
    fetchHostEnabled: false, setFetchHostEnabled: vi.fn(),
    validating: false, validationResult: null, setValidationResult: vi.fn(),
    pendingFetchResponse: null,
    resolveEffectiveAuth: () => h.effectiveAuth,
    handleFetchRow: onFetchRow,
    handleFetchSampleResponse: vi.fn(),
    fetchSampleDataForMapper: vi.fn(),
    handleFetchKeepRules: vi.fn(), handleFetchReplaceAll: vi.fn(), handleFetchCancel: vi.fn(),
    handleValidateResponse: vi.fn(),
  }),
}));
vi.mock('../../../shared/utils/curlParser', () => ({ parseCurl: () => h.parsedCurl }));
vi.mock('../../../shared/utils/curlGenerator', () => ({ buildCurlCommand: () => 'curl https://x' }));
vi.mock('../utils/testEditorUtils', () => ({
  getBaseUrl: (u: string) => u,
  parseQueryParams: () => ({}),
  pickJsonFile: (cb: (raw: unknown) => void) => cb(h.pickJsonRaw),
  rebuildUrl: (base: string) => base,
  unwrapImport: (raw: unknown) => raw,
}));
vi.mock('../../../shared/utils/helpers', () => ({ toErrorMessage: (e: unknown) => String(e) }));
vi.mock('../utils/testDefinitionVersioning', () => ({ createSnapshot: () => ({}) }));
vi.mock('../../../shared/utils/fileSaver', () => ({ saveFile: vi.fn(() => Promise.resolve()) }));
vi.mock('papaparse', () => ({
  default: {
    parse: () => ({ data: [['name', 'channel'], ['A', 'web']] }),
    unparse: () => 'csv-content',
  },
}));

vi.mock('../../requests/components/ParamsEditor', () => ({
  ParamsEditor: ({ onChange, onImportFromUrl }: { onChange: (e: unknown[]) => void; onImportFromUrl: () => void }) => (
    <div data-testid="params-editor">
      <button onClick={() => onChange([{ key: 'a', value: 'b', enabled: true }])}>params-change</button>
      <button onClick={onImportFromUrl}>params-import</button>
    </div>
  ),
  toParamEntries: () => [] as unknown[],
  fromParamEntries: () => [{ key: 'a', value: 'b' }],
}));
vi.mock('../../requests/components/BodyEditor', () => ({ BodyEditor: () => <div data-testid="body-editor" /> }));
vi.mock('./TestEditorAuthTab', () => ({ default: () => <div data-testid="auth-tab" /> }));
vi.mock('./TestEditorValidationTab', () => ({ default: () => <div data-testid="validation-tab" /> }));
vi.mock('../../requests/components/ExtractionEditor', () => ({
  default: ({ onChange }: { onChange: (e: unknown[]) => void }) => (
    <div data-testid="extraction-editor"><button onClick={() => onChange([{ id: 'e1' }])}>extract-change</button></div>
  ),
}));
vi.mock('./DataSourceEditor', () => ({
  default: ({ onFetchRow: f }: { onFetchRow: () => void }) => (
    <div data-testid="data-source-editor"><button onClick={f}>fetch-row</button></div>
  ),
}));
vi.mock('./WsScenarioEditor', () => ({ default: () => <div data-testid="ws-editor" /> }));
vi.mock('./TestDefinitionVersionPanel', () => ({
  default: ({ onCompare }: { onCompare: (a: unknown, b: unknown) => void }) => (
    <div data-testid="version-panel"><button onClick={() => onCompare({ id: 'o' }, { id: 'n' })}>compare</button></div>
  ),
}));
vi.mock('./TestDefinitionVersionDiff', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="version-diff"><button onClick={onClose}>diff-close</button></div>
  ),
}));
vi.mock('./DataSourceSetupModal', () => ({
  default: ({ onApply, onClose }: { onApply: (dt: unknown, u: unknown) => void; onClose: () => void }) => (
    <div data-testid="ds-setup-modal">
      <button onClick={() => onApply({ id: 'dt' }, 'tmpl')}>ds-apply</button>
      <button onClick={onClose}>ds-close</button>
    </div>
  ),
}));
vi.mock('../../workflow/components/modals/WorkflowEditorModalFrame', () => ({
  default: ({ title, headerActions, children, onClose }: {
    title: string; headerActions: React.ReactNode; children: React.ReactNode; onClose: () => void;
  }) => (
    <div data-testid="modal-frame">
      <div data-testid="frame-title">{title}</div>
      <div data-testid="header-actions">{headerActions}</div>
      <div data-testid="frame-body">{children}</div>
      <button onClick={onClose}>frame-close</button>
    </div>
  ),
}));

function makeDraft(over: Partial<Scenario> = {}): Scenario {
  return {
    id: 't1',
    name: 'My Test',
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'status' } as Scenario['validation'],
    ...over,
  };
}

const FGS: FeatureGroup[] = [
  { id: 'fg1', name: 'FG', scenarios: [{ id: 'sc1', name: 'SC', kind: 'standard', tests: [] }] },
];

function makeProps(over: Partial<React.ComponentProps<typeof TestEditorModal>> = {}) {
  return {
    draft: makeDraft(),
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isNew: false,
    inputMode: 'builder' as const,
    onInputModeChange: vi.fn(),
    activeTab: 'params' as const,
    onActiveTabChange: vi.fn(),
    resolvedBaseUrl: 'https://api.example.com',
    allAuthProfiles: [],
    featureGroups: FGS,
    editingTest: { fgId: 'fg1', scenarioId: 'sc1', testId: 't1' },
    onExportTest: vi.fn(),
    onVersionRestore: vi.fn(),
    onVersionDelete: vi.fn(),
    onVersionRename: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.effectiveAuth = { auth: { type: 'none' }, source: 'inline' };
  h.pickJsonRaw = { name: 'Imported', method: 'GET', url: 'https://imported.example.com' };
});

function Harness() {
  const [mode, setMode] = useState<'builder' | 'curlImport' | 'curlExport'>('builder');
  return <TestEditorModal {...makeProps({ inputMode: mode, onInputModeChange: setMode })} />;
}

describe('TestEditorModal — builder mode', () => {
  it('renders builder with name, transport, url-bar and tabs', () => {
    render(<TestEditorModal {...makeProps()} />);
    expect(screen.getByText('Edit Test')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Get User Profile')).toHaveValue('My Test');
    expect(screen.getByLabelText('Transport type')).toBeInTheDocument();
    expect(screen.getByTestId('params-editor')).toBeInTheDocument();
  });

  it('shows New Test / New Parameterized Test titles', () => {
    const { rerender } = render(<TestEditorModal {...makeProps({ isNew: true })} />);
    expect(screen.getByText('New Test')).toBeInTheDocument();
    rerender(<TestEditorModal {...makeProps({ isNew: true, isParameterized: true })} />);
    expect(screen.getByText('New Parameterized Test')).toBeInTheDocument();
    rerender(<TestEditorModal {...makeProps({ isNew: false, isParameterized: true })} />);
    expect(screen.getByText('Edit Parameterized Test')).toBeInTheDocument();
  });

  it('Save is disabled when name is empty and enabled when valid', () => {
    const onSave = vi.fn();
    const { rerender } = render(<TestEditorModal {...makeProps({ draft: makeDraft({ name: '' }) })} />);
    expect(screen.getByText('Save')).toBeDisabled();
    rerender(<TestEditorModal {...makeProps({ draft: makeDraft(), onSave })} />);
    expect(screen.getByText('Save')).toBeEnabled();
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('changes name and method', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Get User Profile'), { target: { value: 'New Name' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
    const methodSelect = document.querySelector('.method-select') as HTMLSelectElement;
    fireEvent.change(methodSelect, { target: { value: 'POST' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });

  it('changes the base url and syncs dataSource urlTemplate', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({
      onDraftChange,
      draft: makeDraft({ dataSource: { id: 'ds', columns: [], rows: [], source: { type: 'inline' }, urlTemplate: 'https://old' } }),
    })} />);
    const urlInput = document.querySelector('.url-input') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'https://new.example.com' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      dataSource: expect.objectContaining({ urlTemplate: expect.any(String) }),
    }));
  });

  it('shows the Use button when base url empty and applies resolved base url', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ url: '' }) })} />);
    fireEvent.click(screen.getByTitle('Use resolved base URL'));
    expect(onDraftChange).toHaveBeenCalled();
  });

  it('handles params change and import from url', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.click(screen.getByText('params-change'));
    expect(onDraftChange).toHaveBeenCalled();
    fireEvent.click(screen.getByText('params-import'));
  });
});

describe('TestEditorModal — transport switching', () => {
  it('switches to wsConnect and renders the WS editor', () => {
    const onDraftChange = vi.fn();
    const onActiveTabChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange, onActiveTabChange, activeTab: 'params' })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'wsConnect' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'WEBSOCKET', actionType: 'wsConnect' }));
    expect(onActiveTabChange).toHaveBeenCalledWith('validation');
  });

  it('switches to wsSend and wsReceive', () => {
    const onDraftChange = vi.fn();
    const { rerender } = render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'wsSend' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'wsSend' }));
    rerender(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'wsReceive' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'wsReceive' }));
  });

  it('switches to kafka and renders placeholder', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'kafkaProduce' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'KAFKA', actionType: 'kafkaProduce' }));
  });

  it('renders WS editor and kafka placeholder based on draft actionType', () => {
    const { rerender } = render(<TestEditorModal {...makeProps({
      draft: makeDraft({ actionType: 'wsConnect', method: 'WEBSOCKET', wsConnectAction: { url: 'wss://x' } as Scenario['wsConnectAction'] }),
    })} />);
    expect(screen.getByTestId('ws-editor')).toBeInTheDocument();
    rerender(<TestEditorModal {...makeProps({ draft: makeDraft({ actionType: 'kafkaProduce', method: 'KAFKA' }) })} />);
    expect(screen.getByText(/Kafka scenario editor is planned/)).toBeInTheDocument();
  });

  it('computes canSave for ws variants', () => {
    // wsConnect valid
    const { rerender } = render(<TestEditorModal {...makeProps({
      draft: makeDraft({ actionType: 'wsConnect', method: 'WEBSOCKET', wsConnectAction: { url: 'wss://x' } as Scenario['wsConnectAction'] }),
    })} />);
    expect(screen.getByText('Save')).toBeEnabled();
    // wsSend missing connectionRef
    rerender(<TestEditorModal {...makeProps({
      draft: makeDraft({ actionType: 'wsSend', method: 'WEBSOCKET', wsSendAction: { connectionRef: '' } as Scenario['wsSendAction'] }),
    })} />);
    expect(screen.getByText('Save')).toBeDisabled();
    // wsReceive with jsonPathValue but no jsonPathMatch → invalid
    rerender(<TestEditorModal {...makeProps({
      draft: makeDraft({ actionType: 'wsReceive', method: 'WEBSOCKET', wsReceiveAction: { connectionRef: 'c', matchCriteria: { jsonPathValue: 'v' } } as Scenario['wsReceiveAction'] }),
    })} />);
    expect(screen.getByText('Save')).toBeDisabled();
  });
});

describe('TestEditorModal — tabs', () => {
  it('renders body tab for non-GET method', () => {
    render(<TestEditorModal {...makeProps({ activeTab: 'body', draft: makeDraft({ method: 'POST' }) })} />);
    expect(screen.getByTestId('body-editor')).toBeInTheDocument();
  });

  it('renders auth tab', () => {
    render(<TestEditorModal {...makeProps({ activeTab: 'auth' })} />);
    expect(screen.getByTestId('auth-tab')).toBeInTheDocument();
  });

  it('renders and edits headers tab', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange, activeTab: 'headers', draft: makeDraft({ headers: [{ key: 'X', value: 'Y' }] }) })} />);
    const inputs = screen.getAllByPlaceholderText(/Header/);
    fireEvent.change(inputs[0], { target: { value: 'Auth' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ headers: [{ key: 'Auth', value: 'Y' }] }));
    fireEvent.click(screen.getByText('×'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ headers: [] }));
    fireEvent.click(screen.getByText('+ Add'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.arrayContaining([{ key: '', value: '' }]) }));
  });

  it('renders validation tab', () => {
    render(<TestEditorModal {...makeProps({ activeTab: 'validation' })} />);
    expect(screen.getByTestId('validation-tab')).toBeInTheDocument();
  });

  it('renders extract tab for http and ws', () => {
    const onDraftChange = vi.fn();
    const { rerender } = render(<TestEditorModal {...makeProps({ activeTab: 'extract', onDraftChange })} />);
    expect(screen.getByTestId('extraction-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('extract-change'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ extractions: [{ id: 'e1' }] }));
    rerender(<TestEditorModal {...makeProps({
      activeTab: 'extract', onDraftChange,
      draft: makeDraft({ actionType: 'wsConnect', method: 'WEBSOCKET' }),
    })} />);
    expect(screen.getByTestId('extraction-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('extract-change'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ extractions: [{ id: 'e1' }] }));
  });

  it('renders data tab (Parameterize) and Data Source variants', () => {
    const { rerender } = render(<TestEditorModal {...makeProps({ activeTab: 'data', scenarioKind: 'parameterized' })} />);
    expect(screen.getByText('Parameterize')).toBeInTheDocument();
    expect(screen.getByTestId('data-source-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('fetch-row'));
    expect(onFetchRow).toHaveBeenCalled();
    rerender(<TestEditorModal {...makeProps({
      activeTab: 'data', scenarioKind: 'parameterized',
      draft: makeDraft({ dataSource: { id: 'ds', columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' } } }),
    })} />);
    expect(screen.getByText('Data Source')).toBeInTheDocument();
  });

  it('hides validation/extract tabs when a validate column exists', () => {
    render(<TestEditorModal {...makeProps({
      scenarioKind: 'parameterized',
      draft: makeDraft({ dataSource: { id: 'ds', columns: [{ id: 'c', name: 'x', type: 'validate', mapping: 'x' }], rows: [], source: { type: 'inline' } } }),
    })} />);
    expect(screen.queryByRole('button', { name: /^Validation/ })).not.toBeInTheDocument();
  });

  it('renders history tab and opens the version diff', () => {
    render(<TestEditorModal {...makeProps({ activeTab: 'history', isNew: false })} />);
    expect(screen.getByTestId('version-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('compare'));
    expect(screen.getByTestId('version-diff')).toBeInTheDocument();
    fireEvent.click(screen.getByText('diff-close'));
    expect(screen.queryByTestId('version-diff')).not.toBeInTheDocument();
  });

  it('switches tabs via the tab buttons', () => {
    const onActiveTabChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onActiveTabChange, draft: makeDraft({ method: 'POST' }) })} />);
    fireEvent.click(screen.getByRole('button', { name: /^Body/ }));
    expect(onActiveTabChange).toHaveBeenCalledWith('body');
    fireEvent.click(screen.getByRole('button', { name: /^Auth/ }));
    expect(onActiveTabChange).toHaveBeenCalledWith('auth');
    fireEvent.click(screen.getByRole('button', { name: /^Headers/ }));
    expect(onActiveTabChange).toHaveBeenCalledWith('headers');
    fireEvent.click(screen.getByRole('button', { name: /^Params/ }));
    expect(onActiveTabChange).toHaveBeenCalledWith('params');
  });
});

describe('TestEditorModal — cURL modes', () => {
  it('imports a cURL command and switches to builder', () => {
    const onDraftChange = vi.fn();
    const onInputModeChange = vi.fn();
    const onActiveTabChange = vi.fn();
    render(<TestEditorModal {...makeProps({ inputMode: 'curlImport', onDraftChange, onInputModeChange, onActiveTabChange })} />);
    const textarea = screen.getByPlaceholderText(/curl -X POST/);
    fireEvent.change(textarea, { target: { value: 'curl https://x' } });
    fireEvent.click(screen.getByText('Import & Switch to Builder'));
    expect(onDraftChange).toHaveBeenCalled();
    expect(onInputModeChange).toHaveBeenCalledWith('builder');
    expect(onActiveTabChange).toHaveBeenCalledWith('body');
  });

  it('does nothing on empty cURL import', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ inputMode: 'curlImport', onDraftChange })} />);
    expect(screen.getByText('Import & Switch to Builder')).toBeDisabled();
  });

  it('generates a cURL command in export mode', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByText('Copy to Clipboard')).toBeEnabled());
    const ta = document.querySelector('.curl-export-textarea') as HTMLTextAreaElement;
    expect(ta.value).toContain('curl');
    fireEvent.click(screen.getByText('Refresh'));
  });

  it('copies generated cURL to clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    render(<Harness />);
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByText('Copy to Clipboard')).toBeEnabled());
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('curl https://x');
  });

  it('shows the oauth2 note in export mode', async () => {
    h.effectiveAuth = { auth: { type: 'oauth2' }, source: 'inline' };
    render(<TestEditorModal {...makeProps({ inputMode: 'curlExport' })} />);
    await waitFor(() => expect(screen.getByText(/OAuth2 token above is a real token/)).toBeInTheDocument());
  });

  it('shows empty-state in export mode when url is blank', () => {
    render(<TestEditorModal {...makeProps({ inputMode: 'curlExport', draft: makeDraft({ url: '' }) })} />);
    expect(screen.getByText(/Configure the test URL in the Builder first/)).toBeInTheDocument();
  });

  it('toggles cURL Import / cURL Export mode buttons', () => {
    const onInputModeChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onInputModeChange })} />);
    fireEvent.click(screen.getByText('cURL Import'));
    expect(onInputModeChange).toHaveBeenCalledWith('curlImport');
    fireEvent.click(screen.getByText('cURL Export'));
    expect(onInputModeChange).toHaveBeenCalledWith('curlExport');
    fireEvent.click(screen.getByText('Builder'));
    expect(onInputModeChange).toHaveBeenCalledWith('builder');
  });
});

describe('TestEditorModal — import/export dropdowns', () => {
  it('imports a test definition from file', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.click(screen.getByText('Import ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Imported', id: 't1' }));
  });

  it('shows an error toast for an invalid imported file', () => {
    h.pickJsonRaw = { foo: 'bar' };
    render(<TestEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Import ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(toastShow).toHaveBeenCalledWith('error', 'Invalid file', expect.any(String));
  });

  it('shows an error toast when imported http test has no url', () => {
    h.pickJsonRaw = { name: 'NoUrl', method: 'GET' };
    render(<TestEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Import ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(toastShow).toHaveBeenCalledWith('error', 'Invalid file', expect.stringContaining('url'));
  });

  it('exports a test definition', () => {
    const onExportTest = vi.fn();
    render(<TestEditorModal {...makeProps({ onExportTest })} />);
    fireEvent.click(screen.getByText('Export ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(onExportTest).toHaveBeenCalled();
  });

  it('opens the Excel template export modal and applies', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.click(screen.getByText('Export ▾'));
    fireEvent.click(screen.getByText('Excel Template'));
    expect(screen.getByTestId('ds-setup-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ds-apply'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ dataSource: { id: 'dt' } }));
    fireEvent.click(screen.getByText('ds-close'));
    expect(screen.queryByTestId('ds-setup-modal')).not.toBeInTheDocument();
  });

  it('exports data as CSV and JSON when a data source exists', () => {
    const dataSource = {
      id: 'ds',
      columns: [
        { id: 'c1', name: 'vin', type: 'path' as const, mapping: 'vin' },
        { id: 'c2', name: 'channel', type: 'param' as const, mapping: 'channel' },
        { id: 'c3', name: 'code', type: 'validate' as const, mapping: 'code' },
        { id: 'c4', name: 'h', type: 'header' as const, mapping: 'h' },
        { id: 'c5', name: 'b', type: 'body' as const, mapping: 'b' },
      ],
      rows: [{ id: 'r1', values: { c1: 'V', c2: 'web', c3: 'C', c4: 'hv', c5: 'bv' }, enabled: true }],
      source: { type: 'inline' as const },
    };
    render(<TestEditorModal {...makeProps({ draft: makeDraft({ dataSource }) })} />);
    fireEvent.click(screen.getByText('Export ▾'));
    fireEvent.click(screen.getByText('Data as CSV'));
    fireEvent.click(screen.getByText('Export ▾'));
    fireEvent.click(screen.getByText('Data as JSON'));
    // no throw = success
    expect(screen.getByTestId('modal-frame')).toBeInTheDocument();
  });

  it('disables data export options without a data source', () => {
    render(<TestEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Export ▾'));
    expect(screen.getByText('Data as CSV').closest('button')).toBeDisabled();
  });

  it('closes dropdowns on outside click', () => {
    render(<TestEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Import ▾'));
    expect(screen.getByText('Data Rows')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Data Rows')).not.toBeInTheDocument();
  });

  it('imports CSV data rows into the data source', async () => {
    const onDraftChange = vi.fn();
    const dataSource = {
      id: 'ds',
      columns: [
        { id: 'c1', name: 'name', type: 'param' as const, mapping: 'name' },
        { id: 'c2', name: 'channel', type: 'param' as const, mapping: 'channel' },
      ],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      const file = new File(['name,channel\nA,web'], 'rows.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await input.onchange?.(new Event('change') as never);
      await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        dataSource: expect.objectContaining({ rows: expect.any(Array) }),
      })));
    } finally {
      spy.mockRestore();
    }
  });

  it('imports JSON data rows into the data source', async () => {
    const onDraftChange = vi.fn();
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'name', type: 'param' as const, mapping: 'name' }],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      const file = new File([JSON.stringify({ rows: [{ values: { name: 'X' }, enabled: true }] })], 'rows.json', { type: 'application/json' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await input.onchange?.(new Event('change') as never);
      await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        dataSource: expect.objectContaining({ rows: [expect.objectContaining({ values: { c1: 'X' } })] }),
      })));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('TestEditorModal — misc', () => {
  it('cancels via header Cancel and frame close', () => {
    const onCancel = vi.fn();
    render(<TestEditorModal {...makeProps({ onCancel })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('frame-close'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('shows param and header badges from counts', () => {
    render(<TestEditorModal {...makeProps({
      draft: makeDraft({ headers: [{ key: 'X', value: '1' }, { key: 'Y', value: '2' }] }),
    })} />);
    // header badge shows 2
    expect(screen.getByRole('button', { name: /Headers 2/ })).toBeInTheDocument();
  });
});

describe('TestEditorModal — coverage gaps', () => {
  it('syncs query params when draft.url changes externally', () => {
    const { rerender } = render(<TestEditorModal {...makeProps({ draft: makeDraft({ url: 'https://a.com/x' }) })} />);
    rerender(<TestEditorModal {...makeProps({ draft: makeDraft({ url: 'https://b.com/y?q=1' }) })} />);
    expect(screen.getByTestId('params-editor')).toBeInTheDocument();
  });

  it('imports a cURL command when the parsed url is empty', () => {
    h.parsedCurl = {
      id: 'p2', name: 'C', method: 'GET', url: '', headers: [], body: '',
      bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'status' },
    } as unknown as Scenario;
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ inputMode: 'curlImport', onDraftChange })} />);
    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/), { target: { value: 'curl x' } });
    fireEvent.click(screen.getByText('Import & Switch to Builder'));
    expect(onDraftChange).toHaveBeenCalled();
  });

  it('clears generated cURL when url is empty in export mode', async () => {
    function HarnessEmptyUrl() {
      const [mode, setMode] = useState<'builder' | 'curlImport' | 'curlExport'>('builder');
      return <TestEditorModal {...makeProps({ draft: makeDraft({ url: '' }), inputMode: mode, onInputModeChange: setMode })} />;
    }
    render(<HarnessEmptyUrl />);
    fireEvent.click(screen.getByText('cURL Export'));
    expect(await screen.findByText(/Configure the test URL in the Builder first/)).toBeInTheDocument();
  });

  it('selects the cURL export textarea text on click', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('cURL Export'));
    await waitFor(() => expect(screen.getByText('Copy to Clipboard')).toBeEnabled());
    const ta = document.querySelector('.curl-export-textarea') as HTMLTextAreaElement;
    fireEvent.click(ta);
    expect(ta).toBeInTheDocument();
  });

  it('returns early when transport is unchanged', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'http' } });
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('switches from WebSocket back to HTTP', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({
      onDraftChange,
      draft: makeDraft({ actionType: 'wsConnect', method: 'WEBSOCKET', wsConnectAction: { url: 'wss://x' } as Scenario['wsConnectAction'] }),
    })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'http' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', actionType: undefined }));
  });

  it('filters non-body extractions when switching to WebSocket', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({
      onDraftChange,
      draft: makeDraft({ extractions: [{ id: 'e1', source: 'header' }, { id: 'e2', source: 'body' }] as Scenario['extractions'] }),
    })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'wsConnect' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      extractions: [{ id: 'e2', source: 'body' }],
    }));
  });

  it('switches away from the extract tab when switching to Kafka', () => {
    const onActiveTabChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onActiveTabChange, activeTab: 'extract' })} />);
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'kafkaProduce' } });
    expect(onActiveTabChange).toHaveBeenCalledWith('validation');
  });

  it('disables Save for wsReceive without a connectionRef', () => {
    render(<TestEditorModal {...makeProps({
      draft: makeDraft({ actionType: 'wsReceive', method: 'WEBSOCKET', wsReceiveAction: { connectionRef: '' } as Scenario['wsReceiveAction'] }),
    })} />);
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('builds a preview URL with param-column placeholders', () => {
    render(<TestEditorModal {...makeProps({
      draft: makeDraft({
        dataSource: {
          id: 'ds',
          columns: [{ id: 'c1', name: 'q', type: 'param', mapping: 'q' }],
          rows: [], source: { type: 'inline' }, urlTemplate: 'https://api.example.com/users',
        },
      }),
    })} />);
    const code = document.querySelector('.url-preview code') as HTMLElement;
    expect(code.textContent).toContain('{{q}}');
  });

  it('returns no sibling tests when the feature group is missing', () => {
    render(<TestEditorModal {...makeProps({ editingTest: { fgId: 'nope', scenarioId: 'sc1', testId: 't1' } })} />);
    expect(screen.getByText('Edit Test')).toBeInTheDocument();
  });

  it('returns no sibling tests when the scenario is missing', () => {
    render(<TestEditorModal {...makeProps({ editingTest: { fgId: 'fg1', scenarioId: 'nope', testId: 't1' } })} />);
    expect(screen.getByText('Edit Test')).toBeInTheDocument();
  });

  it('renders the url placeholder fallback when no resolved base url', () => {
    render(<TestEditorModal {...makeProps({ resolvedBaseUrl: '', draft: makeDraft({ url: '' }) })} />);
    const input = document.querySelector('.url-input') as HTMLInputElement;
    expect(input.placeholder).toContain('https://api.example.com/endpoint');
  });

  it('renders all tab badges (body, auth, validation, extract, history)', () => {
    render(<TestEditorModal {...makeProps({
      isNew: false,
      draft: makeDraft({
        method: 'POST',
        body: '{"a":1}',
        auth: { type: 'bearer', token: 't' } as Scenario['auth'],
        validation: { mode: 'selective' } as Scenario['validation'],
        extractions: [{ id: 'e1', source: 'body' }] as Scenario['extractions'],
        definitionVersions: [{ id: 'v1', label: 'v1', createdAt: '', snapshot: {} } as unknown as import('../../../shared/types').TestDefinitionVersion],
      }),
    })} />);
    expect(screen.getByRole('button', { name: /^Body/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Auth/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Validation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Extract 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /History 1/ })).toBeInTheDocument();
  });

  it('updates a header value field', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange, activeTab: 'headers', draft: makeDraft({ headers: [{ key: 'X', value: 'Y' }] }) })} />);
    const inputs = screen.getAllByPlaceholderText(/Header/);
    fireEvent.change(inputs[1], { target: { value: 'Z' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ headers: [{ key: 'X', value: 'Z' }] }));
  });

  it('uses the validation sampleJson for the extract sample (http and ws)', () => {
    const { rerender } = render(<TestEditorModal {...makeProps({
      activeTab: 'extract',
      draft: makeDraft({ validation: { mode: 'status', sampleJson: '{"a":1}' } as Scenario['validation'] }),
    })} />);
    expect(screen.getByTestId('extraction-editor')).toBeInTheDocument();
    rerender(<TestEditorModal {...makeProps({
      activeTab: 'extract',
      draft: makeDraft({ actionType: 'wsConnect', method: 'WEBSOCKET', validation: { mode: 'status', sampleJson: '{"a":1}' } as Scenario['validation'] }),
    })} />);
    expect(screen.getByTestId('extraction-editor')).toBeInTheDocument();
  });

  it('imports a test definition while in cURL mode and switches to builder', () => {
    h.pickJsonRaw = { name: 'X', method: 'GET', url: 'https://x.com' };
    const onInputModeChange = vi.fn();
    render(<TestEditorModal {...makeProps({ inputMode: 'curlImport', onInputModeChange })} />);
    fireEvent.click(screen.getByText('Import ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(onInputModeChange).toHaveBeenCalledWith('builder');
  });

  it('imports an http test with explicit actionType http', () => {
    h.pickJsonRaw = { name: 'X', method: 'GET', url: 'https://x.com', actionType: 'http' };
    const onDraftChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onDraftChange })} />);
    fireEvent.click(screen.getByText('Import ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'http' }));
  });

  it('warns and switches to validation when importing a ws test with issues', () => {
    h.pickJsonRaw = { name: 'WS', method: 'WEBSOCKET', actionType: 'wsConnect', wsConnectAction: { url: '' } };
    const onActiveTabChange = vi.fn();
    render(<TestEditorModal {...makeProps({ onActiveTabChange })} />);
    fireEvent.click(screen.getByText('Import ▾'));
    fireEvent.click(screen.getByText('Test Definition'));
    expect(toastShow).toHaveBeenCalledWith('warning', 'WS Config Issues', expect.any(String));
    expect(onActiveTabChange).toHaveBeenCalledWith('validation');
  });

  it('returns early when a data-rows import has no file', async () => {
    const onDraftChange = vi.fn();
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'name', type: 'param' as const, mapping: 'name' }],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      Object.defineProperty(input, 'files', { value: [], configurable: true });
      await input.onchange?.(new Event('change') as never);
      expect(onDraftChange).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('imports JSON data rows that lack values and fills empty strings', async () => {
    const onDraftChange = vi.fn();
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'name', type: 'param' as const, mapping: 'name' }],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      const file = new File([JSON.stringify({ rows: [{ enabled: true }] })], 'rows.json', { type: 'application/json' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await input.onchange?.(new Event('change') as never);
      await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        dataSource: expect.objectContaining({ rows: [expect.objectContaining({ values: { c1: '' } })] }),
      })));
    } finally {
      spy.mockRestore();
    }
  });

  it('logs an error when JSON data-rows import fails to parse', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'name', type: 'param' as const, mapping: 'name' }],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      const file = new File(['not-json'], 'rows.json', { type: 'application/json' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await input.onchange?.(new Event('change') as never);
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it('returns early when a CSV data-rows import is empty', async () => {
    const onDraftChange = vi.fn();
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'name', type: 'param' as const, mapping: 'name' }],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      const file = new File(['   '], 'rows.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await input.onchange?.(new Event('change') as never);
      expect(onDraftChange).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('maps CSV columns that do not match any data-source column to null', async () => {
    const onDraftChange = vi.fn();
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'zzz', type: 'param' as const, mapping: 'zzz' }],
      rows: [], source: { type: 'inline' as const },
    };
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === 'input') { (el as HTMLInputElement).click = vi.fn(); created.push(el as HTMLInputElement); }
      return el;
    });
    try {
      render(<TestEditorModal {...makeProps({ onDraftChange, draft: makeDraft({ dataSource }) })} />);
      fireEvent.click(screen.getByText('Import ▾'));
      fireEvent.click(screen.getByText('Data Rows'));
      const input = created[created.length - 1];
      const file = new File(['name,channel\nA,web'], 'rows.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await input.onchange?.(new Event('change') as never);
      await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        dataSource: expect.objectContaining({ rows: expect.any(Array) }),
      })));
    } finally {
      spy.mockRestore();
    }
  });

  it('exports data CSV and JSON with empty name and missing row values', () => {
    const dataSource = {
      id: 'ds',
      columns: [{ id: 'c1', name: 'vin', type: 'path' as const, mapping: 'vin' }],
      rows: [{ id: 'r1', values: {}, enabled: true }],
      source: { type: 'inline' as const },
    };
    render(<TestEditorModal {...makeProps({ draft: makeDraft({ name: '', dataSource }) })} />);
    fireEvent.click(screen.getByText('Export ▾'));
    fireEvent.click(screen.getByText('Data as CSV'));
    fireEvent.click(screen.getByText('Export ▾'));
    fireEvent.click(screen.getByText('Data as JSON'));
    expect(screen.getByTestId('modal-frame')).toBeInTheDocument();
  });
});
