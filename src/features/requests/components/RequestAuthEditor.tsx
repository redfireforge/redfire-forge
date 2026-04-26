import type { AuthConfig, RequestCollection, GlobalAuthProfile } from '../../../shared/types';

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
    <div className="req-auth-editor">
      <select className="req-select" value={authSelectValue} onChange={(e) => handleTypeChange(e.target.value)}>
        <option value="inherit">Inherit from Collection</option>
        <option value="none">No Auth</option>
        {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="apikey">API Key</option>
        <option value="oauth2">OAuth2 Client Credentials</option>
      </select>

      {authSelectValue === 'global-profile' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Select Profile</label>
          <select className="req-select" value={auth.globalProfileId ?? ''}
            onChange={(e) => handleProfileChange(e.target.value)}>
            {globalAuthProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
            ))}
          </select>
          {selectedProfile && (
            <div className="req-profile-info">
              <span className="req-profile-type-badge">{selectedProfile.auth.type.toUpperCase()}</span>
              <span>{selectedProfile.name}</span>
            </div>
          )}
        </div>
      )}

      {auth.type === 'bearer' && !selectedProfile && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Prefix</label>
          <input className="req-input" value={auth.prefix ?? 'Bearer'} onChange={(e) => onUpdate({ ...auth, prefix: e.target.value })} placeholder="Bearer" />
          <label className="req-auth-label">Token</label>
          <input className="req-input" value={auth.token ?? ''} onChange={(e) => onUpdate({ ...auth, token: e.target.value })} placeholder="Token" />
        </div>
      )}
      {auth.type === 'basic' && !selectedProfile && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Username</label>
          <input className="req-input" value={auth.username ?? ''} onChange={(e) => onUpdate({ ...auth, username: e.target.value })} placeholder="Username" />
          <label className="req-auth-label">Password</label>
          <input className="req-input" type="password" value={auth.password ?? ''} onChange={(e) => onUpdate({ ...auth, password: e.target.value })} placeholder="Password" />
        </div>
      )}
      {auth.type === 'apikey' && !selectedProfile && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Key Name</label>
          <input className="req-input" value={auth.apiKeyName ?? ''} onChange={(e) => onUpdate({ ...auth, apiKeyName: e.target.value })} placeholder="Key name" />
          <label className="req-auth-label">Key Value</label>
          <input className="req-input" value={auth.apiKeyValue ?? ''} onChange={(e) => onUpdate({ ...auth, apiKeyValue: e.target.value })} placeholder="Key value" />
          <label className="req-auth-label">Add To</label>
          <select className="req-select" value={auth.apiKeyIn ?? 'header'}
            onChange={(e) => onUpdate({ ...auth, apiKeyIn: e.target.value as 'header' | 'query' })}>
            <option value="header">Header</option><option value="query">Query String</option>
          </select>
        </div>
      )}
      {auth.type === 'oauth2' && !selectedProfile && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Token URL</label>
          <input className="req-input" value={auth.tokenUrl ?? ''} onChange={(e) => onUpdate({ ...auth, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          <label className="req-auth-label">Client ID</label>
          <input className="req-input" value={auth.clientId ?? ''} onChange={(e) => onUpdate({ ...auth, clientId: e.target.value })} placeholder="Client ID" />
          <label className="req-auth-label">Client Secret</label>
          <input className="req-input" type="password" value={auth.clientSecret ?? ''} onChange={(e) => onUpdate({ ...auth, clientSecret: e.target.value })} placeholder="Client Secret" />
        </div>
      )}
      {auth.type === 'inherit' && collection.auth && collection.auth.type !== 'none' && (
        <div className="req-auth-inherit-info">
          Inheriting <strong>{collection.auth.globalProfileId
            ? globalAuthProfiles.find(p => p.id === collection.auth.globalProfileId)?.name ?? collection.auth.type
            : collection.auth.type}</strong> auth from collection "{collection.name}"
        </div>
      )}
    </div>
  );
}
