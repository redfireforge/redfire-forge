#!/usr/bin/env bash
set -euo pipefail

shard="${1:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

case "$shard" in
  3)
    mapfile -t specs < <(
      find e2e -maxdepth 1 -type f \( -name '*.spec.ts' -o -name '*.spec.mjs' \) \
        ! -name 'demo-api-mock-am*.spec.ts' \
        ! -name 'api-mock-multi-server.spec.ts' \
        -print | sort
    )
    ;;
  4)
    specs=(e2e/api-mock-multi-server.spec.ts e2e/demo-api-mock-am*.spec.ts)
    ;;
  *)
    echo "Usage: $0 3|4" >&2
    exit 2
    ;;
esac

if [[ ${#specs[@]} -eq 0 ]]; then
  echo "No E2E specs selected for balanced shard $shard" >&2
  exit 1
fi

E2E_REUSE_SERVERS="${E2E_REUSE_SERVERS:-1}" \
  npx playwright test "${specs[@]}" \
    --reporter=html --workers=1 --retries=0 --timeout=60000