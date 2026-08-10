/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('GrpcAuthPanel (Phase 4C)', () => {
  it('switches auth type via dropdown (GraphQL-style)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={undefined}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('grpc-auth-type-select')).toBeTruthy();
    expect(screen.getByTestId('grpc-auth-no-auth-hint')).toBeTruthy();
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Bearer Token');
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer' });
  });

  it('shows bearer fields when bearer is selected', () => {
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'tok' }}
        preview={emptyPreview}
        onChange={vi.fn()}
      />,
    );
    expect(getCustomSelectValue(screen.getByTestId('grpc-auth-type-select'))).toBe('Bearer Token');
    expect(screen.getByTestId('grpc-auth-bearer-token')).toBeTruthy();
  });

  it('shows page default banner when requested', () => {
    render(
      <GrpcAuthPanel
        auth={undefined}
        preview={emptyPreview}
        showPageDefaultBanner
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-page-scope-banner').textContent).toMatch(/page default/i);
  });

  it('offers inherit from auth profile when compatible profiles exist', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={undefined}
        preview={emptyPreview}
        globalAuthProfiles={[
          { id: 'prof-1', name: 'Demo Bearer', auth: { type: 'bearer', token: 'secret-token' } },
        ]}
        defaultAuthProfileId="prof-1"
        onChange={onChange}
      />,
    );
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Inherit from Auth Profile');
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'prof-1' });
  });

  it('shows oauth2 info box when configured (Phase 4D)', () => {
    const preview: GrpcAuthPreviewResult = {
      ok: true,
      issues: [],
      conflicts: [],
      previewEntries: [{ key: 'authorization', value: '••••••' }],
    };
    render(
      <GrpcAuthPanel
        auth={{
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'id',
            clientSecret: 'secret',
          },
        }}
        preview={preview}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-oauth-notice').textContent).toMatch(/server-side/i);
    expect(screen.getByTestId('grpc-auth-oauth-scope')).toBeTruthy();
  });

  it('shows conflict banner when auth overrides manual metadata', () => {
    const preview: GrpcAuthPreviewResult = {
      ok: false,
      issues: [{ field: 'auth', code: 'GRPC_INVALID_REQUEST', message: 'Auth metadata conflicts with manual metadata for key(s): authorization' }],
      conflicts: [{ key: 'authorization', manualValue: 'Bearer old', authValue: 'Bearer new' }],
      previewEntries: [{ key: 'authorization', value: '••••••' }],
    };
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'new' }}
        preview={preview}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-conflicts').textContent).toMatch(/authorization/i);
    expect(screen.getByTestId('grpc-auth-conflicts').textContent).toMatch(/••••••/);
    expect(screen.getByTestId('grpc-auth-conflicts').textContent).toMatch(/send is blocked/i);
    expect(screen.getByTestId('grpc-auth-preview')).toBeTruthy();
  });

  it('emits auth changes when bearer token is edited', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: '' }}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    await user.type(screen.getByTestId('grpc-auth-bearer-token'), 'tok');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows masked bearer token stored hint (Phase 4G)', () => {
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'stored' }}
        preview={emptyPreview}
        maskedSecretFields={{ bearerToken: true }}
        onChange={vi.fn()}
        onUnmaskSecretField={vi.fn()}
        onClearSecretField={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-bearer-token-stored-hint')).toBeTruthy();
    expect(screen.getByTestId('grpc-auth-bearer-token-clear')).toBeTruthy();
  });
});
