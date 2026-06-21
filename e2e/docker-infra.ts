/**
 * Docker stack orchestration for Playwright global setup/teardown.
 *
 * When E2E_WITH_DOCKER=1, global-setup starts every stack required by the
 * docker project specs (Kafka plaintext/secure/TLS, Schema Registry, WebSocket
 * protocol servers, GraphQL test server).
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const MAX_WAIT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

interface DockerStackDef {
  name: string;
  cwd: string;
  composeArgs?: string;
  healthCheck: () => Promise<boolean>;
}

async function fetchOk(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return resp.ok || resp.status < 600;
  } catch {
    return false;
  }
}

async function isGraphqlHealthy(): Promise<boolean> {
  try {
    const resp = await fetch('http://localhost:4010/health', { signal: AbortSignal.timeout(3_000) });
    if (!resp.ok) return false;
    const body = (await resp.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

async function isSchemaRegistryHealthy(): Promise<boolean> {
  try {
    const resp = await fetch('http://localhost:8085/subjects', { signal: AbortSignal.timeout(3_000) });
    return resp.ok;
  } catch {
    return false;
  }
}

const GRAPHQL_STACK: DockerStackDef = {
  name: 'graphql-test-server',
  cwd: path.join(REPO_ROOT, 'docker/graphql'),
  healthCheck: isGraphqlHealthy,
};

const FULL_DOCKER_STACKS: DockerStackDef[] = [
  GRAPHQL_STACK,
  {
    name: 'kafka-plaintext',
    cwd: path.join(REPO_ROOT, 'docker/kafka/plaintext'),
    healthCheck: () => fetchOk('http://localhost:19644/'),
  },
  {
    name: 'kafka-secure',
    cwd: path.join(REPO_ROOT, 'docker/kafka/secure'),
    healthCheck: () => fetchOk('http://localhost:19645/'),
  },
  {
    name: 'kafka-tls',
    cwd: path.join(REPO_ROOT, 'docker/kafka/tls'),
    healthCheck: () => fetchOk('http://localhost:19648/'),
  },
  {
    name: 'kafka-schema-registry',
    cwd: path.join(REPO_ROOT, 'docker/kafka/schema-registry'),
    healthCheck: isSchemaRegistryHealthy,
  },
  {
    name: 'websocket-protocols',
    cwd: path.join(REPO_ROOT, 'docker/websocket'),
    composeArgs: '-f docker-compose.all.yml',
    healthCheck: () => fetchOk('http://localhost:3100/'),
  },
];

async function waitForHealth(check: () => Promise<boolean>, name: string): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (await check()) {
      console.log(`[docker-infra] ${name} is healthy`);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `[docker-infra] ${name} did not become healthy within ${MAX_WAIT_MS / 1000}s`,
  );
}

function startStack(stack: DockerStackDef): void {
  const cmd = stack.composeArgs
    ? `docker compose ${stack.composeArgs} up -d`
    : 'docker compose up -d';
  console.log(`[docker-infra] Starting ${stack.name} (${stack.cwd})...`);
  execSync(cmd, { cwd: stack.cwd, stdio: 'inherit' });
}

export async function ensureDockerInfrastructure(fullDocker: boolean): Promise<void> {
  const stacks = fullDocker ? FULL_DOCKER_STACKS : [GRAPHQL_STACK];
  for (const stack of stacks) {
    if (await stack.healthCheck()) {
      console.log(`[docker-infra] ${stack.name} already running — skip`);
      continue;
    }
    startStack(stack);
    await waitForHealth(stack.healthCheck, stack.name);
  }
}

export function stopDockerInfrastructure(fullDocker: boolean): void {
  const stacks = fullDocker ? [...FULL_DOCKER_STACKS].reverse() : [GRAPHQL_STACK];
  for (const stack of stacks) {
    try {
      const cmd = stack.composeArgs
        ? `docker compose ${stack.composeArgs} down`
        : 'docker compose down';
      console.log(`[docker-infra] Stopping ${stack.name}...`);
      execSync(cmd, { cwd: stack.cwd, stdio: 'inherit' });
    } catch (err) {
      console.warn(`[docker-infra] Failed to stop ${stack.name}:`, err);
    }
  }
}
