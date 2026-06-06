#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/plaintext/docker-compose.yml"
TOPICS_FILE="$SCRIPT_DIR/topics.txt"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$TOPICS_FILE" ]]; then
  echo "Topics file not found: $TOPICS_FILE" >&2
  exit 1
fi

mapfile -t TOPICS < "$TOPICS_FILE"
for topic in "${TOPICS[@]}"; do
  topic_trimmed="$(echo "$topic" | tr -d '[:space:]')"
  if [[ -z "$topic_trimmed" ]]; then
    continue
  fi
  echo "Creating topic: $topic_trimmed"
  docker compose -f "$COMPOSE_FILE" exec -T redpanda \
    rpk topic create "$topic_trimmed" --partitions 3 --replicas 1 >/dev/null 2>&1 || true
done

echo "Topic creation complete."
