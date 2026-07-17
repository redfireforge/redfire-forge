#!/usr/bin/env bash
# Run E2E only for the demo lesson you touched — not the full demo E2E suite.
#
#   bash scripts/run-demo-e2e.sh grpc-first-call
#   bash scripts/run-demo-e2e.sh packages/demo-hub/src/lessons/protocols/graphql-mutations.ts
#   bash scripts/run-demo-e2e.sh --dry-run lesson17-workflow-runner
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${1:?Usage: $0 <lesson-id-or-path> [--dry-run]}"
shift || true

exec npx tsx scripts/demo-lesson-e2e.ts "$TARGET" "$@"
