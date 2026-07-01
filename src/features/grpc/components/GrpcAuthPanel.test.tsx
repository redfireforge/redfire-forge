/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcAuthPanel } from './GrpcAuthPanel';
import type { GrpcAuthPreviewResult } from '../utils/grpcAuthPreview';

const emptyPreview: GrpcAuthPreviewResult = {
  ok: true,
  issues: [],
  conflicts: [],
  previewEntries: [],
};

describe('GrpcAuthPanel (Phase 4C)', () => {
  it('switches auth type via pills (Phase 4J-B)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GrpcAuthPanel
        auth={undefined}
        preview={emptyPreview}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('grpc-auth-type-pills')).toBeTruthy();
    await user.click(screen.getByTestId('grpc-auth-type-pill-bearer'));
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer' });
  });

  it('shows active pill for configured auth type (Phase 4J-B)', () => {
    render(
      <GrpcAuthPanel
        auth={{ type: 'bearer', bearerToken: 'tok' }}
        preview={emptyPreview}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-auth-type-pill-bearer').className).toContain('active');
    expect(screen.getByTestId('grpc-auth-bearer-token')).toBeTruthy();
  });

  it('shows oauth2 server-side notice when configured (Phase 4D)', () => {
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
      ok: true,
      issues: [],
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
