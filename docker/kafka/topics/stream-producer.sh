#!/usr/bin/env bash
# Continuous message producer for testing Kafka stream/subscribe features.
# Usage: ./stream-producer.sh [topic] [interval_seconds]
#   topic:    default "redfireforge.debug.consume"
#   interval: default 2 (seconds between messages)
#
# Produces messages with incrementing sequence numbers, timestamps, and random keys.
# Ctrl+C to stop.

set -euo pipefail

TOPIC="${1:-redfireforge.debug.consume}"
INTERVAL="${2:-2}"
SEQ=0

echo "Stream producer starting — topic=$TOPIC interval=${INTERVAL}s"
echo "Press Ctrl+C to stop."
echo ""

while true; do
  SEQ=$((SEQ + 1))
  KEY="stream-key-$((RANDOM % 10))"
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  PAYLOAD="{\"seq\":$SEQ,\"ts\":\"$TS\",\"source\":\"stream-producer\",\"data\":{\"value\":$((RANDOM % 1000))}}"

  docker compose -f docker/kafka/plaintext/docker-compose.yml exec -T redpanda \
    rpk topic produce "$TOPIC" --key "$KEY" \
    -H "traceId:stream-$SEQ" -H "source:stream-producer" \
    <<< "$PAYLOAD"

  echo "[$(date +%H:%M:%S)] #$SEQ → $TOPIC key=$KEY"
  sleep "$INTERVAL"
done
