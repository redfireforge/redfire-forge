/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import GraphqlQueryConfigPanel from './GraphqlQueryConfigPanel';
import type { GraphqlQueryNodeData } from '../../workflow/types/workflow';

vi.mock('./GraphqlImportFromCollectionModal', () => ({
  default: vi.fn(({ onImport, onCancel }: {
    onImport: (patch: Partial<GraphqlQueryNodeData>) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="gql-wf-import-col-modal">
      <button type="button" onClick={() => onImport({ query: 'query { imported }', variables: '{"x":1}' })}>
        mock-import
      </button>
      <button type="button" onClick={onCancel}>mock-cancel</button>
    </div>
  )),
}));

function makeValidData(overrides: Partial<GraphqlQueryNodeData> = {}): GraphqlQueryNodeData {
  return {
    label: 'GraphQL Query',
    endpoint: 'http://api.example.com/graphql',
    query: 'query { user { id } }',
    variables: '{}',
    headers: [],
    timeoutMs: 30000,
    extractionRules: [],
    outputBindings: [],
    ...overrides,
  };
}

function tabButton(label: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${label}`) });
}

function tabHasErrorDot(tab: HTMLElement): boolean {
  return within(tab).queryByTestId('gql-wf-tab-error-dot') != null;
}

describe('GraphqlQueryConfigPanel tab validation (4C-8)', () => {
  it('shows no error dots for valid config', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={vi.fn()} />);
    expect(tabHasErrorDot(tabButton('Operation'))).toBe(false);
    expect(tabHasErrorDot(tabButton('Variables'))).toBe(false);
    expect(tabHasErrorDot(tabButton('Extraction'))).toBe(false);
    expect(tabHasErrorDot(tabButton('Output'))).toBe(false);
  });

  it('shows error dot on Operation tab when endpoint is empty', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ endpoint: '' })} onChange={vi.fn()} />);
    expect(tabHasErrorDot(tabButton('Operation'))).toBe(true);
  });

  it('shows error dot on Operation tab when query is empty', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ query: '  ' })} onChange={vi.fn()} />);
    expect(tabHasErrorDot(tabButton('Operation'))).toBe(true);
  });

  it('shows error dot on Variables tab for invalid JSON', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ variables: '{broken' })} onChange={vi.fn()} />);
    expect(tabHasErrorDot(tabButton('Variables'))).toBe(true);
  });

  it('shows error dot on Extraction tab for invalid variable name', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [{ variableName: 'bad-name', jsonPath: '$.id' }],
        })}
        onChange={vi.fn()}
      />,
    );
    expect(tabHasErrorDot(tabButton('Extraction'))).toBe(true);
  });

  it('shows error dot on Output tab for invalid binding variable name', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [{ field: 'data', variableName: '1bad', enabled: true }],
        })}
        onChange={vi.fn()}
      />,
    );
    expect(tabHasErrorDot(tabButton('Output'))).toBe(true);
  });
});

describe('GraphqlQueryConfigPanel import from collections', () => {
  it('opens import picker when Import button is clicked', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('gql-wf-import-col-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-wf-import-collections-btn'));
    expect(screen.getByTestId('gql-wf-import-col-modal')).toBeInTheDocument();
  });

  it('applies imported operation via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('gql-wf-import-collections-btn'));
    fireEvent.click(screen.getByText('mock-import'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      query: 'query { imported }',
      variables: '{"x":1}',
    }));
    expect(screen.queryByTestId('gql-wf-import-col-modal')).not.toBeInTheDocument();
  });
});

describe('GraphqlQueryConfigPanel extraction Test button', () => {
  it('shows no-data message without a prior run', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [{ variableName: 'userId', jsonPath: '$.user.id' }],
        })}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(tabButton('Extraction'));
    fireEvent.click(screen.getByTestId('gql-wf-extraction-test-btn'));
    expect(screen.getByTestId('gql-wf-extraction-test-msg')).toHaveTextContent(/run the workflow first/i);
  });

  it('tests extraction rules against last run responseDetail', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [{ variableName: 'userId', jsonPath: '$.user.id' }],
        })}
        onChange={vi.fn()}
        nodeRunStatus={{
          state: 'pass',
          responseDetail: JSON.stringify({ data: { user: { id: '99' } } }),
        }}
      />,
    );
    fireEvent.click(tabButton('Extraction'));
    fireEvent.click(screen.getByTestId('gql-wf-extraction-test-btn'));
    expect(screen.getByTestId('gql-wf-extraction-test-summary')).toHaveTextContent(/matched/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE TAB TESTING
// ───────────────────────────────────────────────────────────────────────────────

describe('GraphqlQueryConfigPanel — Operation tab', () => {
  it('renders Operation tab content with endpoint and query fields', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('gql-wf-query-panel')).toBeInTheDocument();
    expect(screen.getByTestId('gql-wf-query-editor')).toHaveValue('query { user { id } }');
    const operationTab = tabButton('Operation');
    fireEvent.click(operationTab);
    expect(screen.getByPlaceholderText(/https:\/\/api/)).toHaveValue('http://api.example.com/graphql');
  });

  it('shows endpoint required error when empty', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ endpoint: '' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Endpoint is required/)).toBeInTheDocument();
  });

  it('shows query required error when empty', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ query: '' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Query is required/)).toBeInTheDocument();
  });

  it('shows mutation label for mutation node type', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ query: 'mutation { update }' })} onChange={vi.fn()} nodeType="graphqlMutation" />);
    fireEvent.click(tabButton('Operation'));
    expect(screen.getByText('Mutation')).toBeInTheDocument();
    expect(screen.getByTestId('gql-wf-query-editor')).toHaveAttribute('placeholder', expect.stringContaining('mutation'));
  });

  it('updates endpoint via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={onChange} />);
    const endpointInput = screen.getByPlaceholderText(/https:\/\/api/);
    fireEvent.change(endpointInput, { target: { value: 'http://new-endpoint.com/graphql' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'http://new-endpoint.com/graphql',
    }));
  });

  it('updates query via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={onChange} />);
    const queryEditor = screen.getByTestId('gql-wf-query-editor');
    fireEvent.change(queryEditor, { target: { value: 'query { newField }' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      query: 'query { newField }',
    }));
  });

  it('updates timeout (ms) via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ timeoutMs: 30000 })} onChange={onChange} />);
    fireEvent.click(tabButton('Operation'));
    const timeoutInput = screen.getByTestId('gql-wf-timeout-input');
    fireEvent.change(timeoutInput, { target: { value: '60000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 60000,
    }));
  });

  it('toggles skip TLS verify checkbox', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ skipTlsVerify: false })} onChange={onChange} />);
    fireEvent.click(tabButton('Operation'));
    const tlsCheckbox = screen.getByTestId('gql-wf-skip-tls-checkbox');
    fireEvent.click(tlsCheckbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      skipTlsVerify: true,
    }));
  });

  it('shows Import button in Operation tab', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Operation'));
    expect(screen.getByTestId('gql-wf-import-collections-btn')).toBeInTheDocument();
  });
});

describe('GraphqlQueryConfigPanel — Variables tab', () => {
  it('renders Variables tab with JSON editor', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ variables: '{"userId": 123}' })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Variables'));
    const varEditor = screen.getByTestId('gql-wf-variables-editor');
    expect(varEditor).toHaveValue('{"userId": 123}');
  });

  it('shows validation error for invalid JSON variables', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ variables: '{broken json' })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Variables'));
    expect(screen.getByText(/Variables must be valid JSON/)).toBeInTheDocument();
  });

  it('updates variables via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ variables: '{}' })} onChange={onChange} />);
    fireEvent.click(tabButton('Variables'));
    const varEditor = screen.getByTestId('gql-wf-variables-editor');
    fireEvent.change(varEditor, { target: { value: '{"newVar": "value"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      variables: '{"newVar": "value"}',
    }));
  });

  it('renders Variables tab by default as undefined/empty', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ variables: undefined })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Variables'));
    // Should show default placeholder value
    expect(screen.getByTestId('gql-wf-variables-editor')).toBeTruthy();
  });
});

describe('GraphqlQueryConfigPanel — Headers tab', () => {
  it('renders empty headers section with Add button', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ headers: [] })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Headers'));
    expect(screen.getByTestId('gql-wf-headers-add-btn')).toBeInTheDocument();
    expect(screen.getByText(/No headers yet/)).toBeInTheDocument();
  });

  it('shows header count badge when headers exist', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          headers: [
            { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
            { id: '2', key: 'Authorization', value: 'Bearer token', enabled: true },
          ],
        })}
        onChange={vi.fn()}
      />,
    );
    const headerTab = tabButton('Headers');
    expect(within(headerTab).getByText('2')).toBeInTheDocument();
  });

  it('adds new header via Add button', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ headers: [] })} onChange={onChange} />);
    fireEvent.click(tabButton('Headers'));
    fireEvent.click(screen.getByTestId('gql-wf-headers-add-btn'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      headers: [expect.objectContaining({ key: '', value: '', enabled: true })],
    }));
  });

  it('updates header key via input', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          headers: [{ id: '1', key: '', value: '', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Headers'));
    const keyInput = screen.getByTestId('gql-wf-header-key');
    fireEvent.change(keyInput, { target: { value: 'X-Custom-Header' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      headers: [expect.objectContaining({ key: 'X-Custom-Header' })],
    }));
  });

  it('toggles header enabled state via checkbox', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          headers: [{ id: '1', key: 'Authorization', value: 'Bearer token', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Headers'));
    const enableCheckbox = screen.getByRole('checkbox', { name: /Enable header/i });
    fireEvent.click(enableCheckbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      headers: [expect.objectContaining({ enabled: false })],
    }));
  });

  it('removes header via delete button', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          headers: [{ id: '1', key: 'Authorization', value: 'Bearer token', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Headers'));
    const deleteBtn = screen.getByRole('button', { name: /Remove header/i });
    fireEvent.click(deleteBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      headers: [],
    }));
  });
});

describe('GraphqlQueryConfigPanel — Auth tab', () => {
  it('renders Auth tab with type selector defaulting to None', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: undefined })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Auth'));
    const authTypeSelect = screen.getByTestId('gql-wf-auth-type-select');
    expect(authTypeSelect).toHaveValue('none');
  });

  it('shows Bearer Token fields when Bearer is selected', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'bearer', token: '' } })} onChange={onChange} />);
    fireEvent.click(tabButton('Auth'));
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('{{authToken}}')).toBeInTheDocument();
  });

  it('shows Basic Auth fields (username + password)', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'basic', username: 'user', password: 'pass' } })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Auth'));
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByTestId('gql-wf-auth-password')).toHaveValue('pass');
  });

  it('shows API Key fields (header name + value)', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'apiKey', headerName: 'X-API-Key', headerValue: 'secret123' } })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Auth'));
    expect(screen.getByText('Header name')).toBeInTheDocument();
    expect(screen.getByTestId('gql-wf-auth-header-name')).toHaveValue('X-API-Key');
    expect(screen.getByPlaceholderText('{{apiKey}}')).toHaveValue('secret123');
  });

  it('shows Custom Header fields', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'custom', headerName: 'X-Custom', headerValue: 'customVal' } })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Auth'));
    expect(screen.getByTestId('gql-wf-auth-header-name')).toHaveValue('X-Custom');
    expect(screen.getByPlaceholderText('{{apiKey}}')).toHaveValue('customVal');
  });

  it('clears auth fields when Auth type is set to None', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'bearer', token: 'token123' } })} onChange={onChange} />);
    fireEvent.click(tabButton('Auth'));
    const typeSelect = screen.getByTestId('gql-wf-auth-type-select');
    fireEvent.change(typeSelect, { target: { value: 'none' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      auth: undefined,
    }));
  });

  it('updates bearer token via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'bearer', token: '' } })} onChange={onChange} />);
    fireEvent.click(tabButton('Auth'));
    const tokenInput = screen.getByPlaceholderText('{{authToken}}');
    fireEvent.change(tokenInput, { target: { value: 'newToken123' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      auth: expect.objectContaining({ token: 'newToken123' }),
    }));
  });

  it('updates basic auth username and password', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ auth: { type: 'basic', username: '', password: '' } })} onChange={onChange} />);
    fireEvent.click(tabButton('Auth'));
    const usernameInput = screen.getByPlaceholderText('user');
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      auth: expect.objectContaining({ username: 'newuser' }),
    }));
  });
});

describe('GraphqlQueryConfigPanel — Extraction tab', () => {
  it('renders empty extraction rules with Add button', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ extractionRules: [] })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Extraction'));
    expect(screen.getByTestId('gql-wf-extraction-add-btn')).toBeInTheDocument();
    expect(screen.getByText(/No extraction rules yet/)).toBeInTheDocument();
  });

  it('shows extraction rule count badge', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [
            { variableName: 'userId', jsonPath: '$.user.id' },
            { variableName: 'userName', jsonPath: '$.user.name' },
          ],
        })}
        onChange={vi.fn()}
      />,
    );
    const extractionTab = tabButton('Extraction');
    expect(within(extractionTab).getByText('2')).toBeInTheDocument();
  });

  it('adds extraction rule via Add button', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ extractionRules: [] })} onChange={onChange} />);
    fireEvent.click(tabButton('Extraction'));
    fireEvent.click(screen.getByTestId('gql-wf-extraction-add-btn'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      extractionRules: [expect.objectContaining({ variableName: '', jsonPath: '' })],
    }));
  });

  it('updates extraction rule jsonPath', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [{ variableName: '', jsonPath: '' }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Extraction'));
    const jsonPathInput = screen.getByTestId('gql-wf-extraction-jsonpath');
    fireEvent.change(jsonPathInput, { target: { value: '$.user.id' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      extractionRules: [expect.objectContaining({ jsonPath: '$.user.id' })],
    }));
  });

  it('shows error for invalid variable name identifier', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [{ variableName: 'bad-name', jsonPath: '$.id' }],
        })}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(tabButton('Extraction'));
    expect(screen.getByText(/Must be a valid identifier/)).toBeInTheDocument();
  });

  it('removes extraction rule via delete button', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          extractionRules: [{ variableName: 'userId', jsonPath: '$.user.id' }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Extraction'));
    const deleteBtn = screen.getByRole('button', { name: /Remove extraction rule/i });
    fireEvent.click(deleteBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      extractionRules: [],
    }));
  });

  it('shows Test button in Extraction tab', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Extraction'));
    expect(screen.getByTestId('gql-wf-extraction-test-btn')).toBeInTheDocument();
  });
});

describe('GraphqlQueryConfigPanel — Output tab', () => {
  it('renders empty output bindings with Add button', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData({ outputBindings: [] })} onChange={vi.fn()} />);
    fireEvent.click(tabButton('Output'));
    expect(screen.getByTestId('gql-wf-output-add-btn')).toBeInTheDocument();
    expect(screen.getByText(/No output bindings yet/)).toBeInTheDocument();
  });

  it('shows output binding count badge for enabled bindings', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [
            { field: 'data', variableName: 'responseData', enabled: true },
            { field: 'errors', variableName: 'errors', enabled: false },
          ],
        })}
        onChange={vi.fn()}
      />,
    );
    const outputTab = tabButton('Output');
    expect(within(outputTab).getByText('1')).toBeInTheDocument();
  });

  it('adds output binding via Add button', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ outputBindings: [] })} onChange={onChange} />);
    fireEvent.click(tabButton('Output'));
    fireEvent.click(screen.getByTestId('gql-wf-output-add-btn'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ field: 'data', variableName: '', enabled: true })],
    }));
  });

  it('updates output field via dropdown', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [{ field: 'data', variableName: '', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Output'));
    const fieldSelect = screen.getByTestId('gql-wf-output-field-select');
    fireEvent.change(fieldSelect, { target: { value: 'errors' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ field: 'errors' })],
    }));
  });

  it('updates output variable name', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [{ field: 'data', variableName: '', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Output'));
    const varnameInput = screen.getByTestId('gql-wf-output-varname');
    fireEvent.change(varnameInput, { target: { value: 'responseData' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ variableName: 'responseData' })],
    }));
  });

  it('toggles output binding enabled state', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [{ field: 'data', variableName: 'respData', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Output'));
    const enableCheckbox = screen.getByRole('checkbox', { name: /Enable binding/i });
    fireEvent.click(enableCheckbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ enabled: false })],
    }));
  });

  it('shows error for invalid variable name in output binding', () => {
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [{ field: 'data', variableName: '1invalid', enabled: true }],
        })}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(tabButton('Output'));
    expect(screen.getByText(/Must be a valid identifier/)).toBeInTheDocument();
  });

  it('removes output binding via delete button', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          outputBindings: [{ field: 'data', variableName: 'respData', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Output'));
    const deleteBtn = screen.getByRole('button', { name: /Remove binding/i });
    fireEvent.click(deleteBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [],
    }));
  });
});

describe('GraphqlQueryConfigPanel — label field', () => {
  it('renders label field and updates via onChange', () => {
    const onChange = vi.fn();
    render(<GraphqlQueryConfigPanel data={makeValidData({ label: 'My Query' })} onChange={onChange} />);
    const labelInput = screen.getByDisplayValue('My Query');
    fireEvent.change(labelInput, { target: { value: 'Updated Label' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Updated Label',
    }));
  });
});
