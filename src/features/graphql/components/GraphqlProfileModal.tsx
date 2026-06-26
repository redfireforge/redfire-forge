/**
 * GraphqlProfileModal — named connection profiles (endpoint + auth combos).
 *
 * Layout:
 *   Header  — title + profile count subtitle (no header close — footer only)
 *   Body    — saved profiles list + save-current preview + name input
 *   Footer  — Close (secondary) + Save (primary), bottom-right
 *
 * Design rules:
 *   - Modal overlay: background transparent
 *   - Escape key closes; click outside closes
 *   - Single close mechanism in footer (no × in header)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';
import { authBadgeLabel, isAuthConfigured } from '../utils/authUtils';
import { inheritAuthProfileLabel } from '../utils/gqlAuthResolve';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlProfileModalProps {
  profiles: ConnectionProfile[];
  currentEndpoint: string;
  currentAuth: GraphqlAuth | null | undefined;
  globalAuthProfiles?: GlobalAuthProfile[];
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
  globalAuthProfiles = [],
  onClose,
  onSave,
  onLoad,
  onDelete,
}: GraphqlProfileModalProps) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onDragStart, isDragged, overlayStyle, modalStyle } = useModalDrag(true);

  useEffect(() => {
    if (profiles.length === 0) {
      nameInputRef.current?.focus();
    } else {
      panelRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreFocusToTrigger = () => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="gql-profile-badge"]')?.focus();
    });
  };

  const handleClose = useCallback(() => {
    restoreFocusToTrigger();
    onClose();
  }, [onClose]);

  useModalEscapeClose(handleClose, { capture: true });

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSave = () => {
    const name = newName.trim();
    if (!name || !currentEndpoint.trim()) return;
    onSave(name);
    setNewName('');
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    setSavedFlash(true);
    savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDeleteId(null);
      onDelete(id);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDeleteId(id);
      deleteTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 2500);
    }
  };

  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
  }, []);

  const canSave = newName.trim().length > 0 && currentEndpoint.trim().length > 0;
  const inheritProfileName =
    currentAuth?.type === 'inherit'
      ? inheritAuthProfileLabel(currentAuth, globalAuthProfiles)
      : null;
  const profileCountLabel =
    profiles.length === 0
      ? 'No saved profiles'
      : profiles.length === 1
        ? '1 saved profile'
        : `${profiles.length} saved profiles`;

  return (
    <div
      className={`gql-env-modal-overlay${isDragged ? ' gql-env-modal-overlay--dragged' : ''}`}
      style={overlayStyle}
      onClick={handleOverlayClick}
      data-testid="gql-profile-modal-overlay"
    >
      <div
        className={`gql-profile-modal${isDragged ? ' gql-profile-modal--dragged' : ''}`}
        style={modalStyle}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connection Profiles"
        data-testid="gql-profile-modal"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — drag handle; close lives in footer */}
        <div
          className="gql-profile-modal__header gql-profile-modal__header--draggable"
          onMouseDown={onDragStart}
          data-testid="gql-profile-modal-header"
        >
          <span className="gql-profile-modal__drag-grip" aria-hidden="true" title="Drag to move">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" />
              <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
              <circle cx="2" cy="14" r="1.2" /><circle cx="8" cy="14" r="1.2" />
            </svg>
          </span>
          <div className="gql-profile-modal__title-block">
            <div className="gql-profile-modal__title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Connection Profiles
            </div>
            <p className="gql-profile-modal__subtitle">
              Save and restore endpoint + auth combinations for quick switching.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="gql-profile-modal__body">
          {inheritProfileName && (
            <div className="gql-profile-inherit-note" data-testid="gql-profile-inherit-note">
              <span className="gql-profile-inherit-note__title">Global auth profile (not a connection profile)</span>
              <span className="gql-profile-inherit-note__name">{inheritProfileName}</span>
              <p className="gql-profile-inherit-note__hint">
                This credential lives in the <strong>Auth</strong> panel under{' '}
                <strong>Inherit from Auth Profile</strong> and in Environment Manager.
                Saved profiles below only store endpoint + auth <em>mode</em> — they do not duplicate
                the global catalog entry.
              </p>
            </div>
          )}

          {/* Saved profiles */}
          <div className="gql-profile-section">
            <div className="gql-profile-section__heading-row">
              <span className="gql-profile-section__heading">Saved profiles</span>
              <span className="gql-profile-section__count">{profileCountLabel}</span>
            </div>

            {profiles.length === 0 ? (
              <div className="gql-profile-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>No saved profiles yet</span>
                <small>Name your current connection below to create the first one.</small>
              </div>
            ) : (
              <ul className="gql-profile-list" role="list">
                {profiles.map((profile) => {
                  const authConfigured = isAuthConfigured(profile.auth, globalAuthProfiles);
                  const authLabel = authBadgeLabel(profile.auth, globalAuthProfiles);
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
                          {isConfirmingDelete ? 'Delete?' : 'Remove'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Save current connection */}
          <div className="gql-profile-section gql-profile-section--save">
            <div className="gql-profile-section__heading">Save current connection</div>

            <div className="gql-profile-save-form">
              <div className="gql-profile-save-preview-card">
                <div className="gql-profile-save-preview-row">
                  <span className="gql-profile-save-preview-label">Endpoint</span>
                  <span className="gql-profile-save-form__endpoint" title={currentEndpoint || 'No endpoint set'}>
                    {currentEndpoint ? truncateEndpoint(currentEndpoint, 50) : 'No endpoint configured'}
                  </span>
                </div>
                <div className="gql-profile-save-preview-row">
                  <span className="gql-profile-save-preview-label">Auth</span>
                  <span className={`gql-profile-auth-badge${isAuthConfigured(currentAuth, globalAuthProfiles) ? ' gql-profile-auth-badge--active' : ''}`}>
                    {authBadgeLabel(currentAuth, globalAuthProfiles)}
                  </span>
                </div>
              </div>

              <label className="gql-profile-save-form__label" htmlFor="gql-profile-name-input">
                Profile name
              </label>
              <input
                ref={nameInputRef}
                id="gql-profile-name-input"
                type="text"
                className="gql-input gql-profile-save-form__input"
                placeholder="e.g. Staging, Production, Lesson demo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) handleSave();
                }}
                aria-label="Profile name"
                maxLength={64}
                data-testid="gql-profile-name-input"
              />

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

        {/* Footer — Close + Save (bottom-right) */}
        <div className="gql-profile-modal__footer">
          <button
            type="button"
            className="gql-btn gql-profile-modal__close-btn"
            onClick={handleClose}
            aria-label="Close Connection Profiles"
            data-testid="gql-profile-close-btn"
          >
            Close
          </button>
          <button
            type="button"
            className={`gql-btn gql-profile-save-btn${savedFlash ? ' gql-profile-save-btn--saved' : ' gql-btn--primary'}`}
            onClick={handleSave}
            disabled={!canSave && !savedFlash}
            aria-label="Save connection profile"
            data-testid="gql-profile-save-btn"
          >
            {savedFlash ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
