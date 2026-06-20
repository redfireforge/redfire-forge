/**
 * @vitest-environment jsdom
 *
 * GqlSubscriptionControls — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GqlSubscriptionControls } from './GqlSubscriptionControls';

function defaultProps(overrides = {}) {
  return {
    subscriptionTransport: 'auto' as const,
    onSubscriptionTransportChange: vi.fn(),
    subscriptionState: 'idle' as const,
    effectiveTransportIsSSE: false,
    autoDetectsSSE: false,
    noEndpoint: false,
    endpointHasUnresolved: false,
    queryEmpty: false,
    varsInvalid: false,
    disabled: false,
    onSubscribe: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  };
}

describe('GqlSubscriptionControls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders Subscribe button when idle', () => {
    render(<GqlSubscriptionControls {...defaultProps()} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toBeInTheDocument();
  });

  it('renders Re-subscribe button when state=closed', () => {
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'closed' as const })} />);
    expect(screen.getByText('Re-subscribe')).toBeInTheDocument();
  });

  it('renders Retry button when state=error', () => {
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'error' as const })} />);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders Stop button when state=active', () => {
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'active' as const })} />);
    expect(screen.getByTestId('gql-stop-sub-btn')).toBeInTheDocument();
  });

  it('renders Stop button when state=connecting', () => {
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'connecting' as const })} />);
    expect(screen.getByTestId('gql-stop-sub-btn')).toBeInTheDocument();
  });

  it('calls onSubscribe when Subscribe is clicked', () => {
    const onSubscribe = vi.fn();
    render(<GqlSubscriptionControls {...defaultProps({ onSubscribe })} />);
    fireEvent.click(screen.getByTestId('gql-subscribe-btn'));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when Stop is clicked', () => {
    const onStop = vi.fn();
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'active' as const, onStop })} />);
    fireEvent.click(screen.getByTestId('gql-stop-sub-btn'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables Subscribe when noEndpoint=true', () => {
    render(<GqlSubscriptionControls {...defaultProps({ noEndpoint: true })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toBeDisabled();
  });

  it('disables Subscribe when queryEmpty=true', () => {
    render(<GqlSubscriptionControls {...defaultProps({ queryEmpty: true })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toBeDisabled();
  });

  it('shows transport selector', () => {
    render(<GqlSubscriptionControls {...defaultProps()} />);
    expect(screen.getByTestId('gql-transport-select')).toBeInTheDocument();
  });

  it('calls onSubscriptionTransportChange on select change', () => {
    const onChange = vi.fn();
    render(<GqlSubscriptionControls {...defaultProps({ onSubscriptionTransportChange: onChange })} />);
    fireEvent.change(screen.getByTestId('gql-transport-select'), { target: { value: 'sse' } });
    expect(onChange).toHaveBeenCalledWith('sse');
  });

  it('shows SSE auto-detect hint when autoDetectsSSE=true', () => {
    render(<GqlSubscriptionControls {...defaultProps({ autoDetectsSSE: true })} />);
    expect(screen.getByTestId('gql-transport-auto-hint')).toBeInTheDocument();
  });

  it('does not show SSE auto-detect hint when false', () => {
    render(<GqlSubscriptionControls {...defaultProps({ autoDetectsSSE: false })} />);
    expect(screen.queryByTestId('gql-transport-auto-hint')).toBeNull();
  });

  it('disables Subscribe when endpointHasUnresolved=true', () => {
    render(<GqlSubscriptionControls {...defaultProps({ endpointHasUnresolved: true })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toBeDisabled();
  });

  it('disables Subscribe when varsInvalid=true', () => {
    render(<GqlSubscriptionControls {...defaultProps({ varsInvalid: true })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toBeDisabled();
  });

  it('shows aria-label with endpointHasUnresolved message', () => {
    render(<GqlSubscriptionControls {...defaultProps({ endpointHasUnresolved: true })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Resolve environment variables'),
    );
  });

  it('shows aria-label with varsInvalid message', () => {
    render(<GqlSubscriptionControls {...defaultProps({ varsInvalid: true })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Fix invalid JSON'),
    );
  });

  it('shows status pill when subscriptionState is not idle', () => {
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'active' as const })} />);
    expect(screen.getByTestId('gql-ws-status')).toBeInTheDocument();
  });

  it('disables transport selector while active', () => {
    render(<GqlSubscriptionControls {...defaultProps({ subscriptionState: 'active' as const })} />);
    expect(screen.getByTestId('gql-transport-select')).toBeDisabled();
  });

  it('hides transport selector when no onSubscriptionTransportChange provided', () => {
    render(<GqlSubscriptionControls {...defaultProps({ onSubscriptionTransportChange: undefined })} />);
    expect(screen.queryByTestId('gql-transport-select')).toBeNull();
  });
});
