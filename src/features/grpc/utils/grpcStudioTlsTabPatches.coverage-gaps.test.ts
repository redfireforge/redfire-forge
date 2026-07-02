import { describe, expect, it } from 'vitest';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import {
  buildGrpcTlsConfigTabPatch,
  buildGrpcTlsModeTabPatch,
  buildGrpcTlsStateRestoreTabPatch,
} from './grpcStudioTlsTabPatches';
import type { GrpcTabConnectionResolution } from './resolveGrpcTabConnection';

describe('grpcStudioTlsTabPatches coverage gaps', () => {
  const activeConnection: GrpcTabConnectionResolution = {
    target: 'localhost:50051',
    tlsMode: 'tls',
    connectionProfileId: undefined,
    profileName: undefined,
    validationMessage: undefined,
  };

  it('buildGrpcTlsModeTabPatch clears tls secrets when mode is disabled', () => {
    const tab = createGrpcStudioTab({
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: 'ca' },
      maskedSecretFields: { tls: { serverCaPem: true, clientCertPem: true } },
    });
    const patch = buildGrpcTlsModeTabPatch({ tab, activeConnection }, 'disabled');
    expect(patch.tlsMode).toBe('disabled');
    expect(patch.tlsConfig).toBeUndefined();
    expect(patch.maskedSecretFields).toBeUndefined();
  });

  it('buildGrpcTlsModeTabPatch keeps auth masks when disabling tls with auth secrets', () => {
    const tab = createGrpcStudioTab({
      maskedSecretFields: {
        tls: { serverCaPem: true },
        auth: { bearerToken: true },
      },
    });
    const patch = buildGrpcTlsModeTabPatch({ tab, activeConnection }, 'disabled');
    expect(patch.maskedSecretFields).toEqual({ auth: { bearerToken: true } });
  });

  it('buildGrpcTlsModeTabPatch keeps masked fields when enabling tls', () => {
    const tab = createGrpcStudioTab({
      maskedSecretFields: { tls: { serverCaPem: true } },
    });
    const patch = buildGrpcTlsModeTabPatch({ tab, activeConnection }, 'tls');
    expect(patch.tlsMode).toBe('tls');
    expect(patch.tlsConfig).toBeUndefined();
    expect(patch.maskedSecretFields).toBeUndefined();
  });

  it('buildGrpcTlsConfigTabPatch falls back to activeConnection tlsMode when tab mode is unset', () => {
    const tab = createGrpcStudioTab({ tlsMode: undefined, tlsConfig: { serverCaPem: 'ca' } });
    const patch = buildGrpcTlsConfigTabPatch(
      { tab, activeConnection },
      { serverNameOverride: 'grpc.local' },
    );
    expect(patch.tlsConfig?.serverNameOverride).toBe('grpc.local');
    expect(patch.tlsConfig?.serverCaPem).toBe('ca');
  });

  it('buildGrpcTlsStateRestoreTabPatch strips tls masks when restoring disabled mode', () => {
    const tab = createGrpcStudioTab({
      maskedSecretFields: { tls: { clientKeyPem: true } },
    });
    const patch = buildGrpcTlsStateRestoreTabPatch(tab, {
      tlsMode: 'disabled',
      tlsConfig: undefined,
    });
    expect(patch.tlsMode).toBe('disabled');
    expect(patch.maskedSecretFields).toBeUndefined();
  });

  it('buildGrpcTlsStateRestoreTabPatch preserves masks when restoring tls mode', () => {
    const tab = createGrpcStudioTab({
      maskedSecretFields: { tls: { clientKeyPem: true } },
    });
    const patch = buildGrpcTlsStateRestoreTabPatch(tab, {
      tlsMode: 'mtls',
      tlsConfig: { serverName: 'secure.local' },
    });
    expect(patch.tlsMode).toBe('mtls');
    expect(patch.tlsConfig).toEqual({ serverName: 'secure.local' });
    expect(patch.maskedSecretFields).toBeUndefined();
  });
});
