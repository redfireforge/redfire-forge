import type { SubscriptionState } from '../../../../shared/types/graphql';

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
          <select
            className="gql-transport-select"
            value={subscriptionTransport}
            onChange={(e) => onSubscriptionTransportChange(
              e.target.value as 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'
            )}
            disabled={
              subscriptionState === 'connecting' ||
              subscriptionState === 'active' ||
              subscriptionState === 'reconnecting'
            }
            aria-label="Subscription transport protocol"
            data-testid="gql-transport-select"
            title={
              autoDetectsSSE
                ? 'Auto mode: this endpoint matches the /stream convention — SSE (graphql-sse) will be used automatically. Override below if needed.'
                : 'Subscription transport: Auto (WS by default, SSE for /stream URLs), WS modern (graphql-transport-ws), WS legacy (graphql-ws), or SSE (graphql-sse)'
            }
          >
            <option value="auto">Auto</option>
            <option value="graphql-transport-ws">WS (modern)</option>
            <option value="graphql-ws">WS (legacy)</option>
            <option value="sse">SSE</option>
          </select>

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
