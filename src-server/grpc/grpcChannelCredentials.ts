/**
 * Phase 4F — @grpc/grpc-js channel credentials from normalized GrpcTarget TLS fields.
 */
import * as grpc from '@grpc/grpc-js';
import tls from 'node:tls';
import {
  defaultGrpcTlsMode,
  type GrpcTlsConfig,
  type GrpcTlsMode,
} from '../../src/shared/grpc/contracts.js';

export interface GrpcChannelCredentialsInput {
  tlsMode?: GrpcTlsMode;
  tlsConfig?: GrpcTlsConfig;
}

export function buildGrpcChannelCredentials(
  input: GrpcChannelCredentialsInput,
): grpc.ChannelCredentials {
  const mode = input.tlsMode ?? defaultGrpcTlsMode();
  if (mode === 'disabled') {
    return grpc.credentials.createInsecure();
  }

  const config = input.tlsConfig ?? {};
  const rootCerts = config.serverCaPem?.trim()
    ? Buffer.from(config.serverCaPem)
    : null;

  const privateKey = mode === 'mtls' && config.clientKeyPem?.trim()
    ? Buffer.from(config.clientKeyPem)
    : null;
  const certChain = mode === 'mtls' && config.clientCertPem?.trim()
    ? Buffer.from(config.clientCertPem)
    : null;

  const serverName = config.serverNameOverride?.trim();
  const verifyOptions: grpc.VerifyOptions | undefined = serverName
    ? {
        checkServerIdentity: (_host, cert) => tls.checkServerIdentity(serverName, cert),
      }
    : undefined;

  return grpc.credentials.createSsl(
    rootCerts,
    privateKey,
    certChain,
    verifyOptions,
  );
}
