#!/usr/bin/env node

/**
 * Post-GA P2-B — transport parity matrix automation.
 *
 * Produces a deterministic artifact that asserts frozen transport/call-type
 * semantics and fallback behavior across:
 * - express proxy
 * - grpc-web
 * - spring-servlet
 * - tauri native
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  GRPC_STUDIO_TRANSPORT_MODES,
  GRPC_TRANSPORT_CAPABILITY_MATRIX,
  GRPC_WEB_TRANSPORT_SCHEMA_VERSION,
  assertGrpcTransportCallTypeSupported,
  isGrpcTransportCallTypeSupported,
  GrpcWebTransportPreflightError,
  type GrpcStudioTransportMode,
} from '../src/shared/grpc/grpcWebTransportContracts';
import { GRPC_ERROR_CODES, type GrpcCallType } from '../src/shared/grpc/contracts';
import { GrpcApiClientError } from '../src/shared/grpc/grpcApiClient';
import {
  grpcApiErrorToExpressFallbackBody,
  isGrpcExpressFallbackOffered,
} from '../src/shared/grpc/grpcTransportFallback';

type Check = {
  id: string;
  passed: boolean;
  detail: string;
  meta?: Record<string, unknown>;
};

type Args = {
  outPath: string;
};

const DEFAULT_OUT_PATH = 'artifacts/grpc-transport-parity-matrix.json';

const CALL_TYPES: readonly GrpcCallType[] = [
  'unary',
  'server_streaming',
  'client_streaming',
  'bidi_streaming',
] as const;

const EXPECTED_SUPPORT_MATRIX: Record<GrpcStudioTransportMode, Record<GrpcCallType, boolean>> = {
  express: {
    unary: true,
    server_streaming: true,
    client_streaming: true,
    bidi_streaming: true,
  },
  tauri: {
    unary: true,
    server_streaming: true,
    client_streaming: true,
    bidi_streaming: true,
  },
  'grpc-web': {
    unary: true,
    server_streaming: true,
    client_streaming: false,
    bidi_streaming: false,
  },
  'spring-servlet': {
    unary: true,
    server_streaming: true,
    client_streaming: false,
    bidi_streaming: false,
  },
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    outPath: DEFAULT_OUT_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;

    const equalsIndex = raw.indexOf('=');
    const flag = equalsIndex >= 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex >= 0 ? raw.slice(equalsIndex + 1) : undefined;
    const nextValue = argv[i + 1];
    const hasSeparateValue = inlineValue == null && nextValue != null && !nextValue.startsWith('--');
    const value = inlineValue ?? (hasSeparateValue ? nextValue : '');
    if (hasSeparateValue) i += 1;

    if (flag === '--out' && value) {
      args.outPath = value;
    }
  }

  return args;
}

function addCheck(
  checks: Check[],
  id: string,
  passed: boolean,
  detail: string,
  meta?: Record<string, unknown>,
): void {
  checks.push({ id, passed, detail, ...(meta ? { meta } : {}) });
}

function resolveSupportMatrix(): Record<GrpcStudioTransportMode, Record<GrpcCallType, boolean>> {
  const matrix: Record<GrpcStudioTransportMode, Record<GrpcCallType, boolean>> = {
    express: {
      unary: false,
      server_streaming: false,
      client_streaming: false,
      bidi_streaming: false,
    },
    tauri: {
      unary: false,
      server_streaming: false,
      client_streaming: false,
      bidi_streaming: false,
    },
    'grpc-web': {
      unary: false,
      server_streaming: false,
      client_streaming: false,
      bidi_streaming: false,
    },
    'spring-servlet': {
      unary: false,
      server_streaming: false,
      client_streaming: false,
      bidi_streaming: false,
    },
  };

  for (const mode of GRPC_STUDIO_TRANSPORT_MODES) {
    for (const callType of CALL_TYPES) {
      matrix[mode][callType] = isGrpcTransportCallTypeSupported(mode, callType);
    }
  }

  return matrix;
}

function assertUnsupportedCallTypePreflights(checks: Check[]): void {
  for (const mode of GRPC_STUDIO_TRANSPORT_MODES) {
    for (const callType of CALL_TYPES) {
      const expected = EXPECTED_SUPPORT_MATRIX[mode][callType];
      if (expected) continue;

      let passed = false;
      let observedCode: string | null = null;
      let observedMessage = '';

      try {
        assertGrpcTransportCallTypeSupported(mode, callType);
      } catch (error) {
        if (error instanceof GrpcWebTransportPreflightError) {
          observedCode = error.code;
          observedMessage = error.message;
          passed = observedCode === GRPC_ERROR_CODES.INVALID_REQUEST;
        } else {
          observedMessage = error instanceof Error ? error.message : String(error);
        }
      }

      addCheck(
        checks,
        `unsupported_preflight_${mode}_${callType}`,
        passed,
        `Unsupported combination ${mode}/${callType} is fail-fast preflight guarded`,
        {
          expectedCode: GRPC_ERROR_CODES.INVALID_REQUEST,
          observedCode,
          observedMessage,
        },
      );
    }
  }
}

function assertSupportedCallTypePreflights(checks: Check[]): void {
  for (const mode of GRPC_STUDIO_TRANSPORT_MODES) {
    for (const callType of CALL_TYPES) {
      const expected = EXPECTED_SUPPORT_MATRIX[mode][callType];
      if (!expected) continue;

      let passed = true;
      let observedMessage = '';
      try {
        assertGrpcTransportCallTypeSupported(mode, callType);
      } catch (error) {
        passed = false;
        observedMessage = error instanceof Error ? error.message : String(error);
      }

      addCheck(
        checks,
        `supported_preflight_${mode}_${callType}`,
        passed,
        `Supported combination ${mode}/${callType} does not fail preflight validation`,
        {
          observedMessage,
        },
      );
    }
  }
}

function assertCapabilityFlags(checks: Check[]): void {
  const expectedFlags: Record<
    GrpcStudioTransportMode,
    {
      browserDirect: boolean;
      usesExpressProxy: boolean;
      tauriNative: boolean;
    }
  > = {
    express: {
      browserDirect: false,
      usesExpressProxy: true,
      tauriNative: false,
    },
    tauri: {
      browserDirect: false,
      usesExpressProxy: false,
      tauriNative: true,
    },
    'grpc-web': {
      browserDirect: true,
      usesExpressProxy: false,
      tauriNative: false,
    },
    'spring-servlet': {
      browserDirect: true,
      usesExpressProxy: false,
      tauriNative: false,
    },
  };

  for (const mode of GRPC_STUDIO_TRANSPORT_MODES) {
    const caps = GRPC_TRANSPORT_CAPABILITY_MATRIX[mode];
    const expected = expectedFlags[mode];

    addCheck(
      checks,
      `capability_flags_${mode}`,
      caps.browserDirect === expected.browserDirect
        && caps.usesExpressProxy === expected.usesExpressProxy
        && caps.tauriNative === expected.tauriNative,
      `${mode} capability flags match frozen transport contract`,
      {
        expected,
        actual: {
          browserDirect: caps.browserDirect,
          usesExpressProxy: caps.usesExpressProxy,
          tauriNative: caps.tauriNative,
        },
      },
    );
  }
}

function assertFallbackSemantics(checks: Check[]): void {
  const preflightError = new GrpcApiClientError('call', 'native preflight failed', {
    code: GRPC_ERROR_CODES.UNREACHABLE,
    category: 'unreachable',
    retryable: false,
  });
  const preflightMapped = grpcApiErrorToExpressFallbackBody(preflightError);

  addCheck(
    checks,
    'fallback_offer_for_native_preflight',
    isGrpcExpressFallbackOffered(preflightMapped)
      && preflightMapped.retryable === true,
    'Native preflight errors are promoted to retryable Express fallback offers',
    {
      mapped: preflightMapped,
    },
  );

  const grpcStatusError = new GrpcApiClientError('call', 'grpc status unavailable', {
    code: GRPC_ERROR_CODES.CALL_FAILED,
    category: 'grpc-status',
    retryable: true,
    details: { grpcStatus: 14 },
  });
  const grpcStatusMapped = grpcApiErrorToExpressFallbackBody(grpcStatusError);

  addCheck(
    checks,
    'fallback_not_offered_for_grpc_status_errors',
    !isGrpcExpressFallbackOffered(grpcStatusMapped),
    'gRPC status failures do not receive native-preflight fallback decoration',
    {
      mapped: grpcStatusMapped,
    },
  );
}

async function writeReport(outPath: string, report: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const checks: Check[] = [];

  const resolvedSupportMatrix = resolveSupportMatrix();

  for (const mode of GRPC_STUDIO_TRANSPORT_MODES) {
    for (const callType of CALL_TYPES) {
      const expected = EXPECTED_SUPPORT_MATRIX[mode][callType];
      const actual = resolvedSupportMatrix[mode][callType];
      addCheck(
        checks,
        `support_${mode}_${callType}`,
        actual === expected,
        `${mode} supports ${callType}=${String(expected)}`,
        { expected, actual },
      );
    }
  }

  assertUnsupportedCallTypePreflights(checks);
  assertSupportedCallTypePreflights(checks);
  assertCapabilityFlags(checks);
  assertFallbackSemantics(checks);

  const report = {
    kind: 'grpc_transport_parity_matrix',
    capturedAt: new Date().toISOString(),
    inputs: {
      schemaVersion: GRPC_WEB_TRANSPORT_SCHEMA_VERSION,
      modes: GRPC_STUDIO_TRANSPORT_MODES,
      callTypes: CALL_TYPES,
    },
    expectedSupportMatrix: EXPECTED_SUPPORT_MATRIX,
    resolvedSupportMatrix,
    totals: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    checks,
  };

  await writeReport(args.outPath, report);
  console.log(`[grpc-transport-parity] report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    for (const check of checks.filter((item) => !item.passed)) {
      console.error(`[grpc-transport-parity] FAIL ${check.id}: ${check.detail}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[grpc-transport-parity] fatal error', error);
  process.exit(1);
});
