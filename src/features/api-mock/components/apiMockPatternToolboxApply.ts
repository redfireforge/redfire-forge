import type { ApiMockPathMatcherV1, ApiMockPredicateV1 } from '@shared/api-mock/contracts';
import { validateSchemaDraft } from '@shared/api-mock/schemaDraftValidation';
import type { ConstraintDraft, ToolTab } from './apiMockPatternToolboxConstants';

export function applyPatternToolbox(input: {
  tab: ToolTab;
  jsonPath: string;
  jsonExpected: string;
  xpath: string;
  xpathValue: string;
  schemaKind: 'json' | 'xml';
  schemaText: string;
  constraints: ConstraintDraft[];
  predicateOperator?: ApiMockPredicateV1['operator'];
  regexApplied: { kind: ApiMockPathMatcherV1['kind']; value: string };
  caseInsensitive: boolean;
  kind: ApiMockPathMatcherV1['kind'];
  value: string;
  onApply: (matcher: ApiMockPathMatcherV1) => void;
  onApplyConditions?: (predicates: ApiMockPredicateV1[]) => void;
  onApplyPredicate?: (patch: Partial<ApiMockPredicateV1>) => void;
  onClose: () => void;
  nextId?: () => string;
}): void {
  const id = input.nextId ?? (() => `pred-${crypto.randomUUID().slice(0, 8)}`);
  const applyBodyPredicate = (operator: ApiMockPredicateV1['operator'], expected: ApiMockPredicateV1['expected']) => {
    if (input.onApplyPredicate) input.onApplyPredicate({ source: 'body', selector: '', operator, expected });
    else {
      input.onApplyConditions?.([{
        id: id(),
        source: 'body',
        selector: '',
        operator,
        expected,
      }]);
    }
    input.onClose();
  };

  if (input.tab === 'jsonpath') {
    const operator = input.jsonExpected.trim() ? 'jsonPath_equals' : 'jsonPath_exists';
    const expected = input.jsonExpected.trim() ? [input.jsonPath, input.jsonExpected] : input.jsonPath;
    applyBodyPredicate(operator, expected);
    return;
  }
  if (input.tab === 'xpath') {
    const operator = input.xpathValue.trim() ? 'xpath_equals' : 'xpath_exists';
    const expected = input.xpathValue.trim() ? [input.xpath, input.xpathValue] : input.xpath;
    applyBodyPredicate(operator, expected);
    return;
  }
  if (input.tab === 'schema') {
    if (!validateSchemaDraft(input.schemaKind, input.schemaText).ok) return;
    applyBodyPredicate(input.schemaKind === 'xml' ? 'xmlSchema' : 'jsonSchema', input.schemaText);
    return;
  }
  if (input.tab === 'constraints') {
    const usable = input.constraints.filter(c => c.selector.trim());
    input.onApplyConditions?.(usable.map(c => ({
      id: id(),
      source: c.source,
      selector: c.selector.trim(),
      operator: c.operator,
      expected: c.operator === 'present' || c.operator === 'absent' ? undefined : c.expected,
    })));
    input.onClose();
    return;
  }
  if (input.tab === 'regex') {
    const regexOrGlobRow = !input.predicateOperator
      || input.predicateOperator === 'regex'
      || input.predicateOperator === 'glob';
    if (regexOrGlobRow) {
      input.onApply({
        kind: input.regexApplied.kind,
        value: input.regexApplied.value,
        flags: input.caseInsensitive ? { caseInsensitive: true } : undefined,
      });
    }
  } else if (input.onApplyPredicate) {
    input.onClose();
  } else {
    input.onApply({
      kind: input.kind,
      value: input.value,
      flags: input.caseInsensitive ? { caseInsensitive: true } : undefined,
    });
  }
  input.onClose();
}
