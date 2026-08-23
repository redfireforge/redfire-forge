/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedDsFetchPanel from './SharedDsFetchPanel';

vi.mock('@shared/components/CustomSelect', () => ({
  CustomSelect: ({
    value,
    onChange,
    options,
    className,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
    className?: string;
  }) => (
    <select
      data-testid={className ?? 'custom-select'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

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
    fetchDraftScenario: { id: 'scenario-1' },
    fetchUrlRowRef: { current: null },
    fetchHeadersRef: { current: null },
    fetchAuthRef: { current: null },
    fetchBodyRef: { current: null },
    mappingSummary: {
      counts: { path: 1, param: 2, header: 1, body: 1, validate: 0 },
      warnings: [],
    },
    detectedParams: [{ name: 'channel', source: 'query', value: 'web' }],
    headerCount: 2,
    fetchExpanded: false,
    setFetchExpanded: vi.fn(),
    fetchTab: 'params' as const,
    setFetchTab: vi.fn(),
  };

  const selected = {
    id: 'ds-1',
    name: 'Shared DS',
    fetchConfig: {
      method: 'POST',
      url: 'https://api.example.com/items',
      headers: [
        { key: 'Accept', value: 'application/json' },
        { key: 'X-Trace', value: '1' },
      ],
      auth: { type: 'bearer', prefix: 'Bearer', token: 'tok' },
      body: '{"ok":true}',
      rawCurl: '',
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

describe('SharedDsFetchPanel coverage gaps part 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles cURL import and applies pasted command', () => {
    const props = makeProps({
      fetchConfig: {
        ...makeProps().fetchConfig,
        curlImportExpanded: true,
        curlInput: 'curl https://api.example.com',
      },
    });

    render(<SharedDsFetchPanel {...(props as never)} />);

    fireEvent.click(screen.getByText('cURL Import'));
    expect(props.fetchConfig.setCurlImportExpanded).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/curl -X GET/), {
      target: { value: 'curl -X POST https://x' },
    });
    expect(props.fetchConfig.handleCurlInputChange).toHaveBeenCalledWith('curl -X POST https://x');

    fireEvent.click(screen.getByText('Import & Apply'));
    expect(props.fetchConfig.handleImportCurl).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Cancel'));
    expect(props.fetchConfig.setCurlImportExpanded).toHaveBeenCalledWith(false);
  });

  it('wires action buttons and mapping chips', () => {
    const props = makeProps();
    render(<SharedDsFetchPanel {...(props as never)} />);

    fireEvent.click(screen.getByText('Populate Rows from API'));
    expect(props.onShowPopulateFromApi).toHaveBeenCalled();

    fireEvent.click(screen.getByText('+ Create Test'));
    expect(props.onOpenCreateTestModal).toHaveBeenCalled();

    fireEvent.click(screen.getByText('path:1'));
    expect(props.editorPanel.setFetchExpanded).toHaveBeenCalledWith(true);
    expect(props.editorPanel.setFetchTab).toHaveBeenCalledWith('params');

    fireEvent.click(screen.getByText('header:1'));
    expect(props.editorPanel.setFetchTab).toHaveBeenCalledWith('headers');

    fireEvent.click(screen.getByText('body:1'));
    expect(props.editorPanel.setFetchTab).toHaveBeenCalledWith('body');

    fireEvent.click(screen.getByText('validate:0'));
    expect(props.editorPanel.setFetchExpanded).toHaveBeenCalled();
  });

  it('updates method and URL fields', () => {
    const props = makeProps();
    render(<SharedDsFetchPanel {...(props as never)} />);

    fireEvent.change(screen.getByTestId('shared-ds-fetch-method'), { target: { value: 'PUT' } });
    expect(props.fetchConfig.handleFetchConfigChange).toHaveBeenCalledWith({ method: 'PUT' });

    fireEvent.change(screen.getByPlaceholderText(/api.example.com/), {
      target: { value: 'https://api.example.com/v2' },
    });
    expect(props.fetchConfig.handleFetchConfigChange).toHaveBeenCalledWith({ url: 'https://api.example.com/v2' });
  });

  it('renders params tab content when expanded', () => {
    const props = makeProps({
      editorPanel: {
        ...makeProps().editorPanel,
        fetchExpanded: true,
        fetchTab: 'params',
      },
    });
    render(<SharedDsFetchPanel {...(props as never)} />);

    expect(screen.getByText('channel')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
  });

  it('shows empty params helper when no variables detected', () => {
    const props = makeProps({
      editorPanel: {
        ...makeProps().editorPanel,
        fetchExpanded: true,
        fetchTab: 'params',
        detectedParams: [],
      },
    });
    render(<SharedDsFetchPanel {...(props as never)} />);
    expect(screen.getByText(/No template variables detected/)).toBeInTheDocument();
  });

  it('renders singular mapping warning label', () => {
    const props = makeProps({
      editorPanel: {
        ...makeProps().editorPanel,
        mappingSummary: {
          counts: { path: 0, param: 0, header: 0, body: 0, validate: 0 },
          warnings: [{ type: 'param', mapping: 'x', message: 'Missing x' }],
        },
      },
    });
    render(<SharedDsFetchPanel {...(props as never)} />);
    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });

  it('toggles tabs for params, auth, headers, and body', () => {
    const editorPanel = {
      ...makeProps().editorPanel,
      fetchExpanded: true,
      fetchTab: 'params' as const,
      setFetchExpanded: vi.fn(),
      setFetchTab: vi.fn(),
    };
    const props = makeProps({ editorPanel });
    const { rerender } = render(<SharedDsFetchPanel {...(props as never)} />);

    fireEvent.click(screen.getByRole('button', { name: /Params/i }));
    expect(editorPanel.setFetchExpanded).toHaveBeenCalled();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          editorPanel: { ...editorPanel, fetchTab: 'auth' },
        } as never)}
      />,
    );
    fireEvent.change(screen.getByTestId('shared-ds-fetch-auth-type'), { target: { value: 'basic' } });
    expect(props.fetchConfig.handleFetchAuthTypeChange).toHaveBeenCalledWith('basic');

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          selected: {
            ...props.selected,
            fetchConfig: {
              ...props.selected.fetchConfig,
              auth: { type: 'basic', username: 'u', password: 'p' },
            },
          },
          editorPanel: { ...editorPanel, fetchTab: 'auth' },
        } as never)}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Enter username'), { target: { value: 'alice' } });
    expect(props.fetchConfig.handleFetchAuthPatch).toHaveBeenCalledWith({ username: 'alice' });
    fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'secret' } });
    expect(props.fetchConfig.handleFetchAuthPatch).toHaveBeenCalledWith({ password: 'secret' });

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          selected: {
            ...props.selected,
            fetchConfig: {
              ...props.selected.fetchConfig,
              auth: { type: 'apikey', apiKeyName: 'k', apiKeyValue: 'v', apiKeyIn: 'header' },
            },
          },
          editorPanel: { ...editorPanel, fetchTab: 'auth' },
        } as never)}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('X-API-Key'), { target: { value: 'Api-Key' } });
    fireEvent.change(screen.getByPlaceholderText('your-api-key'), { target: { value: 'key-1' } });
    fireEvent.change(screen.getAllByTestId('shared-ds-fetch-auth-type')[1], { target: { value: 'query' } });
    expect(props.fetchConfig.handleFetchAuthPatch).toHaveBeenCalled();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          selected: {
            ...props.selected,
            fetchConfig: {
              ...props.selected.fetchConfig,
              auth: {
                type: 'oauth2',
                tokenUrl: 'https://auth/token',
                clientId: 'id',
                clientSecret: 'sec',
              },
            },
          },
          editorPanel: { ...editorPanel, fetchTab: 'auth' },
        } as never)}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('https://auth.example.com/oauth/token'), {
      target: { value: 'https://oauth/token' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter client ID'), { target: { value: 'client' } });
    fireEvent.change(screen.getByPlaceholderText('Enter client secret'), { target: { value: 'shh' } });
    expect(props.fetchConfig.handleFetchAuthPatch).toHaveBeenCalled();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          selected: {
            ...props.selected,
            fetchConfig: {
              ...props.selected.fetchConfig,
              auth: { type: 'bearer', prefix: 'Token', token: '' },
            },
          },
          editorPanel: { ...editorPanel, fetchTab: 'auth' },
        } as never)}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'Bearer' } });
    fireEvent.change(screen.getByPlaceholderText('eyJhbGciOi...'), { target: { value: 'jwt' } });
    expect(props.fetchConfig.handleFetchAuthPatch).toHaveBeenCalled();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          editorPanel: { ...editorPanel, fetchTab: 'headers' },
        } as never)}
      />,
    );
    const headerKeys = screen.getAllByPlaceholderText('Header');
    fireEvent.change(headerKeys[0], { target: { value: 'X-Test' } });
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0], { target: { value: '1' } });
    expect(props.fetchConfig.handleFetchHeaderChange).toHaveBeenCalled();
    fireEvent.click(screen.getAllByTitle('Remove header')[0]);
    expect(props.fetchConfig.handleRemoveFetchHeader).toHaveBeenCalled();
    fireEvent.click(screen.getByText('+ Header'));
    expect(props.fetchConfig.handleAddFetchHeader).toHaveBeenCalled();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          editorPanel: { ...editorPanel, fetchTab: 'body' },
        } as never)}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Optional request body'), {
      target: { value: '{"updated":true}' },
    });
    expect(props.fetchConfig.handleFetchConfigChange).toHaveBeenCalledWith({ body: '{"updated":true}' });
  });

  it('collapses an active tab when clicked again', () => {
    const editorPanel = {
      ...makeProps().editorPanel,
      fetchExpanded: true,
      fetchTab: 'params' as const,
      setFetchExpanded: vi.fn(),
      setFetchTab: vi.fn(),
    };
    const props = makeProps({ editorPanel });
    const { container } = render(<SharedDsFetchPanel {...(props as never)} />);

    const tabs = container.querySelector('.builder-tabs')!;
    fireEvent.click(within(tabs).getByRole('button', { name: /^Params/i }));
    expect(editorPanel.setFetchExpanded).toHaveBeenCalledWith(false);

    const authTab = within(tabs).getByRole('button', { name: /^Auth/i });
    expect(authTab.querySelector('.tab-badge-dot')).toBeTruthy();
    fireEvent.click(authTab);
    expect(editorPanel.setFetchExpanded).toHaveBeenCalledWith(true);
    expect(editorPanel.setFetchTab).toHaveBeenCalledWith('auth');

    const headersTab = within(tabs).getByRole('button', { name: /^Headers/i });
    expect(headersTab.textContent).toContain('2');
    fireEvent.click(headersTab);
    expect(editorPanel.setFetchTab).toHaveBeenCalledWith('headers');

    const bodyTab = within(tabs).getByRole('button', { name: /^Body/i });
    expect(bodyTab.querySelector('.tab-badge-dot')).toBeTruthy();
    fireEvent.click(bodyTab);
    expect(editorPanel.setFetchTab).toHaveBeenCalledWith('body');
  });

  it('collapses auth, headers, and body tabs when already active', () => {
    const editorPanel = {
      ...makeProps().editorPanel,
      fetchExpanded: true,
      fetchTab: 'auth' as const,
      setFetchExpanded: vi.fn(),
      setFetchTab: vi.fn(),
    };
    const props = makeProps({ editorPanel });
    const { container, rerender } = render(<SharedDsFetchPanel {...(props as never)} />);
    const tabs = () => container.querySelector('.builder-tabs')!;

    fireEvent.click(within(tabs()).getByRole('button', { name: /^Auth/i }));
    expect(editorPanel.setFetchExpanded).toHaveBeenCalledWith(false);

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          editorPanel: { ...editorPanel, fetchTab: 'headers' },
        } as never)}
      />,
    );
    fireEvent.click(within(tabs()).getByRole('button', { name: /^Headers/i }));
    expect(editorPanel.setFetchExpanded).toHaveBeenCalledWith(false);

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          editorPanel: { ...editorPanel, fetchTab: 'body' },
        } as never)}
      />,
    );
    fireEvent.click(within(tabs()).getByRole('button', { name: /^Body/i }));
    expect(editorPanel.setFetchExpanded).toHaveBeenCalledWith(false);
  });

  it('routes param chip clicks to the params tab', () => {
    const props = makeProps();
    render(<SharedDsFetchPanel {...(props as never)} />);
    fireEvent.click(screen.getByText('param:2'));
    expect(props.editorPanel.setFetchExpanded).toHaveBeenCalledWith(true);
    expect(props.editorPanel.setFetchTab).toHaveBeenCalledWith('params');
  });

  it('hides body tab for GET requests', () => {
    const props = makeProps({
      selected: {
        ...makeProps().selected,
        fetchConfig: {
          ...makeProps().selected.fetchConfig,
          method: 'GET',
          body: '',
        },
      },
    });
    const { container } = render(<SharedDsFetchPanel {...(props as never)} />);
    const tabs = container.querySelector('.builder-tabs')!;
    expect(within(tabs).queryByRole('button', { name: /^Body/i })).toBeNull();
  });

  it('covers curl import toggle and disabled import when input is blank', () => {
    const props = makeProps({
      fetchConfig: {
        ...makeProps().fetchConfig,
        curlImportExpanded: true,
        curlInput: '   ',
      },
    });
    render(<SharedDsFetchPanel {...(props as never)} />);
    expect(screen.getByText('Import & Apply')).toBeDisabled();

    fireEvent.click(screen.getByText('cURL Import'));
    expect(props.fetchConfig.setCurlImportExpanded).toHaveBeenCalled();
  });

  it('renders inherit auth type without extra credential fields', () => {
    const props = makeProps({
      selected: {
        ...makeProps().selected,
        fetchConfig: {
          ...makeProps().selected.fetchConfig,
          auth: { type: 'inherit' },
        },
      },
      editorPanel: {
        ...makeProps().editorPanel,
        fetchExpanded: true,
        fetchTab: 'auth',
      },
    });
    render(<SharedDsFetchPanel {...(props as never)} />);
    expect(screen.queryByPlaceholderText('Enter username')).toBeNull();
    expect(screen.getByTestId('shared-ds-fetch-auth-type')).toHaveValue('inherit');
  });

  it('does not copy when stored curl is empty', async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const props = makeProps({
      selected: {
        ...makeProps().selected,
        fetchConfig: {
          ...makeProps().selected.fetchConfig,
          rawCurl: '   ',
        },
      },
    });
    render(<SharedDsFetchPanel {...(props as never)} />);
    expect(screen.queryByTestId('shared-ds-view-curl')).toBeNull();
  });

  it('toggles curl view closed when raw curl is cleared', () => {
    const props = makeProps({
      selected: {
        ...makeProps().selected,
        fetchConfig: {
          ...makeProps().selected.fetchConfig,
          rawCurl: 'curl https://a',
        },
      },
    });
    const { rerender } = render(<SharedDsFetchPanel {...(props as never)} />);
    fireEvent.click(screen.getByTestId('shared-ds-view-curl'));
    expect(screen.getByTestId('shared-ds-curl-view')).toBeInTheDocument();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          selected: {
            ...props.selected,
            fetchConfig: { ...props.selected.fetchConfig, rawCurl: '' },
          },
        } as never)}
      />,
    );
    expect(screen.queryByTestId('shared-ds-curl-view')).toBeNull();
  });

  it('uses fallbacks for sparse fetch config and param rows without values', () => {
    const props = makeProps({
      selected: {
        id: 'ds-sparse',
        name: 'Sparse',
        fetchConfig: {
          method: 'POST',
          url: '',
          auth: { type: 'none' },
        },
      },
      editorPanel: {
        ...makeProps().editorPanel,
        fetchExpanded: true,
        fetchTab: 'params',
        detectedParams: [{ name: 'id', source: 'path' }],
        headerCount: 0,
      },
    });
    const { container } = render(<SharedDsFetchPanel {...(props as never)} />);

    expect(screen.getByText('{{id}}')).toBeInTheDocument();
    expect(within(container.querySelector('.builder-tabs')!).queryByRole('button', { name: /^Auth/i })?.textContent).not.toContain('•');

    const headersProps = {
      ...props,
      editorPanel: { ...props.editorPanel, fetchTab: 'headers' },
      selected: {
        ...props.selected,
        fetchConfig: {
          ...props.selected.fetchConfig,
          headers: undefined,
        },
      },
    };
    const { rerender } = render(<SharedDsFetchPanel {...(headersProps as never)} />);
    rerender(<SharedDsFetchPanel {...(headersProps as never)} />);
    expect(screen.getAllByPlaceholderText('Header').length).toBeGreaterThan(0);

    const bodyProps = {
      ...props,
      editorPanel: { ...props.editorPanel, fetchTab: 'body' },
      selected: {
        ...props.selected,
        fetchConfig: {
          ...props.selected.fetchConfig,
          body: undefined,
        },
      },
    };
    rerender(<SharedDsFetchPanel {...(bodyProps as never)} />);
    fireEvent.change(screen.getByPlaceholderText('Optional request body'), { target: { value: 'x' } });
    expect(props.fetchConfig.handleFetchConfigChange).toHaveBeenCalledWith({ body: 'x' });
  });

  it('covers auth field fallbacks for each auth type', () => {
    const baseEditor = {
      ...makeProps().editorPanel,
      fetchExpanded: true,
      fetchTab: 'auth' as const,
    };

    const cases = [
      { type: 'bearer', auth: { type: 'bearer' } },
      { type: 'basic', auth: { type: 'basic' } },
      { type: 'apikey', auth: { type: 'apikey' } },
      { type: 'oauth2', auth: { type: 'oauth2' } },
    ] as const;

    for (const { auth } of cases) {
      const props = makeProps({
        editorPanel: baseEditor,
        selected: {
          ...makeProps().selected,
          fetchConfig: {
            ...makeProps().selected.fetchConfig,
            auth,
          },
        },
      });
      const { unmount } = render(<SharedDsFetchPanel {...(props as never)} />);
      expect(screen.getAllByTestId('shared-ds-fetch-auth-type')[0]).toBeInTheDocument();
      unmount();
    }
  });

  it('shows body tab without badge when POST body is blank', () => {
    const props = makeProps({
      selected: {
        ...makeProps().selected,
        fetchConfig: {
          ...makeProps().selected.fetchConfig,
          method: 'POST',
          body: '   ',
        },
      },
    });
    const { container } = render(<SharedDsFetchPanel {...(props as never)} />);
    const bodyTab = within(container.querySelector('.builder-tabs')!).getByRole('button', { name: /^Body/i });
    expect(bodyTab.querySelector('.tab-badge-dot')).toBeNull();
  });

  it('omits create-test button when callback is not provided', () => {
    const props = makeProps({ onOpenCreateTestModal: undefined });
    render(<SharedDsFetchPanel {...(props as never)} />);
    expect(screen.queryByText('+ Create Test')).toBeNull();
  });

  it('resets curl view state when selected id changes', () => {
    const props = makeProps({
      selected: {
        ...makeProps().selected,
        fetchConfig: {
          ...makeProps().selected.fetchConfig,
          rawCurl: 'curl https://a',
        },
      },
    });
    const { rerender } = render(<SharedDsFetchPanel {...(props as never)} />);
    fireEvent.click(screen.getByTestId('shared-ds-view-curl'));
    expect(screen.getByTestId('shared-ds-curl-view')).toBeInTheDocument();

    rerender(
      <SharedDsFetchPanel
        {...({
          ...props,
          selected: { ...props.selected, id: 'ds-2' },
        } as never)}
      />,
    );
    expect(screen.queryByTestId('shared-ds-curl-view')).toBeNull();
  });
});
