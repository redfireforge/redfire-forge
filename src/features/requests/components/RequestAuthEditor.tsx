import type { AuthConfig, RequestCollection, GlobalAuthProfile } from '@shared/types';
import { AuthTypeSelect } from './AuthTypeSelect';
import WfDarkSelect from '../../workflow/components/modals/WfDarkSelect';

interface Props {
  auth: AuthConfig;
  collection: RequestCollection;
  globalAuthProfiles: GlobalAuthProfile[];
  onUpdate: (auth: AuthConfig) => void;
}

export default function RequestAuthEditor({ auth, collection, globalAuthProfiles, onUpdate }: Props) {
  const authSelectValue = auth.globalProfileId ? 'global-profile' : auth.type;

  const handleTypeChange = (val: string) => {
    if (val === 'global-profile') {
      const first = globalAuthProfiles[0];
      if (first) onUpdate({ ...first.auth, globalProfileId: first.id });
    } else {
      onUpdate({ type: val as AuthConfig['type'] });
    }
  };

  const handleProfileChange = (profileId: string) => {
    const profile = globalAuthProfiles.find(p => p.id === profileId);
    if (profile) onUpdate({ ...profile.auth, globalProfileId: profile.id });
  };

  const selectedProfile = auth.globalProfileId
    ? globalAuthProfiles.find(p => p.id === auth.globalProfileId)
    : null;

  return (
    <div className="req-auth-editor" data-testid="req-auth-editor">
      <AuthTypeSelect
        value={authSelectValue}
        onChange={handleTypeChange}
        showGlobalProfile={globalAuthProfiles.length > 0}
      />

      {authSelectValue === 'global-profile' && (
        <div className="req-auth-fields">
          <div className="req-auth-row">
            <label className="req-auth-label">Select Profile</label>
            <WfDarkSelect
              className="req-auth-wf-select"
              aria-label="Select global auth profile"
              testId="req-auth-profile-select"
              value={auth.globalProfileId ?? ''}
              options={globalAuthProfiles.map((p) => ({ value: p.id, label: `${p.name} (${p.auth.type})` }))}
              onChange={handleProfileChange}
            />
          </div>
          {selectedProfile && (
            <div className="req-profile-info">
              <span className="req-profile-type-badge">{selectedProfile.auth.type.toUpperCase()}</span>
              <span>{selectedProfile.name}</span>
            </div>
          )}
        </div>
      )}

      {auth.type === 'bearer' && !selectedProfile && (
        <div className="req-auth-fields" data-testid="req-auth-bearer-fields">
          <div className="req-auth-row">
            <label className="req-auth-label">Prefix</label>
            <input className="req-input" data-testid="req-auth-prefix-input" value={auth.prefix ?? 'Bearer'} onChange={(e) => onUpdate({ ...auth, prefix: e.target.value })} placeholder="Bearer" />
          </div>
          <div className="req-auth-row">
            <label className="req-auth-label">Token</label>
            <input className="req-input" data-testid="req-auth-token-input" value={auth.token ?? ''} onChange={(e) => onUpdate({ ...auth, token: e.target.value })} placeholder="Token" />
          </div>
        </div>
      )}
      {auth.type === 'basic' && !selectedProfile && (
        <div className="req-auth-fields">
          <div className="req-auth-row">
            <label className="req-auth-label">Username</label>
            <input className="req-input" value={auth.username ?? ''} onChange={(e) => onUpdate({ ...auth, username: e.target.value })} placeholder="Username" />
          </div>
          <div className="req-auth-row">
            <label className="req-auth-label">Password</label>
            <input className="req-input" type="password" value={auth.password ?? ''} onChange={(e) => onUpdate({ ...auth, password: e.target.value })} placeholder="Password" />
          </div>
        </div>
      )}
      {auth.type === 'apikey' && !selectedProfile && (
        <div className="req-auth-fields">
          <div className="req-auth-row">
            <label className="req-auth-label">Key Name</label>
            <input className="req-input" value={auth.apiKeyName ?? ''} onChange={(e) => onUpdate({ ...auth, apiKeyName: e.target.value })} placeholder="Key name" />
          </div>
          <div className="req-auth-row">
            <label className="req-auth-label">Key Value</label>
            <input className="req-input" value={auth.apiKeyValue ?? ''} onChange={(e) => onUpdate({ ...auth, apiKeyValue: e.target.value })} placeholder="Key value" />
          </div>
          <div className="req-auth-row">
            <label className="req-auth-label">Add To</label>
            <WfDarkSelect
              className="req-auth-wf-select"
              aria-label="Add API key to"
              testId="req-auth-apikey-in"
              value={auth.apiKeyIn ?? 'header'}
              options={[
                { value: 'header', label: 'Header' },
                { value: 'query', label: 'Query String' },
              ]}
              onChange={(v) => onUpdate({ ...auth, apiKeyIn: v as 'header' | 'query' })}
            />
          </div>
        </div>
      )}
      {auth.type === 'oauth2' && !selectedProfile && (
        <div className="req-auth-fields">
          <div className="req-auth-row">
            <label className="req-auth-label">Token URL</label>
            <input className="req-input" value={auth.tokenUrl ?? ''} onChange={(e) => onUpdate({ ...auth, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          </div>
          <div className="req-auth-row">
            <label className="req-auth-label">Client ID</label>
            <input className="req-input" value={auth.clientId ?? ''} onChange={(e) => onUpdate({ ...auth, clientId: e.target.value })} placeholder="Client ID" />
          </div>
          <div className="req-auth-row">
            <label className="req-auth-label">Client Secret</label>
            <input className="req-input" type="password" value={auth.clientSecret ?? ''} onChange={(e) => onUpdate({ ...auth, clientSecret: e.target.value })} placeholder="Client Secret" />
          </div>
        </div>
      )}
      {auth.type === 'inherit' && collection.auth && collection.auth.type !== 'none' && (
        <div className="req-auth-inherit-info">
          Inheriting <strong>{collection.auth.globalProfileId
            ? globalAuthProfiles.find(p => p.id === collection.auth!.globalProfileId)?.name ?? collection.auth.type
            : collection.auth.type}</strong> auth from collection "{collection.name}"
        </div>
      )}
    </div>
  );
}
