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
