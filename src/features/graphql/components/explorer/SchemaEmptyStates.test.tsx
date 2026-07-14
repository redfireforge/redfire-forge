/**
 * @vitest-environment jsdom
 * SchemaEmptyStates.test.tsx — unit tests for the schema explorer empty state panels.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SchemaIdleState,
  SchemaLoadingState,
  SchemaErrorState,
  SchemaIntrospectionDisabledState,
} from './SchemaEmptyStates';

describe('SchemaIdleState', () => {
  const onIntrospect = vi.fn();
  beforeEach(() => resetAllMocks());

  it('renders the idle state container', () => {
    render(<SchemaIdleState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByTestId('gql-se-empty-idle')).toBeTruthy();
  });

  it('shows "No schema loaded" title', () => {
    render(<SchemaIdleState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByText(/no schema loaded/i)).toBeTruthy();
  });

  it('renders the Introspect Schema button', () => {
    render(<SchemaIdleState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByTestId('gql-se-idle-introspect-btn')).toBeTruthy();
  });

  it('calls onIntrospect when button is clicked', () => {
    render(<SchemaIdleState onIntrospect={onIntrospect} introspecting={false} />);
    fireEvent.click(screen.getByTestId('gql-se-idle-introspect-btn'));
    expect(onIntrospect).toHaveBeenCalledTimes(1);
  });

  it('disables button while introspecting', () => {
    render(<SchemaIdleState onIntrospect={onIntrospect} introspecting />);
    const btn = screen.getByTestId('gql-se-idle-introspect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('does not render button when onIntrospect is not provided', () => {
    render(<SchemaIdleState introspecting={false} />);
    expect(screen.queryByTestId('gql-se-idle-introspect-btn')).toBeNull();
  });
});

describe('SchemaLoadingState', () => {
  it('renders the loading state container', () => {
    render(<SchemaLoadingState />);
    expect(screen.getByTestId('gql-se-loading')).toBeTruthy();
  });

  it('shows "Loading schema…" title', () => {
    render(<SchemaLoadingState />);
    expect(screen.getByText(/loading schema/i)).toBeTruthy();
  });
});

describe('SchemaErrorState', () => {
  const onIntrospect = vi.fn();
  beforeEach(() => resetAllMocks());

  it('renders the error state container', () => {
    render(<SchemaErrorState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByTestId('gql-se-error')).toBeTruthy();
  });

  it('shows "Introspection failed" title', () => {
    render(<SchemaErrorState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByText(/introspection failed/i)).toBeTruthy();
  });

  it('displays error message', () => {
    render(<SchemaErrorState errorMessage="Connection refused" onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('renders retry button', () => {
    render(<SchemaErrorState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByTestId('gql-se-retry-btn')).toBeTruthy();
  });

  it('calls onIntrospect when retry is clicked', () => {
    render(<SchemaErrorState onIntrospect={onIntrospect} introspecting={false} />);
    fireEvent.click(screen.getByTestId('gql-se-retry-btn'));
    expect(onIntrospect).toHaveBeenCalledTimes(1);
  });

  it('disables retry button while introspecting', () => {
    render(<SchemaErrorState onIntrospect={onIntrospect} introspecting />);
    const btn = screen.getByTestId('gql-se-retry-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('SchemaIntrospectionDisabledState', () => {
  const onIntrospect = vi.fn();
  beforeEach(() => resetAllMocks());

  it('renders the introspection-disabled container', () => {
    render(<SchemaIntrospectionDisabledState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByTestId('gql-se-introspection-disabled')).toBeTruthy();
  });

  it('shows "Introspection disabled" title', () => {
    render(<SchemaIntrospectionDisabledState onIntrospect={onIntrospect} introspecting={false} />);
    expect(screen.getByText(/introspection disabled/i)).toBeTruthy();
  });

  it('displays custom error message', () => {
    render(
      <SchemaIntrospectionDisabledState
        errorMessage="Server has disabled introspection"
        onIntrospect={onIntrospect}
        introspecting={false}
      />,
    );
    expect(screen.getByText('Server has disabled introspection')).toBeTruthy();
  });

  it('renders retry button with warn variant class', () => {
    render(<SchemaIntrospectionDisabledState onIntrospect={onIntrospect} introspecting={false} />);
    const btn = screen.getByTestId('gql-se-retry-btn');
    expect(btn.className).toContain('gql-se-empty-action--warn');
  });

  it('calls onIntrospect when retry is clicked', () => {
    render(<SchemaIntrospectionDisabledState onIntrospect={onIntrospect} introspecting={false} />);
    fireEvent.click(screen.getByTestId('gql-se-retry-btn'));
    expect(onIntrospect).toHaveBeenCalledTimes(1);
  });
});
