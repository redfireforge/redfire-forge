#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$ROOT_DIR/certs"
WITH_GO_MOCK=0

for arg in "$@"; do
  case "$arg" in
    --with-go-mock)
      WITH_GO_MOCK=1
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: ./probe-fixtures.sh [--with-go-mock]" >&2
      exit 1
      ;;
  esac
done

function require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd grpcurl

function assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "[probe] FAIL: expected '$label' to contain '$needle'" >&2
    echo "[probe] got: $haystack" >&2
    exit 1
  fi
}

echo "[probe] HTTP health checks"
curl -fsS http://localhost:50052/health >/dev/null
curl -fsS http://localhost:50453/health >/dev/null
curl -fsS http://localhost:50454/health >/dev/null
curl -fsS http://localhost:8080/actuator/health >/dev/null

echo "[probe] plaintext gRPC fixture :50051"
grpcurl -plaintext -d '{"message":"probe-plaintext"}' \
  localhost:50051 echo.EchoService/Echo >/dev/null

echo "[probe] TLS gRPC fixture :50443"
grpcurl -cacert "$CERT_DIR/ca.crt" -d '{"message":"probe-tls"}' \
  localhost:50443 echo.EchoService/Echo >/dev/null

echo "[probe] mTLS gRPC fixture :50444"
grpcurl -cacert "$CERT_DIR/ca.crt" -cert "$CERT_DIR/client.crt" -key "$CERT_DIR/client.key" \
  -d '{"message":"probe-mtls"}' \
  localhost:50444 echo.EchoService/Echo >/dev/null

echo "[probe] Envoy grpc-web fixture endpoint :50055"
grpcurl -plaintext -d '{"message":"probe-envoy"}' \
  localhost:50055 echo.EchoService/Echo >/dev/null

echo "[probe] Spring Boot gRPC fixture :9090 (schema-v2 method)"
grpcurl -plaintext \
  -d '{"message":"probe-spring","labels":["fixture","spring"],"attributes":{"source":"probe"}}' \
  localhost:9090 echo.EchoService/CreateComplexEcho >/dev/null

if [[ "$WITH_GO_MOCK" -eq 1 ]]; then
  echo "[probe] Go mock servicer health + rule import :50062"
  curl -fsS http://localhost:50062/health >/dev/null
  mock_rules_json="$(curl -fsS http://localhost:50062/rules)"
  assert_contains "$mock_rules_json" '"ruleCount"' "mock rules payload"

  echo "[probe] Go mock servicer metadata predicate :50061"
  metadata_response="$(grpcurl -plaintext -H 'x-tenant: acme' -d '{"message":"probe-metadata"}' localhost:50061 echo.EchoService/Echo)"
  assert_contains "$metadata_response" 'mock-tenant-acme' "metadata rule response"

  echo "[probe] Go mock servicer body-path predicate :50061"
  body_response="$(grpcurl -plaintext -d '{"message":"probe-body","attributes":{"order_id":"123"}}' localhost:50061 echo.EchoService/CreateComplexEcho)"
  assert_contains "$body_response" 'mock-order-123' "body-path rule response"

  echo "[probe] Go mock servicer stream rule :50061"
  stream_response="$(grpcurl -plaintext -d '{"message":"probe-stream"}' localhost:50061 echo.EchoService/ServerStream)"
  assert_contains "$stream_response" 'mock-stream-1' "stream rule response first message"
  assert_contains "$stream_response" 'mock-stream-2' "stream rule response second message"
fi

echo "[probe] all fixture checks passed"
