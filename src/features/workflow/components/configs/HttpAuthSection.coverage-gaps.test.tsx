/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { effectiveAuthLabel, HttpAuthSection } from './HttpAuthSection';
import type { AuthConfig, Scenario } from '@shared/types';
import type { WorkflowService } from '../../types/workflow';

vi.mock('../../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options, 'data-testid': dataTestId, 'aria-label': ariaLabel }: {
    value: string;
    onChange: (next: string) => void;
    options: Array<{ value: string; label: string }>;
    'data-testid'?: string;
    'aria-label'?: string;
  }) => (
    <select
      data-testid={dataTestId}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

const workflowServices: WorkflowService[] = [
  { id: 'svc-1', name: 'Users API', baseUrl: 'http://api', auth: { type: 'bearer', token: 'svc-token' } },
  { id: 'svc-2', name: 'Billing API', baseUrl: 'http://billing', auth: { type: 'none' } },
];

function renderSection(
  auth: Scenario['auth'],
  serviceId?: string,
  resolvedServiceAuth?: AuthConfig,
  showAuthPassword = false,
) {
  const onAuthChange = vi.fn();
  const setShowAuthPassword = vi.fn();
  cleanup();
  render(
    <HttpAuthSection
      auth={auth}
      serviceId={serviceId}
      workflowServices={workflowServices}
      resolvedServiceAuth={resolvedServiceAuth}
      showAuthPassword={showAuthPassword}
      setShowAuthPassword={setShowAuthPassword}
      onAuthChange={onAuthChange}
    />,
  );
  return { onAuthChange, setShowAuthPassword };
}

describe('HttpAuthSection coverage gaps', () => {
  it('formats labels for all auth types', () => {
    expect(effectiveAuthLabel(undefined)).toBe('No Auth');
    expect(effectiveAuthLabel({ type: 'none' } as never)).toBe('No Auth');
    expect(effectiveAuthLabel({ type: 'bearer' } as never)).toBe('Bearer Token');
    expect(effectiveAuthLabel({ type: 'basic' } as never)).toBe('Basic Auth');
    expect(effectiveAuthLabel({ type: 'apikey' } as never)).toBe('API Key');
    expect(effectiveAuthLabel({ type: 'apikey', apiKeyName: 'X-API-Key' } as never)).toBe('API Key (X-API-Key)');
    expect(effectiveAuthLabel({ type: 'digest' } as never)).toBe('Digest Auth');
    expect(effectiveAuthLabel({ type: 'oauth2' } as never)).toBe('OAuth2 Client Credentials');
    expect(effectiveAuthLabel({ type: 'inherit' } as never)).toBe('Inherit');
    expect(effectiveAuthLabel({ type: 'custom' } as never)).toBe('custom');
  });

  it('renders inherit and basic/bearer/apikey branches', () => {
    const inherit = renderSection({ type: 'inherit' } as Scenario['auth']);
    expect(screen.getByTestId('wf-http-auth-inherit-hint')).toHaveTextContent('No service selected');

    fireEvent.change(screen.getByTestId('wf-http-auth-type-select'), { target: { value: 'basic' } });
    expect(inherit.onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'basic' }));

    renderSection({ type: 'inherit' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    expect(screen.getByTestId('wf-http-auth-inherit-hint')).toHaveTextContent('Users API');
    expect(screen.getByTestId('wf-http-auth-inherit-hint')).toHaveTextContent('Bearer Token');

    renderSection({ type: 'inherit' } as Scenario['auth'], 'svc-2', { type: 'none' } as AuthConfig);
    expect(screen.getByTestId('wf-http-auth-inherit-hint')).toHaveTextContent('Billing API');
    expect(screen.getByTestId('wf-http-auth-inherit-hint')).toHaveTextContent('No auth is configured');

    renderSection({ type: 'none' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    expect(screen.getByTestId('wf-http-auth-service-unused-hint')).toHaveTextContent('switch Type to');

    renderSection({ type: 'none' } as Scenario['auth']);
    expect(screen.getByTestId('wf-http-auth-type-select')).toBeInTheDocument();

    renderSection({ type: 'none' } as Scenario['auth'], 'svc-2', { type: 'none' } as AuthConfig);
    expect(screen.getByTestId('wf-http-auth-type-select')).toBeInTheDocument();

    const basic = renderSection({ type: 'basic', username: 'user', password: 'secret' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'new-user' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByLabelText('Show password'));
    expect(basic.onAuthChange).toHaveBeenCalled();
    expect(basic.setShowAuthPassword).toHaveBeenCalled();

    cleanup();
    renderSection({ type: 'basic', username: 'user', password: 'secret' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig, true);
    expect(screen.getByLabelText('Password')).not.toHaveClass('wf-http-auth-textarea--masked');
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'visible-user' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'visible-secret' } });

    const bearer = renderSection({ type: 'bearer', token: 'tok', prefix: 'Bearer' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'new-token' } });
    fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'Token' } });
    fireEvent.click(screen.getByLabelText('Show token'));
    expect(bearer.onAuthChange).toHaveBeenCalled();
    expect(bearer.setShowAuthPassword).toHaveBeenCalled();

    cleanup();
    renderSection({ type: 'bearer', token: 'tok', prefix: 'Bearer' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig, true);
    expect(screen.getByLabelText('Token')).not.toHaveClass('wf-http-auth-textarea--masked');
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'visible-token' } });
    fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'Token' } });

    cleanup();
    renderSection({ type: 'bearer', token: 'tok' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    expect(screen.getByLabelText('Prefix')).toHaveValue('Bearer');

    const apiKey = renderSection({ type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'key', apiKeyIn: 'header' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.change(screen.getByLabelText('Key Name'), { target: { value: 'Authorization' } });
    fireEvent.change(screen.getByLabelText('Key Value'), { target: { value: 'api-secret' } });
    fireEvent.click(screen.getByLabelText('Query Parameter'));
    fireEvent.click(screen.getByLabelText('Show key value'));
    renderSection({ type: 'apikey', apiKeyName: 'Authorization', apiKeyValue: 'api-secret', apiKeyIn: 'query' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.click(screen.getByLabelText('Header'));
    expect(apiKey.onAuthChange).toHaveBeenCalled();
    expect(apiKey.setShowAuthPassword).toHaveBeenCalled();

    cleanup();
    renderSection({ type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'key', apiKeyIn: 'header' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig, true);
    expect(screen.getByLabelText('Key Value')).not.toHaveClass('wf-http-auth-textarea--masked');
    fireEvent.change(screen.getByLabelText('Key Name'), { target: { value: 'Visible-API-Key' } });
    fireEvent.change(screen.getByLabelText('Key Value'), { target: { value: 'visible-secret' } });

    cleanup();
    renderSection({ type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'key' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.click(screen.getByLabelText('Query Parameter'));
    fireEvent.click(screen.getByLabelText('Header'));
  });

  it('renders digest and oauth2 branches', () => {
    const digest = renderSection({ type: 'digest', username: 'digest-user', password: 'digest-pass' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'digest-user-2' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'digest-pass-2' } });
    fireEvent.click(screen.getByLabelText('Show password'));
    expect(digest.onAuthChange).toHaveBeenCalled();
    expect(digest.setShowAuthPassword).toHaveBeenCalled();

    cleanup();
    renderSection({ type: 'digest', username: 'digest-user', password: 'digest-pass' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig, true);
    expect(screen.getByLabelText('Password')).not.toHaveClass('wf-http-auth-textarea--masked');
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'visible-digest-user' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'visible-digest-pass' } });

    const oauth2 = renderSection({ type: 'oauth2', tokenUrl: 'https://auth.example.com/token', clientId: 'client', clientSecret: 'secret' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    fireEvent.change(screen.getByLabelText('Token URL'), { target: { value: 'https://auth.example.com/other' } });
    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'client-2' } });
    fireEvent.change(screen.getByLabelText('Client Secret'), { target: { value: 'secret-2' } });
    fireEvent.click(screen.getByLabelText('Show client secret'));
    expect(oauth2.onAuthChange).toHaveBeenCalled();
    expect(oauth2.setShowAuthPassword).toHaveBeenCalled();

    cleanup();
    renderSection({ type: 'oauth2', tokenUrl: 'https://auth.example.com/token', clientId: 'client', clientSecret: 'secret' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig, true);
    expect(screen.getByLabelText('Client Secret')).not.toHaveClass('wf-http-auth-textarea--masked');
    fireEvent.change(screen.getByLabelText('Token URL'), { target: { value: 'https://auth.example.com/visible' } });
    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'client-visible' } });
    fireEvent.change(screen.getByLabelText('Client Secret'), { target: { value: 'secret-visible' } });
  });

  it('covers the remaining native handlers with explicit role queries', () => {
    cleanup();
    const typeSelect = renderSection({ type: 'bearer' } as Scenario['auth']);
    fireEvent.change(screen.getByTestId('wf-http-auth-type-select'), { target: { value: 'apikey' } });
    expect(typeSelect.onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'apikey' }));

    cleanup();
    const apiKey = renderSection({ type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'key', apiKeyIn: 'header' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    expect(screen.getByRole('radio', { name: 'Header' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Query Parameter' }));
    expect(apiKey.onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'query' }));

    cleanup();
    const apiKeyHeader = renderSection({ type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'key', apiKeyIn: 'query' } as Scenario['auth'], 'svc-1', { type: 'bearer', token: 'svc-token' } as AuthConfig);
    expect(screen.getByRole('radio', { name: 'Query Parameter' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Header' }));
    expect(apiKeyHeader.onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'header' }));

    cleanup();
    const apiKeyToggle = renderSection({ type: 'apikey', apiKeyValue: 'key' } as Scenario['auth']);
    fireEvent.click(screen.getByLabelText('Show key value'));
    expect(apiKeyToggle.setShowAuthPassword).toHaveBeenCalled();

    cleanup();
    const bearer = renderSection({ type: 'bearer', prefix: 'Bearer' } as Scenario['auth']);
    fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'Token' } });
    expect(bearer.onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'Token' }));
  });
});
