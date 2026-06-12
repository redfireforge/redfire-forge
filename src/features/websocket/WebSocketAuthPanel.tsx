import { useState, useMemo } from 'react';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';
import AuthConfigPanel from '../requests/components/AuthConfigPanel';
import { useAuthVerify } from '../requests/hooks/useAuthVerify';
import { buildFeatureAuthTypeOptions } from '../scenarios/utils/scenarioBuilderUtils';
import { isTauri } from '../../shared/utils/platform';
import { describeResolvedAuth, resolveEffectiveAuth } from './wsAuthResolve';

export interface WebSocketAuthPanelProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
}

/**
 * Phase 8 — Auth tab body for the WebSocket studio.
 *
 * Wraps the shared {@link AuthConfigPanel}, baking in `useAuthVerify`, the
 * secret-visibility toggle, and global-profile inherit binding (stored in
 * `auth.globalProfileId`). Adds a masked "resolved-as" preview and an honest
 * browser-mode info callout: header-based WS auth rides the proxy sidecar (the
 * direct browser `WebSocket` transport cannot set headers), while query-based
 * auth (API key in query) works on every transport.
 */
export default function WebSocketAuthPanel({
  auth,
  onChange,
  globalAuthProfiles = [],
}: WebSocketAuthPanelProps) {
  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth } = useAuthVerify();
  const [showSecret, setShowSecret] = useState(false);

  const authTypeOptions = useMemo(
    () => buildFeatureAuthTypeOptions(globalAuthProfiles),
    [globalAuthProfiles],
  );

  const resolvedDescription = useMemo(
    () => describeResolvedAuth(auth, globalAuthProfiles),
    [auth, globalAuthProfiles],
  );

  // Header-based auth needs the proxy in the browser; query-based does not.
  const effective = resolveEffectiveAuth(auth, globalAuthProfiles);
  const isQueryAuth = effective?.type === 'apikey' && effective.apiKeyIn === 'query';
  const hasHeaderAuth = !!effective && !isQueryAuth;
  const showBrowserCallout = hasHeaderAuth && !isTauri();

  const handleProfileChange = (profileId: string | undefined) => {
    onChange({ ...auth, globalProfileId: profileId });
  };

  return (
    <div className="ws-auth-pane">
      <AuthConfigPanel
        panelClassName="scenario-auth-panel ws-auth-panel"
        auth={auth}
        onChange={onChange}
        title="Connection Auth"
        hint="Applied when the connection is established"
        showProfileSelector
        globalAuthProfileId={auth.globalProfileId}
        onProfileChange={handleProfileChange}
        allAuthProfiles={globalAuthProfiles}
        authVerifying={authVerifying}
        authVerifyResult={authVerifyResult}
        setAuthVerifyResult={setAuthVerifyResult}
        verifyAuth={verifyAuth}
        showSecret={showSecret}
        setShowSecret={setShowSecret}
        authTypeOptions={authTypeOptions}
      />

      {resolvedDescription && (
        <div className="ws-auth-resolved" data-testid="ws-auth-resolved">
          <span className="ws-auth-resolved-label">Will send</span>
          <code className="ws-auth-resolved-value">{resolvedDescription}</code>
        </div>
      )}

      {showBrowserCallout && (
        <div className="ws-auth-callout" data-testid="ws-auth-callout">
          <span className="ws-auth-callout-icon" aria-hidden="true">ℹ</span>
          <div className="ws-auth-callout-body">
            Browsers can't set custom headers on a WebSocket handshake, so this
            connection will be routed through the local proxy to apply the auth
            header. In the desktop app the native transport is used instead.
          </div>
        </div>
      )}
    </div>
  );
}
