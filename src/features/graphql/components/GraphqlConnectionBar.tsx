import { useMemo } from 'react';
import type React from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { GraphqlAuth, GraphqlEnvironment, SubscriptionState } from '@shared/types/graphql';
import type { GlobalAuthProfile } from '@shared/types';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';
import { useGqlPollingPopover } from '../hooks/useGqlPollingPopover';
import { authBadgeLabel, isAuthConfigured, type GqlAuthBadgePresentation } from '../utils/authUtils';
import { findUnresolvedVars } from '../utils/envUtils';
import { GqlPollingPopoverContent } from './connection-bar/GqlPollingPopoverContent';
import { GqlEndpointInput } from './connection-bar/GqlEndpointInput';
import { GqlSubscriptionControls } from './connection-bar/GqlSubscriptionControls';
import { GraphqlTlsPanel } from './GraphqlTlsPanel';
import type { EndpointRowStatus } from '../../environments/utils/protocolEndpointUtils';
import { ProtocolEndpointPreview } from '@shared/components/ProtocolEndpointPreview';

const MAX_ENV_NAME_LEN = 18;

interface GraphqlConnectionBarProps {
  endpoint: string;
  onEndpointChange: (url: string) => void;
  /** Phase 6 PT-5: active tab has a custom endpoint override (not inheriting page default). */
  hasEndpointOverride?: boolean;
  /** Phase 6 PT-5: clear per-tab endpoint override and inherit page default. */
  onClearEndpoint?: () => void;
  onExecute?: () => void;
  onCancel?: () => void;
  onIntrospect?: () => void;
  executing?: boolean;
  introspecting?: boolean;
  schemaStatus?: 'loaded' | 'error' | 'none';
  typesCount?: number;
  schemaPolling?: boolean;
  selectedOperation?: string;
  operations?: string[];
  onSelectOperation?: (name: string) => void;
  varsInvalid?: boolean;
  queryEmpty?: boolean;
  disabled?: boolean;
  fileErrors?: boolean;
  auth?: GraphqlAuth | null;
  /** Phase 6H Slice 7.4: focus the bottom-panel Auth tab when the badge is clicked. */
  onFocusAuthPanel?: () => void;
  /** Phase 6H Slice 4: badge label + variant + scope pill (computed in page). */
  authBadgePresentation?: GqlAuthBadgePresentation;
  /** Global auth profiles — used for auth badge label fallback. */
  globalAuthProfiles?: GlobalAuthProfile[];
  recentEndpoints?: string[];
  onRemoveRecentEndpoint?: (url: string) => void;
  activeEnvName?: string | null;
  onEnvBadgeClick?: () => void;
  /** Live demo: Env modal is not the current step spotlight — badge is inert. */
  envBadgeDemoLocked?: boolean;
  queryValidationErrors?: number;
  profiles?: ConnectionProfile[];
  onProfileBadgeClick?: () => void;
  /** Live demo: Profiles modal is not the current step spotlight — badge is inert. */
  profileBadgeDemoLocked?: boolean;
  skipTlsVerify?: boolean;
  onSkipTlsVerifyChange?: (skip: boolean) => void;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  onTlsSettingsChange?: (patch: Partial<{
    skipTlsVerify: boolean;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  }>) => void;
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  onPollingChange?: (enabled: boolean, intervalSeconds: number) => void;
  /** Phase 6F: active tab has per-tab polling override (not inheriting page default). */
  hasPollingOverride?: boolean;
  /** Phase 6F: clear per-tab polling override and inherit page default. */
  onClearPolling?: () => void;
  activeEnvironment?: GraphqlEnvironment | null;
  globalEnvMap?: Record<string, string>;
  endpointProtocolStatus?: EndpointRowStatus;
  pollErrorMessage?: string | null;
  activeOperationType?: 'query' | 'mutation' | 'subscription' | null;
  subscriptionState?: SubscriptionState;
  onSubscribe?: () => void;
  onStop?: () => void;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  onSubscriptionTransportChange?: (t: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse') => void;
  complexityScore?: number;
  complexityLevel?: 'ok' | 'warn' | 'danger';
  // Phase 3F
  advancedSettingsOpen?: boolean;
  onAdvancedSettingsClick?: () => void;
  advSettingsBtnRef?: React.RefObject<HTMLButtonElement | null>;
  batchEnabled?: boolean;
  batchedTabCount?: number;
  batchExecuting?: boolean;
  /** Phase 6A-8 — checked tabs span different endpoints */
  batchEndpointMismatch?: boolean;
  /** Phase 6A-8 — batched tabs share a usable resolved endpoint */
  batchEndpointReady?: boolean;
  /** Phase 6F — checked batch tab(s) reference profile not yet in catalog */
  batchProfileLinkPending?: boolean;
  /** Phase 6G — summary of configured batch (from Advanced Settings). */
  batchSummaryLabel?: string | null;
  onSendBatch?: () => void;
  apqCacheHit?: boolean;
  apqHash?: string;
  apqUnsupported?: boolean;
  /** Phase 6F: profile link pending — block execute/introspect until catalog resolves. */
  endpointLinkPending?: boolean;
}

export function GraphqlConnectionBar({
  endpoint,
  onEndpointChange,
  hasEndpointOverride = false,
  onClearEndpoint,
  onExecute,
  onCancel,
  onIntrospect,
  executing = false,
  introspecting = false,
  schemaStatus = 'none',
  typesCount,
  schemaPolling = false,
  selectedOperation,
  operations = [],
  onSelectOperation,
  varsInvalid = false,
  queryEmpty = false,
  disabled = false,
  fileErrors = false,
  auth,
  onFocusAuthPanel,
  authBadgePresentation,
  globalAuthProfiles = [],
  recentEndpoints = [],
  onRemoveRecentEndpoint,
  activeEnvName,
  onEnvBadgeClick,
  envBadgeDemoLocked = false,
  queryValidationErrors = 0,
  profiles = [],
  onProfileBadgeClick,
  profileBadgeDemoLocked = false,
  skipTlsVerify = false,
  onSkipTlsVerifyChange,
  tlsCaCert,
  tlsClientCert,
  tlsClientKey,
  onTlsSettingsChange,
  pollingEnabled = false,
  pollingIntervalSeconds = 30,
  onPollingChange,
  hasPollingOverride = false,
  onClearPolling,
  activeEnvironment,
  globalEnvMap,
  endpointProtocolStatus,
  pollErrorMessage,
  activeOperationType,
  subscriptionState = 'idle',
  onSubscribe,
  onStop,
  subscriptionTransport = 'auto',
  onSubscriptionTransportChange,
  complexityScore,
  complexityLevel = 'ok',
  advancedSettingsOpen = false,
  onAdvancedSettingsClick,
  advSettingsBtnRef,
  batchEnabled = false,
  batchedTabCount = 0,
  batchExecuting = false,
  batchEndpointMismatch = false,
  batchEndpointReady = false,
  batchProfileLinkPending = false,
  batchSummaryLabel = null,
  onSendBatch,
  apqCacheHit,
  apqHash,
  apqUnsupported = false,
  endpointLinkPending = false,
}: GraphqlConnectionBarProps) {
  const noEndpoint = !endpoint.trim();

  // Auto-detect SSE transport for /stream endpoints
  const normUrl = endpoint.toLowerCase();
  const autoDetectsSSE = subscriptionTransport === 'auto' &&
    (normUrl.endsWith('/stream') || normUrl.includes('/stream?'));
  const effectiveTransportIsSSE =
    subscriptionTransport === 'sse' || autoDetectsSSE;

  // BUG-GQL-R7-6: detect unresolved {{var}} in endpoint URL
  const unresolvedEndpointVars = findUnresolvedVars(endpoint, activeEnvironment, globalEnvMap);
  const endpointHasUnresolved = unresolvedEndpointVars.length > 0;
  const endpointUnresolvedTooltip = endpointHasUnresolved
    ? unresolvedEndpointVars.map((k) => `'{{${k}}}' not found in active environment`).join('\n')
    : '';

  const executeDisabled = disabled || executing || varsInvalid || queryEmpty || noEndpoint || endpointHasUnresolved || endpointLinkPending || fileErrors || !onExecute;
  const introspectDisabled = disabled || introspecting || noEndpoint || endpointHasUnresolved || endpointLinkPending || !onIntrospect;

  const isHttps = endpoint.toLowerCase().startsWith('https://');

  const polling = useGqlPollingPopover({
    pollingEnabled,
    pollingIntervalSeconds,
    onPollingChange,
  });

  const authLabel = authBadgePresentation?.label ?? authBadgeLabel(auth, globalAuthProfiles);
  const authConfigured = authBadgePresentation?.configured ?? isAuthConfigured(auth, globalAuthProfiles);
  const authBadgeVariant = authBadgePresentation?.variant ?? (authConfigured ? 'default' : 'inherit');
  const authBadgeScope = authBadgePresentation?.scope ?? null;
  const authBadgeClassName = [
    'gql-auth-badge',
    authBadgeVariant === 'inherit' && 'gql-auth-badge--inherit',
    authBadgeVariant === 'override' && 'gql-auth-badge--override',
    authBadgeVariant === 'profile' && 'gql-auth-badge--profile',
    authConfigured && authBadgeVariant !== 'inherit' && authBadgeVariant !== 'profile' && 'gql-auth-badge--configured',
  ].filter(Boolean).join(' ');
  const authScopePillLabel =
    authBadgeScope === 'page' ? 'Page'
      : authBadgeScope === 'tab' ? 'Tab'
        : authBadgeScope === 'profile' ? 'Profile'
          : null;

  const previewEnvMap = useMemo(() => {
    const local: Record<string, string> = {};
    for (const v of activeEnvironment?.variables ?? []) {
      if (v.enabled && v.key.trim()) local[v.key.trim()] = v.value;
    }
    return { ...(globalEnvMap ?? {}), ...local };
  }, [globalEnvMap, activeEnvironment]);

  const pollingPopoverSharedProps = {
    pollingEnabled,
    pollingIntervalSeconds,
    localIntervalSeconds:    polling.localIntervalSeconds,
    setLocalIntervalSeconds: polling.setLocalIntervalSeconds,
    onPollingChange:         onPollingChange!,
    onClose:                 () => polling.closePollingPopoverViaRef.current(),
    commitPollingInterval:   polling.commitPollingInterval,
    hasPollingOverride,
    onClearPolling,
    pollingSwitchRef:        polling.pollingSwitchRef,
    popoverRef:              polling.pollingPopoverRef,
    popoverPos:              polling.pollingPopoverPos,
  };

  return (
    <>
    <div className="gql-connection-bar" data-testid="gql-connection-bar">
      {/* GQL method badge */}
      <span className="gql-method-badge" aria-hidden="true">GQL</span>

      {/* Phase 1D: Profile picker button */}
      {onProfileBadgeClick && (
        <button
          type="button"
          className={`gql-profile-badge${profiles.length > 0 ? ' gql-profile-badge--has-profiles' : ''}${profileBadgeDemoLocked ? ' gql-connection-badge--demo-locked' : ''}`}
          onClick={onProfileBadgeClick}
          disabled={disabled || profileBadgeDemoLocked}
          data-testid="gql-profile-badge"
          title={
            profileBadgeDemoLocked
              ? 'Profiles are locked during this demo step'
              : profiles.length > 0
              ? `${profiles.length} saved profile${profiles.length !== 1 ? 's' : ''} — click to manage`
              : 'No saved profiles — click to save current connection'
          }
          aria-label={
            profileBadgeDemoLocked
              ? 'Profiles locked during demo step'
              : profiles.length > 0
              ? `${profiles.length} saved profile${profiles.length !== 1 ? 's' : ''} — click to manage`
              : 'No saved profiles — click to save current connection'
          }
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {profiles.length > 0 ? (
            <span className="gql-profile-badge-count">{profiles.length}</span>
          ) : (
            <span className="gql-profile-badge-label">Profiles</span>
          )}
        </button>
      )}

      <GqlEndpointInput
        endpoint={endpoint}
        onEndpointChange={onEndpointChange}
        disabled={disabled}
        recentEndpoints={recentEndpoints}
        onRemoveRecentEndpoint={onRemoveRecentEndpoint}
        hasEndpointOverride={hasEndpointOverride}
        onClearEndpoint={onClearEndpoint}
        endpointHasUnresolved={endpointHasUnresolved}
        endpointUnresolvedTooltip={endpointUnresolvedTooltip}
      />

      {/* TLS skip toggle — https:// endpoints only */}
      {isHttps && onSkipTlsVerifyChange && (
        <button
          type="button"
          className={`gql-tls-toggle${skipTlsVerify ? ' gql-tls-toggle--active' : ''}`}
          onClick={() => onSkipTlsVerifyChange(!skipTlsVerify)}
          disabled={disabled}
          data-testid="gql-tls-toggle"
          title={
            skipTlsVerify
              ? 'TLS verification is disabled — click to re-enable (not safe for production)'
              : 'TLS verification enabled — click to disable for self-signed certificates'
          }
          aria-pressed={skipTlsVerify}
          aria-label={skipTlsVerify ? 'TLS verification disabled — click to enable' : 'TLS verification enabled'}
        >
          {skipTlsVerify ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          )}
          <span className="gql-tls-toggle-label">
            {skipTlsVerify ? 'SSL off' : 'SSL'}
          </span>
        </button>
      )}

      {isHttps && onTlsSettingsChange && (
        <GraphqlTlsPanel
          skipTlsVerify={skipTlsVerify}
          caCert={tlsCaCert}
          clientCert={tlsClientCert}
          clientKey={tlsClientKey}
          onTlsChange={onTlsSettingsChange}
          disabled={disabled}
        />
      )}

      {/* Operation selector — multiple named operations only */}
      {operations.length > 1 && (
        <div className="gql-op-selector-wrap">
          <span className="gql-op-selector-label">Executing:</span>
          <CustomSelect
            className="gql-op-selector gql-select"
            value={selectedOperation ?? ''}
            onChange={(v) => onSelectOperation?.(v)}
            options={operations.map((name) => ({ value: name, label: name }))}
            data-testid="gql-op-selector"
            aria-label="Select operation to execute"
          />
        </div>
      )}

      {/* Phase 1E: Environment badge */}
      {onEnvBadgeClick && (
        <button
          type="button"
          className={`gql-env-badge${activeEnvName ? ' gql-env-badge--active' : ''}${envBadgeDemoLocked ? ' gql-connection-badge--demo-locked' : ''}`}
          onClick={onEnvBadgeClick}
          disabled={disabled || envBadgeDemoLocked}
          data-testid="gql-env-badge"
          title={
            envBadgeDemoLocked
              ? 'Environment is locked during this demo step'
              : activeEnvName
              ? `Active environment: ${activeEnvName} — click to manage`
              : 'No environment active — click to set up environment variables'
          }
          aria-label={
            envBadgeDemoLocked
              ? 'Environment locked during demo step'
              : activeEnvName
              ? `Active environment: ${activeEnvName} — click to manage`
              : 'No environment active — click to set up environment variables'
          }
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
          <span className="gql-env-badge-label">
            {activeEnvName
              ? activeEnvName.length > MAX_ENV_NAME_LEN
                ? `${activeEnvName.slice(0, MAX_ENV_NAME_LEN)}…`
                : activeEnvName
              : 'No Env'}
          </span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Auth badge — opens bottom Auth panel (Slice 7.4) */}
      <div className="gql-auth-badge-wrap">
        <button
          type="button"
          className={authBadgeClassName}
          onClick={() => onFocusAuthPanel?.()}
          aria-haspopup="false"
          aria-label={`Authentication: ${authLabel}${authScopePillLabel ? ` (${authScopePillLabel} scope)` : ''} — open Auth panel`}
          data-testid="gql-auth-badge-btn"
          title={`Authentication: ${authLabel}${authScopePillLabel ? ` · ${authScopePillLabel}` : ''} — open Auth panel`}
          disabled={disabled || !onFocusAuthPanel}
        >
          <span className="gql-auth-badge-dot" aria-hidden="true" />
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {authLabel}
          {authScopePillLabel && (
            <span
              className={`gql-auth-badge-scope-pill gql-auth-badge-scope-pill--${authBadgeScope}`}
              data-testid="gql-auth-badge-scope-pill"
            >
              {authScopePillLabel}
            </span>
          )}
        </button>
      </div>

      {/* Introspect button */}
      <button
        className="gql-btn gql-btn--secondary"
        onClick={onIntrospect}
        disabled={introspectDisabled}
        data-testid="gql-introspect-btn"
        type="button"
        aria-label={
          introspecting          ? 'Introspecting schema…'
          : endpointLinkPending  ? 'Waiting for connection profile to load'
          : noEndpoint           ? 'Enter an endpoint URL to introspect'
          : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL to introspect'
          : 'Introspect schema (⌘⇧I)'
        }
        title={
          introspecting          ? 'Introspecting schema…'
          : endpointLinkPending  ? 'Waiting for connection profile to load'
          : noEndpoint           ? 'Enter an endpoint URL first'
          : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL first'
          : 'Fetch and load the GraphQL schema (⌘⇧I)'
        }
      >
        {introspecting ? <span className="gql-btn-spinner" aria-hidden="true" /> : null}
        {introspecting ? 'Introspecting…' : 'Introspect'}
      </button>

      {/* Schema validation warning badge */}
      {queryValidationErrors > 0 && !executing && (
        <span
          className="gql-validation-warning"
          role="status"
          aria-live="polite"
          title={`${queryValidationErrors} schema validation error${queryValidationErrors !== 1 ? 's' : ''} — check editor squiggles`}
          aria-label={`${queryValidationErrors} schema validation error${queryValidationErrors !== 1 ? 's' : ''}`}
          data-testid="gql-validation-warning"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {queryValidationErrors}
        </span>
      )}

      {/* Execute / Subscribe section */}
      {activeOperationType === 'subscription' ? (
        <GqlSubscriptionControls
          subscriptionTransport={subscriptionTransport}
          onSubscriptionTransportChange={onSubscriptionTransportChange}
          subscriptionState={subscriptionState}
          effectiveTransportIsSSE={effectiveTransportIsSSE}
          autoDetectsSSE={autoDetectsSSE}
          noEndpoint={noEndpoint}
          endpointHasUnresolved={endpointHasUnresolved}
          queryEmpty={queryEmpty}
          varsInvalid={varsInvalid}
          disabled={disabled || endpointLinkPending}
          onSubscribe={onSubscribe}
          onStop={onStop}
        />
      ) : (
        <>
          {/* Sprint 7 (2G-2): query complexity cost badge */}
          {complexityScore !== undefined && complexityScore > 0 && !executing && (
            <span
              className={`gql-complexity-badge gql-complexity-badge--${complexityLevel}`}
              data-testid="gql-complexity-badge"
              title={`Estimated query complexity: ${complexityScore}${complexityLevel === 'danger' ? ' — very expensive query, consider simplifying' : complexityLevel === 'warn' ? ' — moderately complex query' : ''}`}
              aria-label={`Query complexity: ${complexityScore}`}
            >
              ≈{complexityScore}
            </span>
          )}

          {executing ? (
            <button
              className="gql-btn gql-btn--cancel"
              onClick={onCancel}
              data-testid="gql-cancel-btn"
              type="button"
              aria-label="Cancel execution (Esc)"
              title="Cancel (Esc)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Cancel
            </button>
          ) : (
            <button
              className="gql-btn gql-btn--primary"
              onClick={onExecute}
              disabled={executeDisabled}
              data-testid="gql-execute-btn"
              type="button"
              aria-label={
                endpointLinkPending   ? 'Waiting for connection profile to load'
                : noEndpoint              ? 'Enter an endpoint URL to execute'
                : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL to execute'
                : queryEmpty            ? 'Enter a query to execute'
                : varsInvalid           ? 'Fix invalid JSON in Variables to execute'
                : fileErrors            ? 'Fix file size errors in the Files tab to execute'
                : 'Execute operation (⌘ Enter)'
              }
              title={
                endpointLinkPending   ? 'Waiting for connection profile to load'
                : noEndpoint              ? 'Enter an endpoint URL first'
                : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL first'
                : queryEmpty            ? 'Enter a query first'
                : varsInvalid           ? 'Fix invalid JSON in Variables first'
                : fileErrors            ? 'Fix file errors in the Files tab first'
                : 'Execute (⌘ Enter)'
              }
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Execute
            </button>
          )}
        </>
      )}

      {/* Schema status indicator + polling config (when schema IS loaded) */}
      {schemaStatus === 'loaded' && (
        <div className="gql-schema-status-wrap">
          <div
            className={`gql-schema-status${pollErrorMessage ? ' gql-schema-status--poll-warn' : ' gql-schema-status--ok'}`}
            data-testid="gql-schema-badge-ok"
            title={pollErrorMessage ? `Last refresh failed: ${pollErrorMessage}` : undefined}
          >
            {schemaPolling ? (
              <span
                className={`gql-polling-dot${pollErrorMessage ? ' gql-polling-dot--warn' : ''}`}
                aria-label={pollErrorMessage ? `Schema polling active — last refresh failed: ${pollErrorMessage}` : 'Schema polling active'}
                title={pollErrorMessage ? `Last refresh failed: ${pollErrorMessage}` : 'Schema polling active'}
              />
            ) : (
              <span className="gql-schema-status-dot" aria-hidden="true" />
            )}
            {pollErrorMessage ? 'Schema stale' : `Schema loaded${typesCount !== undefined ? ` (${typesCount})` : ''}`}
          </div>

          {onPollingChange && (
            <button
              ref={polling.pollingBtnRef}
              type="button"
              className={`gql-polling-config-btn${pollingEnabled ? ' gql-polling-config-btn--active' : ''}`}
              onClick={() => {
                if (polling.pollingOpen) {
                  polling.closePollingPopoverViaRef.current();
                } else {
                  polling.setPollingOpen(true);
                }
              }}
              aria-expanded={polling.pollingOpen}
              aria-haspopup="dialog"
              data-testid="gql-polling-config-btn"
              title={pollingEnabled ? `Auto-refresh every ${pollingIntervalSeconds}s — click to configure` : 'Enable auto-refresh (schema polling)'}
              aria-label={pollingEnabled ? `Auto-refresh every ${pollingIntervalSeconds}s — click to configure` : 'Enable auto-refresh (schema polling)'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}

          {polling.pollingOpen && onPollingChange && (
            <GqlPollingPopoverContent
              {...pollingPopoverSharedProps}
              intervalInputId="gql-polling-interval"
            />
          )}
        </div>
      )}

      {/* Schema error badge */}
      {schemaStatus === 'error' && (
        <div className="gql-schema-status gql-schema-status--error" data-testid="gql-schema-badge-error">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Schema error
        </div>
      )}

      {/* Polling config button when schema NOT loaded but polling is active */}
      {pollingEnabled && schemaStatus !== 'loaded' && onPollingChange && (
        <div className="gql-schema-status-wrap">
          <button
            ref={polling.pollingBtnRef}
            type="button"
            className="gql-polling-config-btn gql-polling-config-btn--active"
            onClick={() => {
              if (polling.pollingOpen) {
                polling.closePollingPopoverViaRef.current();
              } else {
                polling.setPollingOpen(true);
              }
            }}
            aria-expanded={polling.pollingOpen}
            aria-haspopup="dialog"
            data-testid="gql-polling-config-btn-standalone"
            title={`Auto-refresh every ${pollingIntervalSeconds}s — click to configure`}
            aria-label={`Auto-refresh every ${pollingIntervalSeconds}s — click to configure`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>

          {polling.pollingOpen && (
            <GqlPollingPopoverContent
              {...pollingPopoverSharedProps}
              intervalInputId="gql-polling-interval-standalone"
              data-testid="gql-polling-popover"
            />
          )}
        </div>
      )}

      {/* Phase 3F: APQ cache-hit/miss badge */}
      {apqHash && (
        <span
          className={`gql-apq-badge${apqCacheHit ? ' gql-apq-badge--hit' : apqUnsupported ? ' gql-apq-badge--unsupported' : ' gql-apq-badge--miss'}`}
          title={apqUnsupported ? `APQ not supported by server (hash: ${apqHash})` : `APQ hash: ${apqHash}`}
          aria-label={apqCacheHit ? `APQ cache hit: ${apqHash.slice(0, 16)}…` : apqUnsupported ? 'APQ unsupported by server' : `APQ cache miss: ${apqHash.slice(0, 16)}…`}
        >
          {apqCacheHit ? `APQ hit: ${apqHash.slice(0, 16)}…` : apqUnsupported ? 'APQ unsupported' : `APQ miss: ${apqHash.slice(0, 16)}…`}
        </span>
      )}

      {/* Phase 6G: batch summary from Advanced Settings configuration */}
      {batchEnabled && batchSummaryLabel && (
        <span
          className="gql-batch-summary-chip"
          data-testid="gql-batch-summary-chip"
          title="Configured in Advanced Settings → Batch"
        >
          {batchSummaryLabel}
        </span>
      )}

      {/* Phase 3F: Send Batch button */}
      {batchEnabled && batchedTabCount >= 2 && (
        <button
          type="button"
          className={`gql-btn gql-btn--batch${batchEndpointMismatch ? ' gql-btn--batch-mismatch' : ''}`}
          disabled={batchExecuting || batchEndpointMismatch || !batchEndpointReady}
          onClick={onSendBatch}
          data-testid="gql-send-batch-btn"
          aria-label={
            batchProfileLinkPending
              ? 'Send batch disabled: waiting for connection profile to load'
              : batchEndpointMismatch
              ? 'Send batch disabled: checked tabs span different endpoints'
              : `Send batch of ${batchedTabCount} operations`
          }
          title={
            batchProfileLinkPending
              ? 'Waiting for connection profile to load on a checked tab'
              : batchEndpointMismatch
              ? 'Checked tabs use different endpoints — batch requires endpoint parity'
              : `Send ${batchedTabCount} operations in one batch request`
          }
        >
          {batchExecuting ? 'Batching…' : `Send Batch (${batchedTabCount})`}
        </button>
      )}

      {/* Phase 3F: Advanced settings gear button */}
      {onAdvancedSettingsClick && (
        <button
          ref={advSettingsBtnRef ?? undefined}
          type="button"
          className={`gql-adv-settings-btn${advancedSettingsOpen ? ' gql-adv-settings-btn--active' : ''}`}
          onClick={onAdvancedSettingsClick}
          aria-label="Advanced query settings (APQ, batch, dedup, complexity gate)"
          aria-expanded={advancedSettingsOpen}
          aria-haspopup="dialog"
          data-testid="gql-adv-settings-btn"
          title="Advanced settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      )}
    </div>
    <ProtocolEndpointPreview
      draftUrl={endpoint}
      envVarMap={previewEnvMap}
      protocolRowStatus={endpointProtocolStatus}
      testId="gql-endpoint-preview"
      className="gql-endpoint-preview-row"
    />
    </>
  );
}
