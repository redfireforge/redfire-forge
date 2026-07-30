/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedDsFetchPanel from './SharedDsFetchPanel';

type AnyObj = Record<string, unknown>;

function makeProps(overrides: Partial<AnyObj> = {}) {
  const fetchConfig = {
    setCurlImportExpanded: vi.fn(),
    setWizardScenario: vi.fn(),
    setShowSetupWizard: vi.fn(),
    curlImportExpanded: false,
    curlInput: '',
    handleCurlInputChange: vi.fn(),
    handleImportCurl: vi.fn(),
    handleFetchConfigChange: vi.fn(),
    handleFetchAuthTypeChange: vi.fn(),
    handleFetchAuthPatch: vi.fn(),
    handleFetchHeaderChange: vi.fn(),
    handleRemoveFetchHeader: vi.fn(),
    handleAddFetchHeader: vi.fn(),
  };

  const editorPanel = {
    fetchDraftScenario: null,
    fetchUrlRowRef: { current: null },
    fetchHeadersRef: { current: null },
    fetchAuthRef: { current: null },
    fetchBodyRef: { current: null },
    mappingSummary: {
      counts: { path: 1, param: 1, header: 1, body: 0, validate: 0 },
      warnings: [],
    },
    detectedParams: [],
    headerCount: 0,
    fetchExpanded: true,
    setFetchExpanded: vi.fn(),
    fetchTab: 'params',
    setFetchTab: vi.fn(),
  };

  const selected = {
    id: 'ds-1',
    name: 'Shared DS',
    fetchConfig: {
      method: 'GET',
      url: 'https://api.example.com/items',
      headers: [{ key: 'Accept', value: 'application/json' }],
      auth: { type: 'none' },
      body: '',
      rawCurl: 'curl -X GET https://api.example.com/items',
    },
  };

  return {
    selected,
    fetchConfig,
    editorPanel,
    onShowPopulateFromApi: vi.fn(),
    onOpenCreateTestModal: vi.fn(),
    ...overrides,
  };
}

describe('SharedDsFetchPanel coverage gaps', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('toggles cURL view and copies stored command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SharedDsFetchPanel {...(makeProps() as never)} />);

    fireEvent.click(screen.getByTestId('shared-ds-view-curl'));
    expect(screen.getByTestId('shared-ds-curl-view')).toBeInTheDocument();
    expect(screen.getByText('Stored cURL command')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('curl -X GET https://api.example.com/items'));
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('shared-ds-curl-view')).toBeNull();
  });

  it('handles clipboard copy failures without crashing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SharedDsFetchPanel {...(makeProps() as never)} />);

    fireEvent.click(screen.getByTestId('shared-ds-view-curl'));
    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('opens setup wizard only when a draft scenario exists', () => {
    const noScenario = makeProps();
    const { rerender } = render(<SharedDsFetchPanel {...(noScenario as never)} />);

    const configureBtn = screen.getByText('Configure Variables + Auth…');
    expect(configureBtn).toBeDisabled();

    const withScenario = makeProps({
      editorPanel: {
        ...noScenario.editorPanel,
        fetchDraftScenario: { id: 'scenario-1' },
      },
    });
    rerender(<SharedDsFetchPanel {...(withScenario as never)} />);

    fireEvent.click(screen.getByText('Configure Variables + Auth…'));
    expect(withScenario.fetchConfig.setWizardScenario).toHaveBeenCalledWith({ id: 'scenario-1' });
    expect(withScenario.fetchConfig.setShowSetupWizard).toHaveBeenCalledWith(true);
  });

  it('renders mapping warnings and routes warning click to params tab', () => {
    const props = makeProps({
      editorPanel: {
        ...makeProps().editorPanel,
        mappingSummary: {
          counts: { path: 0, param: 0, header: 0, body: 0, validate: 0 },
          warnings: [
            { type: 'param', mapping: 'channel', message: 'Missing param channel' },
            { type: 'header', mapping: 'Authorization', message: 'Missing header Authorization' },
          ],
        },
      },
    });

    render(<SharedDsFetchPanel {...(props as never)} />);

    fireEvent.click(screen.getByText('2 issues'));
    expect(props.editorPanel.setFetchExpanded).toHaveBeenCalledWith(true);
    expect(props.editorPanel.setFetchTab).toHaveBeenCalledWith('params');

    expect(screen.getByText('Mapping issues')).toBeInTheDocument();
    expect(screen.getByText('Missing param channel')).toBeInTheDocument();
    expect(screen.getByText('Missing header Authorization')).toBeInTheDocument();
  });

  it('shows body tab for non-GET methods and uses fallback param value rendering', () => {
    const props = makeProps({
      selected: {
        id: 'ds-2',
        fetchConfig: {
          method: 'POST',
          url: 'https://api.example.com/items/{{itemId}}',
          headers: [{ key: '', value: '' }],
          auth: { type: 'none' },
          body: '{"a":1}',
          rawCurl: '',
        },
      },
      editorPanel: {
        ...makeProps().editorPanel,
        detectedParams: [{ name: 'itemId', source: 'path' }],
      },
    });

    render(<SharedDsFetchPanel {...(props as never)} />);

    expect(screen.getAllByRole('button', { name: /^Body/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('{{itemId}}')).toBeInTheDocument();
  });
});
