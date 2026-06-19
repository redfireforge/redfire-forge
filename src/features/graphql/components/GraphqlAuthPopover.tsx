/**
 * GraphqlAuthPopover — Phase 1D
 *
 * Floating popover for configuring GraphQL request authentication.
 * Triggered by clicking the auth badge in GraphqlConnectionBar.
 *
 * Supported types:
 *   • None      — no headers added (saves null to parent)
 *   • Bearer    — Authorization: Bearer <token>
 *   • Basic     — Authorization: Basic base64(user:pass)
 *   • API Key   — <Custom-Header>: <value>
 *   • OAuth 2.0 — read-only; OAuth token injection is a Phase 3 feature
 *   • Custom    — read-only; user manages headers in the Headers panel
 *
 * Bug fixes (re-evaluation round 1):
 *   - BUG-1D-V1/V2: onChange now accepts null for "No Auth"; auth prop accepts null
 *   - BUG-1D-V3: Escape handler calls stopPropagation to prevent double-firing cancel-execution
 *   - BUG-1D-V4: Popover anchored right: 0 (right-edge) to prevent viewport overflow
 *   - BUG-1D-V5: Added aria-modal="true" to the dialog
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import type { GraphqlAuth } from '../../../shared/types/graphql';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlAuthPopoverProps {
  /** null when no auth is configured */
  auth: GraphqlAuth | null;
  /** null means "No Auth" — parent should clear its auth state */
  onChange: (auth: GraphqlAuth | null) => void;
  onClose: () => void;
  /** Anchor element — popover is positioned below this element */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

// ─── Auth type sentinel + options ─────────────────────────────────────────────

const AUTH_TYPE_NONE = 'none' as const;
type SelectableAuthType = GraphqlAuth['type'] | typeof AUTH_TYPE_NONE;

const AUTH_TYPES: Array<{ value: SelectableAuthType; label: string; disabled?: boolean }> = [
  { value: AUTH_TYPE_NONE, label: 'No Auth' },
  { value: 'bearer',       label: 'Bearer Token' },
  { value: 'basic',        label: 'Basic Auth' },
  { value: 'apiKey',       label: 'API Key' },
  { value: 'oauth2',       label: 'OAuth 2.0 (Phase 3 — coming soon)', disabled: true },
  { value: 'custom',       label: 'Custom (Headers Panel)' },
];

// ─── Password visibility toggle ───────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder,
  testId,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
  /** Optional ref forwarded to the underlying <input> element for auto-focus */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="gql-auth-pw-wrap">
      {/* BUG-P1-R4-1 fix: set id={testId} so <label htmlFor="..."> associations work.
          testId doubles as both the HTML id and the data-testid — no new prop needed. */}
      <input
        ref={inputRef}
        id={testId}
        type={visible ? 'text' : 'password'}
        className="gql-input gql-auth-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        data-testid={testId}
      />
      <button
        type="button"
        className="gql-auth-pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        title={visible ? 'Hide' : 'Show'}
      >
        {visible ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Popover ─────────────────────────────────────────────────────────────────

export function GraphqlAuthPopover({ auth, onChange, onClose, anchorRef }: GraphqlAuthPopoverProps) {
  const popoverRef   = useRef<HTMLDivElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  // Refs for first credential field in each auth type — used for auto-focus
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // BUG-S5-OVERFLOW fix: use position:fixed so the popover escapes any overflow:auto parent
  // (the connection bar has overflow-x:auto which implicitly sets overflow-y:auto, causing
  //  auto-scroll that displaces absolutely-positioned children).
  const [fixedPos, setFixedPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    function recalc() {
      if (!anchorRef?.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setFixedPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [anchorRef]);

  // Derive selected type for the dropdown — null auth means 'none'
  const selectedType: SelectableAuthType = auth?.type ?? AUTH_TYPE_NONE;

  // BUG-R2-3 / BUG-R3-2 fix: smart auto-focus on mount.
  // If auth is already configured → focus the first credential field (saves one Tab).
  // If no auth configured (null) → focus the type selector so user can pick a type.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (auth && auth.type !== undefined) {
        // Auth is configured — jump straight to the credential field
        (firstFieldRef.current ?? typeSelectRef.current)?.focus();
      } else {
        // No auth yet — direct the user to pick a type
        typeSelectRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only: captures initial auth to set focus once

  // BUG-R3-5 fix: after the user picks a type, auto-focus the first credential field.
  // Tracks the previous type to distinguish mount (handled above) from user-driven changes.
  const prevTypeRef = useRef<SelectableAuthType>(selectedType);
  useEffect(() => {
    const prev = prevTypeRef.current;
    prevTypeRef.current = selectedType;
    // Skip on mount (prev === selectedType at first render)
    if (prev === selectedType) return;
    // Type changed — focus first credential field if there is one, else type selector
    if (selectedType !== AUTH_TYPE_NONE) {
      const raf = requestAnimationFrame(() =>
        (firstFieldRef.current ?? typeSelectRef.current)?.focus()
      );
      return () => cancelAnimationFrame(raf);
    }
  }, [selectedType]);

  // Close when clicking outside the popover
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        anchorRef?.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  const handleEscapeClose = useCallback(() => {
    anchorRef?.current?.focus();
    onClose();
  }, [onClose, anchorRef]);

  useModalEscapeClose(handleEscapeClose, { capture: true });

  function handleTypeChange(type: SelectableAuthType) {
    if (type === AUTH_TYPE_NONE) {
      // BUG-1D-V1 fix: signal "No Auth" with null — parent clears its auth state
      onChange(null);
      return;
    }
    if (!auth || auth.type !== type) {
      const base = { ...auth, type } as GraphqlAuth;
      if (type === 'apiKey' && !base.headerName) {
        base.headerName = 'X-API-Key';
      }
      onChange(base);
    }
  }

  // BUG-R3-3 fix: cleaner preview text — no misleading base64 with "***" for Basic Auth
  function preview(): string {
    if (!auth) return 'No authentication headers will be added';
    switch (auth.type) {
      case 'bearer': {
        const t = auth.token?.trim() ?? '';
        return t
          ? `Authorization: Bearer ${t.slice(0, 24)}${t.length > 24 ? '…' : ''}`
          : 'Token not set — no header will be added';
      }
      case 'basic': {
        const u = auth.username?.trim() ?? '';
        return u
          ? `Authorization: Basic ••• (${u}:••••••)`
          : 'Username not set — no header will be added';
      }
      case 'apiKey': {
        const n = auth.headerName?.trim() ?? '';
        const v = auth.headerValue ?? '';
        if (!n) return 'Header name not set — no header will be added';
        return `${n}: ${v ? '•••' : '(empty value)'}`;
      }
      case 'oauth2':
        return 'Token injected via pre-request script (Phase 3)';
      case 'custom':
        return 'Custom headers added via the Headers panel';
      default:
        return 'No authentication headers will be added';
    }
  }

  return (
    <div
      ref={popoverRef}
      className="gql-auth-popover"
      style={fixedPos ? { top: fixedPos.top, right: fixedPos.right } : { visibility: 'hidden' }}
      role="dialog"
      aria-label="Authentication configuration"
      aria-modal="true"
      data-testid="gql-auth-popover"
    >
      {/* Header */}
      <div className="gql-auth-popover-header">
        <span className="gql-auth-popover-title">Authentication</span>
        {/* BUG-1D-R4-20 fix: restore focus to trigger button on explicit close */}
        <button
          type="button"
          className="gql-auth-popover-close"
          onClick={() => { anchorRef?.current?.focus(); onClose(); }}
          aria-label="Close authentication settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Type selector + credential fields */}
      <div className="gql-auth-popover-body">
        <div className="gql-auth-field">
          <label className="gql-auth-label" htmlFor="gql-auth-type-select">Type</label>
          <select
            ref={typeSelectRef}
            id="gql-auth-type-select"
            className="gql-select gql-auth-type-select"
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value as SelectableAuthType)}
            data-testid="gql-auth-type-select"
          >
            {AUTH_TYPES.map((t) => (
              <option key={t.value} value={t.value} disabled={t.disabled}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* BUG-R3-1 fix: "No Auth" guidance message — body was empty before */}
        {selectedType === AUTH_TYPE_NONE && (
          <div className="gql-auth-no-auth-hint">
            No authentication headers will be sent.
            Select a type above to add credentials.
          </div>
        )}

        {/* Bearer Token */}
        {auth?.type === 'bearer' && (
          <div className="gql-auth-field">
            <label className="gql-auth-label" htmlFor="gql-auth-bearer-input">Token</label>
            <PasswordInput
              value={auth.token ?? ''}
              onChange={(v) => onChange({ ...auth, token: v })}
              placeholder="Enter bearer token…"
              testId="gql-auth-bearer-input"
              inputRef={firstFieldRef}
            />
          </div>
        )}

        {/* Basic Auth */}
        {auth?.type === 'basic' && (
          <>
            <div className="gql-auth-field">
              <label className="gql-auth-label" htmlFor="gql-auth-basic-user">Username</label>
              <input
                id="gql-auth-basic-user"
                ref={firstFieldRef}
                type="text"
                className="gql-input gql-auth-input"
                value={auth.username ?? ''}
                onChange={(e) => onChange({ ...auth, username: e.target.value })}
                placeholder="username"
                autoComplete="off"
                spellCheck={false}
                data-testid="gql-auth-basic-user"
              />
            </div>
            <div className="gql-auth-field">
              <label className="gql-auth-label" htmlFor="gql-auth-basic-pass">Password</label>
              <PasswordInput
                value={auth.password ?? ''}
                onChange={(v) => onChange({ ...auth, password: v })}
                placeholder="password"
                testId="gql-auth-basic-pass"
              />
            </div>
          </>
        )}

        {/* API Key */}
        {auth?.type === 'apiKey' && (
          <>
            <div className="gql-auth-field">
              <label className="gql-auth-label" htmlFor="gql-auth-apikey-name">Header</label>
              <input
                id="gql-auth-apikey-name"
                ref={firstFieldRef}
                type="text"
                className="gql-input gql-auth-input"
                value={auth.headerName ?? 'X-API-Key'}
                onChange={(e) => onChange({ ...auth, headerName: e.target.value })}
                placeholder="X-API-Key"
                autoComplete="off"
                spellCheck={false}
                data-testid="gql-auth-apikey-name"
              />
            </div>
            <div className="gql-auth-field">
              <label className="gql-auth-label" htmlFor="gql-auth-apikey-val">Value</label>
              <PasswordInput
                value={auth.headerValue ?? ''}
                onChange={(v) => onChange({ ...auth, headerValue: v })}
                placeholder="API key value"
                testId="gql-auth-apikey-val"
              />
            </div>
          </>
        )}

        {/* OAuth 2.0 — read-only message */}
        {auth?.type === 'oauth2' && (
          <div className="gql-auth-info-box">
            OAuth 2.0 token injection is handled by pre-request scripts (Phase 3).
            Use <strong>Bearer Token</strong> type if you already have an access token.
          </div>
        )}

        {/* Custom — read-only message */}
        {auth?.type === 'custom' && (
          <div className="gql-auth-info-box">
            Add your custom authentication headers directly in the
            <strong> Headers</strong> panel below the query editor.
          </div>
        )}
      </div>

      {/* Preview footer — shows what header will be injected */}
      <div className="gql-auth-popover-footer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <code className="gql-auth-preview">{preview()}</code>
      </div>
    </div>
  );
}
