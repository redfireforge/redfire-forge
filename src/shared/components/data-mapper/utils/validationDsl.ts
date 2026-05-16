import type { ExpectedField, FieldOperator, Assertion, JsonTypeName, ComparisonOperator } from '../../../types';

// ─── Types ────────────────────────────────────────────────

export interface ParsedRule {
  lineNumber: number;
  path: string;
  operator: string;
  value?: string;
  negate?: boolean;
  kind: 'field' | 'length' | 'each' | 'contains_item' | 'subset' | 'type_check' | 'existence' | 'custom';
}

export interface ParseError {
  lineNumber: number;
  column?: number;
  message: string;
}

export interface DslParseResult {
  rules: ParsedRule[];
  errors: ParseError[];
}

export interface DslModel {
  fields: ExpectedField[];
  assertions: Assertion[];
}

/** Assertion types owned by the DSL layer (managed via code editor / visual mappings).
 *  Non-DSL assertions (status, responseTime, header) belong to the Test Editor. */
export const DSL_ASSERTION_TYPES = new Set([
  'typeCheck', 'existence', 'arrayLength', 'each',
  'arrayContains', 'containsSubset', 'custom',
]);

// ─── Operator Keyword Maps ────────────────────────────────

const FIELD_OPERATOR_KEYWORDS: Record<string, FieldOperator> = {
  'equals': 'equals',
  '=': 'equals',
  'not_equals': 'not_equals',
  '!=': 'not_equals',
  'greater_than': 'greater_than',
  '>': 'greater_than',
  'greater_than_or_equal': 'greater_than_or_equal',
  '>=': 'greater_than_or_equal',
  'less_than': 'less_than',
  '<': 'less_than',
  'less_than_or_equal': 'less_than_or_equal',
  '<=': 'less_than_or_equal',
  'contains': 'contains',
  'not_contains': 'not_contains',
  'starts_with': 'starts_with',
  'ends_with': 'ends_with',
  'regex': 'regex',
  'is_true': 'is_true',
  'is_false': 'is_false',
  'is_null': 'is_null',
  'is_not_null': 'is_not_null',
  'is_empty': 'is_empty',
  'is_not_empty': 'is_not_empty',
  'exists': 'exists',
  'not_exists': 'not_exists',
  'is_type': 'is_type',
  'in': 'in',
  'not_in': 'not_in',
  'between': 'between',
  'close_to': 'close_to',
};

const NO_VALUE_OPERATORS = new Set<string>([
  'is_true', 'is_false', 'is_null', 'is_not_null',
  'is_empty', 'is_not_empty', 'exists', 'not_exists',
]);

const OPERATOR_TO_KEYWORD: Record<FieldOperator, string> = {
  'equals': 'equals',
  'not_equals': 'not_equals',
  'greater_than': '>',
  'greater_than_or_equal': '>=',
  'less_than': '<',
  'less_than_or_equal': '<=',
  'contains': 'contains',
  'not_contains': 'not_contains',
  'starts_with': 'starts_with',
  'ends_with': 'ends_with',
  'regex': 'regex',
  'is_true': 'is_true',
  'is_false': 'is_false',
  'is_null': 'is_null',
  'is_not_null': 'is_not_null',
  'is_empty': 'is_empty',
  'is_not_empty': 'is_not_empty',
  'exists': 'exists',
  'not_exists': 'not_exists',
  'is_type': 'is_type',
  'in': 'in',
  'not_in': 'not_in',
  'between': 'between',
  'close_to': 'close_to',
};

const COMPARISON_OP_MAP: Record<string, ComparisonOperator> = {
  '=': '=', '==': '=', '!=': '!=', '>': '>', '>=': '>=', '<': '<', '<=': '<=',
};

// ─── Parser ───────────────────────────────────────────────

function tokenizeLine(line: string): { path: string; rest: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const match = trimmed.match(/^(\S+)\s+(.*)/);
  if (!match) return { path: trimmed, rest: '' };
  return { path: match[1], rest: match[2].trim() };
}

function parseOperatorAndValue(rest: string): { operator: string; value?: string } {
  // Try two-word operators first (e.g., "is_true", "not_contains")
  const twoWordMatch = rest.match(/^(\S+)\s+(.*)/);
  if (twoWordMatch) {
    return { operator: twoWordMatch[1], value: twoWordMatch[2].trim() || undefined };
  }
  return { operator: rest, value: undefined };
}

function unquote(val: string): string {
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1).replace(/\\(.)/g, (_m, ch) => ch);
  }
  return val;
}

export function parseDslLine(line: string, lineNumber: number): ParsedRule | ParseError | null {
  const trimmedRaw = line.trim();
  if (!trimmedRaw || trimmedRaw.startsWith('#')) return null;

  // ASSERT keyword — custom predicate assertion
  const assertMatch = trimmedRaw.match(/^(NOT\s+)?ASSERT(\s+(.*))?$/i);
  if (assertMatch) {
    const negate = !!assertMatch[1];
    const afterAssert = (assertMatch[3] ?? '').trim();
    if (!afterAssert) {
      return { lineNumber, message: 'ASSERT requires an expression' };
    }
    // Optional description: ASSERT <expression> // <description>
    const descSplit = afterAssert.match(/^(.+?)\s*\/\/\s*(.+)$/);
    const expression = descSplit ? descSplit[1].trim() : afterAssert;
    const description = descSplit ? descSplit[2].trim() : undefined;
    return {
      lineNumber,
      path: '(custom)',
      operator: 'assert',
      value: description ? `${expression}\n${description}` : expression,
      negate,
      kind: 'custom',
    };
  }

  const tokens = tokenizeLine(line);
  if (!tokens) return null;

  const { path, rest } = tokens;

  if (!rest) {
    return { lineNumber, message: 'Missing operator after path' };
  }

  let effectiveRest = rest;
  let negate = false;
  if (/^NOT\s+/i.test(effectiveRest)) {
    negate = true;
    effectiveRest = effectiveRest.replace(/^NOT\s+/i, '');
  }

  const { operator: rawOp, value: rawValue } = parseOperatorAndValue(effectiveRest);
  const opLower = rawOp.toLowerCase();

  // Collection operators: "length >=", "length >", etc.
  if (opLower === 'length') {
    if (!rawValue) {
      return { lineNumber, message: 'Missing comparison after "length"' };
    }
    const lenMatch = rawValue.match(/^([><=!]+)\s*(.*)/);
    if (!lenMatch) {
      return { lineNumber, message: `Invalid length comparison: ${rawValue}` };
    }
    return {
      lineNumber, path, operator: `length ${lenMatch[1]}`, value: lenMatch[2].trim(),
      negate, kind: 'length',
    };
  }

  // "each" operator: "each >= 0", "each contains ..."
  if (opLower === 'each') {
    if (!rawValue) {
      return { lineNumber, message: 'Missing operator after "each"' };
    }
    const eachParts = rawValue.match(/^(\S+)\s*(.*)/)!;
    return {
      lineNumber, path, operator: `each ${eachParts[1]}`, value: eachParts[2].trim() || undefined,
      negate, kind: 'each',
    };
  }

  // "contains_*" operators (any/all/only/none + legacy contains_item)
  if (opLower === 'contains_item' || opLower === 'contains_any' || opLower === 'contains_all' || opLower === 'contains_only' || opLower === 'contains_none') {
    if (rawValue) {
      const trimVal = rawValue.trim();
      const looksLikeJson = trimVal.startsWith('{') || trimVal.startsWith('[') || trimVal.startsWith('"');
      if (!looksLikeJson) {
        return { lineNumber, column: 1, message: `${opLower} value must be JSON: {"field": "value"}, ["item"], or "literal" — got: ${trimVal.length > 40 ? trimVal.slice(0, 40) + '…' : trimVal}` };
      }
      if (trimVal.startsWith('{') || trimVal.startsWith('[')) {
        try { JSON.parse(trimVal); } catch {
          return { lineNumber, column: 1, message: `Invalid JSON in ${opLower} value: ${trimVal.length > 40 ? trimVal.slice(0, 40) + '…' : trimVal}` };
        }
      }
    }
    return {
      lineNumber, path, operator: opLower, value: rawValue,
      negate, kind: 'contains_item',
    };
  }

  // "subset" operator
  if (opLower === 'subset') {
    if (rawValue) {
      const trimVal = rawValue.trim();
      if (trimVal.startsWith('{') || trimVal.startsWith('[')) {
        try { JSON.parse(trimVal); } catch {
          return { lineNumber, column: 1, message: `Invalid JSON in subset value: ${trimVal.length > 40 ? trimVal.slice(0, 40) + '…' : trimVal}` };
        }
      } else if (!trimVal.startsWith('"')) {
        return { lineNumber, column: 1, message: `subset value must be JSON: {"field": "value"} — got: ${trimVal.length > 40 ? trimVal.slice(0, 40) + '…' : trimVal}` };
      }
    }
    return {
      lineNumber, path, operator: 'subset', value: rawValue,
      negate, kind: 'subset',
    };
  }

  // Standard field operators
  const fieldOp = FIELD_OPERATOR_KEYWORDS[opLower];
  if (!fieldOp) {
    return { lineNumber, message: `Unknown operator: "${rawOp}"` };
  }

  if (!NO_VALUE_OPERATORS.has(fieldOp) && !rawValue) {
    return { lineNumber, message: `Operator "${rawOp}" requires a value` };
  }

  // Determine kind for type_check and existence
  if (fieldOp === 'is_type') {
    return { lineNumber, path, operator: fieldOp, value: rawValue, negate, kind: 'type_check' };
  }
  if (fieldOp === 'exists' || fieldOp === 'not_exists') {
    return { lineNumber, path, operator: fieldOp, value: undefined, negate, kind: 'existence' };
  }

  const listOperators = new Set(['in', 'not_in', 'between', 'close_to']);
  return {
    lineNumber, path, operator: fieldOp,
    value: rawValue ? (listOperators.has(fieldOp) ? rawValue : unquote(rawValue)) : undefined,
    negate, kind: 'field',
  };
}

export function parseDsl(text: string): DslParseResult {
  const lines = text.split('\n');
  const rules: ParsedRule[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const result = parseDslLine(lines[i], i + 1);
    if (!result) continue;
    if ('message' in result) {
      errors.push(result);
    } else {
      rules.push(result);
    }
  }

  return { rules, errors };
}

// ─── Serializer (Model → DSL Text) ───────────────────────

function quoteValue(value: string | undefined, operator: FieldOperator): string {
  if (NO_VALUE_OPERATORS.has(operator)) return '';
  if (value == null) return '""';
  if (operator === 'between' || operator === 'in' || operator === 'not_in' || operator === 'close_to') {
    return value;
  }
  if (operator === 'is_type') return value;
  // Number literals
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  // Boolean literals
  if (value === 'true' || value === 'false') return value;
  // Already quoted
  if (value.startsWith('"') && value.endsWith('"')) return value;
  // Wrap strings in quotes, escaping embedded backslashes and double-quotes
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function serializeToDsl(fields: ExpectedField[], assertions: Assertion[]): string {
  const lines: string[] = [];
  const fieldLines: string[] = [];
  const collectionLines: string[] = [];
  const typeLines: string[] = [];
  const customLines: string[] = [];

  // Compute alignment width
  let maxPathLen = 0;
  for (const f of fields) {
    const path = f.jsonPath.replace(/^\$\.?/, '');
    if (path.length > maxPathLen) maxPathLen = path.length;
  }
  for (const a of assertions) {
    if ('jsonPath' in a) {
      const path = (a as { jsonPath: string }).jsonPath.replace(/^\$\.?/, '');
      if (path.length > maxPathLen) maxPathLen = path.length;
    }
  }
  const padWidth = Math.max(maxPathLen + 2, 20);

  // Field-level rules
  for (const f of fields) {
    const path = f.jsonPath.replace(/^\$\.?/, '') || '$';
    const op = f.operator ?? 'equals';
    const keyword = OPERATOR_TO_KEYWORD[op] ?? op;
    const paddedPath = path.padEnd(padWidth);
    const neg = f.negate ? 'NOT ' : '';
    if (NO_VALUE_OPERATORS.has(op)) {
      fieldLines.push(`${paddedPath}${neg}${keyword}`);
    } else {
      const val = f.operatorValue ?? f.expectedValue;
      fieldLines.push(`${paddedPath}${neg}${keyword.padEnd(20)}${quoteValue(val, op)}`);
    }
  }

  // Standalone assertions
  for (const a of assertions) {
    const neg = a.negate ? 'NOT ' : '';
    switch (a.type) {
      case 'typeCheck': {
        const path = a.jsonPath.replace(/^\$\.?/, '') || '$';
        typeLines.push(`${path.padEnd(padWidth)}${neg}is_type${' '.repeat(13)}${a.expectedType}`);
        break;
      }
      case 'existence': {
        const path = a.jsonPath.replace(/^\$\.?/, '') || '$';
        typeLines.push(`${path.padEnd(padWidth)}${neg}${a.expectExists ? 'exists' : 'not_exists'}`);
        break;
      }
      case 'arrayLength': {
        const path = a.jsonPath.replace(/^\$\.?/, '') || '$';
        const lenOp = a.operator ?? '=';
        const padLen = Math.max(0, 14 - lenOp.length);
        collectionLines.push(`${path.padEnd(padWidth)}${neg}length ${lenOp}${' '.repeat(padLen)}${a.value ?? 0}`);
        break;
      }
      case 'each': {
        const path = a.jsonPath.replace(/^\$\.?/, '') || '$';
        const subPath = a.fieldPath ? `[*].${a.fieldPath}` : '[*]';
        const fullPath = `${path}${subPath}`;
        const eachOperator = a.operator ?? 'equals';
        const eachOp = OPERATOR_TO_KEYWORD[eachOperator] ?? eachOperator;
        if (NO_VALUE_OPERATORS.has(eachOperator)) {
          collectionLines.push(`${fullPath.padEnd(padWidth)}${neg}each ${eachOp}`);
        } else {
          collectionLines.push(`${fullPath.padEnd(padWidth)}${neg}each ${eachOp.padEnd(16)}${quoteValue(a.value ?? '', eachOperator as FieldOperator)}`);
        }
        break;
      }
      case 'arrayContains': {
        const path = a.jsonPath.replace(/^\$\.?/, '') || '$';
        const modeKeyword = a.mode === 'all' ? 'contains_all' : a.mode === 'only' ? 'contains_only' : a.mode === 'none' ? 'contains_none' : 'contains_any';
        collectionLines.push(`${path.padEnd(padWidth)}${neg}${modeKeyword.padEnd(20)}${a.value}`);
        break;
      }
      case 'containsSubset': {
        const path = a.jsonPath.replace(/^\$\.?/, '') || '$';
        collectionLines.push(`${path.padEnd(padWidth)}${neg}subset              ${a.expected}`);
        break;
      }
      case 'custom': {
        const desc = a.description ? ` // ${a.description}` : '';
        customLines.push(`${neg}ASSERT ${a.expression}${desc}`);
        break;
      }
      default:
        break;
    }
  }

  if (fieldLines.length > 0) {
    lines.push('# Field assertions');
    lines.push(...fieldLines.sort());
  }
  if (collectionLines.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('# Collection assertions');
    lines.push(...collectionLines.sort());
  }
  if (typeLines.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('# Type & existence assertions');
    lines.push(...typeLines.sort());
  }
  if (customLines.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('# Custom predicate assertions');
    lines.push(...customLines);
  }

  return lines.join('\n');
}

// ─── Model Converter (ParsedRule → Model) ─────────────────

export function dslToModel(rules: ParsedRule[]): DslModel {
  const fields: ExpectedField[] = [];
  const assertions: Assertion[] = [];

  for (const rule of rules) {
    const jsonPath = rule.path.startsWith('$') ? rule.path : `$.${rule.path}`;
    const neg = rule.negate ? true : undefined;

    switch (rule.kind) {
      case 'field': {
        const op = rule.operator as FieldOperator;
        fields.push({
          jsonPath,
          expectedValue: rule.value ?? '',
          operator: op === 'equals' ? undefined : op,
          operatorValue: NO_VALUE_OPERATORS.has(op) ? undefined : rule.value,
          ...(neg && { negate: true }),
        });
        break;
      }
      case 'length': {
        const lenMatch = rule.operator.match(/^length\s*([><=!]+)$/);
        if (lenMatch && COMPARISON_OP_MAP[lenMatch[1]]) {
          const parsedValue = Number(rule.value);
          assertions.push({
            type: 'arrayLength',
            jsonPath,
            operator: COMPARISON_OP_MAP[lenMatch[1]],
            value: isNaN(parsedValue) ? 0 : parsedValue,
            ...(neg && { negate: true }),
          });
        }
        break;
      }
      case 'each': {
        const eachMatch = rule.operator.match(/^each\s+(.+)$/);
        if (eachMatch) {
          const innerOp = FIELD_OPERATOR_KEYWORDS[eachMatch[1].toLowerCase()];
          const starMatch = jsonPath.match(/^(.+?)\[\*\]\.?(.*)$/);
          const arrayPath = starMatch ? starMatch[1] : jsonPath;
          const fieldPath = starMatch ? starMatch[2] : '';
          if (innerOp) {
            assertions.push({
              type: 'each',
              jsonPath: arrayPath,
              fieldPath,
              operator: innerOp,
              value: rule.value,
              ...(neg && { negate: true }),
            });
          }
        }
        break;
      }
      case 'contains_item': {
        const mode = rule.operator === 'contains_all' ? 'all' : rule.operator === 'contains_only' ? 'only' : rule.operator === 'contains_none' ? 'none' : 'any';
        assertions.push({
          type: 'arrayContains',
          jsonPath,
          value: rule.value ?? '',
          mode,
          ...(neg && { negate: true }),
        });
        break;
      }
      case 'subset': {
        assertions.push({
          type: 'containsSubset',
          jsonPath,
          expected: rule.value ?? '{}',
          ...(neg && { negate: true }),
        });
        break;
      }
      case 'type_check': {
        const expectedType = (rule.value ?? 'string').toLowerCase() as JsonTypeName;
        assertions.push({ type: 'typeCheck', jsonPath, expectedType, ...(neg && { negate: true }) });
        break;
      }
      case 'existence': {
        const existOp = rule.operator as FieldOperator;
        fields.push({
          jsonPath,
          expectedValue: '',
          operator: existOp,
          ...(neg && { negate: true }),
        });
        break;
      }
      case 'custom': {
        const val = rule.value ?? '';
        const nlIdx = val.indexOf('\n');
        const expression = nlIdx >= 0 ? val.slice(0, nlIdx) : val;
        const description = nlIdx >= 0 ? val.slice(nlIdx + 1) : undefined;
        assertions.push({
          type: 'custom',
          expression,
          ...(description && { description }),
          ...(neg && { negate: true }),
        });
        break;
      }
    }
  }

  return { fields, assertions };
}

// ─── Import/Export ────────────────────────────────────────

export interface ExportableRule {
  path: string;
  operator: string;
  value?: string;
  negate?: boolean;
}

export function exportAsJson(fields: ExpectedField[], assertions: Assertion[]): string {
  const dslText = serializeToDsl(fields, assertions);
  const { rules } = parseDsl(dslText);
  const exportable: ExportableRule[] = rules.map(r => ({
    path: r.path,
    operator: r.operator,
    ...(r.value !== undefined ? { value: r.value } : {}),
    ...(r.negate ? { negate: true } : {}),
  }));
  return JSON.stringify(exportable, null, 2);
}

export function importFromJson(text: string): DslModel | ParseError {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) {
      return { lineNumber: 1, message: 'Expected a JSON array of rules' };
    }
    const rules: ParsedRule[] = arr.map((item: ExportableRule, i: number) => {
      const kind = detectKind(item.operator);
      return { lineNumber: i + 1, path: item.path, operator: item.operator, value: item.value, negate: item.negate, kind };
    });
    return dslToModel(rules);
  } catch {
    return { lineNumber: 1, message: 'Invalid JSON' };
  }
}

function detectKind(operator: string): ParsedRule['kind'] {
  if (operator === 'assert') return 'custom';
  if (operator.startsWith('length')) return 'length';
  if (operator.startsWith('each')) return 'each';
  if (operator === 'contains_item' || operator === 'contains_any' || operator === 'contains_all' || operator === 'contains_only' || operator === 'contains_none') return 'contains_item';
  if (operator === 'subset') return 'subset';
  if (operator === 'is_type') return 'type_check';
  if (operator === 'exists' || operator === 'not_exists') return 'existence';
  return 'field';
}

export function importAutoDetect(text: string): DslModel | ParseError {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    return importFromJson(trimmed);
  }
  const { rules, errors } = parseDsl(trimmed);
  if (errors.length > 0) {
    return errors[0];
  }
  return dslToModel(rules);
}
