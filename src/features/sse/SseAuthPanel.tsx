import { useState, useMemo } from 'react';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';
import AuthConfigPanel from '../requests/components/AuthConfigPanel';
import { useAuthVerify } from '../requests/hooks/useAuthVerify';
import { buildFeatureAuthTypeOptions } from '../scenarios/utils/scenarioBuilderUtils';
import { describeResolvedAuth } from '../websocket/wsAuthResolve';

export interface SseAuthPanelProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
}

/**
 * Phase 8 — Auth tab body for the SSE studio.
 *
 * Wraps the shared {@link AuthConfigPanel}, baking in `useAuthVerify`, the
 * secret-visibility toggle, and global-profile inherit binding (stored in
 * `auth.globalProfileId`). Adds a masked "resolved-as" preview. Unlike the
 * WebSocket panel there is no browser-mode callout: SSE connects via `fetch`,
 * which can set custom headers directly in the browser.
 */
export default function SseAuthPanel({
  auth,
  onChange,
  globalAuthProfiles = [],
}: SseAuthPanelProps) {
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

  const handleProfileChange = (profileId: string | undefined) => {
    onChange({ ...auth, globalProfileId: profileId });
  };

  return (
    <div className="sse-auth-pane">
      <AuthConfigPanel
        panelClassName="scenario-auth-panel sse-auth-panel"
        auth={auth}
        onChange={onChange}
        title="Connection Auth"
        hint="Applied when the connection is established"
        useCustomTypeDropdown
        useStackedBearerFields
        useStackedAuthFields
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
        <div className="sse-auth-resolved" data-testid="sse-auth-resolved">
          <span className="sse-auth-resolved-label">Will send</span>
          <code className="sse-auth-resolved-value">{resolvedDescription}</code>
        </div>
      )}
    </div>
  );
}
