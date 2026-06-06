#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

echo "Checking docker compose service status..."
docker compose -f "$COMPOSE_FILE" ps

echo "Checking redpanda cluster health..."
docker compose -f "$COMPOSE_FILE" exec -T redpanda rpk cluster health --exit-when-healthy

echo "Checking topic list..."
docker compose -f "$COMPOSE_FILE" exec -T redpanda rpk topic list

echo "Plaintext healthcheck complete."
