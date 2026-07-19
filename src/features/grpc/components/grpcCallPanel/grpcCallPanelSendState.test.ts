import { describe, it, expect } from 'vitest';
import { resolveGrpcSendBlockHint } from './grpcCallPanelSendState';

describe('resolveGrpcSendBlockHint', () => {
  it('allows sends when the request is not using a method yet', () => {
    expect(resolveGrpcSendBlockHint({
      hasMethod: false,
      targetValid: false,
      tlsValid: false,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: false,
      metadataReady: false,
      composerFormReady: false,
      composerJsonReady: false,
    })).toBeNull();
  });

  it('returns the first applicable blocking hint in priority order', () => {
    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: false,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('Set a valid target endpoint before sending.');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: false,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('Fix TLS configuration in the connection panel before sending.');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: true,
      hasTypedOAuth2Input: true,
      authReady: true,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('OAuth2 is incomplete. Send will run without OAuth2 until token URL, client ID, and client secret are set.');
  });

  it('falls back to later validation messages when earlier checks pass', () => {
    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: false,
      authIssueMessage: 'Auth issue',
      metadataReady: false,
      metadataValidationMessage: 'Metadata issue',
      composerFormReady: false,
      formError: 'Form issue',
      composerJsonReady: false,
      jsonError: 'JSON issue',
      offTabJsonValidationError: 'Off-tab JSON issue',
    })).toBe('Auth issue');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: false,
      metadataValidationMessage: 'Metadata issue',
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('Metadata issue');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: false,
      formError: 'Form issue',
      composerJsonReady: false,
    })).toBe('Form issue');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: false,
      offTabJsonValidationError: 'Off-tab JSON issue',
    })).toBe('Off-tab JSON issue');
  });

  it('uses default messages when specific validation messages are absent', () => {
    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: false,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('Complete auth configuration before sending.');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: false,
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('Fix metadata validation errors before sending.');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: false,
      composerJsonReady: true,
    })).toBe('Fix form input errors before sending.');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: false,
    })).toBe('Fix JSON request body errors before sending.');
  });

  it('falls back to authErrorMessage and jsonError when those messages are provided', () => {
    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: false,
      authErrorMessage: 'Auth error',
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: true,
    })).toBe('Auth error');

    expect(resolveGrpcSendBlockHint({
      hasMethod: true,
      targetValid: true,
      tlsValid: true,
      allowSendWithoutOAuth2: false,
      hasTypedOAuth2Input: false,
      authReady: true,
      metadataReady: true,
      composerFormReady: true,
      composerJsonReady: false,
      jsonError: 'JSON error',
    })).toBe('JSON error');
  });
});