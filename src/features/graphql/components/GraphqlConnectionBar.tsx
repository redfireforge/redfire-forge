/**
 * GraphqlConnectionBar — the horizontal bar at the top of the GraphQL Studio.
 *
 * Phase 1A: endpoint URL input + Execute (disabled) + Introspect (disabled).
 * Phase 1B: schema introspection, schema status badge, polling indicator.
 * Phase 1C: execute handler, operation-name selector, Cancel button.
 * Phase 1D: GQL method badge, auth badge + popover, recent endpoints dropdown.
 * Phase 1E: env badge button (opens environment manager modal).
 * Phase 1 Gap: TLS skip toggle, schema polling config popover.
 */

import { useEffect, useRef, useState } from 'react';
import type { GraphqlAuth, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';
import { authBadgeLabel, isAuthConfigured } from '../utils/authUtils';
import { findUnresolvedVars } from '../utils/envUtils';
import { GraphqlAuthPopover } from './GraphqlAuthPopover';

const MAX_ENV_NAME_LEN = 18;
const MIN_POLL_SECONDS = 10;
const MAX_POLL_SECONDS = 3600;

interface GraphqlConnectionBarProps {
  endpoint: string;
  onEndpointChange: (url: string) => void;
  onExecute?: () => void;
  /** Called when the user clicks the Cancel button (visible while executing) */
  onCancel?: () => void;
  onIntrospect?: () => void;
  executing?: boolean;
  introspecting?: boolean;
  /** Shown as a badge next to the URL when schema is loaded */
  schemaStatus?: 'loaded' | 'error' | 'none';
  /** Number of types in the loaded schema — shown in the schema badge */
  typesCount?: number;
  /** True when schema polling is active (shows a pulsing green dot) */
  schemaPolling?: boolean;
  /** Currently selected operation name (for multi-operation documents) */
  selectedOperation?: string;
  /** All named operations in the current document (empty if only one or anonymous) */
  operations?: string[];
  onSelectOperation?: (name: string) => void;
  /** True when variables JSON is invalid — disables Execute and shows a tooltip */
  varsInvalid?: boolean;
  /** True when the active tab's query is empty/whitespace — disables Execute */
  queryEmpty?: boolean;
  disabled?: boolean;
  /** Phase 1D: current auth config (null = no auth) */
  auth?: GraphqlAuth | null;
  /** BUG-1D-V1 fix: null means "No Auth" — clears the auth config */
  onAuthChange?: (auth: GraphqlAuth | null) => void;
  /** Phase 1D: recent endpoints list for the autocomplete dropdown */
  recentEndpoints?: string[];
  onRemoveRecentEndpoint?: (url: string) => void;
  /** Phase 1E: active environment name (null = no active env) */
  activeEnvName?: string | null;
  /** Phase 1E: opens the environment manager modal */
  onEnvBadgeClick?: () => void;
  /** Phase 1C addition: number of schema validation errors in the current query (0 = clean) */
  queryValidationErrors?: number;
  /** Phase 1D addition: saved connection profiles for the profile picker */
  profiles?: ConnectionProfile[];
  /** Phase 1D addition: opens the connection profiles modal */
  onProfileBadgeClick?: () => void;
  /** Phase 1 Gap: TLS certificate verification skip toggle */
  skipTlsVerify?: boolean;
  onSkipTlsVerifyChange?: (skip: boolean) => void;
  /** Phase 1 Gap: schema polling configuration */
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  onPollingChange?: (enabled: boolean, intervalSeconds: number) => void;
  /** BUG-GQL-R7-6: active environment for detecting unresolved {{var}} in the endpoint URL */
  activeEnvironment?: GraphqlEnvironment | null;
  /** BUG-GQL-R8-9: non-null when a background schema poll refresh has failed */
  pollErrorMessage?: string | null;
}

export function GraphqlConnectionBar({
  endpoint,
  onEndpointChange,
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
  auth,
  onAuthChange,
  recentEndpoints = [],
  onRemoveRecentEndpoint,
  activeEnvName,
  onEnvBadgeClick,
  queryValidationErrors = 0,
  profiles = [],
  onProfileBadgeClick,
  skipTlsVerify = false,
  onSkipTlsVerifyChange,
  pollingEnabled = false,
  pollingIntervalSeconds = 30,
  onPollingChange,
  activeEnvironment,
  pollErrorMessage,
}: GraphqlConnectionBarProps) {
  const noEndpoint = !endpoint.trim();

  // BUG-GQL-R7-6 fix: detect unresolved {{var}} references in the endpoint URL.
  // Headers already show per-row warnings; the URL input was silently ignored.
  // A request to literal "https://{{host}}/graphql" produces a network error with
  // no inline hint — surfacing it here prevents confusing connection failures.
  const unresolvedEndpointVars = findUnresolvedVars(endpoint, activeEnvironment);
  const endpointHasUnresolved = unresolvedEndpointVars.length > 0;
  const endpointUnresolvedTooltip = endpointHasUnresolved
    ? unresolvedEndpointVars.map((k) => `'{{${k}}}' not found in active environment`).join('\n')
    : '';

  // BUG-GQL-R8-10 fix: block Execute when endpoint has unresolved {{var}} references.
  // BUG-GQL-R9-8 fix: also block Introspect — it makes the same HTTP request to the same endpoint.
  // BUG-GQL-R12-6 fix: also block Execute when query is empty — prevents silent no-op
  const executeDisabled = disabled || executing || varsInvalid || queryEmpty || noEndpoint || endpointHasUnresolved || !onExecute;
  const introspectDisabled = disabled || introspecting || noEndpoint || endpointHasUnresolved || !onIntrospect;

  // ── TLS skip toggle — only relevant for https:// endpoints ────────────────
  const isHttps = endpoint.toLowerCase().startsWith('https://');

  // ── Polling config popover ────────────────────────────────────────────────
  const [pollingOpen, setPollingOpen] = useState(false);
  const [localIntervalSeconds, setLocalIntervalSeconds] = useState(pollingIntervalSeconds);
  const pollingBtnRef = useRef<HTMLButtonElement>(null);
  const pollingPopoverRef = useRef<HTMLDivElement>(null);
  const pollingSwitchRef = useRef<HTMLButtonElement>(null);

  // Always-fresh refs so that effect closures never see stale state values.
  const localIntervalSecondsRef = useRef(localIntervalSeconds);
  localIntervalSecondsRef.current = localIntervalSeconds;
  const pollingEnabledRef = useRef(pollingEnabled);
  pollingEnabledRef.current = pollingEnabled;
  const onPollingChangeRef = useRef(onPollingChange);
  onPollingChangeRef.current = onPollingChange;

  // Commit the current (potentially uncommitted) interval to the parent.
  // Reads local state; safe to call directly in React event handlers.
  // BUG-GQL-R10-26 fix: read pollingEnabled from ref, not the render-closure value.
  // Without this, toggling polling off then immediately blurring the interval field
  // could commit with the stale `enabled: true` from the previous render.
  const commitPollingInterval = () => {
    const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSecondsRef.current));
    setLocalIntervalSeconds(clamped);
    onPollingChangeRef.current?.(pollingEnabledRef.current, clamped);
    return clamped;
  };

  // Close popover AND persist any uncommitted interval edit. Reads from refs
  // so it always sees the freshest values even when invoked from a stale effect closure.
  // This prevents the "typed a value + pressed Escape → change silently discarded" UX trap.
  // Also restores focus to the trigger button for accessibility (Escape should return focus).
  const closePollingPopoverViaRef = useRef<() => void>(() => setPollingOpen(false));
  closePollingPopoverViaRef.current = () => {
    if (pollingEnabledRef.current) {
      const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSecondsRef.current));
      setLocalIntervalSeconds(clamped);
      onPollingChangeRef.current?.(pollingEnabledRef.current, clamped);
    }
    setPollingOpen(false);
    // Return focus to the button that opened the popover (a11y: Escape key convention)
    requestAnimationFrame(() => pollingBtnRef.current?.focus());
  };

  // Sync local interval state when prop changes
  useEffect(() => { setLocalIntervalSeconds(pollingIntervalSeconds); }, [pollingIntervalSeconds]);

  // Move focus to the toggle switch when popover opens
  useEffect(() => {
    if (pollingOpen) {
      requestAnimationFrame(() => pollingSwitchRef.current?.focus());
    }
  }, [pollingOpen]);

  // Close polling popover on outside click or Escape.
  // Calls closePollingPopoverViaRef.current() to always use the freshest state
  // even though the effect closure only runs when pollingOpen changes.
  useEffect(() => {
    if (!pollingOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        pollingPopoverRef.current &&
        !pollingPopoverRef.current.contains(e.target as Node) &&
        !pollingBtnRef.current?.contains(e.target as Node)
      ) {
        closePollingPopoverViaRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closePollingPopoverViaRef.current(); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [pollingOpen]);

  // ── Auth popover ─────────────────────────────────────────────────────────
  const [authOpen, setAuthOpen] = useState(false);
  const authBadgeRef = useRef<HTMLButtonElement>(null);

  const authLabel = authBadgeLabel(auth);
  const authConfigured = isAuthConfigured(auth);

  // ── Recent endpoints dropdown ────────────────────────────────────────────
  const [endpointFocused, setEndpointFocused] = useState(false);
  const endpointWrapRef = useRef<HTMLDivElement>(null);

  // Show recent dropdown when: input is focused AND there are recent endpoints to show
  const showRecent = endpointFocused && recentEndpoints.length > 0;

  return (
    <div className="gql-connection-bar" data-testid="gql-connection-bar">
      {/* GQL method badge */}
      <span className="gql-method-badge" aria-hidden="true">GQL</span>

      {/* Phase 1D: Profile picker button — shows saved profile count */}
      {onProfileBadgeClick && (
        <button
          type="button"
          className={`gql-profile-badge${profiles.length > 0 ? ' gql-profile-badge--has-profiles' : ''}`}
          onClick={onProfileBadgeClick}
          disabled={disabled}
          data-testid="gql-profile-badge"
          title={
            profiles.length > 0
              ? `${profiles.length} saved profile${profiles.length !== 1 ? 's' : ''} — click to manage`
              : 'No saved profiles — click to save current connection'
          }
          aria-label={
            profiles.length > 0
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

      {/* Endpoint URL with recent endpoints dropdown */}
      {/* BUG-P1-R1-1 fix: removed redundant inline style={{ position: 'relative' }} —
          .gql-connection-url-wrap already has position: relative in graphql-studio.css */}
      <div
        className="gql-connection-url-wrap"
        ref={endpointWrapRef}
      >
        <input
          type="text"
          className="gql-connection-url gql-input"
          value={endpoint}
          onChange={(e) => onEndpointChange(e.target.value)}
          onFocus={() => setEndpointFocused(true)}
          onBlur={(e) => {
            // Close only if focus leaves the URL wrap entirely (not moving to a dropdown item)
            if (!endpointWrapRef.current?.contains(e.relatedTarget as Node)) {
              setEndpointFocused(false);
            }
          }}
          placeholder="https://api.example.com/graphql"
          spellCheck={false}
          disabled={disabled}
          data-testid="gql-endpoint-input"
          aria-label="GraphQL endpoint URL"
          aria-autocomplete="list"
          aria-expanded={showRecent}
        />

        {/* BUG-GQL-R7-6 fix: warn when endpoint URL has unresolved {{var}} references */}
        {endpointHasUnresolved && (
          <span
            className="gql-endpoint-unresolved-icon"
            title={endpointUnresolvedTooltip}
            aria-label={endpointUnresolvedTooltip}
            data-testid="gql-endpoint-unresolved-icon"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        )}

        {/* Recent endpoints dropdown */}
        {showRecent && (
          <ul
            className="gql-recent-endpoints"
            role="listbox"
            aria-label="Recent endpoints"
            data-testid="gql-recent-endpoints"
            onMouseDown={(e) => e.preventDefault()} // prevent blur on click
          >
            {recentEndpoints.map((url) => (
              <li
                key={url}
                className="gql-recent-endpoint-item"
                role="option"
                aria-selected={url === endpoint}
              >
                <button
                  type="button"
                  className="gql-recent-endpoint-btn"
                  onClick={() => {
                    onEndpointChange(url);
                    setEndpointFocused(false);
                  }}
                  title={url}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="12 8 12 12 14 14" />
                    <path d="M3.05 11a9 9 0 1 0 .5-4.08" />
                    <polyline points="3 3 3 9 9 9" />
                  </svg>
                  <span className="gql-recent-endpoint-url">{url}</span>
                </button>
                {onRemoveRecentEndpoint && (
                  <button
                    type="button"
                    className="gql-recent-endpoint-remove"
                    onClick={() => onRemoveRecentEndpoint(url)}
                    aria-label={`Remove ${url} from recent endpoints`}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Phase 1 Gap: TLS skip toggle — only visible for https:// endpoints */}
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
          {/* Shield with slash when disabled, plain shield when enabled */}
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

      {/* Operation selector — shown only when document has multiple named operations */}
      {operations.length > 1 && (
        <div className="gql-op-selector-wrap">
          <span className="gql-op-selector-label">Executing:</span>
          <select
            className="gql-op-selector gql-select"
            value={selectedOperation}
            onChange={(e) => onSelectOperation?.(e.target.value)}
            data-testid="gql-op-selector"
            aria-label="Select operation to execute"
          >
            {operations.map((name, idx) => (
              <option key={`${name}-${idx}`} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Phase 1E: Environment badge — opens env manager modal */}
      {onEnvBadgeClick && (
        <button
          type="button"
          className={`gql-env-badge${activeEnvName ? ' gql-env-badge--active' : ''}`}
          onClick={onEnvBadgeClick}
          disabled={disabled}
          data-testid="gql-env-badge"
          title={
            activeEnvName
              ? `Active environment: ${activeEnvName} — click to manage`
              : 'No environment active — click to set up environment variables'
          }
          aria-label={
            activeEnvName
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

      {/* Auth badge — opens auth config popover */}
      {/* BUG-1D-R4-21 fix: removed inline style={{ position: 'relative' }} — now in CSS class */}
      <div className="gql-auth-badge-wrap">
        {/* BUG-1D-R4-19 fix: added explicit aria-label for screen readers */}
        <button
          ref={authBadgeRef}
          type="button"
          className={`gql-auth-badge${authConfigured ? ' gql-auth-badge--configured' : ''}`}
          onClick={() => setAuthOpen((o) => !o)}
          aria-expanded={authOpen}
          aria-haspopup="dialog"
          aria-label={`Authentication: ${authLabel} — click to configure`}
          data-testid="gql-auth-badge-btn"
          title={`Authentication: ${authLabel}`}
          disabled={disabled}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {authLabel}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Auth popover — BUG-1D-V2 fix: pass null directly (not the fallback bearer object) */}
        {authOpen && onAuthChange && (
          <GraphqlAuthPopover
            auth={auth ?? null}
            onChange={onAuthChange}
            onClose={() => setAuthOpen(false)}
            anchorRef={authBadgeRef}
          />
        )}
      </div>

      {/* Introspect button (Phase 1B) */}
      <button
        className="gql-btn gql-btn--secondary"
        onClick={onIntrospect}
        disabled={introspectDisabled}
        data-testid="gql-introspect-btn"
        type="button"
        aria-label={
          introspecting ? 'Introspecting schema…'
          : noEndpoint ? 'Enter an endpoint URL to introspect'
          : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL to introspect'
          : 'Introspect schema (⌘⇧I)'
        }
        title={
          introspecting ? 'Introspecting schema…'
          : noEndpoint ? 'Enter an endpoint URL first'
          : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL first'
          : 'Fetch and load the GraphQL schema (⌘⇧I)'
        }
      >
        {introspecting ? (
          <span className="gql-btn-spinner" aria-hidden="true" />
        ) : null}
        {introspecting ? 'Introspecting…' : 'Introspect'}
      </button>

      {/* Phase 1C addition: schema validation warning badge — shown when query has errors */}
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

      {/* Execute / Cancel button (Phase 1C) */}
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
            noEndpoint ? 'Enter an endpoint URL to execute'
            : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL to execute'
            : queryEmpty ? 'Enter a query to execute'
            : varsInvalid ? 'Fix invalid JSON in Variables to execute'
            : 'Execute operation (⌘ Enter)'
          }
          title={
            noEndpoint ? 'Enter an endpoint URL first'
            : endpointHasUnresolved ? 'Resolve environment variables in endpoint URL first'
            : queryEmpty ? 'Enter a query first'
            : varsInvalid ? 'Fix invalid JSON in Variables first'
            : 'Execute (⌘ Enter)'
          }
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Execute
        </button>
      )}

      {/* Schema status indicator + polling config */}
      {/* BUG-R2-1 fix: polling dot REPLACES the static dot (not shown alongside it) */}
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
            {/* BUG-GQL-R8-9 fix: show non-blocking warning when poll refresh fails */}
            {pollErrorMessage ? 'Schema stale' : `Schema loaded${typesCount !== undefined ? ` (${typesCount})` : ''}`}
          </div>

          {/* Phase 1 Gap: Schema polling config button */}
          {onPollingChange && (
            <button
              ref={pollingBtnRef}
              type="button"
              className={`gql-polling-config-btn${pollingEnabled ? ' gql-polling-config-btn--active' : ''}`}
              onClick={() => {
                if (pollingOpen) {
                  // Closing via button click: commit any pending interval edit
                  closePollingPopoverViaRef.current();
                } else {
                  setPollingOpen(true);
                }
              }}
              aria-expanded={pollingOpen}
              aria-haspopup="dialog"
              data-testid="gql-polling-config-btn"
              title={pollingEnabled ? `Auto-refresh every ${pollingIntervalSeconds}s — click to configure` : 'Enable auto-refresh (schema polling)'}
              aria-label={pollingEnabled ? `Auto-refresh every ${pollingIntervalSeconds}s — click to configure` : 'Enable auto-refresh (schema polling)'}
            >
              {/* Clock/refresh icon */}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}

          {/* Schema polling config popover */}
          {pollingOpen && onPollingChange && (
            <div
              ref={pollingPopoverRef}
              className="gql-polling-popover"
              role="dialog"
              aria-modal="true"
              aria-label="Schema polling configuration"
              data-testid="gql-polling-popover"
            >
              <div className="gql-polling-popover-header">
                <span>Auto-refresh schema</span>
                <button
                  type="button"
                  className="gql-polling-popover-close"
                  onClick={() => closePollingPopoverViaRef.current()}
                  aria-label="Close polling config"
                >×</button>
              </div>
              <div className="gql-polling-popover-body">
                {/* BUG-R5 fix: use <div> + onClick instead of <label> wrapping <button>.
                    Clicking a <label> only activates input-type controls, not buttons. */}
                <div
                  className="gql-polling-toggle-row"
                  onClick={() => {
                    const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSeconds || 30));
                    setLocalIntervalSeconds(clamped);
                    onPollingChange(!pollingEnabled, clamped);
                  }}
                  role="none"
                >
                  <span className="gql-polling-toggle-label">Enable polling</span>
                  <button
                    ref={pollingSwitchRef}
                    type="button"
                    role="switch"
                    aria-checked={pollingEnabled}
                    className={`gql-polling-switch${pollingEnabled ? ' gql-polling-switch--on' : ''}`}
                    onClick={(e) => {
                      // Prevent the row's onClick from firing twice (event bubbles up)
                      e.stopPropagation();
                      const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSeconds || 30));
                      setLocalIntervalSeconds(clamped);
                      onPollingChange(!pollingEnabled, clamped);
                    }}
                    data-testid="gql-polling-toggle"
                    aria-label="Enable schema polling"
                  >
                    <span className="gql-polling-switch-thumb" />
                  </button>
                </div>

                {pollingEnabled && (
                  <div className="gql-polling-interval-row">
                    <label className="gql-polling-interval-label" htmlFor="gql-polling-interval">
                      Refresh every
                    </label>
                    <input
                      id="gql-polling-interval"
                      type="number"
                      className="gql-input gql-polling-interval-input"
                      value={localIntervalSeconds}
                      min={MIN_POLL_SECONDS}
                      max={MAX_POLL_SECONDS}
                      onChange={(e) => setLocalIntervalSeconds(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      onBlur={commitPollingInterval}
                      onKeyDown={(e) => {
                        e.stopPropagation(); // prevent global keyboard shortcuts while typing
                        if (e.key === 'Enter') { commitPollingInterval(); }
                      }}
                      data-testid="gql-polling-interval-input"
                    />
                    <span className="gql-polling-interval-unit">s</span>
                  </div>
                )}

                {/* BUG-R2 fix: show effective clamped value, not the raw (possibly 0) localIntervalSeconds */}
                <p className="gql-polling-hint">
                  {pollingEnabled
                    ? `Schema re-introspected every ${Math.max(MIN_POLL_SECONDS, localIntervalSeconds)}s. Only updated when SDL changes.`
                    : 'Automatically re-introspect the schema on a timer.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {schemaStatus === 'error' && (
        <div className="gql-schema-status gql-schema-status--error" data-testid="gql-schema-badge-error">
          {/* BUG-GQL-R6-2 fix: use SVG warning icon for visual consistency with the OK badge */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Schema error
        </div>
      )}

      {/* BUG-GQL-R19-2 fix: show polling config when polling is active but schema
          is not in 'loaded' state, so users can turn off unwanted background requests.
          When schema IS loaded, the button renders inside the schema-status-wrap above. */}
      {pollingEnabled && schemaStatus !== 'loaded' && onPollingChange && (
        <button
          ref={pollingBtnRef}
          type="button"
          className="gql-polling-config-btn gql-polling-config-btn--active"
          onClick={() => {
            if (pollingOpen) {
              closePollingPopoverViaRef.current();
            } else {
              setPollingOpen(true);
            }
          }}
          aria-expanded={pollingOpen}
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
      )}
    </div>
  );
}
