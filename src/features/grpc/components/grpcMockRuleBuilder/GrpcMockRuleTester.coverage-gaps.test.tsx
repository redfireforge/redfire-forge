/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GrpcMockRule, GrpcMockRuleSet } from '../../../../shared/grpc/grpcMockRuleContracts';
import * as grpcMockRuleBuilderModel from '../../utils/grpcMockRuleBuilderModel';
import {
  createDefaultGrpcMockBuilderRuleRow,
  parseGrpcMockRuleSetToBuilderModel,
  resetGrpcMockBuilderNodeIdsForTests,
} from '../../utils/grpcMockRuleBuilderModel';
import { buildAdvancedMock } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcMockRuleTester } from './GrpcMockRuleTester';

const RULE_ID = 'target-rule';

function makeRule(overrides: Partial<GrpcMockRule> & Pick<GrpcMockRule, 'id'>): GrpcMockRule {
  return {
    name: overrides.name ?? overrides.id,
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals', method: 'Echo' },
    response: { statusCode: 0, body: { ok: true } },
    ...overrides,
  };
}

function buildModelFromRuleSet(ruleSet: GrpcMockRuleSet) {
  return parseGrpcMockRuleSetToBuilderModel(ruleSet);
}

function renderTester(
  builderModel: grpcMockRuleBuilderModel.GrpcMockBuilderModel,
  ruleId = RULE_ID,
  onClose = vi.fn(),
) {
  const view = render(
    <GrpcMockRuleTester builderModel={builderModel} ruleId={ruleId} onClose={onClose} />,
  );
  return { ...view, onClose };
}

function fillRequest(
  ruleId: string,
  {
    service = '',
    method = '',
    body = '{}',
  }: { service?: string; method?: string; body?: string } = {},
) {
  if (service) {
    fireEvent.change(screen.getByTestId(`grpc-mock-tester-service-${ruleId}`), {
      target: { value: service },
    });
  }
  if (method) {
    fireEvent.change(screen.getByTestId(`grpc-mock-tester-method-${ruleId}`), {
      target: { value: method },
    });
  }
  fireEvent.change(screen.getByTestId(`grpc-mock-tester-body-${ruleId}`), {
    target: { value: body },
  });
}

function runTest(ruleId: string) {
  fireEvent.click(screen.getByTestId(`grpc-mock-tester-run-${ruleId}`));
}

describe('GrpcMockRuleTester coverage gaps', () => {
  beforeEach(() => {
    resetGrpcMockBuilderNodeIdsForTests();
  });

  it('renders with ruleId test ids and intro copy', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    renderTester({ rules: [row] }, row.id);

    expect(screen.getByTestId(`grpc-mock-builder-tester-${row.id}`)).toBeTruthy();
    expect(screen.getByTestId(`grpc-mock-tester-service-${row.id}`)).toBeTruthy();
    expect(screen.getByTestId(`grpc-mock-tester-method-${row.id}`)).toBeTruthy();
    expect(screen.getByTestId(`grpc-mock-tester-body-${row.id}`)).toBeTruthy();
    expect(screen.getByText(/Simulate a gRPC request/i)).toBeTruthy();
  });

  it('matches the current rule when service, method, and body align', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: RULE_ID,
          name: 'Echo match',
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 7, body: { ok: true } },
        }),
      ],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, {
      service: 'echo.EchoService',
      method: 'Echo',
      body: '{"message":"hello"}',
    });
    runTest(RULE_ID);

    const result = screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`);
    expect(result.className).toContain('grpc-mock-builder-tester__result--match');
    expect(result.textContent).toContain('This rule matched!');
    expect(result.textContent).toContain('Response status: 7');
  });

  it('shows status code 0 when the matched response omits statusCode', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: RULE_ID,
          response: { body: { ok: true } },
        }),
      ],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`).textContent)
      .toContain('Response status: 0');
  });

  it('reports when another rule matched instead of the open rule', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: 'other-rule',
          name: 'Other echo',
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
        }),
        makeRule({
          id: RULE_ID,
          name: 'Ping only',
          priority: 2,
          predicate: { kind: 'method_equals', method: 'Ping' },
        }),
      ],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    const result = screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`);
    expect(result.className).toContain('grpc-mock-builder-tester__result--other');
    expect(result.textContent).toContain('Another rule matched');
    expect(result.textContent).toContain('Other echo');
  });

  it('uses default response when no rule matches', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: RULE_ID,
          predicate: { kind: 'method_equals', method: 'Ping' },
        }),
      ],
      defaultResponse: { statusCode: 12, message: 'default miss', body: { fallback: true } },
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    const result = screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`);
    expect(result.className).toContain('grpc-mock-builder-tester__result--miss');
    expect(result.textContent).toContain('No rule matched — default response used');
  });

  it('falls back to rule id when another matched rule has no name', async () => {
    const evaluator = await import('../../../../shared/grpc/grpcMockRuleEvaluatorCore');
    const evalSpy = vi.spyOn(evaluator, 'evaluateGrpcMockRuleSet').mockReturnValue({
      matched: true,
      usedDefault: false,
      ruleId: 'other-rule',
      fallthroughChain: [],
      response: { statusCode: 0 },
    });

    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel);
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`).textContent)
      .toContain('other-rule');
    evalSpy.mockRestore();
  });

  it('shows a pure miss when evaluation returns no default path', async () => {
    const evaluator = await import('../../../../shared/grpc/grpcMockRuleEvaluatorCore');
    const evalSpy = vi.spyOn(evaluator, 'evaluateGrpcMockRuleSet').mockReturnValue({
      matched: false,
      usedDefault: false,
      fallthroughChain: [],
      response: { statusCode: 0 },
    });

    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    const result = screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`);
    expect(result.textContent).toContain('No rule matched — miss');
    evalSpy.mockRestore();
  });

  it('renders fallthrough chain details from evaluation', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: 'ft-1',
          priority: 1,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 1 } },
        }),
        makeRule({
          id: 'ft-2',
          priority: 2,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 2 } },
        }),
        makeRule({
          id: RULE_ID,
          priority: 3,
          predicate: { kind: 'method_equals', method: 'Missing' },
          response: { statusCode: 0, body: { step: 3 } },
        }),
      ],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    const result = screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`);
    expect(result.className).toContain('grpc-mock-builder-tester__result--other');
    expect(result.textContent).toContain('Fallthrough chain: ft-1 → ft-2');
  });

  it('shows invalid JSON body errors and clears prior results', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo', body: '{"broken":' });
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-error-${RULE_ID}`).textContent)
      .toContain('Invalid JSON in request body');
    expect(screen.queryByTestId(`grpc-mock-tester-result-${RULE_ID}`)).toBeNull();
  });

  it('adds, edits, and removes metadata rows', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: RULE_ID,
          predicate: {
            kind: 'and',
            predicates: [
              { kind: 'method_equals', method: 'Echo' },
              { kind: 'metadata_equals', key: 'x-token', value: 'secret' },
            ],
          },
        }),
      ],
    });

    renderTester(builderModel);

    fireEvent.change(screen.getByTestId(`grpc-mock-tester-meta-key-${RULE_ID}-0`), {
      target: { value: 'x-token' },
    });
    fireEvent.change(screen.getByTestId(`grpc-mock-tester-meta-val-${RULE_ID}-0`), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByTestId(`grpc-mock-tester-add-meta-${RULE_ID}`));
    fireEvent.change(screen.getByTestId(`grpc-mock-tester-meta-key-${RULE_ID}-1`), {
      target: { value: 'trace-id' },
    });
    fireEvent.change(screen.getByTestId(`grpc-mock-tester-meta-val-${RULE_ID}-1`), {
      target: { value: 'abc-123' },
    });

    fireEvent.click(screen.getByLabelText('Remove metadata row 2'));
    expect(screen.queryByTestId(`grpc-mock-tester-meta-key-${RULE_ID}-1`)).toBeNull();

    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`).textContent)
      .toContain('This rule matched!');
  });

  it('resets to a blank metadata row when the last row is removed', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel);
    fireEvent.click(screen.getByLabelText('Remove metadata row 1'));

    expect(screen.getByTestId(`grpc-mock-tester-meta-key-${RULE_ID}-0`)).toBeTruthy();
    expect((screen.getByTestId(`grpc-mock-tester-meta-key-${RULE_ID}-0`) as HTMLInputElement).value)
      .toBe('');
  });

  it('treats an empty body textarea as {}', () => {
    const builderModel = buildModelFromRuleSet({
      rules: [
        makeRule({
          id: RULE_ID,
          predicate: { kind: 'body_path_exists', path: 'message' },
        }),
      ],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo', body: '' });
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-result-${RULE_ID}`).textContent)
      .toContain('No rule matched — default response used');
  });

  it('calls onClose from the footer close button', () => {
    const onClose = vi.fn();
    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel, RULE_ID, onClose);
    fireEvent.click(screen.getByTestId('grpc-mock-tester-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('surfaces serialization failures from the builder model', () => {
    const serializeSpy = vi.spyOn(grpcMockRuleBuilderModel, 'serializeGrpcMockBuilderModelToRuleSet')
      .mockImplementation(() => {
        throw new Error('serialize failed');
      });

    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel);
    fillRequest(RULE_ID, { method: 'Echo' });
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-error-${RULE_ID}`).textContent)
      .toContain('serialize failed');
    serializeSpy.mockRestore();
  });

  it('stringifies non-Error failures from runTest', () => {
    const serializeSpy = vi.spyOn(grpcMockRuleBuilderModel, 'serializeGrpcMockBuilderModelToRuleSet')
      .mockImplementation(() => {
        throw 'plain failure';
      });

    const builderModel = buildModelFromRuleSet({
      rules: [makeRule({ id: RULE_ID })],
    });

    renderTester(builderModel);
    runTest(RULE_ID);

    expect(screen.getByTestId(`grpc-mock-tester-error-${RULE_ID}`).textContent)
      .toContain('plain failure');
    serializeSpy.mockRestore();
  });

  it('can be opened from the builder panel advanced mock helper', () => {
    const rulesJson = JSON.stringify({
      rules: [{
        id: RULE_ID,
        name: 'Echo match',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: { statusCode: 0, body: { ok: true } },
      }],
    }, null, 2);

    const advanced = buildAdvancedMock({
      mockServer: { rulesJson },
    });

    expect(advanced.mockServer.rulesJson).toContain(RULE_ID);
    expect(parseGrpcMockRuleSetToBuilderModel(JSON.parse(rulesJson)).rules[0]?.id).toBe(RULE_ID);
  });
});
