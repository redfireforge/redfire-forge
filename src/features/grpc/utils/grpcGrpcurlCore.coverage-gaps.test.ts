/**
 * Phase 5F — coverage gaps for grpcGrpcurlCore.
 */
import { describe, expect, it } from 'vitest';
import {
  buildGrpcurlInvokeCommand,
  grpcGrpcurlImportToTabPatch,
  normalizeGrpcurlCommandInput,
  parseGrpcurlCommand,
} from './grpcGrpcurlCore';

describe('grpcGrpcurlCore coverage gaps', () => {
  it('warns when -plaintext conflicts with TLS cert paths', () => {
    const parsed = parseGrpcurlCommand(
      'grpcurl -plaintext -cert client.pem -key client.key localhost:50051 echo.EchoService/Echo',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.tlsMode).toBe('disabled');
    expect(parsed.warnings.some((w) => w.includes('plaintext conflicts'))).toBe(true);
  });

  it('exports tls mode tls with cacert only (no client cert flags)', () => {
    const command = buildGrpcurlInvokeCommand({
      targetAddress: 'localhost:50051',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'tls',
      tlsFilePaths: { caCertPath: './ca.pem', certPath: './ignored.pem' },
    });
    expect(command).toContain('-cacert ./ca.pem');
    expect(command).not.toContain('-cert');
  });

  it('grpcGrpcurlImportToTabPatch omits tlsConfig when authority absent', () => {
    const parsed = parseGrpcurlCommand('grpcurl -plaintext localhost:50051 echo.EchoService/Echo');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(grpcGrpcurlImportToTabPatch(parsed).tlsConfig).toBeUndefined();
  });

  it('rejects invalid -H header format', () => {
    const parsed = parseGrpcurlCommand('grpcurl -H badheader localhost:50051 echo.EchoService/Echo');
    expect(parsed.ok).toBe(false);
  });

  it('rejects missing flag values and invalid JSON body', () => {
    expect(parseGrpcurlCommand('grpcurl -d localhost:50051 echo.EchoService/Echo').ok).toBe(false);
    expect(parseGrpcurlCommand('grpcurl -d "not-json" localhost:50051 echo.EchoService/Echo').ok).toBe(false);
    expect(parseGrpcurlCommand('grpcurl -proto localhost:50051 echo.EchoService/Echo').ok).toBe(false);
  });

  it('flags unknown options and -format non-json warnings', () => {
    const parsed = parseGrpcurlCommand(
      'grpcurl -emit-defaults -format text -d \'{"message":"hi"}\' localhost:50051 echo.EchoService/Echo',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.unsupportedFlags).toContain('-emit-defaults');
    expect(parsed.warnings.some((w) => w.includes('partially imported'))).toBe(true);
  });

  it('normalizeGrpcurlCommandInput collapses backslash continuations', () => {
    expect(normalizeGrpcurlCommandInput('grpcurl \\\n  -plaintext host:1 svc/Method')).toBe(
      'grpcurl -plaintext host:1 svc/Method',
    );
  });
});
