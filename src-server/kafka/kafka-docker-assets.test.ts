import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..', '..');

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('Kafka Docker assets (Phase 1D)', () => {
  it('includes plaintext compose file with redpanda service and healthcheck', () => {
    const composePath = resolve(repoRoot, 'docker/kafka/plaintext/docker-compose.yml');
    expect(existsSync(composePath)).toBe(true);
    const compose = read('docker/kafka/plaintext/docker-compose.yml');
    expect(compose).toContain('redfireforge-redpanda');
    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('19092:19092');
  });

  it('includes required local topics list', () => {
    const topics = read('docker/kafka/topics/topics.txt').trim().split(/\n+/);
    expect(topics).toContain('orders.created');
    expect(topics).toContain('redfireforge.debug.consume');
    expect(topics).toHaveLength(10);
  });

  it('seed script contains deterministic payload families', () => {
    const seed = read('docker/kafka/topics/seed-messages.sh');
    expect(seed).toContain('orders.created');
    expect(seed).toContain('payments.authorized');
    expect(seed).toContain('redfireforge.results.summary');
    expect(seed).toContain('traceId=');
  });

  it('bootstrap script wires full plaintext flow', () => {
    const bootstrap = read('scripts/kafka-plaintext-bootstrap.sh');
    expect(bootstrap).toContain('docker compose -f "$COMPOSE_FILE" up -d');
    expect(bootstrap).toContain('healthcheck.sh');
    expect(bootstrap).toContain('create-topics.sh');
    expect(bootstrap).toContain('seed-messages.sh');
    expect(bootstrap).toContain('smoke-test.sh');
    expect(bootstrap).toContain('docker compose -f "$COMPOSE_FILE" down --remove-orphans');
  });
});

describe('Kafka Docker assets (Phase 3 secure profile)', () => {
  it('includes secure compose file with SASL-enabled redpanda and init container', () => {
    const composePath = resolve(repoRoot, 'docker/kafka/secure/docker-compose.yml');
    expect(existsSync(composePath)).toBe(true);
    const compose = read('docker/kafka/secure/docker-compose.yml');
    expect(compose).toContain('redfireforge-redpanda-secure');
    expect(compose).toContain('19093:19093');
    expect(compose).toContain('healthcheck:');
    // SASL is enabled via .bootstrap.yaml (cluster-level config), not the compose command.
    // Verify the bootstrap file is mounted into the container.
    expect(compose).toContain('.bootstrap.yaml');
  });

  it('bootstrap file enables SASL and declares admin as superuser', () => {
    const bootstrapPath = resolve(repoRoot, 'docker/kafka/secure/.bootstrap.yaml');
    expect(existsSync(bootstrapPath)).toBe(true);
    const bootstrap = read('docker/kafka/secure/.bootstrap.yaml');
    expect(bootstrap).toContain('enable_sasl: true');
    expect(bootstrap).toContain('superusers:');
    expect(bootstrap).toContain('- admin');
  });

  it('secure compose init container creates admin and app users, topics, and ACLs', () => {
    const compose = read('docker/kafka/secure/docker-compose.yml');
    // Admin user is created by the init container (superuser status comes from .bootstrap.yaml)
    expect(compose).toContain('rpk acl user create admin');
    expect(compose).toContain('rpk acl user create redfireforge-app');
    expect(compose).toContain('rpk topic create redfireforge.debug.consume');
    expect(compose).toContain('rpk topic create redfireforge.results.summary');
    expect(compose).toContain('rpk acl create --allow-principal User:redfireforge-app');
    // Verify the invalid CLI flags (unrecognized by rpk redpanda start) are absent
    expect(compose).not.toContain('--superuser=');
    expect(compose).not.toContain('--username=admin');
    expect(compose).not.toContain('--password=admin-secret');
    expect(compose).not.toContain('--set=redpanda.superusers=');
  });

  it('includes secure smoke test script with SASL scenarios', () => {
    const smokePath = resolve(repoRoot, 'docker/kafka/secure/smoke-test.sh');
    expect(existsSync(smokePath)).toBe(true);
    const smoke = read('docker/kafka/secure/smoke-test.sh');
    // S1: admin superuser SCRAM-SHA-256 (PLAIN requires TLS, so SCRAM is used throughout)
    expect(smoke).toContain('SCRAM-SHA-256 valid credentials (admin superuser)');
    expect(smoke).toContain('SCRAM-SHA-256 valid credentials');
    expect(smoke).toContain('Invalid');
    expect(smoke).toContain('Invalid broker address');
    expect(smoke).toContain('Full lifecycle');
    // Ensure SASL/PLAIN is never used — Redpanda requires TLS for PLAIN and this profile has no TLS.
    expect(smoke).not.toContain('"mode":"plain"');
    expect(smoke).not.toContain("'mode':'plain'");
  });

  it('includes secure env example with all required variables', () => {
    const envPath = resolve(repoRoot, 'docker/kafka/env/secure.env.example');
    expect(existsSync(envPath)).toBe(true);
    const env = read('docker/kafka/env/secure.env.example');
    expect(env).toContain('KAFKA_SECURE_BROKERS');
    expect(env).toContain('KAFKA_SECURE_USERNAME');
    expect(env).toContain('KAFKA_SECURE_PASSWORD');
    expect(env).toContain('19093');
  });
});
