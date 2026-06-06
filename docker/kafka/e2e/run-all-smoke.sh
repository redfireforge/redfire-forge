#!/usr/bin/env bash
# =============================================================================
# Run All Kafka Smoke Tests — One-Command End-to-End Validation
# =============================================================================
#
# Starts Docker containers, waits for health, seeds test data, and runs all
# smoke tests across all three Kafka profiles:
#   1. Plaintext  (port 19092)
#   2. Secure     (port 19093, SASL/SCRAM-SHA-256)
#   3. Schema Reg (port 19094, Confluent Schema Registry)
#
# Each profile is independent and uses different ports, so they can run
# concurrently without collision.
#
# Prerequisites:
#   - Docker Desktop running
#   - jq installed (brew install jq)
#   - Local server running: npm run server
#
# Usage:
#   ./run-all-smoke.sh                    # run all profiles
#   ./run-all-smoke.sh plaintext          # run only plaintext
#   ./run-all-smoke.sh secure             # run only secure
#   ./run-all-smoke.sh schema-registry    # run only schema registry
#   ./run-all-smoke.sh --seed-only        # just start Docker + seed, no smoke
#   ./run-all-smoke.sh --skip-docker      # skip Docker start (already running)
#
# Environment variables:
#   KAFKA_SMOKE_BASE_URL    Server base URL (default: http://127.0.0.1:3001)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KAFKA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colour helpers ───────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}▸${RESET} $1"; }
success() { echo -e "${GREEN}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $1"; }
error()   { echo -e "${RED}✗${RESET} $1" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

# ── Argument parsing ─────────────────────────────────────────────────────────

RUN_PLAINTEXT=true
RUN_SECURE=true
RUN_SCHEMA_REGISTRY=true
SEED_ONLY=false
SKIP_DOCKER=false

for arg in "$@"; do
  case "$arg" in
    plaintext)
      RUN_SECURE=false
      RUN_SCHEMA_REGISTRY=false
      ;;
    secure)
      RUN_PLAINTEXT=false
      RUN_SCHEMA_REGISTRY=false
      ;;
    schema-registry)
      RUN_PLAINTEXT=false
      RUN_SECURE=false
      ;;
    --seed-only)
      SEED_ONLY=true
      ;;
    --skip-docker)
      SKIP_DOCKER=true
      ;;
    --help|-h)
      head -30 "$0" | tail -25
      exit 0
      ;;
  esac
done

# ── Dependency check ─────────────────────────────────────────────────────────

if ! command -v jq &>/dev/null; then
  error "jq is required but not found. Install with: brew install jq"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  error "Docker is required but not found."
  exit 1
fi

# ── Docker management ────────────────────────────────────────────────────────

start_profile() {
  local profile="$1"
  local compose_file="$KAFKA_DIR/$profile/docker-compose.yml"

  if [[ ! -f "$compose_file" ]]; then
    error "Compose file not found: $compose_file"
    return 1
  fi

  info "Starting $profile profile..."
  docker compose -f "$compose_file" up -d --wait 2>&1 | while read -r line; do
    echo "  $line"
  done
  success "$profile containers are healthy"
}

wait_for_container() {
  local container="$1"
  local max_wait="${2:-60}"
  local waited=0

  while [[ $waited -lt $max_wait ]]; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
      return 0
    fi
    sleep 2
    ((waited += 2)) || true
  done

  error "Container '$container' not running after ${max_wait}s"
  return 1
}

# ── Track overall results ────────────────────────────────────────────────────

TOTAL_PASS=0
TOTAL_FAIL=0
PROFILES_RUN=0
PROFILES_FAILED=0

# =============================================================================
# Plaintext Profile
# =============================================================================

if [[ "$RUN_PLAINTEXT" == "true" ]]; then
  header "PLAINTEXT PROFILE (port 19092)"

  if [[ "$SKIP_DOCKER" != "true" ]]; then
    start_profile "plaintext"
  fi

  # Seed UI test data
  info "Seeding UI test data..."
  "$SCRIPT_DIR/ui-test-seed.sh"

  # Also run the original seed-messages.sh for backward compat
  info "Running original seed-messages.sh..."
  "$KAFKA_DIR/topics/seed-messages.sh"

  if [[ "$SEED_ONLY" != "true" ]]; then
    info "Running plaintext smoke test..."
    if "$KAFKA_DIR/plaintext/smoke-test.sh"; then
      success "Plaintext smoke test PASSED"
    else
      error "Plaintext smoke test FAILED"
      ((PROFILES_FAILED++)) || true
    fi
    ((PROFILES_RUN++)) || true
  fi
fi

# =============================================================================
# Secure Profile
# =============================================================================

if [[ "$RUN_SECURE" == "true" ]]; then
  header "SECURE PROFILE (port 19093, SASL/SCRAM-SHA-256)"

  if [[ "$SKIP_DOCKER" != "true" ]]; then
    start_profile "secure"
    # Wait for init container to complete (creates users + topics)
    info "Waiting for secure init container..."
    sleep 5
    wait_for_container "redfireforge-redpanda-secure"
  fi

  # Seed UI test data on secure broker
  info "Seeding UI test data (secure profile)..."
  "$SCRIPT_DIR/ui-test-seed.sh" --profile secure

  if [[ "$SEED_ONLY" != "true" ]]; then
    info "Running secure smoke test..."
    if "$KAFKA_DIR/secure/smoke-test.sh"; then
      success "Secure smoke test PASSED"
    else
      error "Secure smoke test FAILED"
      ((PROFILES_FAILED++)) || true
    fi
    ((PROFILES_RUN++)) || true
  fi
fi

# =============================================================================
# Schema Registry Profile
# =============================================================================

if [[ "$RUN_SCHEMA_REGISTRY" == "true" ]]; then
  header "SCHEMA REGISTRY PROFILE (port 19094, Confluent SR on 8085)"

  if [[ "$SKIP_DOCKER" != "true" ]]; then
    start_profile "schema-registry"
    # Schema Registry takes extra time to initialize
    info "Waiting for Schema Registry to be ready..."
    sleep 5
  fi

  if [[ "$SEED_ONLY" != "true" ]]; then
    info "Running schema registry smoke test..."
    if "$KAFKA_DIR/schema-registry/smoke-test.sh"; then
      success "Schema Registry smoke test PASSED"
    else
      error "Schema Registry smoke test FAILED"
      ((PROFILES_FAILED++)) || true
    fi
    ((PROFILES_RUN++)) || true
  fi
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${RESET}"

if [[ "$SEED_ONLY" == "true" ]]; then
  echo -e "  ${GREEN}Docker started and data seeded.${RESET}"
  echo ""
  echo "  Next steps:"
  echo "    1. Start the server:  npm run server"
  echo "    2. Start the web UI:  npm run dev"
  echo "    3. Open http://localhost:5173"
  echo "    4. Follow test-scenario MD files in:"
  echo "       docs/plan/future/kafka/test-scenarios/"
else
  if [[ "$PROFILES_FAILED" -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}ALL ${PROFILES_RUN} PROFILE(S) PASSED${RESET}"
  else
    echo -e "  ${RED}${BOLD}${PROFILES_FAILED}/${PROFILES_RUN} PROFILE(S) FAILED${RESET}"
  fi
fi

echo -e "${BOLD}════════════════════════════════════════════════════════${RESET}"

if [[ "$PROFILES_FAILED" -gt 0 ]]; then
  exit 1
fi
