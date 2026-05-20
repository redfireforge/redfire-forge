import { useState, useCallback } from 'react';
import type { AuthConfig } from '../../../shared/types';
import { acquireOAuth2Token } from '../../../engine/tokenManager';
import { toErrorMessage } from '../../../shared/utils/helpers';

export interface AuthVerifyResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export function useAuthVerify() {
  const [authVerifying, setAuthVerifying] = useState(false);
  const [authVerifyResult, setAuthVerifyResult] = useState<AuthVerifyResult | null>(null);

  const verifyAuth = useCallback(async (auth: AuthConfig) => {
    setAuthVerifying(true);
    setAuthVerifyResult(null);
    try {
      if (auth.type === 'oauth2') {
        if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
          const missing = [!auth.tokenUrl && 'Token URL', !auth.clientId && 'Client ID', !auth.clientSecret && 'Client Secret'].filter(Boolean).join(', ');
          setAuthVerifyResult({ ok: false, message: `Missing: ${missing}` });
          return;
        }
        const token = await acquireOAuth2Token(auth);
        const parts = token.split('.');
        let detail = `Token: ${token.slice(0, 20)}...${token.slice(-10)}`;
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp) {
              const expDate = new Date(payload.exp * 1000);
              detail += `\nExpires: ${expDate.toLocaleString()}`;
            }
            if (payload.scope) detail += `\nScope: ${payload.scope}`;
          } catch { /* not a JWT */ }
        }
        setAuthVerifyResult({ ok: true, message: 'Token acquired successfully', detail });
      } else if (auth.type === 'basic') {
        if (!auth.username) { setAuthVerifyResult({ ok: false, message: 'Username is required' }); return; }
        setAuthVerifyResult({ ok: true, message: 'Basic Auth configured', detail: `Username: ${auth.username}` });
      } else if (auth.type === 'bearer') {
        if (!auth.token) { setAuthVerifyResult({ ok: false, message: 'Token is required' }); return; }
        const prefix = auth.prefix?.trim() || 'Bearer';
        setAuthVerifyResult({ ok: true, message: 'Bearer Token configured', detail: `${prefix} ${auth.token.slice(0, 20)}...` });
      } else if (auth.type === 'apikey') {
        if (!auth.apiKeyName || !auth.apiKeyValue) { setAuthVerifyResult({ ok: false, message: 'Key Name and Key Value are required' }); return; }
        setAuthVerifyResult({ ok: true, message: 'API Key configured', detail: `${auth.apiKeyName} → ${auth.apiKeyIn === 'query' ? 'Query Param' : 'Header'}` });
      } else if (auth.type === 'digest') {
        if (!auth.username) { setAuthVerifyResult({ ok: false, message: 'Username is required' }); return; }
        setAuthVerifyResult({ ok: true, message: 'Digest Auth configured', detail: `Username: ${auth.username}` });
      } else {
        setAuthVerifyResult({ ok: false, message: 'No auth type selected' });
      }
    } catch (err) {
      setAuthVerifyResult({ ok: false, message: toErrorMessage(err) });
    } finally {
      setAuthVerifying(false);
    }
  }, []);

  return { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth };
}
