import type { AuthConfig, GlobalAuthProfile } from '../../../shared/types';

export type ModalAuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'global-profile';

export interface EnvAuthState {
  authType: ModalAuthType;
  bearerPrefix: string;
  bearerToken: string;
  basicUser: string;
  basicPass: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  selectedProfileId: string;
}

export function getAuthType(auth?: AuthConfig, allProfiles?: GlobalAuthProfile[]): ModalAuthType {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return 'none';
  if (auth.globalProfileId && allProfiles?.length) return 'global-profile';
  return auth.type as ModalAuthType;
}

export function authToState(auth: AuthConfig | undefined, profiles: GlobalAuthProfile[]): EnvAuthState {
  return {
    authType: getAuthType(auth, profiles),
    bearerPrefix: auth?.prefix ?? 'Bearer',
    bearerToken: auth?.token ?? '',
    basicUser: auth?.username ?? '',
    basicPass: auth?.password ?? '',
    apiKeyName: auth?.apiKeyName ?? '',
    apiKeyValue: auth?.apiKeyValue ?? '',
    apiKeyIn: auth?.apiKeyIn ?? 'header',
    tokenUrl: auth?.tokenUrl ?? '',
    clientId: auth?.clientId ?? '',
    clientSecret: auth?.clientSecret ?? '',
    selectedProfileId: auth?.globalProfileId ?? (profiles[0]?.id ?? ''),
  };
}

export function stateToAuth(s: EnvAuthState, profiles: GlobalAuthProfile[]): AuthConfig | undefined {
  switch (s.authType) {
    case 'bearer': return { type: 'bearer', prefix: s.bearerPrefix, token: s.bearerToken };
    case 'basic': return { type: 'basic', username: s.basicUser, password: s.basicPass };
    case 'apikey': return { type: 'apikey', apiKeyName: s.apiKeyName, apiKeyValue: s.apiKeyValue, apiKeyIn: s.apiKeyIn };
    case 'oauth2': return { type: 'oauth2', tokenUrl: s.tokenUrl, clientId: s.clientId, clientSecret: s.clientSecret };
    case 'global-profile': {
      const profile = profiles.find(p => p.id === s.selectedProfileId);
      if (profile) return { ...profile.auth, globalProfileId: s.selectedProfileId };
      return { type: 'none' };
    }
    default: return { type: 'none' };
  }
}

export function emptyAuthState(profiles: GlobalAuthProfile[]): EnvAuthState {
  return authToState(undefined, profiles);
}
