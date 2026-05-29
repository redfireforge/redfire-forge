/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadTestFile, buildScenarios, buildTestConfig } from './loader';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

describe('loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadTestFile', () => {
    it('loads a valid YAML test file', () => {
      const yamlContent = `
name: Test Suite
baseUrl: https://api.example.com
tests:
  - name: Get Users
    method: GET
    url: /users
`;
      mockReadFileSync.mockReturnValue(yamlContent);

      const file = loadTestFile('test.yaml');

      expect(file.name).toBe('Test Suite');
      expect(file.baseUrl).toBe('https://api.example.com');
      expect(file.tests).toHaveLength(1);
      expect(file.tests[0].name).toBe('Get Users');
    });

    it('loads a valid JSON test file', () => {
      const jsonContent = JSON.stringify({
        name: 'Test Suite',
        tests: [{ name: 'Get Users', url: '/users', method: 'GET' }],
      });
      mockReadFileSync.mockReturnValue(jsonContent);

      const file = loadTestFile('test.json');

      expect(file.name).toBe('Test Suite');
      expect(file.tests).toHaveLength(1);
    });

    it('throws error if tests array is missing', () => {
      mockReadFileSync.mockReturnValue('name: Test');

      expect(() => loadTestFile('test.yaml')).toThrow('non-empty "tests" array');
    });

    it('throws error if tests array is empty', () => {
      mockReadFileSync.mockReturnValue('name: Test\ntests: []');

      expect(() => loadTestFile('test.yaml')).toThrow('non-empty "tests" array');
    });
  });

  describe('buildScenarios', () => {
    it('builds scenarios from test file', () => {
      const file = {
        tests: [
          { name: 'Get Users', url: '/users', method: 'GET' },
          { name: 'Create User', url: '/users', method: 'POST' },
        ],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].name).toBe('Get Users');
      expect(scenarios[0].method).toBe('GET');
      expect(scenarios[1].name).toBe('Create User');
      expect(scenarios[1].method).toBe('POST');
    });

    it('resolves relative URLs with baseUrl', () => {
      const file = {
        baseUrl: 'https://api.example.com',
        tests: [{ name: 'Test', url: '/users', method: 'GET' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].url).toBe('https://api.example.com/users');
    });

    it('preserves absolute URLs', () => {
      const file = {
        baseUrl: 'https://api.example.com',
        tests: [{ name: 'Test', url: 'https://other.api.com/users', method: 'GET' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].url).toBe('https://other.api.com/users');
    });

    it('uses CLI baseUrl over file baseUrl', () => {
      const file = {
        baseUrl: 'https://api.example.com',
        tests: [{ name: 'Test', url: '/users', method: 'GET' }],
      };

      const scenarios = buildScenarios(file, 'https://staging.example.com');

      expect(scenarios[0].url).toBe('https://staging.example.com/users');
    });

    it('defaults method to GET', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].method).toBe('GET');
    });

    it('uppercases method', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', method: 'post' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].method).toBe('POST');
    });

    it('merges default headers with test headers', () => {
      const file = {
        defaults: {
          headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        },
        tests: [{ name: 'Test', url: '/users', headers: { Accept: 'application/xml' } }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].headers).toHaveLength(3);
      expect(scenarios[0].headers).toContainEqual({ key: 'Authorization', value: 'Bearer token' });
      expect(scenarios[0].headers).toContainEqual({ key: 'Accept', value: 'application/xml' });
    });

    it('test headers override default headers', () => {
      const file = {
        defaults: {
          headers: { 'Content-Type': 'application/json' },
        },
        tests: [{ name: 'Test', url: '/users', headers: { 'Content-Type': 'text/plain' } }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].headers).toHaveLength(1);
      expect(scenarios[0].headers[0]).toEqual({ key: 'Content-Type', value: 'text/plain' });
    });

    // ─── Scenario Tags Tests ────────────────────────────────

    it('preserves tags from YAML as scenarioTags', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', tags: ['smoke', 'regression'] }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toEqual(['smoke', 'regression']);
    });

    it('normalizes tags to lowercase', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', tags: ['Smoke', 'REGRESSION', 'Critical'] }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toEqual(['smoke', 'regression', 'critical']);
    });

    it('trims whitespace from tags', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', tags: ['  smoke  ', 'regression '] }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toEqual(['smoke', 'regression']);
    });

    it('filters out empty tags', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', tags: ['smoke', '', '  ', 'regression'] }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toEqual(['smoke', 'regression']);
    });

    it('sets scenarioTags to undefined when tags is missing', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toBeUndefined();
    });

    it('sets scenarioTags to undefined when tags is empty array', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', tags: [] }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toBeUndefined();
    });

    it('sets scenarioTags to undefined when all tags are empty strings', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users', tags: ['', '  '] }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].scenarioTags).toBeUndefined();
    });

    // ─── Auth Tests ────────────────────────────────

    it('uses default auth when test has no auth', () => {
      const file = {
        defaults: {
          auth: { type: 'bearer' as const, token: 'default-token' },
        },
        tests: [{ name: 'Test', url: '/users' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].auth).toEqual({ type: 'bearer', token: 'default-token' });
    });

    it('test auth overrides default auth', () => {
      const file = {
        defaults: {
          auth: { type: 'bearer' as const, token: 'default-token' },
        },
        tests: [{ name: 'Test', url: '/users', auth: { type: 'basic' as const, username: 'user', password: 'pass' } }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].auth.type).toBe('basic');
    });

    // ─── Validation Tests ────────────────────────────────

    it('parses validation config', () => {
      const file = {
        tests: [{
          name: 'Test',
          url: '/users',
          validation: {
            mode: 'selective' as const,
            expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          },
        }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].validation.mode).toBe('selective');
      expect(scenarios[0].validation.expectedFields).toHaveLength(1);
    });

    it('defaults validation to none', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].validation.mode).toBe('none');
    });

    // ─── Extraction Tests ────────────────────────────────

    it('parses extractions', () => {
      const file = {
        tests: [{
          name: 'Test',
          url: '/users',
          extract: [
            { name: 'userId', expression: '$.id' },
            { name: 'header', source: 'header' as const, expression: 'X-Request-Id' },
          ],
        }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].extractions).toHaveLength(2);
      expect(scenarios[0].extractions![0]).toEqual({ name: 'userId', source: 'body', expression: '$.id' });
      expect(scenarios[0].extractions![1].source).toBe('header');
    });

    // ─── External Data Source Tests ────────────────────────────────

    it('attaches external data source to all scenarios', () => {
      const file = {
        tests: [
          { name: 'Test 1', url: '/users' },
          { name: 'Test 2', url: '/posts' },
        ],
      };
      const externalDataSource = {
        columns: [{ id: 'c1', name: 'userId' }],
        rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
      };

      const scenarios = buildScenarios(file, undefined, externalDataSource);

      expect(scenarios[0].dataSource).toBe(externalDataSource);
      expect(scenarios[1].dataSource).toBe(externalDataSource);
    });

    it('featureGroupName and groupName are set from file', () => {
      const file = {
        tests: [{
          name: 'Test',
          url: '/users',
          featureGroup: 'User API',
          scenario: 'CRUD Operations',
        }],
      };

      const scenarios = buildScenarios(file);

      expect(scenarios[0].featureGroupName).toBe('User API');
      expect(scenarios[0].groupName).toBe('CRUD Operations');
    });
  });

  describe('buildTestConfig', () => {
    it('builds config with defaults', () => {
      const file = { tests: [{ name: 'Test', url: '/users' }] };
      const scenarios = buildScenarios(file);

      const config = buildTestConfig(file, scenarios, {});

      expect(config.concurrency).toBe(1);
      expect(config.executionMode).toBe('batch');
      expect(config.errorPolicy).toBe('continue');
    });

    it('uses file config values', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
        config: {
          concurrency: 10,
          iterations: 100,
          mode: 'pool',
          errorPolicy: 'stop-first',
        },
      };
      const scenarios = buildScenarios(file);

      const config = buildTestConfig(file, scenarios, {});

      expect(config.concurrency).toBe(10);
      expect(config.iterations).toBe(100);
      expect(config.executionMode).toBe('pool');
      expect(config.errorPolicy).toBe('stop-first');
    });

    it('CLI overrides take precedence over file config', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
        config: { concurrency: 10, iterations: 100 },
      };
      const scenarios = buildScenarios(file);

      const config = buildTestConfig(file, scenarios, {
        concurrency: 5,
        transactions: 50,
      });

      expect(config.concurrency).toBe(5);
      expect(config.iterations).toBe(50);
    });

    it('uses defaults timeout and retries', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
        defaults: { timeout: 30, retries: 3, retryDelay: 2000 },
      };
      const scenarios = buildScenarios(file);

      const config = buildTestConfig(file, scenarios, {});

      expect(config.timeoutSec).toBe(30);
      expect(config.retryCount).toBe(3);
      expect(config.retryDelayMs).toBe(2000);
    });

    it('creates load profile config when mode is load-profile', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
        config: {
          mode: 'load-profile',
          loadProfile: {
            type: 'sustained',
            duration: 120,
            maxConcurrency: 20,
          },
        },
      };
      const scenarios = buildScenarios(file);

      const config = buildTestConfig(file, scenarios, {});

      expect(config.loadProfile).toBeDefined();
      expect(config.loadProfile!.type).toBe('sustained');
      expect(config.loadProfile!.durationSec).toBe(120);
      expect(config.loadProfile!.maxConcurrency).toBe(20);
    });

    it('preserves workflow variables', () => {
      const file = {
        tests: [{ name: 'Test', url: '/users' }],
        variables: { baseUrl: 'https://api.example.com', token: 'abc123' },
      };
      const scenarios = buildScenarios(file);

      const config = buildTestConfig(file, scenarios, {});

      expect(config.workflowVariables).toEqual({
        baseUrl: 'https://api.example.com',
        token: 'abc123',
      });
    });
  });
});
