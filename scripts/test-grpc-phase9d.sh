#!/usr/bin/env bash
# Phase 9D — gRPC target validation + canonical env token gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9D: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcTargetValidationCatalog.ts
  src/shared/grpc/grpcCanonicalEnvValidation.ts
  src/shared/grpc/grpcTargetValidationCatalog.test.ts
  src/shared/grpc/grpcCanonicalEnvValidation.test.ts
  src/shared/grpc/grpcPhase9dAcceptance.test.ts
  src/shared/grpc/grpcTargetValidationParity.test.ts
  scripts/test-grpc-phase9d.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9D deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9d"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9d' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcTargetValidationCatalog.test.ts" \
  "$ROOT/src/shared/grpc/grpcCanonicalEnvValidation.test.ts" \
  "$ROOT/src/shared/grpc/targetValidation.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9dAcceptance.test.ts" \
  "$ROOT/src/shared/grpc/grpcTargetValidationParity.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 9D tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9D: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9D: Target validation + canonical env tests =="
npx vitest run \
  src/shared/grpc/grpcTargetValidationCatalog.test.ts \
  src/shared/grpc/grpcCanonicalEnvValidation.test.ts \
  src/shared/grpc/targetValidation.test.ts \
  src/shared/grpc/grpcPhase9dAcceptance.test.ts \
  src/shared/grpc/grpcTargetValidationParity.test.ts

echo "== Phase 9D: Studio target validation regression =="
npx vitest run src/features/grpc/hooks/useGrpcTargetValidation.test.ts

echo "== Phase 9D: Server request validation parity =="
npx vitest run src/shared/grpc/requestValidation.test.ts

echo "== Phase 9D: envVarUtils grpcPort derivation =="
npx vitest run src/shared/utils/envVarUtils.test.ts

echo "== Phase 9D: Phase 9C regression =="
grpc_gate_run_regression "Phase phase9c" test:grpc:phase9c

echo ""
echo "Phase 9D gate: ALL PASSED"
