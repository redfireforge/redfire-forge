/**
 * @vitest-environment jsdom
 *
 * GraphqlAuthPopover.test.tsx — unit tests for the authentication popover component.
 * Tests rendering, type switching, credential inputs, preview text, and close behavior.
 */
import { render, fireEvent, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { GraphqlAuthPopover } from './GraphqlAuthPopover';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import React from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAnchorRef() {
  const el = document.createElement('button');
  document.body.appendChild(el);
  const ref = { current: el } as React.RefObject<HTMLElement>;
  return ref;
}

function renderPopover(auth: GraphqlAuth | null, onChange = vi.fn(), onClose = vi.fn()) {
  const anchorRef = makeAnchorRef();
  const result = render(
    <GraphqlAuthPopover
      auth={auth}
      onChange={onChange}
      onClose={onClose}
      anchorRef={anchorRef}
    />,
  );
  return { ...result, onChange, onClose, anchorRef };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('GraphqlAuthPopover — rendering', () => {
  it('renders the popover dialog with correct role', () => {
    renderPopover(null);
    expect(screen.getByTestId('gql-auth-popover')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders the type selector dropdown', () => {
    renderPopover(null);
    expect(screen.getByTestId('gql-auth-type-select')).toBeTruthy();
  });

  it('renders close button', () => {
    renderPopover(null);
    expect(screen.getByLabelText('Close authentication settings')).toBeTruthy();
  });

  it('shows "No Auth" as selected when auth is null', () => {
    renderPopover(null);
    const select = screen.getByTestId('gql-auth-type-select') as HTMLSelectElement;
    expect(select.value).toBe('none');
  });

  it('shows "bearer" as selected when auth.type is bearer', () => {
    renderPopover({ type: 'bearer', token: 'tok' });
    const select = screen.getByTestId('gql-auth-type-select') as HTMLSelectElement;
    expect(select.value).toBe('bearer');
  });

  it('shows "basic" as selected when auth.type is basic', () => {
    renderPopover({ type: 'basic', username: 'user', password: 'pass' });
    const select = screen.getByTestId('gql-auth-type-select') as HTMLSelectElement;
    expect(select.value).toBe('basic');
  });

  it('shows "apiKey" as selected when auth.type is apiKey', () => {
    renderPopover({ type: 'apiKey', headerName: 'X-Api-Key', headerValue: 'val' });
    const select = screen.getByTestId('gql-auth-type-select') as HTMLSelectElement;
    expect(select.value).toBe('apiKey');
  });

  it('renders all auth type options', () => {
    renderPopover(null);
    const select = screen.getByTestId('gql-auth-type-select') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['none', 'bearer', 'basic', 'apiKey', 'oauth2', 'custom']);
  });

  it('shows no-auth hint when type is none', () => {
    renderPopover(null);
    expect(screen.getByText(/No authentication headers will be sent/)).toBeTruthy();
  });
});

// ─── Type switching ───────────────────────────────────────────────────────────

describe('GraphqlAuthPopover — type switching', () => {
  it('calls onChange(null) when switching to "No Auth"', () => {
    const onChange = vi.fn();
    renderPopover({ type: 'bearer', token: 'tok' }, onChange);
    const select = screen.getByTestId('gql-auth-type-select');
    fireEvent.change(select, { target: { value: 'none' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with new auth object when switching from null to bearer', () => {
    const onChange = vi.fn();
    renderPopover(null, onChange);
    const select = screen.getByTestId('gql-auth-type-select');
    fireEvent.change(select, { target: { value: 'bearer' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'bearer' }));
  });

  it('calls onChange with basic type when switching to basic', () => {
    const onChange = vi.fn();
    renderPopover(null, onChange);
    const select = screen.getByTestId('gql-auth-type-select');
    fireEvent.change(select, { target: { value: 'basic' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'basic' }));
  });

  it('does not call onChange when selecting the same type', () => {
    const onChange = vi.fn();
    renderPopover({ type: 'bearer', token: 'tok' }, onChange);
    const select = screen.getByTestId('gql-auth-type-select');
    fireEvent.change(select, { target: { value: 'bearer' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets default headerName when switching to apiKey from scratch', () => {
    const onChange = vi.fn();
    renderPopover(null, onChange);
    const select = screen.getByTestId('gql-auth-type-select');
    fireEvent.change(select, { target: { value: 'apiKey' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apiKey', headerName: 'X-API-Key' }),
    );
  });
});

// ─── Bearer token input ───────────────────────────────────────────────────────

describe('GraphqlAuthPopover — bearer token input', () => {
  it('renders token input when auth type is bearer', () => {
    renderPopover({ type: 'bearer', token: 'mytoken' });
    expect(screen.getByTestId('gql-auth-bearer-input')).toBeTruthy();
  });

  it('calls onChange with updated token', () => {
    const onChange = vi.fn();
    renderPopover({ type: 'bearer', token: 'old' }, onChange);
    const input = screen.getByTestId('gql-auth-bearer-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new-token' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ token: 'new-token' }));
  });

  it('shows preview text for bearer auth with token', () => {
    renderPopover({ type: 'bearer', token: 'abc123' });
    expect(screen.getByText(/Authorization: Bearer/)).toBeTruthy();
  });

  it('shows "Token not set" preview when bearer token is empty', () => {
    renderPopover({ type: 'bearer', token: '' });
    expect(screen.getByText(/Token not set/)).toBeTruthy();
  });

  it('truncates long token in preview', () => {
    renderPopover({ type: 'bearer', token: 'a'.repeat(30) });
    const preview = screen.getByText(/Authorization: Bearer/);
    // Long token should be truncated with ellipsis
    expect(preview.textContent).toContain('…');
  });
});

// ─── Basic auth inputs ────────────────────────────────────────────────────────

describe('GraphqlAuthPopover — basic auth inputs', () => {
  it('renders username and password inputs', () => {
    renderPopover({ type: 'basic', username: 'user', password: 'pass' });
    expect(screen.getByTestId('gql-auth-basic-user')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-basic-pass')).toBeTruthy();
  });

  it('calls onChange with updated username', () => {
    const onChange = vi.fn();
    renderPopover({ type: 'basic', username: 'old', password: '' }, onChange);
    const input = screen.getByTestId('gql-auth-basic-user') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'newuser' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ username: 'newuser' }));
  });

  it('calls onChange with updated password', () => {
    const onChange = vi.fn();
    renderPopover({ type: 'basic', username: 'u', password: 'old' }, onChange);
    const input = screen.getByTestId('gql-auth-basic-pass') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'newpass' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ password: 'newpass' }));
  });

  it('shows basic auth preview when username is set', () => {
    renderPopover({ type: 'basic', username: 'alice', password: 'secret' });
    expect(screen.getByText(/Authorization: Basic/)).toBeTruthy();
  });

  it('shows "Username not set" preview when username is empty', () => {
    renderPopover({ type: 'basic', username: '', password: '' });
    expect(screen.getByText(/Username not set/)).toBeTruthy();
  });
});

// ─── API Key inputs ───────────────────────────────────────────────────────────

describe('GraphqlAuthPopover — apiKey inputs', () => {
  it('renders header name and value inputs', () => {
    renderPopover({ type: 'apiKey', headerName: 'X-Key', headerValue: 'val' });
    expect(screen.getByTestId('gql-auth-apikey-name')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-apikey-val')).toBeTruthy();
  });

  it('calls onChange with updated header name', () => {
    const onChange = vi.fn();
    renderPopover({ type: 'apiKey', headerName: 'X-Old', headerValue: 'v' }, onChange);
    const input = screen.getByTestId('gql-auth-apikey-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'X-New-Key' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerName: 'X-New-Key' }));
  });

  it('shows apiKey preview text', () => {
    renderPopover({ type: 'apiKey', headerName: 'X-Key', headerValue: 'secret' });
    expect(screen.getByText(/X-Key/)).toBeTruthy();
  });

  it('shows "Header name not set" when headerName is empty', () => {
    renderPopover({ type: 'apiKey', headerName: '', headerValue: '' });
    expect(screen.getByText(/Header name not set/)).toBeTruthy();
  });

  it('shows (empty value) when headerValue is empty', () => {
    renderPopover({ type: 'apiKey', headerName: 'X-Key', headerValue: '' });
    expect(screen.getByText(/empty value/)).toBeTruthy();
  });
});

// ─── OAuth2 and custom (read-only) ────────────────────────────────────────────

describe('GraphqlAuthPopover — read-only auth types', () => {
  it('shows oauth2 read-only info', () => {
    renderPopover({ type: 'oauth2' });
    expect(screen.getByText(/pre-request scripts/i)).toBeTruthy();
  });

  it('shows custom read-only info', () => {
    renderPopover({ type: 'custom' });
    expect(screen.getByText(/custom authentication headers/i)).toBeTruthy();
  });
});

// ─── Close behavior ───────────────────────────────────────────────────────────

describe('GraphqlAuthPopover — close behavior', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderPopover(null, vi.fn(), onClose);
    fireEvent.click(screen.getByLabelText('Close authentication settings'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderPopover(null, vi.fn(), onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking outside the popover', () => {
    const onClose = vi.fn();
    renderPopover(null, vi.fn(), onClose);
    // Click somewhere outside the popover
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── PasswordInput visibility toggle ─────────────────────────────────────────

describe('GraphqlAuthPopover — password visibility toggle', () => {
  it('token input starts as password type (hidden)', () => {
    renderPopover({ type: 'bearer', token: 'mytoken' });
    const input = screen.getByTestId('gql-auth-bearer-input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('toggles token input to text type when show button is clicked', () => {
    renderPopover({ type: 'bearer', token: 'mytoken' });
    const toggleBtn = screen.getByLabelText('Show value');
    fireEvent.click(toggleBtn);
    const input = screen.getByTestId('gql-auth-bearer-input') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('toggle button label changes to "Hide value" after revealing', () => {
    renderPopover({ type: 'bearer', token: 'mytoken' });
    fireEvent.click(screen.getByLabelText('Show value'));
    expect(screen.getByLabelText('Hide value')).toBeTruthy();
  });
});

// ─── Additional coverage for apiKey value and default preview ─────────────────

describe('GraphqlAuthPopover — additional apiKey coverage', () => {
  it('calls onChange with updated header value', () => {
    const onChange = vi.fn();
    render(<GraphqlAuthPopover
      auth={{ type: 'apiKey', headerName: 'X-API-Key', headerValue: 'oldval' }}
      onChange={onChange}
      onClose={vi.fn()}
    />);
    const valueInput = screen.getByTestId('gql-auth-apikey-val');
    fireEvent.change(valueInput, { target: { value: 'newval' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerValue: 'newval' }));
  });

  it('shows no-auth preview for null auth type', () => {
    render(<GraphqlAuthPopover auth={null} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/No authentication headers will be added/i)).toBeTruthy();
  });

  it('preview default branch with unknown auth type falls back gracefully', () => {
    const anchorRef = makeAnchorRef();
    render(<GraphqlAuthPopover
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth={{ type: 'unknownType' as any }}
      onChange={vi.fn()}
      onClose={vi.fn()}
      anchorRef={anchorRef}
    />);
    expect(screen.getByText(/No authentication headers will be added/i)).toBeTruthy();
  });

  it('mount-time requestAnimationFrame focus path executes when auth is set', () => {
    vi.useFakeTimers();
    const anchorRef = makeAnchorRef();
    render(<GraphqlAuthPopover
      auth={{ type: 'bearer', token: 'tok123' }}
      onChange={vi.fn()}
      onClose={vi.fn()}
      anchorRef={anchorRef}
    />);
    vi.runAllTimers();
    vi.useRealTimers();
    // If no error thrown, the RAF callback ran successfully
    expect(screen.getByTestId('gql-auth-bearer-input')).toBeTruthy();
  });

  it('mount-time requestAnimationFrame focus path executes when auth is null', () => {
    vi.useFakeTimers();
    const anchorRef = makeAnchorRef();
    render(<GraphqlAuthPopover auth={null} onChange={vi.fn()} onClose={vi.fn()} anchorRef={anchorRef} />);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(screen.getByText(/No authentication headers will be added/i)).toBeTruthy();
  });

  it('type change requestAnimationFrame focus path executes on type switch', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const anchorRef = makeAnchorRef();
    render(<GraphqlAuthPopover auth={null} onChange={onChange} onClose={vi.fn()} anchorRef={anchorRef} />);
    const typeSelect = screen.getByTestId('gql-auth-type-select');
    fireEvent.change(typeSelect, { target: { value: 'bearer' } });
    vi.runAllTimers();
    vi.useRealTimers();
    expect(onChange).toHaveBeenCalled();
  });
});
