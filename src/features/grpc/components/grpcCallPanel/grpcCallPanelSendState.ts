export interface GrpcSendBlockHintInput {
  hasMethod: boolean;
  targetValid: boolean;
  tlsValid: boolean;
  allowSendWithoutOAuth2: boolean;
  hasTypedOAuth2Input: boolean;
  authReady: boolean;
  authIssueMessage?: string | null;
  authErrorMessage?: string | null;
  metadataReady: boolean;
  metadataValidationMessage?: string | null;
  composerFormReady: boolean;
  composerJsonReady: boolean;
  formError?: string | null;
  jsonError?: string | null;
  offTabJsonValidationError?: string | null;
}

export function resolveGrpcSendBlockHint(input: GrpcSendBlockHintInput): string | null {
  if (!input.hasMethod) return null;
  if (!input.targetValid) {
    return 'Set a valid target endpoint before sending.';
  }
  if (!input.tlsValid) {
    return 'Fix TLS configuration in the connection panel before sending.';
  }
  if (input.allowSendWithoutOAuth2 && input.hasTypedOAuth2Input) {
    return 'OAuth2 is incomplete. Send will run without OAuth2 until token URL, client ID, and client secret are set.';
  }
  if (!input.authReady) {
    return input.authIssueMessage
      ?? input.authErrorMessage
      ?? 'Complete auth configuration before sending.';
  }
  if (!input.metadataReady) {
    return input.metadataValidationMessage
      ?? 'Fix metadata validation errors before sending.';
  }
  if (!input.composerFormReady) {
    return input.formError ?? 'Fix form input errors before sending.';
  }
  if (!input.composerJsonReady) {
    return input.jsonError
      ?? input.offTabJsonValidationError
      ?? 'Fix JSON request body errors before sending.';
  }
  return null;
}
