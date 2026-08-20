/**
 * CLI-side baseline storage.
 *
 * Baselines are stored as a flat JSON array at:
 *   <basePath>/store.json   (default basePath: .redfireforge/baselines)
 *
 * Each entry holds only the TestSummary snapshot — full results arrays are
 * NOT stored, keeping the file small and suitable for VCS tracking.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import type { TestSummary } from '../src/shared/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CliBaseline {
  runId: string;
  label?: string;
  savedAt: number;
  /** Absolute path to the test YAML/JSON file this baseline was produced from. */
  projectPath: string;
  summary: TestSummary;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_BASELINES_DIR = '.redfireforge/baselines';
const STORE_FILENAME = 'store.json';

// ── Internal helpers ─────────────────────────────────────────────────────────

function storeFilePath(basePath: string): string {
  return join(resolve(basePath), STORE_FILENAME);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all stored baselines. Returns an empty array when the store does not
 * yet exist or cannot be parsed.
 */
export function loadCliBaselines(basePath: string = DEFAULT_BASELINES_DIR): CliBaseline[] {
  const file = storeFilePath(basePath);
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CliBaseline[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the full baselines array, creating the directory if needed.
 */
export function saveCliBaselines(baselines: CliBaseline[], basePath: string = DEFAULT_BASELINES_DIR): void {
  const dir = resolve(basePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storeFilePath(basePath), JSON.stringify(baselines, null, 2));
}

/**
 * Append (or replace) a single baseline entry.
 * Replaces any existing entry with the same projectPath + runId pair.
 */
export function addCliBaseline(baseline: CliBaseline, basePath: string = DEFAULT_BASELINES_DIR): void {
  const existing = loadCliBaselines(basePath).filter(
    (b) => !(b.projectPath === baseline.projectPath && b.runId === baseline.runId),
  );
  saveCliBaselines([...existing, baseline], basePath);
}

/**
 * Find the most-recently-saved baseline for a given test file.
 * Returns `null` when no matching baseline exists.
 */
export function findLatestBaseline(
  projectPath: string,
  basePath: string = DEFAULT_BASELINES_DIR,
): CliBaseline | null {
  const matching = loadCliBaselines(basePath).filter((b) => b.projectPath === projectPath);
  if (matching.length === 0) return null;
  return matching.reduce((latest, b) => (b.savedAt > latest.savedAt ? b : latest));
}

/**
 * Find a baseline by its runId. Returns `null` when not found.
 */
export function findBaselineById(
  runId: string,
  basePath: string = DEFAULT_BASELINES_DIR,
): CliBaseline | null {
  return loadCliBaselines(basePath).find((b) => b.runId === runId) ?? null;
}

// ── Sentinel value ────────────────────────────────────────────────────────────

/** Pass this as the --compare-baseline value to select the most-recent baseline automatically. */
export const LATEST_BASELINE_SENTINEL = 'latest-baseline';
