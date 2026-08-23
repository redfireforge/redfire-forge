/**
 * GraphqlAuthPanel — bottom-panel auth editor (Phase 6H Slice 7.2).
 *
 * Option D layout: two-tone form rows, inherit banner, reset link, resolved preview footer.
 */

import type { GlobalAuthProfile } from '@shared/types';
import type { GraphqlAuth } from '@shared/types/graphql';
import type { GqlAuthPopoverScope } from '../utils/gqlAuthPopoverUtils';
import { GraphqlAuthForm } from './GraphqlAuthForm';

export interface GraphqlAuthPanelProps {
  storedAuth: GraphqlAuth | null | undefined;
  resolvedPreview: string;
  authScope: GqlAuthPopoverScope;
  hasAuthOverride?: boolean;
  onResetToInherit?: () => void;
  onChange: (auth: GraphqlAuth | null) => void;
  linkedProfileName?: string | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
}

export function GraphqlAuthPanel({
  storedAuth,
  resolvedPreview,
  authScope,
  hasAuthOverride = false,
  onResetToInherit,
  onChange,
  linkedProfileName = null,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
}: GraphqlAuthPanelProps) {
  return (
    <div className="gql-auth-panel" data-testid="gql-auth-panel">
      <div className="gql-auth-panel-scroll" data-testid="gql-auth-panel-scroll">
        <GraphqlAuthForm
          storedAuth={storedAuth}
          authScope={authScope}
          hasAuthOverride={hasAuthOverride}
          onResetToInherit={onResetToInherit}
          onChange={onChange}
          linkedProfileName={linkedProfileName}
          globalAuthProfiles={globalAuthProfiles}
          defaultAuthProfileId={defaultAuthProfileId}
        />
      </div>
      <div className="gql-auth-panel-footer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <code className="gql-auth-preview" data-testid="gql-auth-preview">{resolvedPreview}</code>
      </div>
    </div>
  );
}
