import type { Dispatch, SetStateAction } from 'react';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import type { AuthType, Scenario } from '../../../../shared/types';
import type { WorkflowService } from '../../types/workflow';

interface HttpAuthSectionProps {
  auth: Scenario['auth'];
  serviceId?: string;
  workflowServices: WorkflowService[];
  showAuthPassword: boolean;
  setShowAuthPassword: Dispatch<SetStateAction<boolean>>;
  onAuthChange: (auth: Scenario['auth']) => void;
}

export function HttpAuthSection({
  auth,
  serviceId,
  workflowServices,
  showAuthPassword,
  setShowAuthPassword,
  onAuthChange,
}: HttpAuthSectionProps) {
  return (
    <div className="wf-config-auth-section">
      <div className="auth-type-select">
        <label>Type</label>
        <CustomSelect
          value={auth.type}
          onChange={(v) => onAuthChange({ ...auth, type: v as AuthType })}
          options={[
            { value: 'inherit', label: 'Inherit from Service' },
            { value: 'none', label: 'No Auth' },
            { value: 'basic', label: 'Basic Auth' },
            { value: 'bearer', label: 'Bearer Token' },
            { value: 'apikey', label: 'API Key' },
            { value: 'digest', label: 'Digest Auth' },
            { value: 'oauth2', label: 'OAuth2 Client Credentials' },
          ]}
        />
      </div>
      {auth.type === 'inherit' && (
        <div className="auth-inherit-hint">
          {serviceId
            ? `Auth will be inherited from the selected service (${workflowServices.find(ws => ws.id === serviceId)?.name || serviceId}).`
            : 'No service selected — auth will use the environment fallback or remain unauthenticated.'}
        </div>
      )}
      {auth.type === 'basic' && (
        <div className="wf-http-auth-fields">
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-username">Username</label>
            <textarea
              id="wf-http-auth-username"
              className="wf-http-auth-textarea"
              rows={1}
              value={auth.username || ''}
              onChange={(e) => onAuthChange({ ...auth, username: e.target.value })}
              aria-label="Username"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-password">Password</label>
            <div className="wf-http-auth-secret-wrap">
              <textarea
                id="wf-http-auth-password"
                className={`wf-http-auth-textarea${showAuthPassword ? '' : ' wf-http-auth-textarea--masked'}`}
                rows={1}
                value={auth.password || ''}
                onChange={(e) => onAuthChange({ ...auth, password: e.target.value })}
                aria-label="Password"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="wf-http-auth-secret-toggle"
                onClick={() => setShowAuthPassword((v) => !v)}
                title={showAuthPassword ? 'Hide password' : 'Show password'}
                aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
              >
                {showAuthPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>
      )}
      {auth.type === 'bearer' && (
        <div className="wf-http-auth-fields">
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-token">Token</label>
            <div className="wf-http-auth-secret-wrap">
              <textarea
                id="wf-http-auth-token"
                className={`wf-http-auth-textarea${showAuthPassword ? '' : ' wf-http-auth-textarea--masked'}`}
                rows={1}
                value={auth.token || ''}
                onChange={(e) => onAuthChange({ ...auth, token: e.target.value })}
                placeholder="eyJhbGciOi..."
                aria-label="Token"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="wf-http-auth-secret-toggle"
                onClick={() => setShowAuthPassword((v) => !v)}
                title={showAuthPassword ? 'Hide token' : 'Show token'}
                aria-label={showAuthPassword ? 'Hide token' : 'Show token'}
              >
                {showAuthPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-prefix">Prefix</label>
            <textarea
              id="wf-http-auth-prefix"
              className="wf-http-auth-textarea"
              rows={1}
              value={auth.prefix ?? 'Bearer'}
              onChange={(e) => onAuthChange({ ...auth, prefix: e.target.value })}
              placeholder="Bearer"
              aria-label="Prefix"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      )}
      {auth.type === 'apikey' && (
        <div className="wf-http-auth-fields">
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-key-name">Key Name</label>
            <textarea
              id="wf-http-auth-key-name"
              className="wf-http-auth-textarea"
              rows={1}
              value={auth.apiKeyName || ''}
              onChange={(e) => onAuthChange({ ...auth, apiKeyName: e.target.value })}
              placeholder="X-API-Key"
              aria-label="Key Name"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-key-value">Key Value</label>
            <div className="wf-http-auth-secret-wrap">
              <textarea
                id="wf-http-auth-key-value"
                className={`wf-http-auth-textarea${showAuthPassword ? '' : ' wf-http-auth-textarea--masked'}`}
                rows={1}
                value={auth.apiKeyValue || ''}
                onChange={(e) => onAuthChange({ ...auth, apiKeyValue: e.target.value })}
                placeholder="your-api-key"
                aria-label="Key Value"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="wf-http-auth-secret-toggle"
                onClick={() => setShowAuthPassword((v) => !v)}
                title={showAuthPassword ? 'Hide key value' : 'Show key value'}
                aria-label={showAuthPassword ? 'Hide key value' : 'Show key value'}
              >
                {showAuthPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="wf-http-auth-row">
            <label>Add to</label>
            <div className="wf-http-auth-radio-group radio-group">
              <label className="radio-label">
                <input type="radio" checked={auth.apiKeyIn !== 'query'} onChange={() => onAuthChange({ ...auth, apiKeyIn: 'header' })} />
                Header
              </label>
              <label className="radio-label">
                <input type="radio" checked={auth.apiKeyIn === 'query'} onChange={() => onAuthChange({ ...auth, apiKeyIn: 'query' })} />
                Query Parameter
              </label>
            </div>
          </div>
        </div>
      )}
      {auth.type === 'digest' && (
        <div className="wf-http-auth-fields">
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-digest-username">Username</label>
            <textarea
              id="wf-http-auth-digest-username"
              className="wf-http-auth-textarea"
              rows={1}
              value={auth.username || ''}
              onChange={(e) => onAuthChange({ ...auth, username: e.target.value })}
              aria-label="Username"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-digest-password">Password</label>
            <div className="wf-http-auth-secret-wrap">
              <textarea
                id="wf-http-auth-digest-password"
                className={`wf-http-auth-textarea${showAuthPassword ? '' : ' wf-http-auth-textarea--masked'}`}
                rows={1}
                value={auth.password || ''}
                onChange={(e) => onAuthChange({ ...auth, password: e.target.value })}
                aria-label="Password"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="wf-http-auth-secret-toggle"
                onClick={() => setShowAuthPassword((v) => !v)}
                title={showAuthPassword ? 'Hide password' : 'Show password'}
                aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
              >
                {showAuthPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>
      )}
      {auth.type === 'oauth2' && (
        <div className="wf-http-auth-fields">
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-token-url">Token URL</label>
            <textarea
              id="wf-http-auth-token-url"
              className="wf-http-auth-textarea"
              rows={1}
              value={auth.tokenUrl || ''}
              onChange={(e) => onAuthChange({ ...auth, tokenUrl: e.target.value })}
              placeholder="https://auth.example.com/oauth/token"
              aria-label="Token URL"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-client-id">Client ID</label>
            <textarea
              id="wf-http-auth-client-id"
              className="wf-http-auth-textarea"
              rows={1}
              value={auth.clientId || ''}
              onChange={(e) => onAuthChange({ ...auth, clientId: e.target.value })}
              aria-label="Client ID"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="wf-http-auth-row">
            <label htmlFor="wf-http-auth-client-secret">Client Secret</label>
            <div className="wf-http-auth-secret-wrap">
              <textarea
                id="wf-http-auth-client-secret"
                className={`wf-http-auth-textarea${showAuthPassword ? '' : ' wf-http-auth-textarea--masked'}`}
                rows={1}
                value={auth.clientSecret || ''}
                onChange={(e) => onAuthChange({ ...auth, clientSecret: e.target.value })}
                aria-label="Client Secret"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="wf-http-auth-secret-toggle"
                onClick={() => setShowAuthPassword((v) => !v)}
                title={showAuthPassword ? 'Hide client secret' : 'Show client secret'}
                aria-label={showAuthPassword ? 'Hide client secret' : 'Show client secret'}
              >
                {showAuthPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
