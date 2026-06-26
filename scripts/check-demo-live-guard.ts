#!/usr/bin/env npx tsx
/**
 * Exit 0 when E2E scripts should skip killing the Vite dev server (live demo active).
 * Exit 1 when reset is safe (no guard / stale guard / missing file).
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  DEMO_LIVE_GUARD_RELATIVE_PATH,
  parseDemoLiveGuardState,
  resolveDemoLiveGuardCheckDecision,
  type DemoLiveGuardState,
} from '../packages/demo-hub/src/demoLiveGuardPolicy';

const root = resolve(import.meta.dirname, '..');
const guardPath = resolve(root, DEMO_LIVE_GUARD_RELATIVE_PATH);
const devPort = process.env.E2E_VITE_PORT ?? '5173';
const DEV_GUARD_URL = process.env.DEMO_LIVE_GUARD_URL
  ?? `http://localhost:${devPort}/__demo-live-guard`;

const FILE_READ_ATTEMPTS = 3;
const FILE_READ_DELAY_MS = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function readGuardFromFileOnce(): DemoLiveGuardState | null {
  try {
    const raw = JSON.parse(readFileSync(guardPath, 'utf8')) as unknown;
    return parseDemoLiveGuardState(raw);
  } catch {
    return null;
  }
}

/** Retry reads only when the file exists but parsing failed (torn write). */
async function readGuardFromFile(): Promise<DemoLiveGuardState | null> {
  if (!existsSync(guardPath)) return null;

  for (let attempt = 0; attempt < FILE_READ_ATTEMPTS; attempt += 1) {
    const parsed = readGuardFromFileOnce();
    if (parsed) return parsed;
    if (attempt < FILE_READ_ATTEMPTS - 1) {
      await sleep(FILE_READ_DELAY_MS);
    }
  }
  return null;
}

async function readGuardFromDevServer(): Promise<DemoLiveGuardState | null> {
  try {
    const res = await fetch(DEV_GUARD_URL, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    const raw = await res.json() as unknown;
    return parseDemoLiveGuardState(raw);
  } catch {
    return null;
  }
}

const fromFile = await readGuardFromFile();
const needsServerConfirm = resolveDemoLiveGuardCheckDecision(fromFile, null) === 'skip-reset';
const fromServer = needsServerConfirm ? await readGuardFromDevServer() : null;
const decision = resolveDemoLiveGuardCheckDecision(fromFile, fromServer);

if (decision === 'skip-reset') {
  const guard = fromServer ?? fromFile;
  const lesson = guard?.lessonId ? ` (${guard.lessonId})` : '';
  console.log(`[demo-live-guard] Active live demo${lesson} — skip dev-server reset`);
  process.exit(0);
}

process.exit(1);
