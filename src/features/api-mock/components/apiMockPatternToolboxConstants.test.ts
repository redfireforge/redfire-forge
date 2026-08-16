import { describe, expect, it } from 'vitest';
import {
  SCHEMA_CURRENT_PRESET_NAME,
  SCHEMA_PRESETS,
  activeSchemaLibraryName,
  initialJsonPathDraft,
  initialRegexPattern,
  initialRegexSamples,
  initialSchemaKind,
  initialSchemaText,
  initialXPathDraft,
  isCustomSchemaDraft,
  matchingSchemaPresetName,
  normalizeSchemaDraft,
  toolboxTabForOperator,
} from './apiMockPatternToolboxConstants';

describe('apiMockPatternToolboxConstants', () => {
  it('maps matcher operators onto toolbox tabs', () => {
    expect(toolboxTabForOperator('regex')).toBe('regex');
    expect(toolboxTabForOperator('glob')).toBe('regex');
    expect(toolboxTabForOperator('jsonPath_exists')).toBe('jsonpath');
    expect(toolboxTabForOperator('jsonPath_equals')).toBe('jsonpath');
    expect(toolboxTabForOperator('xpath_exists')).toBe('xpath');
    expect(toolboxTabForOperator('xpath_equals')).toBe('xpath');
    expect(toolboxTabForOperator('jsonSchema')).toBe('schema');
    expect(toolboxTabForOperator('xmlSchema')).toBe('schema');
    expect(toolboxTabForOperator('exact')).toBe('path');
    expect(toolboxTabForOperator(undefined)).toBe('path');
  });

  it('picks JSON vs XML schema kind from operator and expected shape', () => {
    expect(initialSchemaKind('xmlSchema', { type: 'object' })).toBe('xml');
    expect(initialSchemaKind('jsonSchema', 'Order, Id')).toBe('json');
    expect(initialSchemaKind(undefined, ['Order'])).toBe('xml');
    expect(initialSchemaKind(undefined, 'Order, Id')).toBe('xml');
    expect(initialSchemaKind(undefined, '{ "type": "object" }')).toBe('json');
    expect(initialSchemaKind(undefined, { requiredElements: ['Id'] })).toBe('xml');
    expect(initialSchemaKind(undefined, { type: 'object' })).toBe('json');
    expect(initialSchemaKind(undefined, undefined)).toBe('json');
  });

  it('seeds JSONPath, XPath, regex, and schema editors from the matcher being edited', () => {
    expect(initialJsonPathDraft('jsonPath_equals', ['$.role', 'admin'])).toEqual({ path: '$.role', value: 'admin' });
    expect(initialJsonPathDraft('jsonPath_exists', '$.user.email')).toEqual({ path: '$.user.email', value: '' });
    expect(initialJsonPathDraft(undefined, undefined).path).toBe('$');

    expect(initialXPathDraft('xpath_equals', ['//status', 'open'])).toEqual({ expr: '//status', value: 'open' });
    expect(initialXPathDraft('xpath_exists', '/*')).toEqual({ expr: '/*', value: '' });
    expect(initialXPathDraft(undefined, undefined)).toEqual({ expr: '/*', value: '' });

    expect(initialRegexPattern('regex', 'foo.*bar')).toBe('foo.*bar');
    expect(initialRegexPattern('glob', '*.png')).toBe('*.png');
    expect(initialRegexPattern('regex')).toBe('^[0-9]+$');
    expect(initialRegexPattern(undefined, undefined, 'regex', '^[a-z]+$')).toBe('^[a-z]+$');
    expect(initialRegexPattern()).toBe('^[0-9]+$');
    expect(initialRegexPattern('regex', 12)).toBe('12');

    expect(initialSchemaText('xmlSchema', { required: ['Order'] })).toContain('Order');
    expect(initialSchemaText('jsonPath_exists', '$.user.email')).toContain('"type": "object"');
    expect(initialSchemaText(undefined, 'Order, Id')).toBe('Order, Id');
    expect(initialSchemaText()).toContain('"type": "object"');
  });

  it('treats compact and pretty JSON as the same schema draft', () => {
    expect(normalizeSchemaDraft('json', '{ "type": "object" }')).toBe(
      normalizeSchemaDraft('json', SCHEMA_PRESETS[0].value),
    );
    expect(normalizeSchemaDraft('xml', 'Order,  Id')).toBe('Order,Id');
    expect(normalizeSchemaDraft('json', '{')).toBe('{');
    expect(matchingSchemaPresetName('json', '{"type":"object"}')).toBe('JSON object');
    expect(matchingSchemaPresetName('json', '{"type":"object","required":["customer"]}')).toBeNull();
    expect(isCustomSchemaDraft('json', '{"type":"object"}')).toBe(false);
    expect(isCustomSchemaDraft('json', '{"required":["customer"]}')).toBe(true);
    expect(isCustomSchemaDraft('json', '   ')).toBe(false);
    expect(activeSchemaLibraryName('json', '{"type":"object"}')).toBe('JSON object');
    expect(activeSchemaLibraryName('json', '{"required":["id"]}', {
      kind: 'json',
      schema: '{"required":["id"]}',
    })).toBe(SCHEMA_CURRENT_PRESET_NAME);
    expect(activeSchemaLibraryName('json', SCHEMA_PRESETS[1].value, {
      kind: 'json',
      schema: '{"required":["id"]}',
    })).toBe('Required id');
  });

  it('seeds session-shaped live samples for a cookie row, Numeric ID for the path wand', () => {
    expect(initialRegexSamples('cookie').map(s => s.value)).toEqual(['S-2048', 's-2048', 'admin', 'S-20']);
    expect(initialRegexSamples().map(s => s.value)).toEqual(['42', '100234', 'admin', '42a']);
    expect(initialRegexSamples('header').map(s => s.value)).toEqual(['42', '100234', 'admin', '42a']);
  });
});
