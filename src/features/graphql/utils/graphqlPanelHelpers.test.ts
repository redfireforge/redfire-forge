import { describe, it, expect } from 'vitest';
import {
  isValidIdentifier,
  isValidJson,
  hasInvalidVariablesJson,
  hasInvalidExtractionRules,
  hasInvalidOutputBindings,
  computeQueryTabErrors,
  hasQueryConfigErrors,
  computeSubscriptionTabErrors,
  hasSubscriptionConfigErrors,
  computeIntrospectTabErrors,
  hasIntrospectConfigErrors,
  computeAssertTabErrors,
  hasAssertConfigErrors,
  hasGraphqlNodeConfigErrors,
  isGraphqlWorkflowNodeType,
} from './graphqlPanelHelpers';

describe('graphqlPanelHelpers', () => {
  describe('isValidIdentifier', () => {
    it('accepts valid identifiers', () => {
      expect(isValidIdentifier('userId')).toBe(true);
      expect(isValidIdentifier('_private')).toBe(true);
      expect(isValidIdentifier('a1')).toBe(true);
    });

    it('rejects invalid identifiers', () => {
      expect(isValidIdentifier('')).toBe(false);
      expect(isValidIdentifier('123')).toBe(false);
      expect(isValidIdentifier('has space')).toBe(false);
      expect(isValidIdentifier('bad-name')).toBe(false);
    });
  });

  describe('isValidJson / hasInvalidVariablesJson', () => {
    it('treats empty and {} as valid', () => {
      expect(hasInvalidVariablesJson('')).toBe(false);
      expect(hasInvalidVariablesJson('{}')).toBe(false);
      expect(hasInvalidVariablesJson(undefined)).toBe(false);
    });

    it('accepts valid JSON objects', () => {
      expect(isValidJson('{"id": "1"}')).toBe(true);
      expect(hasInvalidVariablesJson('{"id": "{{userId}}"}')).toBe(false);
    });

    it('flags malformed JSON', () => {
      expect(hasInvalidVariablesJson('{broken')).toBe(true);
      expect(hasInvalidVariablesJson('not json')).toBe(true);
    });

    it('trims whitespace in variables payload before validation', () => {
      expect(hasInvalidVariablesJson('   {}   ')).toBe(false);
      expect(hasInvalidVariablesJson('  {broken ')).toBe(true);
    });
  });

  describe('rule/output validation helpers', () => {
    it('ignores empty variable names and flags invalid extraction names', () => {
      expect(hasInvalidExtractionRules([{ variableName: '', jsonPath: '$.id' }])).toBe(false);
      expect(hasInvalidExtractionRules([{ variableName: 'bad-name', jsonPath: '$.id' }])).toBe(true);
    });

    it('ignores empty binding names and flags invalid output names', () => {
      expect(hasInvalidOutputBindings([{ variableName: '' }])).toBe(false);
      expect(hasInvalidOutputBindings([{ variableName: '123bad' }])).toBe(true);
    });
  });

  describe('computeQueryTabErrors', () => {
    const validBase = {
      endpoint: 'http://api.example.com/graphql',
      query: 'query { user { id } }',
      variables: '{}',
      extractionRules: [],
      outputBindings: [],
    };

    it('reports no errors for valid config', () => {
      const errors = computeQueryTabErrors(validBase);
      expect(hasQueryConfigErrors(errors)).toBe(false);
    });

    it('flags missing endpoint and query on operation tab', () => {
      expect(computeQueryTabErrors({ ...validBase, endpoint: '' }).operation).toBe(true);
      expect(computeQueryTabErrors({ ...validBase, query: '  ' }).operation).toBe(true);
    });

    it('flags invalid variables JSON', () => {
      expect(computeQueryTabErrors({ ...validBase, variables: '{bad' }).variables).toBe(true);
    });

    it('flags invalid extraction variable names', () => {
      const errors = computeQueryTabErrors({
        ...validBase,
        extractionRules: [{ variableName: 'bad-name', jsonPath: '$.id' }],
      });
      expect(errors.extraction).toBe(true);
    });

    it('flags invalid output binding variable names', () => {
      const errors = computeQueryTabErrors({
        ...validBase,
        outputBindings: [{ field: 'data', variableName: '1bad', enabled: true }],
      });
      expect(errors.output).toBe(true);
    });
  });

  describe('computeSubscriptionTabErrors', () => {
    const validBase = {
      endpoint: 'http://api.example.com/graphql',
      subscriptionQuery: 'subscription { events { id } }',
      variables: '{}',
      extractionRules: [],
      outputBindings: [],
    };

    it('flags missing endpoint or subscription query', () => {
      expect(computeSubscriptionTabErrors({ ...validBase, endpoint: '' }).subscription).toBe(true);
      expect(computeSubscriptionTabErrors({ ...validBase, subscriptionQuery: '' }).subscription).toBe(true);
    });

    it('includes variables errors on subscription tab', () => {
      expect(computeSubscriptionTabErrors({ ...validBase, variables: '{x' }).subscription).toBe(true);
    });

    it('hasSubscriptionConfigErrors returns false for valid subscription config', () => {
      const errors = computeSubscriptionTabErrors(validBase);
      expect(hasSubscriptionConfigErrors(errors)).toBe(false);
    });
  });

  describe('computeIntrospectTabErrors', () => {
    it('flags missing endpoint', () => {
      expect(computeIntrospectTabErrors({ endpoint: '', outputBindings: [] }).endpoint).toBe(true);
    });

    it('hasIntrospectConfigErrors returns false for valid introspect config', () => {
      const errors = computeIntrospectTabErrors({ endpoint: 'http://x/graphql', outputBindings: [] });
      expect(hasIntrospectConfigErrors(errors)).toBe(false);
    });
  });

  describe('computeAssertTabErrors', () => {
    it('flags missing source variable', () => {
      expect(computeAssertTabErrors({ sourceVariable: '', assertions: [] }).source).toBe(true);
    });

    it('flags assertions with empty jsonPath', () => {
      const errors = computeAssertTabErrors({
        sourceVariable: 'myData',
        assertions: [{ id: 'a1', jsonPath: '', operator: 'equals', expectedValue: '1' }],
      });
      expect(errors.assertions).toBe(true);
    });

    it('hasAssertConfigErrors returns false when source and assertions are valid', () => {
      const errors = computeAssertTabErrors({
        sourceVariable: 'responseData',
        assertions: [{ id: 'a1', jsonPath: '$.id', operator: 'equals', expectedValue: '1' }],
      });
      expect(hasAssertConfigErrors(errors)).toBe(false);
    });
  });

  describe('hasGraphqlNodeConfigErrors', () => {
    it('detects graphql node types', () => {
      expect(isGraphqlWorkflowNodeType('graphqlQuery')).toBe(true);
      expect(isGraphqlWorkflowNodeType('http')).toBe(false);
    });

    it('returns true for invalid query node data', () => {
      expect(hasGraphqlNodeConfigErrors('graphqlQuery', {
        label: 'Q',
        endpoint: '',
        query: '',
        variables: '{}',
        headers: [],
        timeoutMs: 30000,
        extractionRules: [],
        outputBindings: [],
      })).toBe(true);
    });

    it('returns false for valid mutation node data', () => {
      expect(hasGraphqlNodeConfigErrors('graphqlMutation', {
        label: 'M',
        endpoint: 'http://x/graphql',
        query: 'mutation { x }',
        variables: '{}',
        headers: [],
        timeoutMs: 30000,
        extractionRules: [],
        outputBindings: [],
      })).toBe(false);
    });

    it('returns true for invalid subscription node data', () => {
      expect(hasGraphqlNodeConfigErrors('graphqlSubscription', {
        label: 'S',
        endpoint: '',
        subscriptionQuery: '',
        variables: '{}',
        extractionRules: [],
        outputBindings: [],
      })).toBe(true);
    });

    it('returns true for invalid introspect node data', () => {
      expect(hasGraphqlNodeConfigErrors('graphqlIntrospect', {
        label: 'I',
        endpoint: '',
        timeoutMs: 5000,
        outputBindings: [],
      })).toBe(true);
    });

    it('returns true for invalid assert node data', () => {
      expect(hasGraphqlNodeConfigErrors('graphqlAssert', {
        label: 'A',
        sourceVariable: '',
        assertions: [{ id: 'a1', jsonPath: '', operator: 'equals', expectedValue: '1' }],
        failBehavior: 'error',
      })).toBe(true);
    });

    it('returns false for unknown node type', () => {
      expect(hasGraphqlNodeConfigErrors('http', {
        label: 'X',
        endpoint: '',
        query: '',
        variables: '{}',
        headers: [],
        timeoutMs: 1000,
        extractionRules: [],
        outputBindings: [],
      })).toBe(false);
    });
  });
});
