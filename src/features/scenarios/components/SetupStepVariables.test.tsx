/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, selectOptionByIndex, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import SetupStepVariables from './SetupStepVariables';
import { SetupStepVariablesProps } from './SetupStepVariables';

function makeProps(overrides: Partial<SetupStepVariablesProps> = {}): SetupStepVariablesProps {
  return {
    analysis: { segments: [
      { index: 0, segment: 'api' },
      { index: 1, segment: 'v1' },
      { index: 2, segment: '123' },
    ] },
    selections: {},
    toggleSegment: vi.fn(),
    setVarName: vi.fn(),
    autoUrlTemplate: 'https://api.example.com/v1/{{id}}',
    urlTemplateInput: 'https://api.example.com/v1/{{id}}',
    setUrlTemplateInput: vi.fn(),
    isTemplateCustomized: false,
    setIsTemplateCustomized: vi.fn(),
    urlParams: [],
    paramSelections: {},
    setParamSelection: vi.fn(),
    headerCandidates: [],
    headerSelections: {},
    setHeaderSelection: vi.fn(),
    bodyVariableCandidates: [],
    bodySelections: {},
    setBodySelection: vi.fn(),
    workingAuth: { type: 'none' },
    setWorkingAuthType: vi.fn(),
    patchWorkingAuth: vi.fn(),
    test: { method: 'GET', headers: [], body: '' },
    ...overrides,
  };
}

describe('SetupStepVariables', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('path variables', () => {
    it('renders path segments', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(screen.getByText('/api')).toBeInTheDocument();
      expect(screen.getByText('/v1')).toBeInTheDocument();
      expect(screen.getByText('/123')).toBeInTheDocument();
    });

    it('shows selected count', () => {
      render(<SetupStepVariables {...makeProps({
        selections: { 2: { checked: true, name: 'id' } },
      })} />);
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('calls toggleSegment on checkbox click', () => {
      const toggleSegment = vi.fn();
      render(<SetupStepVariables {...makeProps({ toggleSegment })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(toggleSegment).toHaveBeenCalledWith(0);
    });

    it('shows variable name input for checked segments', () => {
      render(<SetupStepVariables {...makeProps({
        selections: { 2: { checked: true, name: 'itemId' } },
      })} />);
      expect(screen.getByDisplayValue('itemId')).toBeInTheDocument();
    });

    it('calls setVarName with sanitized value', () => {
      const setVarName = vi.fn();
      render(<SetupStepVariables {...makeProps({
        selections: { 2: { checked: true, name: 'id' } },
        setVarName,
      })} />);
      const input = screen.getByDisplayValue('id');
      fireEvent.change(input, { target: { value: 'new_name' } });
      expect(setVarName).toHaveBeenCalledWith(2, 'new_name');
    });

    it('renders empty path variable name when checked selection has no name', () => {
      render(<SetupStepVariables {...makeProps({
        selections: { 1: { checked: true, name: '' } },
      })} />);
      const varInputs = screen.getAllByPlaceholderText('variable name');
      expect(varInputs.some(el => (el as HTMLInputElement).value === '')).toBe(true);
    });

    it('treats absent path variable name as empty when selection is checked', () => {
      render(<SetupStepVariables {...makeProps({
        selections: { 0: { checked: true, name: undefined as unknown as string } },
      })} />);
      const varInputs = screen.getAllByPlaceholderText('variable name');
      expect(varInputs.some(el => (el as HTMLInputElement).value === '')).toBe(true);
    });

    it('ignores undefined selection entries when counting selected path segments', () => {
      render(<SetupStepVariables {...makeProps({
        selections: { 0: undefined as unknown as { checked: boolean; name: string }, 1: { checked: true, name: 'x' } },
      })} />);
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('collapses and re-expands each variables section', () => {
      render(<SetupStepVariables {...makeProps()} />);

      const sectionButtons = [
        screen.getByRole('button', { name: /Path Variables/i }),
        screen.getByRole('button', { name: /URL Template Preview/i }),
        screen.getByRole('button', { name: /Query Variables/i }),
        screen.getByRole('button', { name: /Header Variables/i }),
        screen.getByRole('button', { name: /Body Variables/i }),
        screen.getByRole('button', { name: /Auth Configuration/i }),
      ];

      for (const button of sectionButtons) {
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
      }
    });
  });

  describe('URL template', () => {
    it('renders auto URL template in code box', () => {
      render(<SetupStepVariables {...makeProps()} />);
      const codeEl = document.querySelector('.url-pattern-box');
      expect(codeEl?.textContent).toBe('https://api.example.com/v1/{{id}}');
    });

    it('renders URL template textarea', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(screen.getByDisplayValue('https://api.example.com/v1/{{id}}')).toBeInTheDocument();
    });

    it('calls setIsTemplateCustomized and setUrlTemplateInput on edit', () => {
      const setIsTemplateCustomized = vi.fn();
      const setUrlTemplateInput = vi.fn();
      render(<SetupStepVariables {...makeProps({ setIsTemplateCustomized, setUrlTemplateInput })} />);
      const textarea = screen.getByDisplayValue('https://api.example.com/v1/{{id}}');
      fireEvent.change(textarea, { target: { value: 'https://new-url.com/{{id}}' } });
      expect(setIsTemplateCustomized).toHaveBeenCalledWith(true);
      expect(setUrlTemplateInput).toHaveBeenCalledWith('https://new-url.com/{{id}}');
    });

    it('disables Reset button when not customized', () => {
      render(<SetupStepVariables {...makeProps({ isTemplateCustomized: false })} />);
      expect(screen.getByText('Reset to Auto Template')).toBeDisabled();
    });

    it('enables Reset button when customized and resets on click', () => {
      const setIsTemplateCustomized = vi.fn();
      const setUrlTemplateInput = vi.fn();
      render(<SetupStepVariables {...makeProps({
        isTemplateCustomized: true,
        setIsTemplateCustomized,
        setUrlTemplateInput,
        autoUrlTemplate: 'https://auto.com/{{id}}',
      })} />);
      const btn = screen.getByText('Reset to Auto Template');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(setIsTemplateCustomized).toHaveBeenCalledWith(false);
      expect(setUrlTemplateInput).toHaveBeenCalledWith('https://auto.com/{{id}}');
    });
  });

  describe('query variables', () => {
    it('shows "No query parameters" when empty', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(screen.getByText('No query parameters')).toBeInTheDocument();
    });

    it('renders query params with toggle and name input', () => {
      render(<SetupStepVariables {...makeProps({
        urlParams: [{ key: 'page', value: '1' }, { key: 'limit', value: '10' }],
      })} />);
      expect(screen.getByText('page')).toBeInTheDocument();
      expect(screen.getByText('limit')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('shows count of enabled params', () => {
      render(<SetupStepVariables {...makeProps({
        urlParams: [{ key: 'page', value: '1' }, { key: 'limit', value: '10' }],
        paramSelections: { page: { enabled: true, name: 'page' }, limit: { enabled: false, name: 'limit' } },
      })} />);
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('defaults missing param selection to enabled for count', () => {
      render(<SetupStepVariables {...makeProps({
        urlParams: [{ key: 'q', value: 'x' }],
        paramSelections: {},
      })} />);
      expect(screen.getByText('1/1')).toBeInTheDocument();
    });

    it('calls setParamSelection on checkbox change', () => {
      const setParamSelection = vi.fn();
      render(<SetupStepVariables {...makeProps({
        urlParams: [{ key: 'page', value: '1' }],
        setParamSelection,
      })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const pageCheckbox = checkboxes.find(cb => cb.closest('.csv-fixed-item')?.textContent?.includes('page'));
      fireEvent.click(pageCheckbox!);
      expect(setParamSelection).toHaveBeenCalledWith('page', { enabled: expect.any(Boolean) });
    });

    it('calls setParamSelection on name change', () => {
      const setParamSelection = vi.fn();
      render(<SetupStepVariables {...makeProps({
        urlParams: [{ key: 'page', value: '1' }],
        paramSelections: { page: { enabled: true, name: 'page' } },
        setParamSelection,
      })} />);
      const nameInput = screen.getByDisplayValue('page');
      fireEvent.change(nameInput, { target: { value: 'pageNum' } });
      expect(setParamSelection).toHaveBeenCalledWith('page', { name: 'pageNum' });
    });
  });

  describe('header variables', () => {
    it('shows "No headers" when empty', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(screen.getByText('No headers')).toBeInTheDocument();
    });

    it('renders header candidates', () => {
      render(<SetupStepVariables {...makeProps({
        headerCandidates: [
          { key: 'Authorization', value: 'Bearer xxx', suggestedName: 'auth_token', suggestedEnabled: true },
        ],
        headerSelections: { Authorization: { enabled: true, name: 'auth_token' } },
      })} />);
      expect(screen.getByText('Authorization')).toBeInTheDocument();
      expect(screen.getByText('Bearer xxx')).toBeInTheDocument();
      expect(screen.getByDisplayValue('auth_token')).toBeInTheDocument();
    });

    it('calls setHeaderSelection on checkbox change', () => {
      const setHeaderSelection = vi.fn();
      render(<SetupStepVariables {...makeProps({
        headerCandidates: [{ key: 'X-Api-Key', value: 'abc', suggestedName: 'apiKey', suggestedEnabled: false }],
        setHeaderSelection,
      })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const headerCb = checkboxes.find(cb => cb.closest('.csv-fixed-item')?.textContent?.includes('X-Api-Key'));
      fireEvent.click(headerCb!);
      expect(setHeaderSelection).toHaveBeenCalledWith('X-Api-Key', { enabled: expect.any(Boolean) });
    });

    it('calls setHeaderSelection with sanitized name when header name input changes', () => {
      const setHeaderSelection = vi.fn();
      render(<SetupStepVariables {...makeProps({
        headerCandidates: [{ key: 'X-Foo', value: 'bar', suggestedName: 'fooVar', suggestedEnabled: true }],
        headerSelections: { 'X-Foo': { enabled: true, name: 'fooVar' } },
        setHeaderSelection,
      })} />);
      fireEvent.change(screen.getByDisplayValue('fooVar'), { target: { value: 'new_name!' } });
      expect(setHeaderSelection).toHaveBeenCalledWith('X-Foo', { name: 'new_name' });
    });

    it('counts enabled header selections including suggested defaults when none stored', () => {
      render(<SetupStepVariables {...makeProps({
        headerCandidates: [{ key: 'H1', value: 'v', suggestedName: 'h1', suggestedEnabled: true }],
        headerSelections: {},
      })} />);
      expect(screen.getByText('0/1')).toBeInTheDocument();
    });
  });

  describe('body variables', () => {
    it('shows "No body placeholders found" when empty', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(screen.getByText('No body placeholders found')).toBeInTheDocument();
    });

    it('renders body variable candidates', () => {
      render(<SetupStepVariables {...makeProps({
        bodyVariableCandidates: ['payloadId', 'amount'],
        bodySelections: { payloadId: { enabled: true, name: 'payloadId' }, amount: { enabled: true, name: 'amount' } },
      })} />);
      expect(screen.getByText('payloadId')).toBeInTheDocument();
      expect(screen.getByText('amount')).toBeInTheDocument();
    });

    it('calls setBodySelection on toggle', () => {
      const setBodySelection = vi.fn();
      render(<SetupStepVariables {...makeProps({
        bodyVariableCandidates: ['payload'],
        setBodySelection,
      })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const bodyCb = checkboxes.find(cb => cb.closest('.csv-fixed-item')?.textContent?.includes('payload'));
      fireEvent.click(bodyCb!);
      expect(setBodySelection).toHaveBeenCalledWith('payload', { enabled: expect.any(Boolean) });
    });

    it('calls setBodySelection with sanitized name when body variable name input changes', () => {
      const setBodySelection = vi.fn();
      render(<SetupStepVariables {...makeProps({
        bodyVariableCandidates: ['bodyKey'],
        bodySelections: { bodyKey: { enabled: true, name: 'bodyKey' } },
        setBodySelection,
      })} />);
      fireEvent.change(screen.getByDisplayValue('bodyKey'), { target: { value: 'row_id@1' } });
      expect(setBodySelection).toHaveBeenCalledWith('bodyKey', { name: 'row_id1' });
    });

    it('shows body variable count from stored selections only', () => {
      render(<SetupStepVariables {...makeProps({
        bodyVariableCandidates: ['onlyVar'],
        bodySelections: {},
      })} />);
      expect(screen.getByText('0/1')).toBeInTheDocument();
    });
  });

  describe('auth configuration', () => {
    it('shows auth type select', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(getCustomSelectValue(document.body)).toBe('No Auth');
    });

    it('calls setWorkingAuthType on change', () => {
      const setWorkingAuthType = vi.fn();
      render(<SetupStepVariables {...makeProps({ setWorkingAuthType })} />);
      selectOption(document.body, 'Bearer Token');
      expect(setWorkingAuthType).toHaveBeenCalledWith('bearer');
    });

    it('shows bearer token fields', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'bearer', token: 'my-token', prefix: 'Bearer' },
        patchWorkingAuth,
      })} />);
      expect(screen.getByDisplayValue('Bearer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('my-token')).toBeInTheDocument();
      fireEvent.change(screen.getByDisplayValue('my-token'), { target: { value: 'new-token' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ token: 'new-token' });
    });

    it('uses default Bearer prefix when bearer auth omits prefix', () => {
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'bearer', token: 't-only' },
      })} />);
      expect(screen.getByDisplayValue('Bearer')).toBeInTheDocument();
    });

    it('uses empty token value when bearer omits token', () => {
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'bearer', prefix: 'Bearer' },
      })} />);
      expect(screen.getByPlaceholderText('eyJhbGciOi...')).toHaveValue('');
    });

    it('patches bearer prefix input on change', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'bearer', token: 'x', prefix: 'Bearer' },
        patchWorkingAuth,
      })} />);
      fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'Token' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ prefix: 'Token' });
    });

    it('shows basic auth fields and edits username', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'basic', username: 'admin', password: 'pass' },
        patchWorkingAuth,
      })} />);
      expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
      fireEvent.change(screen.getByDisplayValue('admin'), { target: { value: 'root' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ username: 'root' });
    });

    it('shows empty basic auth fields when username and password are omitted', () => {
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'basic' },
      })} />);
      expect(screen.getByPlaceholderText('Enter username')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter password')).toHaveValue('');
    });

    it('edits basic auth password', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'basic', username: 'admin', password: 'pass' },
        patchWorkingAuth,
      })} />);
      const pwInput = screen.getByDisplayValue('pass');
      fireEvent.change(pwInput, { target: { value: 'newpass' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ password: 'newpass' });
    });

    it('shows apikey fields with location select', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'header' },
        patchWorkingAuth,
      })} />);
      expect(screen.getByDisplayValue('X-Key')).toBeInTheDocument();
      expect(screen.getByDisplayValue('secret')).toBeInTheDocument();
      expect(screen.getByText('Header')).toBeInTheDocument();
      selectOptionByIndex(document.body, 1, 'Query String');
      expect(patchWorkingAuth).toHaveBeenCalledWith({ apiKeyIn: 'query' });
    });

    it('defaults apikey location to header when apiKeyIn is omitted', () => {
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'apikey', apiKeyName: 'K', apiKeyValue: 'v' },
      })} />);
      expect(screen.getByText('Header')).toBeInTheDocument();
    });

    it('shows empty api key name and value fields when omitted', () => {
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'apikey' },
      })} />);
      expect(screen.getByPlaceholderText('X-API-Key')).toHaveValue('');
      expect(screen.getByPlaceholderText('your-api-key')).toHaveValue('');
    });

    it('edits apikey name', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'header' },
        patchWorkingAuth,
      })} />);
      fireEvent.change(screen.getByDisplayValue('X-Key'), { target: { value: 'X-Custom' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ apiKeyName: 'X-Custom' });
    });

    it('edits apikey value', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'header' },
        patchWorkingAuth,
      })} />);
      fireEvent.change(screen.getByDisplayValue('secret'), { target: { value: 'newsecret' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ apiKeyValue: 'newsecret' });
    });

    it('shows oauth2 fields and edits clientId', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'oauth2', tokenUrl: 'https://auth.example.com/token', clientId: 'cid', clientSecret: 'csecret' },
        patchWorkingAuth,
      })} />);
      expect(screen.getByDisplayValue('https://auth.example.com/token')).toBeInTheDocument();
      expect(screen.getByDisplayValue('cid')).toBeInTheDocument();
      fireEvent.change(screen.getByDisplayValue('cid'), { target: { value: 'new-cid' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ clientId: 'new-cid' });
    });

    it('edits oauth2 tokenUrl', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'oauth2', tokenUrl: 'https://auth.example.com/token', clientId: 'cid', clientSecret: 'csecret' },
        patchWorkingAuth,
      })} />);
      fireEvent.change(screen.getByDisplayValue('https://auth.example.com/token'), { target: { value: 'https://new-auth.com/token' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ tokenUrl: 'https://new-auth.com/token' });
    });

    it('edits oauth2 clientSecret', () => {
      const patchWorkingAuth = vi.fn();
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'oauth2', tokenUrl: 'https://auth.example.com/token', clientId: 'cid', clientSecret: 'csecret' },
        patchWorkingAuth,
      })} />);
      const secretInput = screen.getByDisplayValue('csecret');
      fireEvent.change(secretInput, { target: { value: 'new-secret' } });
      expect(patchWorkingAuth).toHaveBeenCalledWith({ clientSecret: 'new-secret' });
    });

    it('shows empty oauth2 fields when optional properties are omitted', () => {
      render(<SetupStepVariables {...makeProps({
        workingAuth: { type: 'oauth2' },
      })} />);
      expect(screen.getByPlaceholderText('https://auth.example.com/oauth/token')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter client ID')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter client secret')).toHaveValue('');
    });
  });

  describe('fixed configuration', () => {
    it('shows method badge', () => {
      render(<SetupStepVariables {...makeProps({ test: { method: 'POST', headers: [], body: '{}' } })} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });

    it('applies lowercased method to method badge class', () => {
      const { container } = render(<SetupStepVariables {...makeProps({
        test: { method: 'PATCH', headers: [], body: '' },
      })} />);
      expect(container.querySelector('.method-patch')).toBeInTheDocument();
    });

    it('shows headers list', () => {
      render(<SetupStepVariables {...makeProps({
        test: { method: 'GET', headers: [{ key: 'Content-Type', value: 'application/json' }, { key: '', value: '' }], body: '' },
      })} />);
      expect(screen.getByText('Content-Type')).toBeInTheDocument();
    });

    it('joins multiple non-empty header keys with comma and space', () => {
      render(<SetupStepVariables {...makeProps({
        test: {
          method: 'GET',
          headers: [{ key: 'A', value: '1' }, { key: 'B', value: '2' }],
          body: '',
        },
      })} />);
      expect(screen.getByText('A, B')).toBeInTheDocument();
    });

    it('shows "None" when no headers', () => {
      render(<SetupStepVariables {...makeProps()} />);
      expect(screen.getByText('None')).toBeInTheDocument();
    });

    it('shows auth type in fixed config', () => {
      render(<SetupStepVariables {...makeProps({ workingAuth: { type: 'bearer', token: 'x' } })} />);
      expect(screen.getAllByText('bearer').length).toBeGreaterThan(0);
    });
  });
});
