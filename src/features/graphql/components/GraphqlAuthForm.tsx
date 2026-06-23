/**
 * GraphqlAuthForm — shared auth editor body (Phase 6H Slice 7.1 / 7.4).
 *
 * Panel-only form used by GraphqlAuthPanel (bottom Auth tab).
 */

import { useMemo, type ReactNode } from 'react';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import {
  AUTH_TYPE_INHERIT_WORKSPACE,
  AUTH_TYPE_NONE,
  buildAuthTypeOptions,
  storedAuthToPopoverType,
  type GqlAuthPopoverScope,
  type GqlAuthPopoverSelectableType,
} from '../utils/gqlAuthPopoverUtils';
import { GraphqlAuthPasswordInput } from './GraphqlAuthPasswordInput';

export interface GraphqlAuthFormProps {
  storedAuth: GraphqlAuth | null | undefined;
  authScope: GqlAuthPopoverScope;
  hasAuthOverride?: boolean;
  onResetToInherit?: () => void;
  onChange: (auth: GraphqlAuth | null) => void;
  linkedProfileName?: string | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
}

function AuthField({
  label,
  labelFor,
  children,
}: {
  label: string;
  labelFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="gql-auth-panel-row">
      <div className="gql-auth-panel-label-col">
        <label htmlFor={labelFor}>{label}</label>
      </div>
      <div className="gql-auth-panel-ctrl-col">{children}</div>
    </div>
  );
}

export function GraphqlAuthForm({
  storedAuth,
  authScope,
  hasAuthOverride = false,
  onResetToInherit,
  onChange,
  linkedProfileName = null,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
}: GraphqlAuthFormProps) {
  const selectedType = storedAuthToPopoverType(storedAuth, authScope);
  const authTypeOptions = useMemo(
    () => buildAuthTypeOptions(globalAuthProfiles, authScope),
    [globalAuthProfiles, authScope],
  );

  const showInheritBanner = authScope === 'tab' && !hasAuthOverride;

  function handleTypeChange(type: GqlAuthPopoverSelectableType) {
    if (type === AUTH_TYPE_INHERIT_WORKSPACE) {
      if (selectedType !== AUTH_TYPE_INHERIT_WORKSPACE) {
        onChange({ type: 'inherit' });
      }
      return;
    }
    if (type === AUTH_TYPE_NONE) {
      if (selectedType !== AUTH_TYPE_NONE) {
        onChange(null);
      }
      return;
    }
    if (type === 'inherit') {
      if (storedAuth?.type !== 'inherit') {
        onChange({
          type: 'inherit',
          globalProfileId: defaultAuthProfileId ?? storedAuth?.globalProfileId,
        });
      }
      return;
    }
    if (!storedAuth || storedAuth.type !== type) {
      const base = { ...storedAuth, type } as GraphqlAuth;
      if (type === 'apiKey' && !base.headerName) {
        base.headerName = 'X-API-Key';
      }
      onChange(base);
    }
  }

  function handleProfileChange(profileId: string) {
    if (storedAuth?.type !== 'inherit') return;
    onChange({
      ...storedAuth,
      globalProfileId: profileId || undefined,
    });
  }

  return (
    <div className="gql-auth-panel-form">
      {authScope === 'page' && (
        <p
          className="gql-auth-inherit-banner gql-auth-page-scope-banner"
          data-testid="gql-auth-page-scope-banner"
          role="status"
        >
          Editing <strong>page default</strong> auth — used by inheriting tabs until they override.
        </p>
      )}

      {showInheritBanner && (
        <p
          className="gql-auth-inherit-banner"
          data-testid="gql-auth-inherit-banner"
          role="status"
        >
          {linkedProfileName ? (
            <>
              Inheriting auth from profile <strong>{linkedProfileName}</strong>
              {' '}— no tab override.
            </>
          ) : (
            <>
              Inheriting <strong>workspace default</strong>
              {' '}— no tab override; uses page settings or profile chain.
            </>
          )}
        </p>
      )}

      {hasAuthOverride && authScope === 'tab' && onResetToInherit && !showInheritBanner && (
        <p
          className="gql-auth-inherit-banner gql-auth-panel-override-banner"
          data-testid="gql-auth-override-banner"
          role="status"
        >
          This tab <strong>overrides</strong> workspace default.{' '}
          <button
            type="button"
            className="gql-auth-panel-reset-link"
            onClick={onResetToInherit}
            data-testid="gql-auth-reset-inherit-btn"
          >
            Reset to inherit workspace
          </button>
        </p>
      )}

      {linkedProfileName && hasAuthOverride && (
        <p
          className="gql-auth-profile-hint"
          data-testid="gql-auth-profile-hint"
          role="status"
        >
          Tab override takes precedence over profile <strong>{linkedProfileName}</strong> auth.
        </p>
      )}

      <AuthField label="Auth type" labelFor="gql-auth-type-select">
        <select
          id="gql-auth-type-select"
          className="gql-select gql-auth-type-select"
          value={selectedType}
          onChange={(e) => handleTypeChange(e.target.value as GqlAuthPopoverSelectableType)}
          data-testid="gql-auth-type-select"
        >
          {authTypeOptions.map((t) => (
            <option key={t.value} value={t.value} disabled={t.disabled}>{t.label}</option>
          ))}
        </select>
      </AuthField>

      {storedAuth?.type === 'inherit' && globalAuthProfiles.length > 0 && (
        <AuthField label="Auth profile" labelFor="gql-auth-profile-select">
          <select
            id="gql-auth-profile-select"
            className="gql-select gql-auth-type-select"
            value={storedAuth.globalProfileId ?? ''}
            onChange={(e) => handleProfileChange(e.target.value)}
            data-testid="gql-auth-profile-select"
          >
            <option value="">— Select a profile —</option>
            {globalAuthProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </AuthField>
      )}

      {showInheritBanner && (
        <button
          type="button"
          className="gql-auth-switch-override-btn"
          onClick={() => onChange({ type: 'bearer', token: '' })}
          data-testid="gql-auth-switch-override-btn"
        >
          Switch to explicit override…
        </button>
      )}

      {selectedType === AUTH_TYPE_NONE && (
        <div className="gql-auth-no-auth-hint">
          No authentication headers will be sent.
          Select a type above to add credentials.
        </div>
      )}

      {storedAuth?.type === 'bearer' && (
        <AuthField label="Token" labelFor="gql-auth-bearer-input">
          <GraphqlAuthPasswordInput
            value={storedAuth.token ?? ''}
            onChange={(v) => onChange({ ...storedAuth, token: v })}
            placeholder="Enter bearer token…"
            testId="gql-auth-bearer-input"
          />
        </AuthField>
      )}

      {storedAuth?.type === 'basic' && (
        <>
          <AuthField label="Username" labelFor="gql-auth-basic-user">
            <input
              id="gql-auth-basic-user"
              type="text"
              className="gql-input gql-auth-input"
              value={storedAuth.username ?? ''}
              onChange={(e) => onChange({ ...storedAuth, username: e.target.value })}
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
              data-testid="gql-auth-basic-user"
            />
          </AuthField>
          <AuthField label="Password" labelFor="gql-auth-basic-pass">
            <GraphqlAuthPasswordInput
              value={storedAuth.password ?? ''}
              onChange={(v) => onChange({ ...storedAuth, password: v })}
              placeholder="password"
              testId="gql-auth-basic-pass"
            />
          </AuthField>
        </>
      )}

      {storedAuth?.type === 'apiKey' && (
        <>
          <AuthField label="Header" labelFor="gql-auth-apikey-name">
            <input
              id="gql-auth-apikey-name"
              type="text"
              className="gql-input gql-auth-input"
              value={storedAuth.headerName ?? 'X-API-Key'}
              onChange={(e) => onChange({ ...storedAuth, headerName: e.target.value })}
              placeholder="X-API-Key"
              autoComplete="off"
              spellCheck={false}
              data-testid="gql-auth-apikey-name"
            />
          </AuthField>
          <AuthField label="Value" labelFor="gql-auth-apikey-val">
            <GraphqlAuthPasswordInput
              value={storedAuth.headerValue ?? ''}
              onChange={(v) => onChange({ ...storedAuth, headerValue: v })}
              placeholder="API key value"
              testId="gql-auth-apikey-val"
            />
          </AuthField>
        </>
      )}

      {storedAuth?.type === 'oauth2' && (
        <div className="gql-auth-info-box">
          OAuth 2.0 token injection is handled by pre-request scripts (Phase 3).
          Use <strong>Bearer Token</strong> type if you already have an access token.
        </div>
      )}

      {storedAuth?.type === 'custom' && (
        <div className="gql-auth-info-box">
          Add your custom authentication headers directly in the
          <strong> Headers</strong> panel below the query editor.
        </div>
      )}
    </div>
  );
}
