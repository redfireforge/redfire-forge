/**
 * GqlConnectionModals — renders the profile and environment modals for
 * GraphQL Studio. Both modals are optional-display (controlled by open flags).
 */
import { GraphqlProfileModal } from './GraphqlProfileModal';
import { GraphqlEnvModal } from './GraphqlEnvModal';
import { removeKey } from '../../../shared/utils/storage';
import { ENDPOINT_BASE_STORAGE_KEY } from '../utils/tabPersistence';
import type { GraphqlAuth, GraphqlEnvironment, GraphqlEnvironmentVariable } from '../../../shared/types/graphql';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';

interface GqlConnectionModalsProps {
  // Profile modal
  profileModalOpen: boolean;
  onProfileModalClose: () => void;
  profiles: ConnectionProfile[];
  endpoint: string;
  auth: GraphqlAuth | null;
  onSaveProfile: (name: string) => unknown;
  onDeleteProfile: (id: string) => void;
  onSetEndpoint: (ep: string) => void;
  onAuthChange: (newAuth: GraphqlAuth | null) => void;
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
  endpoint,
  auth,
  onSaveProfile,
  onDeleteProfile,
  onSetEndpoint,
  onAuthChange,
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
          currentEndpoint={endpoint}
          currentAuth={auth}
          onClose={() => {
            onProfileModalClose();
            requestAnimationFrame(() => {
              (document.querySelector<HTMLButtonElement>('[data-testid="gql-profile-badge"]'))?.focus();
            });
          }}
          onSave={onSaveProfile}
          onLoad={(profile) => {
            onSetEndpoint(profile.endpoint);
            onAuthChange(profile.auth);
            onProfileModalClose();
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
