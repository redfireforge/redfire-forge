/**
 * GqlConnectionModals — renders the profile and environment modals for
 * GraphQL Studio. Both modals are optional-display (controlled by open flags).
 */
import { GraphqlProfileModal } from './GraphqlProfileModal';
import { GraphqlEnvModal } from './GraphqlEnvModal';
import { removeKey } from '../../../shared/utils/storage';
import { ENDPOINT_BASE_STORAGE_KEY } from '../utils/tabPersistence';
import type { GraphqlAuth, GraphqlEnvironment, GraphqlEnvironmentVariable } from '../../../shared/types/graphql';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';

interface GqlConnectionModalsProps {
  // Profile modal
  profileModalOpen: boolean;
  onProfileModalClose: () => void;
  profiles: ConnectionProfile[];
  studioTabs?: ReadonlyArray<{ id: string; label: string; connectionId?: string }>;
  activeTabId?: string | null;
  activeConnectionId?: string | null;
  endpoint: string;
  auth: GraphqlAuth | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  onSaveProfile: (name: string) => unknown;
  onDeleteProfile: (id: string) => void;
  onApplyProfileToActiveTab: (profile: ConnectionProfile) => void;
  prevBaseUrlRef: React.MutableRefObject<string | undefined>;

  // Env modal
  envModalOpen: boolean;
  onEnvModalClose: () => void;
  environments: GraphqlEnvironment[];
  activeEnvironmentId: string | null;
  onCreateEnvironment: (name: string) => string;
  onDeleteEnvironment: (id: string) => void;
  onSetActiveEnvironment: (id: string | null) => void;
  onRenameEnvironment: (id: string, name: string) => void;
  onUpdateVariables: (id: string, vars: GraphqlEnvironmentVariable[]) => void;
  onImportEnvironment: (json: string) => { success: boolean; error?: string };
  onExportEnvironment: (id: string) => string | null;
}

export function GqlConnectionModals({
  profileModalOpen,
  onProfileModalClose,
  profiles,
  studioTabs = [],
  activeTabId = null,
  activeConnectionId = null,
  endpoint,
  auth,
  globalAuthProfiles = [],
  onSaveProfile,
  onDeleteProfile,
  onApplyProfileToActiveTab,
  prevBaseUrlRef,
  envModalOpen,
  onEnvModalClose,
  environments,
  activeEnvironmentId,
  onCreateEnvironment,
  onDeleteEnvironment,
  onSetActiveEnvironment,
  onRenameEnvironment,
  onUpdateVariables,
  onImportEnvironment,
  onExportEnvironment,
}: GqlConnectionModalsProps) {
  return (
    <>
      {profileModalOpen && (
        <GraphqlProfileModal
          profiles={profiles}
          studioTabs={studioTabs}
          activeTabId={activeTabId}
          activeConnectionId={activeConnectionId}
          currentEndpoint={endpoint}
          currentAuth={auth}
          globalAuthProfiles={globalAuthProfiles}
          onClose={() => {
            onProfileModalClose();
            requestAnimationFrame(() => {
              (document.querySelector<HTMLButtonElement>('[data-testid="gql-profile-badge"]'))?.focus();
            });
          }}
          onSave={onSaveProfile}
          onLoad={(profile) => {
            onApplyProfileToActiveTab(profile);
            prevBaseUrlRef.current = '\0profile-pinned';
            removeKey(ENDPOINT_BASE_STORAGE_KEY).catch(() => { /* silent */ });
          }}
          onDelete={onDeleteProfile}
        />
      )}

      {envModalOpen && (
        <GraphqlEnvModal
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onClose={() => {
            onEnvModalClose();
            requestAnimationFrame(() => {
              (document.querySelector<HTMLButtonElement>('[data-testid="gql-env-badge"]'))?.focus();
            });
          }}
          onCreate={onCreateEnvironment}
          onDelete={onDeleteEnvironment}
          onSetActive={onSetActiveEnvironment}
          onRename={onRenameEnvironment}
          onUpdateVariables={onUpdateVariables}
          onImport={onImportEnvironment}
          onExport={onExportEnvironment}
        />
      )}
    </>
  );
}
