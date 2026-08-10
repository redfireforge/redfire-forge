/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../test-utils/customSelectHelper';
import { GraphqlAuthPanel } from './GraphqlAuthPanel';

describe('GraphqlAuthPanel', () => {
  const baseProps = {
    storedAuth: null as const,
    resolvedPreview: 'No auth headers',
    authScope: 'tab' as const,
    onChange: vi.fn(),
  };

  it('renders panel with preview footer', () => {
    render(<GraphqlAuthPanel {...baseProps} />);
    expect(screen.getByTestId('gql-auth-panel')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-panel-scroll')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-preview')).toHaveTextContent('No auth headers');
  });

  it('shows inherit banner when tab inherits workspace auth', () => {
    render(
      <GraphqlAuthPanel
        {...baseProps}
        storedAuth={undefined}
        authScope="tab"
        hasAuthOverride={false}
      />,
    );
    expect(screen.getByTestId('gql-auth-inherit-banner')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-switch-override-btn')).toBeTruthy();
  });

  it('calls onChange when switch to explicit override is clicked', () => {
    const onChange = vi.fn();
    render(
      <GraphqlAuthPanel
        {...baseProps}
        storedAuth={undefined}
        authScope="tab"
        hasAuthOverride={false}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-auth-switch-override-btn'));
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer', token: '' });
  });

  it('shows reset link when tab has auth override', () => {
    const onReset = vi.fn();
    render(
      <GraphqlAuthPanel
        {...baseProps}
        storedAuth={{ type: 'bearer', token: 'x' }}
        authScope="tab"
        hasAuthOverride
        onResetToInherit={onReset}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-auth-reset-inherit-btn'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('shows page scope banner when editing page default auth', () => {
    render(
      <GraphqlAuthPanel
        {...baseProps}
        storedAuth={{ type: 'bearer', token: 'page' }}
        authScope="page"
      />,
    );
    expect(screen.getByTestId('gql-auth-page-scope-banner')).toBeTruthy();
    expect(screen.queryByTestId('gql-auth-inherit-banner')).toBeNull();
  });

  it('allows selecting inherit profile without switch-to-override when tab inherits workspace', () => {
    const onChange = vi.fn();
    const profiles = [{ id: 'p1', name: 'Staging', auth: { type: 'bearer' as const, token: 't' } }];
    render(
      <GraphqlAuthPanel
        storedAuth={undefined}
        resolvedPreview="Authorization: Bearer page"
        authScope="tab"
        hasAuthOverride={false}
        onChange={onChange}
        globalAuthProfiles={profiles}
        defaultAuthProfileId="p1"
      />,
    );
    selectOption(screen.getByTestId('gql-auth-type-select'), 'Inherit from Auth Profile');
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'p1' });
  });
});
