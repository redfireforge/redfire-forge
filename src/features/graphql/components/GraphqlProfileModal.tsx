/**
 * GraphqlProfileModal — Phase 1D addition.
 *
 * Modal for managing named connection profiles (endpoint + auth combos).
 *
 * Layout (single panel):
 *   Header     — "Connection Profiles" title + × close
 *   Section 1  — Saved profiles list (empty state if none)
 *                Each row: name | endpoint (truncated) | auth badge | Load | Delete
 *   Section 2  — "Save current as…" inline form: name input + Save button
 *
 * Design rules:
 *   - Modal overlay: background: transparent (per project convention)
 *   - Escape key closes
 *   - Click outside panel closes
 *   - No duplicate close buttons — only × in header
 */

import { useEffect, useRef, useState } from 'react';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';
import { authBadgeLabel, isAuthConfigured } from '../utils/authUtils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlProfileModalProps {
  profiles: ConnectionProfile[];
  currentEndpoint: string;
  currentAuth: GraphqlAuth | null | undefined;
  onClose: () => void;
  onSave: (name: string) => void;
  onLoad: (profile: ConnectionProfile) => void;
  onDelete: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateEndpoint(url: string, maxLen = 42): string {
  if (url.length <= maxLen) return url;
  const start = url.slice(0, 22);
  const end = url.slice(-16);
  return `${start}…${end}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlProfileModal({
  profiles,
  currentEndpoint,
  currentAuth,
  onClose,
  onSave,
  onLoad,
  onDelete,
}: GraphqlProfileModalProps) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // BUG-R1-5 fix: brief "✓ Saved" flash after saving a profile
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BUG-R1-4 fix: only auto-focus the name input when there are no profiles.
  // When profiles exist, the user's primary action is "Load", not "Save",
  // so auto-focusing the Save input at the bottom forces them to Tab back up.
  //
  // BUG-R2-2 fix: when profiles exist, focus the modal panel itself (tabIndex=-1)
  // so keyboard users can immediately Tab to the first Load button without needing
  // to Tab back into the dialog from the connection bar button.
  useEffect(() => {
    if (profiles.length === 0) {
      nameInputRef.current?.focus();
    } else {
      panelRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG-P1-R5-1 fix: use document capture phase (same as GraphqlEnvModal / GraphqlAuthPopover).
  // The main page registers a window bubble-phase listener for Escape → cancel().
  // Capture phase fires BEFORE bubble phase, so the modal's handler runs first and
  // stopPropagation() prevents the page's cancel() from aborting in-flight requests.
  // (window bubble-phase stopPropagation does NOT prevent sibling window listeners
  // that registered earlier, because listener registration order matters in bubble phase.)
  // BUG-GQL-R10-16 fix: restore focus to profile badge on close (mirrors env modal).
  const restoreFocusToTrigger = () => {
    requestAnimationFrame(() => {
      (document.querySelector<HTMLButtonElement>('[data-testid="gql-profile-badge"]'))?.focus();
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        restoreFocusToTrigger();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [onClose]);

  // Click outside closes
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = () => {
    const name = newName.trim();
    if (!name || !currentEndpoint.trim()) return;
    onSave(name);
    setNewName('');
    // BUG-R1-5 fix: show brief "✓ Saved" flash on the button
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    setSavedFlash(true);
    savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      // Second click — confirmed
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDeleteId(null);
      onDelete(id);
    } else {
      // First click — enter confirming state
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDeleteId(id);
      deleteTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 2500);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
  }, []);

  const canSave = newName.trim().length > 0 && currentEndpoint.trim().length > 0;

  return (
    <div className="gql-env-modal-overlay" onClick={handleOverlayClick} data-testid="gql-profile-modal-overlay">
      {/* BUG-P1-R3-1 fix: outline:none moved to CSS (.gql-profile-modal:focus) —
          tabIndex=-1 panels receive programmatic focus on open but should not
          show a browser focus ring around the whole modal container. */}
      <div
        className="gql-profile-modal"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connection Profiles"
        data-testid="gql-profile-modal"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="gql-profile-modal__header">
          <div className="gql-profile-modal__title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Connection Profiles
          </div>
          <button
            className="gql-profile-modal__close"
            onClick={onClose}
            aria-label="Close Connection Profiles"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="gql-profile-modal__body">

          {/* ── Section 1: Saved profiles ── */}
          <div className="gql-profile-section">
            <div className="gql-profile-section__heading">Saved Profiles</div>

            {profiles.length === 0 ? (
              <div className="gql-profile-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>No saved profiles yet</span>
                <small>Fill in the form below to save your current connection.</small>
              </div>
            ) : (
              <ul className="gql-profile-list" role="list">
                {profiles.map((profile) => {
                  const authConfigured = isAuthConfigured(profile.auth);
                  const authLabel = authBadgeLabel(profile.auth);
                  const isConfirmingDelete = confirmDeleteId === profile.id;

                  return (
                    <li key={profile.id} className="gql-profile-row" data-testid={`gql-profile-row-${profile.id}`}>
                      <div className="gql-profile-row__info">
                        <span className="gql-profile-row__name" title={profile.name}>
                          {profile.name}
                        </span>
                        <span className="gql-profile-row__endpoint" title={profile.endpoint}>
                          {truncateEndpoint(profile.endpoint)}
                        </span>
                      </div>
                      <div className="gql-profile-row__actions">
                        <span
                          className={`gql-profile-auth-badge${authConfigured ? ' gql-profile-auth-badge--active' : ''}`}
                          title={`Auth: ${authLabel}`}
                        >
                          {authLabel}
                        </span>
                        <button
                          type="button"
                          className="gql-profile-btn gql-profile-btn--load"
                          onClick={() => onLoad(profile)}
                          aria-label={`Load profile: ${profile.name}`}
                          title="Load this profile into the connection bar"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className={`gql-profile-btn gql-profile-btn--delete${isConfirmingDelete ? ' gql-profile-btn--confirming' : ''}`}
                          onClick={() => handleDeleteClick(profile.id)}
                          aria-label={
                            isConfirmingDelete
                              ? `Confirm delete ${profile.name}`
                              : `Delete profile: ${profile.name}`
                          }
                          title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete profile'}
                          data-testid={`gql-profile-delete-${profile.id}`}
                        >
                          {/* BUG-GQL-R6-3 fix: ✓ checkmark on a destructive action is misleading
                              (users interpret ✓ as "done/success", not "confirm deletion").
                              Change to "Delete?" to clearly signal this is a dangerous confirm. */}
                          {isConfirmingDelete ? 'Delete?' : '×'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Section 2: Save current connection ── */}
          <div className="gql-profile-section gql-profile-section--save">
            <div className="gql-profile-section__heading">Save Current Connection</div>

            <div className="gql-profile-save-form">
              <div className="gql-profile-save-form__preview">
                <span className="gql-profile-save-form__endpoint" title={currentEndpoint || 'No endpoint set'}>
                  {currentEndpoint ? truncateEndpoint(currentEndpoint, 50) : <em>No endpoint configured</em>}
                </span>
                <span className={`gql-profile-auth-badge${isAuthConfigured(currentAuth) ? ' gql-profile-auth-badge--active' : ''}`}>
                  {authBadgeLabel(currentAuth)}
                </span>
              </div>

              <div className="gql-profile-save-form__row">
                <input
                  ref={nameInputRef}
                  type="text"
                  className="gql-input gql-profile-save-form__input"
                  placeholder="Profile name (e.g. Staging, Production)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSave) handleSave();
                  }}
                  aria-label="Profile name"
                  maxLength={64}
                  data-testid="gql-profile-name-input"
                />
                <button
                  type="button"
                  className={`gql-btn gql-profile-save-btn${savedFlash ? ' gql-profile-save-btn--saved' : ' gql-btn--primary'}`}
                  onClick={handleSave}
                  // BUG-R3-1 fix: do NOT set disabled during the flash — the green "✓ Saved"
                  // needs full opacity. handleSave() guards against re-saves (newName is empty).
                  disabled={!canSave && !savedFlash}
                  aria-label="Save connection profile"
                  data-testid="gql-profile-save-btn"
                >
                  {/* BUG-R1-5 fix: brief "✓ Saved" flash after saving */}
                  {savedFlash ? '✓ Saved' : 'Save'}
                </button>
              </div>

              {/* BUG-R1-8 fix: add warning icon to hint for visual consistency */}
              {!currentEndpoint.trim() && (
                <p className="gql-profile-save-form__hint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Enter an endpoint URL in the connection bar first.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
