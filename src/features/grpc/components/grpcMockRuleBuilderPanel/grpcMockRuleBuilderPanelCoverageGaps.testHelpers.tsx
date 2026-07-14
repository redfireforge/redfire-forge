/* eslint-disable react-refresh/only-export-components -- test helper module */
import { useState } from 'react';
import { vi } from 'vitest';
import { buildAdvancedMock, FIXTURE_DESCRIPTOR } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcMockRuleBuilderPanel } from '../GrpcMockRuleBuilderPanel';

export const VALID_EMPTY_RULES = '{\n  "rules": []\n}';

export function rulesJsonWithRule(rule: Record<string, unknown>) {
  return JSON.stringify({ rules: [rule] }, null, 2);
}

export function StatefulMockBuilder({
  initialRulesJson,
  onPatch = vi.fn(),
  parseError,
  activeDescriptor,
  toolbarHost,
  mockRunning = false,
}: {
  initialRulesJson: string;
  onPatch?: (next: string) => void;
  parseError?: string;
  activeDescriptor?: typeof FIXTURE_DESCRIPTOR;
  toolbarHost?: HTMLElement | null;
  mockRunning?: boolean;
}) {
  const [rulesJson, setRulesJson] = useState(initialRulesJson);
  return (
    <GrpcMockRuleBuilderPanel
      toolbarHost={toolbarHost}
      advanced={buildAdvancedMock({
        mockServer: { rulesJson, parseError },
        mockRunning,
        activeDescriptor: activeDescriptor ?? null,
        patchMockRulesJson: (next) => {
          onPatch(next);
          setRulesJson(next);
        },
      })}
    />
  );
}

export function mockRuleDragDataTransfer(_ruleId: string) {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? '',
  };
}

export function makeTwoRuleJson() {
  return JSON.stringify({
    rules: [
      {
        id: 'rule-a',
        name: 'Alpha Echo',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: { statusCode: 0, body: { ok: true } },
      },
      {
        id: 'rule-b',
        name: 'Beta Ping',
        enabled: true,
        priority: 2,
        predicate: { kind: 'method_equals', method: 'Ping' },
        response: { statusCode: 0 },
      },
    ],
  }, null, 2);
}

export function leafField(prefix: string) {
  const el = document.querySelector(`[data-testid^="${prefix}"]`);
  if (!el) {
    throw new Error(`Missing element with data-testid prefix ${prefix}`);
  }
  return el;
}
