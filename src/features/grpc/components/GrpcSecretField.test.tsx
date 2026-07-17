/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcSecretField } from './GrpcSecretField';

describe('GrpcSecretField (Phase 4G)', () => {
  it('shows stored hint and clear button when masked with value', () => {
    render(
      <GrpcSecretField
        id="secret"
        label="Token"
        testId="grpc-secret"
        value="hidden-token"
        masked
        onChange={vi.fn()}
        onUnmask={vi.fn()}
        onClearStored={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-secret-stored-hint')).toBeTruthy();
    expect(screen.getByTestId('grpc-secret-clear')).toBeTruthy();
    expect((screen.getByTestId('grpc-secret') as HTMLInputElement).value).toBe('');
  });

  it('unmasks on edit without revealing stored value on focus alone', async () => {
    const user = userEvent.setup();
    const onUnmask = vi.fn();
    const onChange = vi.fn();
    render(
      <GrpcSecretField
        id="secret"
        label="Token"
        testId="grpc-secret"
        value="hidden-token"
        masked
        onChange={onChange}
        onUnmask={onUnmask}
      />,
    );
    await user.click(screen.getByTestId('grpc-secret'));
    expect(onUnmask).not.toHaveBeenCalled();
    expect((screen.getByTestId('grpc-secret') as HTMLInputElement).value).toBe('');

    await user.type(screen.getByTestId('grpc-secret'), 'new');
    expect(onUnmask).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onClearStored when clear button clicked', async () => {
    const user = userEvent.setup();
    const onClearStored = vi.fn();
    render(
      <GrpcSecretField
        id="secret"
        label="Token"
        testId="grpc-secret"
        value="hidden-token"
        masked
        onChange={vi.fn()}
        onUnmask={vi.fn()}
        onClearStored={onClearStored}
      />,
    );
    await user.click(screen.getByTestId('grpc-secret-clear'));
    expect(onClearStored).toHaveBeenCalled();
  });

  it('uses auth form row classes when layout is auth', () => {
    const { container } = render(
      <GrpcSecretField
        id="secret"
        label="Password"
        testId="grpc-secret"
        layout="auth"
        value=""
        masked={false}
        onChange={vi.fn()}
        onUnmask={vi.fn()}
      />,
    );
    expect(container.querySelector('.grpc-secret-field--auth')).toBeTruthy();
    expect(container.querySelector('.grpc-auth-form-row')).toBeTruthy();
    expect(container.querySelector('.grpc-auth-form-label')).toBeTruthy();
    expect(container.querySelector('.grpc-auth-form-ctrl')).toBeTruthy();
    expect(container.querySelector('.grpc-tls-form-row')).toBeNull();
  });

  it('renders multiline textarea placeholders and omits stored aria wiring when value is not stored', () => {
    render(
      <GrpcSecretField
        id="pem"
        label="Client key"
        testId="grpc-secret"
        value=""
        masked={false}
        multiline
        placeholder="Paste PEM"
        onChange={vi.fn()}
        onUnmask={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId('grpc-secret') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('Paste PEM');
    expect(textarea.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByTestId('grpc-secret-stored-hint')).toBeNull();
  });

  it('keeps stored hint for multiline masked values without rendering clear action when no handler exists', () => {
    render(
      <GrpcSecretField
        id="pem"
        label="Client key"
        testId="grpc-secret"
        value="stored-secret"
        masked
        multiline
        onChange={vi.fn()}
        onUnmask={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId('grpc-secret') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('');
    expect(textarea.getAttribute('aria-describedby')).toBe('pem-stored-hint');
    expect(screen.getByTestId('grpc-secret-stored-hint')).toBeTruthy();
    expect(screen.queryByTestId('grpc-secret-clear')).toBeNull();
  });

  it('does not call onUnmask when editing an already unmasked field', async () => {
    const user = userEvent.setup();
    const onUnmask = vi.fn();
    const onChange = vi.fn();

    render(
      <GrpcSecretField
        id="plain"
        label="Token"
        testId="grpc-secret"
        value=""
        masked={false}
        onChange={onChange}
        onUnmask={onUnmask}
      />,
    );

    await user.type(screen.getByTestId('grpc-secret'), 'abc');
    expect(onUnmask).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
  });

  it('toggles between hidden and visible input types', async () => {
    const user = userEvent.setup();
    render(
      <GrpcSecretField
        id="plain"
        label="Token"
        testId="grpc-secret"
        value="abc"
        masked={false}
        onChange={vi.fn()}
        onUnmask={vi.fn()}
      />,
    );

    const input = screen.getByTestId('grpc-secret') as HTMLInputElement;
    expect(input.type).toBe('password');

    await user.click(screen.getByTestId('grpc-secret-toggle-visibility'));
    expect((screen.getByTestId('grpc-secret') as HTMLInputElement).type).toBe('text');

    await user.click(screen.getByTestId('grpc-secret-toggle-visibility'));
    expect((screen.getByTestId('grpc-secret') as HTMLInputElement).type).toBe('password');
  });
});
