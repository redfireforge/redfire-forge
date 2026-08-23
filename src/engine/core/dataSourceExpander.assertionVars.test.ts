/**
 * BUG-7 fix: general assertion-field variable substitution.
 *
 * Previously, row-driven {{columnName}} template substitution only applied to
 * kafkaField/wsField/wsNumericField assertions, and only when the row had at least
 * one `body`-type column. This left every other assertion type (status, regex,
 * numeric, header, arrayLength, etc.) unable to template off row data at all —
 * and even kafka/ws assertions couldn't template off `path`/`param`/`validate`
 * columns. These tests cover the broadened `resolveScenarioFromDataRow` behavior.
 */
import { describe, it, expect } from 'vitest';
import { resolveScenarioFromDataRow } from './dataSourceExpander';
import { makeScenario } from './__test-utils__/dataSourceExpanderHelpers';
import type { DataSourceColumn, DataSourceRow, Assertion } from '@shared/types';

function makeRow(id: string, values: Record<string, string>): DataSourceRow {
  return { id, values, enabled: true };
}

describe('resolveScenarioFromDataRow — general assertion variable substitution', () => {
  it('substitutes a validate-column value into a regex assertion pattern (the real BUG-7 fixture case)', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c-id', name: 'id', type: 'path', mapping: 'id' },
      { id: 'c-name', name: 'expectedName', type: 'validate', mapping: '$.name' },
    ];
    const row = makeRow('r1', { 'c-id': '1', 'c-name': 'Leanne Graham' });
    const scenario = makeScenario({
      url: 'https://api.example.com/users/{{id}}',
      validation: {
        mode: 'none',
        assertions: [
          { type: 'regex', jsonPath: '$.name', pattern: '{{expectedName}}' } as Assertion,
        ],
      },
    });

    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    expect(assertion?.type).toBe('regex');
    if (assertion?.type === 'regex') {
      expect(assertion.pattern).toBe('Leanne Graham');
    }
  });

  it('substitutes a path-column value into a status assertion expected field', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c-status', name: 'expectedStatus', type: 'path', mapping: 'expectedStatus' },
    ];
    const row = makeRow('r1', { 'c-status': '201' });
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'status', expected: '{{expectedStatus}}' } as Assertion],
      },
    });

    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    if (assertion?.type === 'status') {
      expect(assertion.expected).toBe('201');
    }
  });

  it('substitutes and re-parses a numeric assertion value from a param column', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c-min', name: 'minCount', type: 'param', mapping: 'minCount' },
    ];
    const row = makeRow('r1', { 'c-min': '5' });
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'numeric', jsonPath: '$.count', operator: '>=', value: 0 } as Assertion,
        ],
      },
    });
    // Manually template the value field since the type is `number`, not a template string —
    // this mirrors how a fixture author would need to author it in YAML (value as a string).
    (scenario.validation.assertions![0] as { value: unknown }).value = '{{minCount}}';

    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    if (assertion?.type === 'numeric') {
      expect(assertion.value).toBe(5);
    }
  });

  it('substitutes header assertion value', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c-env', name: 'env', type: 'param', mapping: 'env' },
    ];
    const row = makeRow('r1', { 'c-env': 'staging' });
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'header', name: 'x-env', operator: 'equals', value: '{{env}}' } as Assertion,
        ],
      },
    });

    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const assertion = resolved.validation.assertions?.[0];
    if (assertion?.type === 'header') {
      expect(assertion.value).toBe('staging');
    }
  });

  it('leaves assertion fields unchanged when no data source columns exist', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '{{expectedName}}' } as Assertion],
      },
    });

    const resolved = resolveScenarioFromDataRow(scenario, [], makeRow('r1', {}), 0);
    const assertion = resolved.validation.assertions?.[0];
    if (assertion?.type === 'regex') {
      expect(assertion.pattern).toBe('{{expectedName}}');
    }
  });

  it('leaves date (structured reference) and custom (expression) assertions untouched', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c-name', name: 'expectedName', type: 'validate', mapping: '$.name' },
    ];
    const row = makeRow('r1', { 'c-name': 'Leanne Graham' });
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'date', jsonPath: '$.createdAt', operator: '>=', reference: { kind: 'today', timezone: 'utc' } } as Assertion,
          { type: 'custom', expression: 'body.name === "{{expectedName}}"' } as Assertion,
        ],
      },
    });

    const resolved = resolveScenarioFromDataRow(scenario, cols, row, 0);
    const [dateAssertion, customAssertion] = resolved.validation.assertions ?? [];
    expect(dateAssertion).toEqual({ type: 'date', jsonPath: '$.createdAt', operator: '>=', reference: { kind: 'today', timezone: 'utc' } });
    if (customAssertion?.type === 'custom') {
      expect(customAssertion.expression).toBe('body.name === "{{expectedName}}"');
    }
  });
});
