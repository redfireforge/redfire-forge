/**
 * Phase 4I — acceptance checklist traceability.
 *
 * Maps plan § Phase 4 acceptance checklist + threat-model spot checks to
 * executable assertions. Detailed unit coverage lives in sub-gate test files;
 * this file is the 4I merge-gate summary.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { GRPC_ERROR_CODES, normalizeGrpcMetadata } from './contracts';
import { mergeGrpcExecuteMetadata } from './grpcAuthPolicy';
import {
  GRPC_REDACTED_PEM_PLACEHOLDER,
  GRPC_REDACTED_PLACEHOLDER,
  sanitizeGrpcErrorMessage,
} from './grpcRedaction';
import { assertTabTlsConfigValid } from '../../features/grpc/hooks/grpcStudioSessionHelpers';
import {
  prepareGrpcCallHistoryExport,
  prepareGrpcExportBundle,
  prepareGrpcHarnessScenarioExport,
  prepareGrpcWorkflowNodeExport,
} from '../../features/grpc/utils/grpcCrossFeatureExport';
import {
  classifyGrpcTransportFailure,
  formatGrpcTransportFailureMessage,
} from './grpcTransportErrors';
import { normalizeGrpcTlsConfig, validateGrpcTlsConfigContract } from './grpcTlsPolicy';
import {
  validateGrpcMetadataRecord,
} from './metadataValidation';
import { scanForbiddenGrpcPersistTargets, scanGrpcObjectForSecretLeakage } from './grpcSecretLeakScan';
import { createGrpcSavedRequestFromSnapshot } from './grpcSavedRequest';
import { validatePhase1UnaryCallRequest } from './requestValidation';
import {
  persistDismissedGrpcStudioHints,
  readDismissedGrpcStudioHints,
  shouldShowPermissionDeniedHint,
  type GrpcStudioHintId,
} from '../../features/grpc/utils/grpcSpringHints';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
TEST-CA
-----END CERTIFICATE-----`;

const RAW_SNAPSHOT = {
  tabId: 'tab-1',
  requestId: 'req-1',
  capturedAt: '2026-01-01T00:00:00.000Z',
  callType: 'unary' as const,
  target: {
    address: 'localhost:50051',
    tlsMode: 'tls' as const,
    tlsConfig: { serverCaPem: VALID_PEM },
  },
  service: 'echo.EchoService',
  method: 'Echo',
  body: { message: 'hi' },
  metadata: { authorization: 'Bearer super-secret-token-value' },
  timeoutMs: 30000,
  descriptorKey: 'desc-1',
  auth: { type: 'bearer' as const, bearerToken: 'super-secret-token-value' },
};

function isPermissionDeniedHintVisible(input: Parameters<typeof shouldShowPermissionDeniedHint>[0], dismissed: Set<GrpcStudioHintId>): boolean {
  return shouldShowPermissionDeniedHint(input) && !dismissed.has('spring_permission_denied');
}

describe('Phase 4 acceptance checklist (4I traceability)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('blocks mtls without client cert and key locally with actionable validation', () => {
    const issues = validateGrpcTlsConfigContract('mtls', {
      serverCaPem: VALID_PEM,
    });
    const certIssue = issues.find((issue) => issue.field === 'tlsConfig.clientCertPem');
    const keyIssue = issues.find((issue) => issue.field === 'tlsConfig.clientKeyPem');
    expect(certIssue).toBeDefined();
    expect(keyIssue).toBeDefined();
    for (const issue of [certIssue, keyIssue]) {
      expect(issue!.message.length).toBeGreaterThan(10);
    }

    expect(() => assertTabTlsConfigValid(
      {
        target: 'localhost:50051',
        tlsMode: 'mtls',
        targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
      },
      { serverCaPem: VALID_PEM },
    )).toThrow(/clientCertPem|client cert/i);
  });

  it('classifies TLS hostname mismatch and unknown CA as distinct failures', () => {
    const hostname = classifyGrpcTransportFailure(
      new Error('Hostname/IP does not match certificate altnames'),
    );
    const unknownCa = classifyGrpcTransportFailure(
      new Error('self-signed certificate in certificate chain'),
    );

    expect(hostname.details.tlsFailure).toBe('hostname_mismatch');
    expect(unknownCa.details.tlsFailure).toBe('unknown_ca');
    expect(formatGrpcTransportFailureMessage({ tlsFailure: 'hostname_mismatch' }))
      .toMatch(/hostname/i);
    expect(formatGrpcTransportFailureMessage({ tlsFailure: 'unknown_ca' }))
      .toMatch(/not trusted|unknown/i);
    expect(formatGrpcTransportFailureMessage({ tlsFailure: 'hostname_mismatch' }))
      .not.toEqual(formatGrpcTransportFailureMessage({ tlsFailure: 'unknown_ca' }));
  });

  it('blocks Authorization conflicts between manual metadata and auth panel', () => {
    const merged = mergeGrpcExecuteMetadata(
      { authorization: 'Bearer manual-metadata-token' },
      { type: 'bearer', bearerToken: 'panel-token-value' },
    );
    expect(merged.ok).toBe(false);
    if (merged.ok) return;
    expect(merged.field).toBe('auth');
    expect(merged.error).toMatch(/authorization/i);
  });

  it('accepts valid -bin base64 metadata through execute validation without corruption', () => {
    const payload = Buffer.from('hello-grpc-bin').toString('base64');
    expect(validateGrpcMetadataRecord({ 'payload-bin': payload })).toBeNull();
    expect(normalizeGrpcMetadata({ 'payload-bin': payload })['payload-bin']).toBe(payload);
    expect(validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      metadata: { 'payload-bin': payload },
    })).toEqual([]);
    expect(validateGrpcMetadataRecord({ 'payload-bin': 'not-valid-base64!!!' }))
      .toMatch(/valid base64/i);
    expect(validateGrpcMetadataRecord({ 'payload-bin': '' }))
      .toMatch(/non-empty base64/i);
  });

  it('redacts secrets from all forbidden persist export surfaces', () => {
    const bundle = prepareGrpcExportBundle({
      snapshot: RAW_SNAPSHOT,
      identity: { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
    });
    const history = prepareGrpcCallHistoryExport({ snapshot: RAW_SNAPSHOT });
    const workflow = prepareGrpcWorkflowNodeExport({ label: 'Echo', snapshot: RAW_SNAPSHOT });
    const harness = prepareGrpcHarnessScenarioExport({ name: 'Echo', snapshot: RAW_SNAPSHOT });

    const payload = {
      grpc_export_bundle: bundle,
      grpc_call_history_v1: history,
      workflow_node_snapshot: workflow,
      harness_scenario_export: harness,
    };
    expect(scanForbiddenGrpcPersistTargets(payload)).toHaveLength(0);

    for (const snapshot of [
      bundle.snapshot,
      history.snapshot,
      workflow.snapshot,
      harness.snapshot,
    ]) {
      expect(snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
      expect(snapshot.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
      expect(snapshot.target.tlsConfig?.serverCaPem).toBe(GRPC_REDACTED_PEM_PLACEHOLDER);
    }
    expect(bundle.savedRequest.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('shows Spring PERMISSION_DENIED hint only for gRPC status 7, hides when dismissed', () => {
    expect(shouldShowPermissionDeniedHint({ unaryStatus: 7 })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ streamStatus: 7 })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ unaryStatus: 16 })).toBe(false);
    expect(shouldShowPermissionDeniedHint({
      lastError: {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'Permission denied',
        details: { grpcStatus: 7 },
      },
    })).toBe(true);
    expect(shouldShowPermissionDeniedHint({
      streamError: {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'Permission denied',
        details: { grpcStatus: 7 },
      },
    })).toBe(true);
    expect(shouldShowPermissionDeniedHint({
      lastError: {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'Unauthenticated',
        details: { grpcStatus: 16 },
      },
    })).toBe(false);

    expect(isPermissionDeniedHintVisible({ unaryStatus: 7 }, new Set())).toBe(true);
    persistDismissedGrpcStudioHints(new Set(['spring_permission_denied']));
    const dismissed = readDismissedGrpcStudioHints();
    expect(dismissed).toEqual(new Set(['spring_permission_denied']));
    expect(isPermissionDeniedHintVisible({ unaryStatus: 7 }, dismissed)).toBe(false);
    expect(isPermissionDeniedHintVisible({ unaryStatus: 16 }, dismissed)).toBe(false);
  });
});

describe('Phase 4 threat-model spot checks (4I)', () => {
  it('T1 — saved request persist strips bearer secrets before storage', () => {
    const saved = createGrpcSavedRequestFromSnapshot(RAW_SNAPSHOT, {
      id: 'sr-1',
      revisionId: 'rev-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(scanGrpcObjectForSecretLeakage(saved)).toHaveLength(0);
    expect(saved.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(saved.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(saved.tlsConfig?.serverCaPem).toBe(GRPC_REDACTED_PEM_PLACEHOLDER);
  });

  it('T2 — error messages strip PEM blocks before display', () => {
    const raw = 'TLS failed: -----BEGIN PRIVATE KEY-----\nLEAKED\n-----END PRIVATE KEY-----';
    const sanitized = sanitizeGrpcErrorMessage(raw);
    expect(sanitized).not.toContain('LEAKED');
    expect(sanitized).toContain(GRPC_REDACTED_PEM_PLACEHOLDER);
  });

  it('T4 — auth panel conflicts with manual Authorization on unary fixture metadata shape', () => {
    const merged = mergeGrpcExecuteMetadata(
      { ...FIXTURE_UNARY_CALL_REQUEST.metadata, authorization: 'Bearer manual-token' },
      { type: 'bearer', bearerToken: 'panel-token-value' },
    );
    expect(merged.ok).toBe(false);
    if (merged.ok) return;
    expect(merged.field).toBe('auth');
    expect(merged.error).toMatch(/authorization/i);
  });

  it('T5 — mTLS validation issues are actionable strings', () => {
    const issues = validateGrpcTlsConfigContract('mtls', {});
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(10);
    }
  });

  it('T8 — server name override is stripped in plaintext TLS mode', () => {
    const normalized = normalizeGrpcTlsConfig({
      serverCaPem: VALID_PEM,
      serverNameOverride: 'api.example.com',
    }, 'disabled');
    expect(normalized?.serverNameOverride).toBeUndefined();
    expect(normalized?.serverCaPem).toBe(VALID_PEM);
  });
});
