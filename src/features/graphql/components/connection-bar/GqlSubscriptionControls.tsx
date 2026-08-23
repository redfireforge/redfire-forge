import type { SubscriptionState } from '@shared/types/graphql';
import { CustomSelect } from '@shared/components/CustomSelect';

export interface GqlSubscriptionControlsProps {
  subscriptionTransport?:         'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  onSubscriptionTransportChange?: (t: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse') => void;
  subscriptionState:              SubscriptionState;
  effectiveTransportIsSSE:        boolean;
  autoDetectsSSE:                 boolean;
  noEndpoint:                     boolean;
  endpointHasUnresolved:          boolean;
  queryEmpty:                     boolean;
  varsInvalid:                    boolean;
  disabled:                       boolean;
  onSubscribe?:                   () => void;
  onStop?:                        () => void;
}

export function GqlSubscriptionControls({
  subscriptionTransport = 'auto',
  onSubscriptionTransportChange,
  subscriptionState,
  effectiveTransportIsSSE,
  autoDetectsSSE,
  noEndpoint,
  endpointHasUnresolved,
  queryEmpty,
  varsInvalid,
  disabled,
  onSubscribe,
  onStop,
}: GqlSubscriptionControlsProps) {
  return (
    <>
      {onSubscriptionTransportChange && (
        <div className="gql-transport-wrap">
          <CustomSelect
            className="gql-transport-select"
            value={subscriptionTransport}
            onChange={(v) => onSubscriptionTransportChange(
              v as 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'
            )}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'graphql-transport-ws', label: 'WS (modern)' },
              { value: 'graphql-ws', label: 'WS (legacy)' },
              { value: 'sse', label: 'SSE' },
            ]}
            disabled={
              subscriptionState === 'connecting' ||
              subscriptionState === 'active' ||
              subscriptionState === 'reconnecting'
            }
            aria-label="Subscription transport protocol"
            data-testid="gql-transport-select"
          />

          {autoDetectsSSE && (
            <span
              className="gql-transport-auto-hint"
              data-testid="gql-transport-auto-hint"
              aria-hidden="true"
              title="Auto-detected: this endpoint ends with /stream — SSE transport will be used"
            >
              → SSE
            </span>
          )}
        </div>
      )}

      {subscriptionState !== 'idle' && (
        <div
          className={`gql-ws-status gql-ws-status--${subscriptionState}`}
          data-testid="gql-ws-status"
          aria-label={`${effectiveTransportIsSSE ? 'SSE' : 'WebSocket'}: ${subscriptionState}`}
        >
          <span className="gql-ws-status-dot" aria-hidden="true" />
          {subscriptionState === 'connecting'   ? 'Connecting…' :
           subscriptionState === 'active'       ? 'Live' :
           subscriptionState === 'reconnecting' ? 'Reconnecting…' :
           subscriptionState === 'error'        ? 'Error' :
           subscriptionState === 'closed'       ? 'Closed' :
           subscriptionState === 'closing'      ? 'Closing…' :
           subscriptionState}
        </div>
      )}

      {(subscriptionState === 'idle' || subscriptionState === 'closed' || subscriptionState === 'error') && (
        <button
          className="gql-btn gql-btn--subscribe"
          onClick={onSubscribe}
          disabled={!onSubscribe || noEndpoint || endpointHasUnresolved || queryEmpty || varsInvalid || disabled}
          data-testid="gql-subscribe-btn"
          type="button"
          aria-label={
            noEndpoint              ? 'Enter an endpoint URL to subscribe'
            : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL to subscribe'
            : queryEmpty            ? 'Enter a subscription query to subscribe'
            : varsInvalid           ? 'Fix invalid JSON in Variables to subscribe'
            : effectiveTransportIsSSE ? 'Subscribe via SSE (⌘ Enter)'
            : 'Subscribe via WebSocket (⌘ Enter)'
          }
          title={
            noEndpoint              ? 'Enter an endpoint URL first'
            : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL first'
            : queryEmpty            ? 'Enter a subscription query first'
            : varsInvalid           ? 'Fix invalid JSON in Variables first'
            : subscriptionState === 'closed' ? 'Re-subscribe (⌘ Enter)'
            : subscriptionState === 'error'  ? 'Retry subscription (⌘ Enter)'
            : 'Subscribe (⌘ Enter)'
          }
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          {subscriptionState === 'closed' ? 'Re-subscribe' :
           subscriptionState === 'error'  ? 'Retry' :
           'Subscribe'}
        </button>
      )}

      {(subscriptionState === 'connecting' || subscriptionState === 'active' || subscriptionState === 'reconnecting') && (
        <button
          className="gql-btn gql-btn--stop-sub"
          onClick={onStop}
          data-testid="gql-stop-sub-btn"
          type="button"
          aria-label="Stop subscription"
          title="Stop subscription"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          Stop
        </button>
      )}
    </>
  );
}
