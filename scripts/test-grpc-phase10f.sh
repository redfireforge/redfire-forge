#!/usr/bin/env bash
# Phase 10F — Metadata/auth/tls normalization parity gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10F gate: metadata/auth/tls normalization parity ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcBrowserTransportMetadataNorm.ts
  src/shared/grpc/grpcBrowserTransportMetadataNorm.test.ts
  src/shared/grpc/grpcPhase10fAcceptance.test.ts
  scripts/test-grpc-phase10f.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10F deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10f"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10f' >&2
  exit 1
fi
if ! grep -q 'GRPC_WEB_RESERVED_HEADERS' "$ROOT/src/shared/grpc/grpcWebTransportContracts.ts"; then
  echo 'Missing GRPC_WEB_RESERVED_HEADERS in grpcWebTransportContracts' >&2
  exit 1
fi
if ! grep -q 'buildBrowserTransportUserMetadataHeaders' "$ROOT/src/shared/grpc/grpcGrpcWebUnaryClient.ts"; then
  echo 'Missing shared norm in grpcGrpcWebUnaryClient' >&2
  exit 1
fi
if ! grep -q 'buildBrowserTransportUserMetadataHeaders' "$ROOT/src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts"; then
  echo 'Missing shared norm in grpcGrpcSpringServletUnaryClient' >&2
  exit 1
fi
NORM_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcBrowserTransportMetadataNorm.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10fAcceptance.test.ts")
if [[ "${NORM_TEST_COUNT:-0}" -lt 10 ]]; then
  echo "Expected at least 10 norm unit tests, found ${NORM_TEST_COUNT:-0}" >&2
  exit 1
fi
if ! grep -q 'Phase 4 redaction regression' "$ROOT/src/shared/grpc/grpcPhase10fAcceptance.test.ts"; then
  echo 'Missing Phase 4 redaction regression tests in grpcPhase10fAcceptance' >&2
  exit 1
fi
if ! grep -q 'metadata casing parity' "$ROOT/src/shared/grpc/grpcPhase10fAcceptance.test.ts"; then
  echo 'Missing metadata casing parity tests in grpcPhase10fAcceptance' >&2
  exit 1
fi
if ! grep -q 'auth precedence before transport' "$ROOT/src/shared/grpc/grpcPhase10fAcceptance.test.ts"; then
  echo 'Missing auth precedence tests in grpcPhase10fAcceptance' >&2
  exit 1
fi
if ! grep -q 'export const GRPC_AUTH_HEADER_KEYS' "$ROOT/src/shared/grpc/grpcBrowserTransportMetadataNorm.ts"; then
  echo 'Missing GRPC_AUTH_HEADER_KEYS export in grpcBrowserTransportMetadataNorm' >&2
  exit 1
fi
if ! grep -q 'prepareGrpcCallMetadata' "$ROOT/src/features/grpc/grpcStudioTypes.ts"; then
  echo 'Missing prepareGrpcCallMetadata wiring in grpcStudioTypes execute boundary' >&2
  exit 1
fi
if ! grep -q 'spring-servlet: user cannot override TE via metadata' "$ROOT/src/shared/grpc/grpcPhase10fAcceptance.test.ts"; then
  echo 'Missing spring-servlet TE reserved-header test in grpcPhase10fAcceptance' >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 16 ]]; then
  echo "Expected at least 14 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${NORM_TEST_COUNT} norm + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Shared normalization module tests ---"
npx vitest run \
  src/shared/grpc/grpcBrowserTransportMetadataNorm.test.ts
echo ""

echo "--- Step 3: Cross-mode parity acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase10fAcceptance.test.ts
echo ""

echo "--- Step 4: Transport client regression (post-refactor) ---"
npx vitest run \
  src/shared/grpc/grpcGrpcWebUnaryClient.test.ts \
  src/shared/grpc/grpcGrpcWebUnaryClient.coverage-gaps.test.ts \
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.test.ts \
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.coverage-gaps.test.ts
echo ""

echo "--- Step 5: Phase 10E regression ---"
grpc_gate_run_regression "Phase phase10e" test:grpc:phase10e
echo ""

echo "=== Phase 10F gate: PASSED ==="
