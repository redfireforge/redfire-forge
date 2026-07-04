#!/usr/bin/env bash
#
# dev-grpc.sh — one command to bring up every dependency the browser gRPC demo
# lessons need, then start Vite in the foreground.
#
#   1. Docker echo fixture   (docker/grpc → :50051 gRPC, :50052 health)
#   2. Express gRPC proxy    (npm run server → :3001, browser Reflect/Send)
#   3. Vite dev server       (npm run dev → :5173)
#
# Usage:
#   npm run dev:grpc
#
# Docker is left running on exit so the next start is instant. To also stop the
# fixture when you quit, run:  DEV_GRPC_DOWN=1 npm run dev:grpc
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ECHO_HEALTH="http://127.0.0.1:50052/health"
EXPRESS_HEALTH="http://127.0.0.1:3001/health"
SERVER_LOG="/tmp/redfire-dev-grpc-server.log"
EXPRESS_PID=""

probe() { curl --noproxy '*' -sf "$1" >/dev/null 2>&1; }

wait_for() {
  local url="$1" name="$2" tries="$3"
  for ((i = 1; i <= tries; i++)); do
    if probe "$url"; then
      echo "[dev:grpc]   $name ready"
      return 0
    fi
    sleep 1
  done
  echo "[dev:grpc]   $name failed to become ready after ${tries}s" >&2
  return 1
}

cleanup() {
  echo ""
  echo "[dev:grpc] Shutting down…"
  if [[ -n "$EXPRESS_PID" ]] && kill -0 "$EXPRESS_PID" 2>/dev/null; then
    kill "$EXPRESS_PID" 2>/dev/null || true
  fi
  if [[ "${DEV_GRPC_DOWN:-0}" == "1" ]]; then
    echo "[dev:grpc] Stopping Docker echo fixture (DEV_GRPC_DOWN=1)…"
    (cd docker/grpc && docker compose down) || true
  else
    echo "[dev:grpc] Docker echo fixture left running (DEV_GRPC_DOWN=1 to stop it)."
  fi
}
trap cleanup EXIT INT TERM

# 1. Docker echo fixture ──────────────────────────────────────────
if probe "$ECHO_HEALTH"; then
  echo "[dev:grpc] Docker echo fixture already healthy on :50052"
else
  echo "[dev:grpc] Starting Docker echo fixture (docker/grpc)…"
  (cd docker/grpc && docker compose up -d)
  wait_for "$ECHO_HEALTH" "Docker echo (:50052)" 60
fi

# 2. Express gRPC proxy ───────────────────────────────────────────
if probe "$EXPRESS_HEALTH"; then
  echo "[dev:grpc] Express proxy already running on :3001"
else
  echo "[dev:grpc] Starting Express proxy (npm run server)…"
  npm run server >"$SERVER_LOG" 2>&1 &
  EXPRESS_PID=$!
  if ! wait_for "$EXPRESS_HEALTH" "Express proxy (:3001)" 40; then
    echo "[dev:grpc] Express log tail:" >&2
    tail -n 40 "$SERVER_LOG" >&2 || true
    exit 1
  fi
fi

# 3. Vite dev server (foreground) ─────────────────────────────────
echo "[dev:grpc] All dependencies ready — starting Vite…"
npm run dev
