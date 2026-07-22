/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCustomSelectValue, selectOption } from '../../../test-utils/customSelectHelper';
import { GrpcAuthPanel } from './GrpcAuthPanel';
import type { GrpcAuthPreviewResult } from '../utils/grpcAuthPreview';

const emptyPreview: GrpcAuthPreviewResult = {
  ok: true,
  issues: [],
  conflicts: [],
  previewEntries: [],
};

describe('GrpcAuthPanel coverage gaps', () => {
  it('switches to none and clears auth config', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'tok' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'No Auth');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('ignores clicking the already-active auth type pill', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'basic', basicUsername: 'u', basicPassword: 'p' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Basic Auth');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('edits basic auth username and password', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'basic', basicUsername: '', basicPassword: '' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-auth-basic-user'), { target: { value: 'alice' } });
    await user.type(screen.getByTestId('grpc-auth-basic-pass'), 'secret');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'basic', basicUsername: 'alice' }),
    );
  });

  it('edits api_key header name (lowercased) and value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'api_key', apiKeyName: '', apiKeyValue: '' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-auth-api-key-name'), {
      target: { value: 'X-API-KEY' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyName: 'x-api-key' }),
    );
    await user.type(screen.getByTestId('grpc-auth-api-key-value'), 'key123');
    expect(onChange).toHaveBeenCalled();
  });

  it('edits oauth2 token URL, client ID, secret, and scope', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{
          type: 'oauth2',
          oauth2: {
            tokenUrl: '',
            clientId: '',
            clientSecret: '',
            scope: 'read',
          },
        }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-token-url'), {
      target: { value: 'https://auth.example.com/token' },
    });
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-client-id'), {
      target: { value: 'client-id' },
    });
    await user.type(screen.getByTestId('grpc-auth-oauth-client-secret'), 'shh');
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-scope'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.oauth2?.scope).toBeUndefined();
  });

  it('shows issues, errorMessage, and preview entries', () => {
    const preview: GrpcAuthPreviewResult = {
      ok: false,
      issues: [{ field: 'auth.bearerToken', code: 'GRPC_INVALID_REQUEST', message: 'Bearer token required' }],
      conflicts: [],
      previewEntries: [{ key: 'authorization', value: 'Bearer preview' }],
      errorMessage: 'Auth configuration is incomplete',
    };
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: '' }}
        preview={preview}
        onChange={vi.fn()}
      />,
    );
    const issues = screen.getByTestId('grpc-auth-issues');
    expect(issues.textContent).toMatch(/incomplete/i);
    expect(issues.textContent).toMatch(/Bearer token required/i);
    expect(screen.getByTestId('grpc-auth-preview').textContent).toMatch(/authorization/i);
  });

  it('masks secret conflict values but shows non-secret manual values', () => {
    const preview: GrpcAuthPreviewResult = {
      ok: true,
      issues: [],
      conflicts: [
        { key: 'authorization', manualValue: 'Bearer old', authValue: 'Bearer new' },
        { key: 'x-request-id', manualValue: 'trace-123', authValue: 'trace-456' },
      ],
      previewEntries: [],
    };
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'new' }}
        preview={preview}
        onChange={vi.fn()}
      />,
    );
    const conflicts = screen.getByTestId('grpc-auth-conflicts');
    expect(conflicts.textContent).toMatch(/authorization/);
    expect(conflicts.textContent).toMatch(/••••••/);
    expect(conflicts.textContent).toMatch(/trace-123/);
  });

  it('invokes unmask and clear callbacks for masked secret fields', async () => {
    const user = userEvent.setup();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'basic', basicUsername: 'u', basicPassword: 'stored' }}
        preview={emptyPreview}
        maskedSecretFields={{ basicPassword: true }}
        onChange={vi.fn()}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    await user.click(screen.getByTestId('grpc-auth-basic-pass-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('basicPassword');
    await user.type(screen.getByTestId('grpc-auth-basic-pass'), 'x');
    expect(onUnmaskSecretField).toHaveBeenCalledWith('basicPassword');
  });

  it('invokes bearer token unmask and clear callbacks', async () => {
    const user = userEvent.setup();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'stored-token' }}
        preview={emptyPreview}
        maskedSecretFields={{ bearerToken: true }}
        onChange={vi.fn()}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    await user.click(screen.getByTestId('grpc-auth-bearer-token-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('bearerToken');
    await user.type(screen.getByTestId('grpc-auth-bearer-token'), 'x');
    expect(onUnmaskSecretField).toHaveBeenCalledWith('bearerToken');
  });

  it('invokes api key unmask and clear callbacks', async () => {
    const user = userEvent.setup();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: 'stored-key' }}
        preview={emptyPreview}
        maskedSecretFields={{ apiKeyValue: true }}
        onChange={vi.fn()}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    await user.click(screen.getByTestId('grpc-auth-api-key-value-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('apiKeyValue');
    await user.type(screen.getByTestId('grpc-auth-api-key-value'), 'x');
    expect(onUnmaskSecretField).toHaveBeenCalledWith('apiKeyValue');
  });

  it('ignores auth type pill clicks for the active type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'tok' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Bearer Token');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('invokes oauth2 client secret unmask and clear callbacks', async () => {
    const user = userEvent.setup();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'id',
            clientSecret: 'stored',
          },
        }}
        preview={emptyPreview}
        maskedSecretFields={{ oauth2ClientSecret: true }}
        onChange={vi.fn()}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    await user.click(screen.getByTestId('grpc-auth-oauth-client-secret-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('oauth2ClientSecret');
    await user.type(screen.getByTestId('grpc-auth-oauth-client-secret'), 'x');
    expect(onUnmaskSecretField).toHaveBeenCalledWith('oauth2ClientSecret');
  });

  it('shows non-secret conflict values without masking', () => {
    const preview: GrpcAuthPreviewResult = {
      ok: true,
      issues: [],
      conflicts: [{ key: 'x-request-id', manualValue: '', authValue: 'trace-456' }],
      previewEntries: [],
    };
    render(
      <GrpcAuthPanel
        auth={{ type: 'none' }}
        preview={preview}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-conflicts').textContent).toMatch(/x-request-id/);
  });

  it('renders minimal basic, api_key, and oauth2 auth shapes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <GrpcAuthPanel auth={{ type: 'basic' }} preview={emptyPreview} onChange={onChange} />,
    );
    expect((screen.getByTestId('grpc-auth-basic-user') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByTestId('grpc-auth-basic-user'), { target: { value: 'alice' } });

    rerender(
      <GrpcAuthPanel auth={{ type: 'api_key' }} preview={emptyPreview} onChange={onChange} />,
    );
    expect((screen.getByTestId('grpc-auth-api-key-name') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByTestId('grpc-auth-api-key-name'), { target: { value: 'X-API-KEY' } });

    rerender(
      <GrpcAuthPanel auth={{ type: 'oauth2' }} preview={emptyPreview} onChange={onChange} />,
    );
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-token-url'), {
      target: { value: 'https://auth.example.com/token' },
    });
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-client-id'), { target: { value: 'client' } });
    await user.type(screen.getByTestId('grpc-auth-oauth-client-secret'), 'secret');
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-scope'), { target: { value: 'read' } });
    fireEvent.change(screen.getByTestId('grpc-auth-oauth-scope'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('clears auth config when switching to none', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'tok' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'No Auth');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('disables auth type pills and inputs when disabled', () => {
    render(
      <GrpcAuthPanel
        auth={{ type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: 'v' }}
        preview={emptyPreview}
        disabled
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-type-select').querySelector('.cs-trigger')).toHaveProperty('disabled', true);
    expect((screen.getByTestId('grpc-auth-api-key-name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-auth-api-key-value') as HTMLInputElement).disabled).toBe(true);
  });

  it('switches auth type to bearer and edits bearer token', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'none' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Bearer Token');
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer' });
  });

  it('edits bearer token via patchAuth', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: '' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    await user.type(screen.getByTestId('grpc-auth-bearer-token'), 'my-token');
    expect(onChange).toHaveBeenCalled();
  });

  it('masks empty secret conflict values without masking non-secret keys', () => {
    const preview: GrpcAuthPreviewResult = {
      ok: true,
      issues: [],
      conflicts: [
        { key: 'authorization', manualValue: '   ', authValue: 'Bearer new' },
      ],
      previewEntries: [],
    };
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'new' }}
        preview={preview}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-conflicts').textContent).toMatch(/authorization/);
    expect(screen.getByTestId('grpc-auth-conflicts').textContent).not.toMatch(/Bearer new/);
  });

  it('invokes oauth2 secret unmask and clear callbacks', async () => {
    const user = userEvent.setup();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'id',
            clientSecret: 'stored',
          },
        }}
        preview={emptyPreview}
        maskedSecretFields={{ oauth2ClientSecret: true }}
        onChange={vi.fn()}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    await user.click(screen.getByTestId('grpc-auth-oauth-client-secret-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('oauth2ClientSecret');
    await user.type(screen.getByTestId('grpc-auth-oauth-client-secret'), 'x');
    expect(onUnmaskSecretField).toHaveBeenCalledWith('oauth2ClientSecret');
  });

  it('switches auth type to api_key and basic from none', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'none' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'API Key');
    expect(onChange).toHaveBeenCalledWith({ type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: undefined });
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Basic Auth');
    expect(onChange).toHaveBeenCalledWith({ type: 'basic' });
  });

  it('switches auth type to oauth2 from bearer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'tok' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'OAuth 2.0 (Client Credentials)');
    expect(onChange).toHaveBeenCalledWith({
      type: 'oauth2',
      oauth2: { tokenUrl: '', clientId: '', clientSecret: '' },
    });
  });
});
