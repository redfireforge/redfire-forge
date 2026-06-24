/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import GraphqlQueryConfigPanel, { GqlAuthSection, GqlExtractionSection } from './GraphqlQueryConfigPanel';
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

  it('closes import picker when cancel is clicked (covers onCancel handler)', () => {
    render(<GraphqlQueryConfigPanel data={makeValidData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('gql-wf-import-collections-btn'));
    expect(screen.getByTestId('gql-wf-import-col-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-cancel'));
    expect(screen.queryByTestId('gql-wf-import-col-modal')).not.toBeInTheDocument();
  });

  it('triggers endpoint onInsert via Insert button (L536[1] — endpoint ?? "" + snippet)', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{myVar}}'); // immediately invoke to trigger onInsert
    };
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({ endpoint: 'https://base.example.com' })}
        onChange={onChange}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    // InsertVarField renders "Insert…" button when onRequestVariableInsert is provided
    const insertBtn = screen.getByTitle('Insert variable from workflow or upstream step');
    fireEvent.click(insertBtn);
    // endpoint was 'https://base.example.com' + '{{myVar}}'
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://base.example.com{{myVar}}' }),
    );
  });

  it('triggers endpoint onInsert when endpoint is undefined (L536[1] — endpoint ?? "" is "")', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{ep}}');
    };
    render(
      <GraphqlQueryConfigPanel
        data={{
          ...makeValidData(),
          endpoint: undefined,
        } as unknown as import('../../workflow/types/workflow').GraphqlQueryNodeData}
        onChange={onChange}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    const insertBtn = screen.getByTitle('Insert variable from workflow or upstream step');
    fireEvent.click(insertBtn);
    // endpoint=undefined → endpoint ?? '' = '' → '' + '{{ep}}' = '{{ep}}'
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '{{ep}}' }),
    );
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

  it('updates header value via ExpressionInput onChange (covers L103 anonymous fn)', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({
          headers: [{ id: 'h1', key: 'X-Token', value: 'initial', enabled: true }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Headers'));
    // ExpressionInput for header value renders <input placeholder="value">
    const valueInput = screen.getByPlaceholderText('value');
    fireEvent.change(valueInput, { target: { value: 'updated-value' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: [expect.objectContaining({ value: 'updated-value' })],
      }),
    );
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

  it('updates apiKey headerValue via ExpressionInput onChange (covers L223 anonymous fn)', () => {
    const onChange = vi.fn();
    render(
      <GraphqlQueryConfigPanel
        data={makeValidData({ auth: { type: 'apiKey', headerName: 'X-Key', headerValue: 'old-key' } })}
        onChange={onChange}
      />,
    );
    fireEvent.click(tabButton('Auth'));
    const headerValueInput = screen.getByPlaceholderText('{{apiKey}}');
    fireEvent.change(headerValueInput, { target: { value: 'new-key-value' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({ headerValue: 'new-key-value' }),
      }),
    );
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

describe('GraphqlQueryConfigPanel — mutation-specific branches', () => {
  it('shows Mutation validation error when mutation nodeType and query is empty (covers L563/L570)', () => {
    render(
      <GraphqlQueryConfigPanel
        data={{ ...makeValidData(), query: '' }}
        nodeType="graphqlMutation"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Mutation is required')).toBeInTheDocument();
  });

  it('renders mutation placeholder in query editor when mutation nodeType (covers L570 cond-expr[0])', () => {
    render(
      <GraphqlQueryConfigPanel
        data={{ ...makeValidData(), query: '' }}
        nodeType="graphqlMutation"
        onChange={vi.fn()}
      />,
    );
    const editor = screen.getByTestId('gql-wf-query-editor') as HTMLTextAreaElement;
    expect(editor.placeholder).toContain('mutation');
  });
});

describe('GraphqlQueryConfigPanel — undefined data fields', () => {
  it('handles undefined timeoutMs by defaulting to 30000 (covers L580 ?? branch)', () => {
    const data = {
      label: 'Q',
      endpoint: 'https://api.example.com/graphql',
      query: 'query { user { id } }',
      variables: '{}',
      headers: [],
      extractionRules: [],
      outputBindings: [],
    } as unknown as GraphqlQueryNodeData;
    render(<GraphqlQueryConfigPanel data={data} onChange={vi.fn()} />);
    expect((screen.getByTestId('gql-wf-timeout-input') as HTMLInputElement).valueAsNumber).toBe(30000);
  });
});

describe('GqlExtractionSection — test result pass branch coverage', () => {
  it('shows passed extraction result when run data matches jsonPath (covers L536[0]/L539[0])', () => {
    render(
      <GqlExtractionSection
        rules={[{ variableName: 'uid', jsonPath: '$.user.id' }]}
        crud={{ update: vi.fn(), remove: vi.fn(), move: vi.fn() }}
        onAdd={vi.fn()}
        nodeRunStatus={{
          state: 'pass',
          responseDetail: JSON.stringify({ data: { user: { id: '42' } } }),
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-wf-extraction-test-btn'));
    expect(screen.getByTestId('gql-wf-extraction-test-summary')).toHaveTextContent(/matched/i);
    const result = screen.getByTestId('gql-wf-extraction-test-result');
    expect(result).toHaveTextContent('✓');
  });
});

describe('GqlAuthSection — all auth type branches', () => {
  it('renders oauth2 option when auth type is oauth2', () => {
    render(
      <GqlAuthSection
        auth={{ type: 'oauth2' }}
        onChange={vi.fn()}
        variableHints={[]}
      />,
    );
    expect(screen.getByRole('option', { name: /OAuth 2.0 \(not yet supported\)/i })).toBeInTheDocument();
  });

  it('renders bearer token input with existing token value', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        auth={{ type: 'bearer', token: 'existing-token' }}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    // Token input should be visible and show current value
    expect(screen.getByPlaceholderText('{{authToken}}')).toBeInTheDocument();
  });

  it('renders basic auth inputs with username and password values', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        auth={{ type: 'basic', username: 'admin', password: 'secret' }}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    expect(screen.getByPlaceholderText('user')).toBeInTheDocument();
    expect(screen.getByTestId('gql-wf-auth-password')).toHaveValue('secret');

    // Changing password triggers onChange
    fireEvent.change(screen.getByTestId('gql-wf-auth-password'), { target: { value: 'new-pass' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ password: 'new-pass' }));
  });

  it('renders apiKey inputs with existing headerName and headerValue', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        auth={{ type: 'apiKey', headerName: 'X-API-Key', headerValue: 'my-key' }}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    const nameInput = screen.getByTestId('gql-wf-auth-header-name');
    expect(nameInput).toHaveValue('X-API-Key');
    fireEvent.change(nameInput, { target: { value: 'X-New-Key' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerName: 'X-New-Key' }));
  });

  it('renders custom header inputs with existing values', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        auth={{ type: 'custom', headerName: 'X-Custom', headerValue: 'custom-val' }}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    const nameInput = screen.getByTestId('gql-wf-auth-header-name');
    expect(nameInput).toHaveValue('X-Custom');
    expect(nameInput).toHaveAttribute('placeholder', 'X-Custom-Header');
  });

  it('calls setType with non-none value when auth is undefined (spreads {})', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        auth={undefined}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByTestId('gql-wf-auth-type-select'), { target: { value: 'bearer' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'bearer' }));
  });

  it('calls onChange with undefined when setType is called with "none"', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        auth={{ type: 'bearer', token: 'tok' }}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    fireEvent.change(screen.getByTestId('gql-wf-auth-type-select'), { target: { value: 'none' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('renders bearer token input with empty token (L170[1] — auth.token undefined, uses "" fallback)', () => {
    const onChange = vi.fn();
    render(
      <GqlAuthSection
        // auth.token is not provided → undefined → auth?.token ?? '' takes right side [1]
        auth={{ type: 'bearer' } as { type: 'bearer'; token: string }}
        onChange={onChange}
        variableHints={[]}
      />,
    );
    // Token input should render with empty value (from '??'' fallback)
    expect(screen.getByPlaceholderText('{{authToken}}')).toHaveValue('');
  });

  it('renders basic auth with empty username/password (L184[1], L194[1] — fields undefined)', () => {
    render(
      <GqlAuthSection
        // username and password not provided → undefined → takes '' fallback
        auth={{ type: 'basic' } as { type: 'basic'; username: string; password: string }}
        onChange={vi.fn()}
        variableHints={[]}
      />,
    );
    expect(screen.getByPlaceholderText('user')).toHaveValue('');
    expect(screen.getByTestId('gql-wf-auth-password')).toHaveValue('');
  });

  it('renders apiKey/custom auth with empty fields (L208[1], L222[1] — headerName/headerValue undefined)', () => {
    render(
      <GqlAuthSection
        // headerName and headerValue not provided → undefined → takes '' fallback
        auth={{ type: 'apiKey' } as { type: 'apiKey'; headerName: string; headerValue: string }}
        onChange={vi.fn()}
        variableHints={[]}
      />,
    );
    expect(screen.getByTestId('gql-wf-auth-header-name')).toHaveValue('');
    expect(screen.getByPlaceholderText('{{apiKey}}')).toHaveValue('');
  });

  it('triggers bearer token onInsert with existing token (L167[0] — auth.token is truthy, appended to existing)', () => {
    const onChange = vi.fn();
    // Provide onRequestVariableInsert so InsertVarField renders the "Insert…" button
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{newToken}}'); // immediately invoke apply to trigger onInsert callback
    };
    render(
      <GqlAuthSection
        auth={{ type: 'bearer', token: 'existing-' }}  // auth.token is truthy → [0] path of ??
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    // Click the InsertVarField trigger button
    const insertBtn = screen.getByTitle('Insert variable from workflow or upstream step');
    fireEvent.click(insertBtn);
    // applyCb was invoked inside onRequestVariableInsert → auth.token='existing-' + '{{newToken}}'
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ token: 'existing-{{newToken}}' }));
  });

  it('triggers bearer token onInsert without existing token (L167[1] — auth.token undefined, uses "" prefix)', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{token}}'); // immediately apply
    };
    render(
      <GqlAuthSection
        // auth.token undefined → auth?.token ?? '' = '' → [1] path
        auth={{ type: 'bearer' } as { type: 'bearer'; token: string }}
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    const insertBtn = screen.getByTitle('Insert variable from workflow or upstream step');
    fireEvent.click(insertBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ token: '{{token}}' }));
  });

  it('triggers apiKey/custom headerValue onInsert (L219[0]/[1] — auth.headerValue truthy/falsy)', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{apiKey}}');
    };
    render(
      <GqlAuthSection
        auth={{ type: 'apiKey', headerName: 'X-Key', headerValue: 'existing-' }}  // headerValue truthy → [0]
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    const insertBtn = screen.getByTitle('Insert variable from workflow or upstream step');
    fireEvent.click(insertBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerValue: 'existing-{{apiKey}}' }));
  });

  it('triggers apiKey headerValue onInsert without existing value (L219[1] — auth.headerValue undefined)', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{key}}');
    };
    render(
      <GqlAuthSection
        // headerValue undefined → ?? '' = '' → [1]
        auth={{ type: 'apiKey', headerName: 'X-Key' } as { type: 'apiKey'; headerName: string; headerValue: string }}
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    const insertBtn = screen.getByTitle('Insert variable from workflow or upstream step');
    fireEvent.click(insertBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerValue: '{{key}}' }));
  });

  it('calls update() with auth=undefined → spread {} (L139[1] — auth ?? {} right side)', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = (apply: (snippet: string) => void) => {
      apply('{{tok}}'); // invoke apply immediately to trigger update() while auth could be undefined
    };
    // Render with auth that has type='bearer' but is reconstructed as undefined in update()
    // To test L139[1]: auth is undefined → auth ?? {} → {}, meaning we need auth prop = undefined
    // but type shows bearer somehow. Since type = auth?.type ?? 'none', and auth=undefined → type='none',
    // bearer fields won't show. Instead, test by using the GqlAuthSection update path:
    // pass auth=null (coerced to undefined) through a re-render scenario.
    // Workaround: render with auth=undefined but bearer type via setting type to bearer first
    const { rerender } = render(
      <GqlAuthSection
        auth={{ type: 'bearer', token: 'tok' }}
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    // Re-render without auth to show the update() call with auth=undefined
    rerender(
      <GqlAuthSection
        auth={undefined}
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );
    // With auth=undefined, type='none', no bearer fields visible → can't click Insert
    // This test covers the re-render branch path for auth=undefined
    // The onChange for setType to 'bearer' when auth=undefined covers L139[1]:
    fireEvent.change(screen.getByTestId('gql-wf-auth-type-select'), { target: { value: 'bearer' } });
    // setType called with 'bearer' → onChange({ ...(auth ?? {}), type: 'bearer' })
    // auth=undefined → auth ?? {} = {} → [1] branch!
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'bearer' }));
  });
});

describe('GraphqlQueryConfigPanel — undefined field ?? fallback branches', () => {
  it('renders with undefined headers/extractionRules/outputBindings (L470-472[1] — uses [] fallback)', () => {
    // headers, extractionRules, outputBindings all undefined → data.xxx ?? [] uses right side [1]
    render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'http://api.example.com/graphql',
          query: 'query { user { id } }',
          variables: '{}',
          timeoutMs: 30000,
          // headers, extractionRules, outputBindings intentionally omitted
        } as unknown as import('../../workflow/types/workflow').GraphqlQueryNodeData}
        onChange={vi.fn()}
      />,
    );
    // Should render without crash — all ?? [] fallbacks used
    expect(screen.getByTestId('gql-wf-query-panel')).toBeInTheDocument();
  });

  it('renders with undefined endpoint (L536/L539[1] — endpoint ?? "" uses "" fallback)', () => {
    // endpoint undefined → endpoint ?? '' uses right side [1]
    render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          query: 'query { user { id } }',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
          // endpoint intentionally omitted → undefined
        } as unknown as import('../../workflow/types/workflow').GraphqlQueryNodeData}
        onChange={vi.fn()}
      />,
    );
    // Should render without crash
    expect(screen.getByTestId('gql-wf-query-panel')).toBeInTheDocument();
    // endpoint ?? '' fallback: input should have empty value
    const endpointInput = screen.getByPlaceholderText(/https:\/\/api/);
    expect(endpointInput).toHaveValue('');
  });

  it('renders with undefined query (L563[1] — query ?? "" uses "" fallback)', () => {
    // query undefined → query ?? '' uses right side [1]
    render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'http://api.example.com/graphql',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
          // query intentionally omitted → undefined
        } as unknown as import('../../workflow/types/workflow').GraphqlQueryNodeData}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-wf-query-editor')).toHaveValue('');
  });
});

describe('GraphqlQueryConfigPanel — tab count/error badge branches', () => {
  it('shows operation count badge when endpoint and query are configured', () => {
    const { container } = render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'http://localhost:4010/graphql',
          query: 'mutation { createOrder { id } }',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
        }}
        nodeType="graphqlMutation"
        onChange={vi.fn()}
      />,
    );
    const operationTab = container.querySelector('.gql-wf-subtab.active')?.textContent ?? '';
    expect(operationTab).toContain('Operation');
    const tabBadges = container.querySelectorAll('.gql-wf-subtab-badge');
    expect(Array.from(tabBadges).some((b) => b.textContent === '2')).toBe(true);
  });

  it('shows variables count badge when JSON has keys', () => {
    const { container } = render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'https://api.example.com/graphql',
          query: 'query { user { id } }',
          variables: '{"orderId": {{orderId}}, "qty": 1}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
        }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Variables/ }));
    const tabBadges = container.querySelectorAll('.gql-wf-subtab-badge');
    expect(Array.from(tabBadges).some((b) => b.textContent === '2')).toBe(true);
  });

  it('shows headers count badge when headers have keys', () => {
    const { container } = render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'https://api.example.com/graphql',
          query: 'query { user { id } }',
          variables: '{}',
          headers: [
            { id: 'h1', key: 'X-Token', value: 'abc', enabled: true },
            { id: 'h2', key: '', value: 'empty-key', enabled: true }, // empty key → not counted
          ],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
        }}
        onChange={vi.fn()}
      />,
    );
    // Headers tab should show count badge "1" (only h1 has a key)
    const tabBadges = container.querySelectorAll('.gql-wf-subtab-badge');
    const headerBadge = Array.from(tabBadges).find(b => b.textContent === '1');
    expect(headerBadge).toBeTruthy();
  });

  it('shows extraction count badge when extraction rules exist', () => {
    const { container } = render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'https://api.example.com/graphql',
          query: 'query { user { id } }',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [
            { variableName: 'uid', jsonPath: '$.user.id' },
            { variableName: 'name', jsonPath: '$.user.name' },
          ],
          outputBindings: [],
        }}
        onChange={vi.fn()}
      />,
    );
    // Extraction tab should show count badge "2"
    const tabBadges = container.querySelectorAll('.gql-wf-subtab-badge');
    const extractionBadge = Array.from(tabBadges).find(b => b.textContent === '2');
    expect(extractionBadge).toBeTruthy();
  });

  it('shows output count badge when output bindings are enabled', () => {
    const { container } = render(
      <GraphqlQueryConfigPanel
        data={{
          label: 'Q',
          endpoint: 'https://api.example.com/graphql',
          query: 'query { user { id } }',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [
            { field: 'data', variableName: 'result', enabled: true },
            { field: 'errors', variableName: 'errs', enabled: false }, // disabled → not counted
          ],
        }}
        onChange={vi.fn()}
      />,
    );
    // Output tab should show count badge "1" (only the enabled binding)
    const tabBadges = container.querySelectorAll('.gql-wf-subtab-badge');
    const outputBadge = Array.from(tabBadges).find(b => b.textContent === '1');
    expect(outputBadge).toBeTruthy();
  });
});

describe('GraphqlQueryConfigPanel sub-sections edge branches', () => {

  it('shows no-response-data message when run snapshot has no data root', () => {
    render(
      <GqlExtractionSection
        rules={[{ variableName: 'uid', jsonPath: '$.id' }]}
        crud={{
          update: vi.fn(),
          remove: vi.fn(),
          move: vi.fn(),
        }}
        onAdd={vi.fn()}
        nodeRunStatus={{
          state: 'pass',
          responseDetail: JSON.stringify({ httpStatus: 200 }),
          extracted: { prevRun: 'true' },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('gql-wf-extraction-test-btn'));
    expect(screen.getByTestId('gql-wf-extraction-test-msg')).toHaveTextContent(/No response data available/i);
  });

  it('shows add-at-least-one rule message when testing with zero extraction rules', () => {
    render(
      <GqlExtractionSection
        rules={[]}
        crud={{
          update: vi.fn(),
          remove: vi.fn(),
          move: vi.fn(),
        }}
        onAdd={vi.fn()}
        nodeRunStatus={{
          state: 'pass',
          responseDetail: JSON.stringify({ data: { user: { id: '1' } } }),
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('gql-wf-extraction-test-btn'));
    expect(screen.getByTestId('gql-wf-extraction-test-msg')).toHaveTextContent(/Add at least one extraction rule/i);
  });

  it('renders failed extraction summary and inline failure result', () => {
    render(
      <GqlExtractionSection
        rules={[{ variableName: 'uid', jsonPath: '$.missing.path' }]}
        crud={{
          update: vi.fn(),
          remove: vi.fn(),
          move: vi.fn(),
        }}
        onAdd={vi.fn()}
        nodeRunStatus={{
          state: 'pass',
          responseDetail: JSON.stringify({ data: { user: { id: '1' } } }),
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('gql-wf-extraction-test-btn'));
    expect(screen.getByTestId('gql-wf-extraction-test-summary')).toHaveTextContent(/failed/i);
    expect(screen.getByTestId('gql-wf-extraction-test-result')).toHaveTextContent('✗');
  });
});
