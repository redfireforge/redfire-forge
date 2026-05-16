/**
 * Schema Contract Mode — optional strict mode per mapping configuration.
 *
 * When enabled ("Lock Schema"), any response whose structure deviates from
 * the saved snapshot produces validation failures, catching API changes
 * before they cause silent test breakage.
 *
 * Contract failures are produced as FailureDetail[] compatible with the
 * existing validator system (evaluateAssertions in validator.ts).
 */

import type { SchemaSnapshot } from './schemaSnapshot';
import type { SchemaDrift } from './schemaDrift';
import { diffSchemas } from './schemaDrift';
import { captureSchemaSnapshot } from './schemaSnapshot';
import { readKey, writeKey } from '../../../utils/storage';

// ─── Types ────────────────────────────────────────────────

export interface SchemaContractConfig {
  /** Whether contract mode is enabled for this context */
  enabled: boolean;
  /** How strict: 'strict' fails on any change; 'lenient' allows additions */
  mode: 'strict' | 'lenient';
}

export interface ContractViolation {
  /** The field path that violated the contract */
  path: string;
  /** What was expected from the saved schema */
  expected: string;
  /** What was found in the current response */
  actual: string;
  /** The type of drift that caused the violation */
  driftType: SchemaDrift['driftType'];
}

// ─── Storage ──────────────────────────────────────────────

const CONTRACT_PREFIX = 'dm-schema-contract-';

function contractKey(contextId: string): string {
  return `${CONTRACT_PREFIX}${contextId}`;
}

export async function loadContractConfig(
  contextId: string,
): Promise<SchemaContractConfig | null> {
  try {
    const raw = await readKey(contractKey(contextId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'enabled' in parsed) {
      return parsed as SchemaContractConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveContractConfig(
  contextId: string,
  config: SchemaContractConfig,
): Promise<void> {
  try {
    await writeKey(contractKey(contextId), JSON.stringify(config));
  } catch {
    // Silently degrade
  }
}

// ─── Contract Evaluation ──────────────────────────────────

/**
 * Validate a runtime response against a saved schema snapshot.
 *
 * Returns contract violations (compatible with FailureDetail)
 * that can be surfaced in test results.
 *
 * @param savedSnapshot - The locked schema (saved when contract was enabled)
 * @param responseData - The actual runtime response data
 * @param contextId - Adapter context ID
 * @param config - Contract configuration (strict/lenient)
 */
export function validateContract(
  savedSnapshot: SchemaSnapshot,
  responseData: unknown,
  contextId: string,
  config: SchemaContractConfig,
): ContractViolation[] {
  if (!config.enabled) return [];

  let effective = responseData;
  if (typeof effective === 'string') {
    try { effective = JSON.parse(effective); } catch { /* use raw string */ }
  }

  const currentSnapshot = captureSchemaSnapshot(
    contextId,
    savedSnapshot.side,
    effective,
    savedSnapshot.sourceId,
  );

  const drifts = diffSchemas(savedSnapshot, currentSnapshot);
  if (drifts.length === 0) return [];

  const violations: ContractViolation[] = [];

  for (const drift of drifts) {
    switch (drift.driftType) {
      case 'removed':
        violations.push({
          path: drift.path,
          expected: `field present (type: ${drift.savedType})`,
          actual: 'field missing',
          driftType: 'removed',
        });
        break;

      case 'typeChanged':
        violations.push({
          path: drift.path,
          expected: `type: ${drift.savedType}`,
          actual: `type: ${drift.currentType}`,
          driftType: 'typeChanged',
        });
        break;

      case 'added':
        if (config.mode === 'strict') {
          violations.push({
            path: drift.path,
            expected: 'field absent',
            actual: `field present (type: ${drift.currentType})`,
            driftType: 'added',
          });
        }
        break;

      case 'nullableChanged':
        if (config.mode === 'strict') {
          violations.push({
            path: drift.path,
            expected: drift.savedNullable ? 'nullable' : 'non-nullable',
            actual: drift.currentNullable ? 'nullable' : 'non-nullable',
            driftType: 'nullableChanged',
          });
        }
        break;
    }
  }

  return violations;
}

/**
 * Convert contract violations to FailureDetail-compatible objects
 * for the existing validator/results system.
 */
export function contractViolationsToFailures(
  violations: ContractViolation[],
): Array<{ path: string; expected: string; actual: string }> {
  return violations.map((v) => ({
    path: `[schema-contract] ${v.path}`,
    expected: v.expected,
    actual: v.actual,
  }));
}
