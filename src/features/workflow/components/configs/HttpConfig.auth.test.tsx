/**
 * @vitest-environment jsdom
 *
 * HttpConfig — auth tab tests covering all auth types and their form fields.
 *
 * Basic rendering tests live in `HttpConfig.test.tsx`. Interactive paths in
 * `HttpConfig.interactions.test.tsx`. Shared factories in
 * `__test-utils__/httpConfigTestHelpers.tsx`.
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HttpConfig from './HttpConfig';
import type { Scenario } from '../../../../shared/types';
import type { WorkflowService } from '../../types/workflow';
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

describe('HttpConfig — auth tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders auth type select with inherit default', () => {
    const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'inherit' } }) });
    render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
    expect(screen.getByDisplayValue('Inherit from Service')).toBeTruthy();
  });

  it('calls onChange when auth type changes', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'none' } }) });
    render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('No Auth'), { target: { value: 'basic' } });
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as { scenario: Scenario };
    expect(call.scenario.auth.type).toBe('basic');
  });

  it('renders all auth type options', () => {
    const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'none' } }) });
    render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
    const select = screen.getByDisplayValue('No Auth') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('inherit');
    expect(options).toContain('none');
    expect(options).toContain('basic');
    expect(options).toContain('bearer');
    expect(options).toContain('apikey');
    expect(options).toContain('digest');
    expect(options).toContain('oauth2');
  });

  describe('inherit auth', () => {
    it('shows hint when no service selected', () => {
      const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'inherit' } }) });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByText(/No service selected/)).toBeTruthy();
    });

    it('shows service name when service selected', () => {
      const services: WorkflowService[] = [
        { id: 'svc1', name: 'Users API', baseUrl: 'http://api', auth: { type: 'bearer', token: 'tok' } },
      ];
      const data = makeHttpData({
        serviceId: 'svc1',
        scenario: makeScenario({ auth: { type: 'inherit' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} workflowServices={services} />);
      expect(screen.getByText(/inherited from the selected service.*Users API/)).toBeTruthy();
    });
  });

  describe('basic auth', () => {
    it('renders username and password fields', () => {
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'basic', username: 'user', password: 'pass' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByDisplayValue('user')).toBeTruthy();
      expect(screen.getByDisplayValue('pass')).toBeTruthy();
    });

    it('updates username on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'basic', username: '', password: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const inputs = screen.getAllByRole('textbox');
      const usernameInput = inputs.find(i => (i as HTMLInputElement).placeholder !== 'eyJhbGciOi...');
      fireEvent.change(usernameInput!, { target: { value: 'newuser' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('updates password on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'basic', username: 'user', password: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const passwordInput = document.querySelector('input[type="password"]');
      fireEvent.change(passwordInput!, { target: { value: 'newpass' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('bearer auth', () => {
    it('renders token and prefix fields', () => {
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'bearer', token: 'mytoken', prefix: 'Bearer' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByDisplayValue('mytoken')).toBeTruthy();
      expect(screen.getByDisplayValue('Bearer')).toBeTruthy();
    });

    it('updates token on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'bearer', token: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const tokenInput = screen.getByPlaceholderText('eyJhbGciOi...');
      fireEvent.change(tokenInput, { target: { value: 'newtoken' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('updates prefix on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'bearer', token: 'tok', prefix: 'Bearer' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const prefixInput = screen.getByDisplayValue('Bearer');
      fireEvent.change(prefixInput, { target: { value: 'Token' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('apikey auth', () => {
    it('renders key name and value fields', () => {
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'apikey', apiKeyName: 'X-API', apiKeyValue: 'secret' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByDisplayValue('X-API')).toBeTruthy();
      expect(screen.getByDisplayValue('secret')).toBeTruthy();
    });

    it('updates key name on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'apikey', apiKeyName: '', apiKeyValue: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const nameInput = screen.getByPlaceholderText('X-API-Key');
      fireEvent.change(nameInput, { target: { value: 'Authorization' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('updates key value on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'apikey', apiKeyName: 'X-API', apiKeyValue: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const valueInput = screen.getByPlaceholderText('your-api-key');
      fireEvent.change(valueInput, { target: { value: 'newsecret' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('renders radio buttons for header/query placement', () => {
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'header' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByLabelText('Header')).toBeTruthy();
      expect(screen.getByLabelText('Query Parameter')).toBeTruthy();
    });

    it('changes apiKeyIn to query when query radio is clicked', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'header' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Query Parameter'));
      expect(onChange).toHaveBeenCalled();
      const call = onChange.mock.calls[0][0] as { scenario: Scenario };
      expect(call.scenario.auth.apiKeyIn).toBe('query');
    });

    it('changes apiKeyIn to header when header radio is clicked', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'query' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Header'));
      expect(onChange).toHaveBeenCalled();
      const call = onChange.mock.calls[0][0] as { scenario: Scenario };
      expect(call.scenario.auth.apiKeyIn).toBe('header');
    });
  });

  describe('digest auth', () => {
    it('renders username and password fields', () => {
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'digest', username: 'duser', password: 'dpass' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByDisplayValue('duser')).toBeTruthy();
      expect(screen.getByDisplayValue('dpass')).toBeTruthy();
    });

    it('updates digest username on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'digest', username: '', password: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'digestuser' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('updates digest password on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'digest', username: 'u', password: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const passwordInput = document.querySelector('input[type="password"]');
      fireEvent.change(passwordInput!, { target: { value: 'digestpass' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('oauth2 auth', () => {
    it('renders token URL, client ID, and client secret fields', () => {
      const data = makeHttpData({
        scenario: makeScenario({
          auth: {
            type: 'oauth2',
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client123',
            clientSecret: 'secret456',
          },
        }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} />);
      expect(screen.getByDisplayValue('https://auth.example.com/token')).toBeTruthy();
      expect(screen.getByDisplayValue('client123')).toBeTruthy();
      expect(screen.getByDisplayValue('secret456')).toBeTruthy();
    });

    it('updates tokenUrl on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'oauth2', tokenUrl: '', clientId: '', clientSecret: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const tokenUrlInput = screen.getByPlaceholderText('https://auth.example.com/oauth/token');
      fireEvent.change(tokenUrlInput, { target: { value: 'https://new.auth/token' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('updates clientId on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'oauth2', tokenUrl: 'url', clientId: '', clientSecret: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const inputs = screen.getAllByRole('textbox');
      const clientIdInput = inputs.find(i => (i as HTMLInputElement).placeholder === '');
      fireEvent.change(clientIdInput!, { target: { value: 'newclient' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('updates clientSecret on change', () => {
      const onChange = vi.fn();
      const data = makeHttpData({
        scenario: makeScenario({ auth: { type: 'oauth2', tokenUrl: 'url', clientId: 'id', clientSecret: '' } }),
      });
      render(<HttpConfig {...defaultProps} activeTab="auth" data={data} onChange={onChange} />);
      const secretInput = document.querySelector('input[type="password"]');
      fireEvent.change(secretInput!, { target: { value: 'newsecret' } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('auth badge on tab', () => {
    it('shows badge-dot when auth type is basic', () => {
      const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'basic' } }) });
      render(<HttpConfig {...defaultProps} data={data} />);
      const authTab = screen.getByText('Auth').closest('button');
      expect(authTab?.querySelector('.tab-badge-dot')).toBeTruthy();
    });

    it('shows badge-dot when auth type is bearer', () => {
      const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'bearer' } }) });
      render(<HttpConfig {...defaultProps} data={data} />);
      const authTab = screen.getByText('Auth').closest('button');
      expect(authTab?.querySelector('.tab-badge-dot')).toBeTruthy();
    });

    it('does not show badge-dot when auth type is none', () => {
      const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'none' } }) });
      render(<HttpConfig {...defaultProps} data={data} />);
      const authTab = screen.getByText('Auth').closest('button');
      expect(authTab?.querySelector('.tab-badge-dot')).toBeNull();
    });

    it('does not show badge-dot when auth type is inherit', () => {
      const data = makeHttpData({ scenario: makeScenario({ auth: { type: 'inherit' } }) });
      render(<HttpConfig {...defaultProps} data={data} />);
      const authTab = screen.getByText('Auth').closest('button');
      expect(authTab?.querySelector('.tab-badge-dot')).toBeNull();
    });
  });
});

describe('HttpConfig — body tab formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats JSON when Pretty Format button is clicked', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: '{"a":1,"b":2}' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Pretty Format'));
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as { scenario: Scenario };
    expect(call.scenario.body).toContain('\n');
  });

  it('ignores Pretty Format when body is not valid JSON', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: 'not json' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Pretty Format'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('minifies JSON when Minify button is clicked', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: '{\n  "a": 1,\n  "b": 2\n}' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Minify'));
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as { scenario: Scenario };
    expect(call.scenario.body).toBe('{"a":1,"b":2}');
  });

  it('ignores Minify when body is not valid JSON', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ scenario: makeScenario({ body: 'not json' }) });
    render(<HttpConfig {...defaultProps} activeTab="body" data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Minify'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('HttpConfig — spec version mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders spec version select when sourceSpecVersionId is set', () => {
    const data = makeHttpData({ sourceSpecVersionId: 'v1', sourceSpecVersionLabel: '1.0' });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(screen.getByText(/Latest/)).toBeTruthy();
  });

  it('shows version label when pinned mode and label exists', () => {
    const data = makeHttpData({
      sourceSpecVersionId: 'v1',
      sourceSpecVersionLabel: '2.0',
      specVersionMode: 'pinned',
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(screen.getByText('v2.0')).toBeTruthy();
  });

  it('changes spec version mode on select change', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ sourceSpecVersionId: 'v1', specVersionMode: 'latest' });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} />);
    const select = screen.getByDisplayValue(/Latest/) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'pinned' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ specVersionMode: 'pinned' }));
  });
});

describe('HttpConfig — timeout field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders timeout input with current value', () => {
    const data = makeHttpData({ timeoutSec: 30 });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(screen.getByDisplayValue('30')).toBeTruthy();
  });

  it('clamps timeout to 0-300 range', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ timeoutSec: 30 });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} />);
    const timeoutInput = screen.getByDisplayValue('30');
    fireEvent.change(timeoutInput, { target: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutSec: 300 }));
  });

  it('clamps negative timeout to 0', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ timeoutSec: 30 });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} />);
    const timeoutInput = screen.getByDisplayValue('30');
    fireEvent.change(timeoutInput, { target: { value: '-10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutSec: 0 }));
  });

  it('handles non-numeric timeout input', () => {
    const onChange = vi.fn();
    const data = makeHttpData({ timeoutSec: 30 });
    render(<HttpConfig {...defaultProps} data={data} onChange={onChange} />);
    const timeoutInput = screen.getByDisplayValue('30');
    fireEvent.change(timeoutInput, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutSec: 0 }));
  });
});

describe('HttpConfig — visual variables mapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Visual Variables button when template slots exist', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/{{userId}}', body: '{{data}}' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(screen.getByText(/Visual Variables/)).toBeTruthy();
  });

  it('does not show Visual Variables button when no template slots', () => {
    const data = makeHttpData({ scenario: makeScenario({ url: '/api/users', body: '' }) });
    render(<HttpConfig {...defaultProps} data={data} />);
    expect(screen.queryByText(/Visual Variables/)).toBeNull();
  });
});

describe('HttpConfig — validation badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows badge-dot when validation mode is selective', () => {
    const data = makeHttpData({
      scenario: makeScenario({ validation: { mode: 'selective' } } as Partial<Scenario>),
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const valTab = screen.getByText('Validation').closest('button');
    expect(valTab?.querySelector('.tab-badge-dot')).toBeTruthy();
  });

  it('shows badge-dot when expectedFields exist', () => {
    const data = makeHttpData({
      scenario: makeScenario({
        validation: { expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }] },
      } as unknown as Partial<Scenario>),
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const valTab = screen.getByText('Validation').closest('button');
    expect(valTab?.querySelector('.tab-badge-dot')).toBeTruthy();
  });

  it('does not show badge-dot when validation is empty', () => {
    const data = makeHttpData({
      scenario: makeScenario({ validation: {} }),
    });
    render(<HttpConfig {...defaultProps} data={data} />);
    const valTab = screen.getByText('Validation').closest('button');
    expect(valTab?.querySelector('.tab-badge-dot')).toBeNull();
  });
});
