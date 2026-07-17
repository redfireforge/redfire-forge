#!/usr/bin/env bash
# gRPC Phase 11 advanced features — scoped dev tests (no regression chain).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== gRPC advanced features dev loop (Phase 11) ==="
echo ""

GRPC_FORCE_TSC=1 grpc_gate_run_tsc project
echo ""

PHASE11_TESTS=()
while IFS= read -r test_file; do
  PHASE11_TESTS+=("$test_file")
done < <(
  find src/shared/grpc src/features/grpc \( \
    -name '*Phase11*.test.ts' -o -name '*Phase11*.test.tsx' \
    -o -name 'grpcAdvancedFeature*.test.ts' \
    -o -name 'grpcLoadTest*.test.ts' \
    -o -name 'grpcMockRule*.test.ts' \
    -o -name 'grpcMockRuntime*.test.ts' \
    -o -name 'grpcMockPredicate*.test.ts' \
    -o -name 'grpcMockConfig*.test.ts' \
    -o -name 'grpcMockLatency*.test.ts' \
    -o -name 'grpcSchemaDiff*.test.ts' \
    -o -name 'grpcStudioAdvanced*.test.ts' \
    -o -name 'GrpcAdvancedFeatures*.test.tsx' \
  \) 2>/dev/null | sort -u
)

if [[ "${#PHASE11_TESTS[@]}" -eq 0 ]]; then
  echo "No Phase 11 test files found" >&2
  exit 1
fi

npx vitest run "${PHASE11_TESTS[@]}"

echo ""
echo "=== gRPC advanced dev loop: PASSED ==="
