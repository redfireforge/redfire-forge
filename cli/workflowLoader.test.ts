/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { loadWorkflowFile } from './workflowLoader';
import type { HttpNodeData } from '../src/features/workflow/types/workflow';

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

describe('workflowLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadWorkflowFile', () => {
    const validYamlContent = `
name: Test Workflow
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: { label: Start }
  - id: http1
    type: http
    position: { x: 0, y: 100 }
    data:
      label: Get Users
      method: GET
      url: /users
  - id: end
    type: end
    position: { x: 0, y: 200 }
    data: { label: End }
edges:
  - id: e1
    source: start
    target: http1
  - id: e2
    source: http1
    target: end
variables:
  baseUrl: https://api.example.com
`;

    it('loads a valid YAML workflow file', () => {
      mockReadFileSync.mockReturnValue(validYamlContent);
      
      const workflow = loadWorkflowFile('test.yaml');
      
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.nodes).toHaveLength(3);
      expect(workflow.edges).toHaveLength(2);
      expect(workflow.variables).toEqual({ baseUrl: 'https://api.example.com' });
    });

    it('loads a valid YML workflow file', () => {
      mockReadFileSync.mockReturnValue(validYamlContent);
      
      const workflow = loadWorkflowFile('test.yml');
      
      expect(workflow.name).toBe('Test Workflow');
    });

    it('loads a valid JSON workflow file', () => {
      const jsonContent = JSON.stringify({
        name: 'Test Workflow',
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
          { id: 'end', type: 'end', position: { x: 0, y: 100 }, data: { label: 'End' } },
        ],
        edges: [{ id: 'e1', source: 'start', target: 'end' }],
      });
      mockReadFileSync.mockReturnValue(jsonContent);
      
      const workflow = loadWorkflowFile('test.json');
      
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.nodes).toHaveLength(2);
    });

    it('normalizes simplified HTTP node format to full format', () => {
      const yamlWithSimplifiedHttp = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: { label: Start }
  - id: http1
    type: http
    position: { x: 0, y: 100 }
    data:
      label: Get Users
      method: GET
      url: /users
      headers:
        Authorization: Bearer token123
        Content-Type: application/json
      body: '{"test": true}'
edges:
  - id: e1
    source: start
    target: http1
`;
      mockReadFileSync.mockReturnValue(yamlWithSimplifiedHttp);
      
      const workflow = loadWorkflowFile('test.yaml');
      const httpNode = workflow.nodes.find(n => n.id === 'http1');
      
      expect(httpNode?.data).toHaveProperty('scenario');
      const scenario = (httpNode?.data as HttpNodeData).scenario;
      expect(scenario.method).toBe('GET');
      expect(scenario.url).toBe('/users');
      expect(scenario.headers).toHaveLength(2);
      expect(scenario.body).toBe('{"test": true}');
    });

    it('preserves full HTTP node format with scenario', () => {
      const yamlWithFullHttp = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: { label: Start }
  - id: http1
    type: http
    position: { x: 0, y: 100 }
    data:
      label: Get Users
      scenario:
        id: scenario-1
        name: Get Users
        url: /users
        method: GET
        headers: []
        body: ""
        auth: { type: none }
        validation: { mode: none }
edges:
  - id: e1
    source: start
    target: http1
`;
      mockReadFileSync.mockReturnValue(yamlWithFullHttp);
      
      const workflow = loadWorkflowFile('test.yaml');
      const httpNode = workflow.nodes.find(n => n.id === 'http1');
      
      expect((httpNode?.data as HttpNodeData).scenario.id).toBe('scenario-1');
    });

    it('converts headers object to array format', () => {
      const yaml = `
name: Test
nodes:
  - id: http1
    type: http
    position: { x: 0, y: 0 }
    data:
      label: Test
      url: /test
      headers:
        Authorization: Bearer token
        X-Custom: value
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      const scenario = (workflow.nodes[0].data as HttpNodeData).scenario;
      
      expect(scenario.headers).toEqual([
        { key: 'Authorization', value: 'Bearer token' },
        { key: 'X-Custom', value: 'value' },
      ]);
    });

    it('handles headers already in array format', () => {
      const yaml = `
name: Test
nodes:
  - id: http1
    type: http
    position: { x: 0, y: 0 }
    data:
      label: Test
      url: /test
      headers:
        - key: Authorization
          value: Bearer token
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      const scenario = (workflow.nodes[0].data as HttpNodeData).scenario;
      
      expect(scenario.headers).toEqual([{ key: 'Authorization', value: 'Bearer token' }]);
    });

    it('defaults method to GET if not specified', () => {
      const yaml = `
name: Test
nodes:
  - id: http1
    type: http
    position: { x: 0, y: 0 }
    data:
      label: Test
      url: /test
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      const scenario = (workflow.nodes[0].data as HttpNodeData).scenario;
      
      expect(scenario.method).toBe('GET');
    });

    it('uppercases the HTTP method', () => {
      const yaml = `
name: Test
nodes:
  - id: http1
    type: http
    position: { x: 0, y: 0 }
    data:
      label: Test
      method: post
      url: /test
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      const scenario = (workflow.nodes[0].data as HttpNodeData).scenario;
      
      expect(scenario.method).toBe('POST');
    });

    it('throws error if name is missing', () => {
      const yaml = `
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('Workflow must have a "name" string field');
    });

    it('throws error if nodes is missing', () => {
      const yaml = `
name: Test
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('Workflow must have a "nodes" array');
    });

    it('throws error if edges is missing', () => {
      const yaml = `
name: Test
nodes: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('Workflow must have an "edges" array');
    });

    it('throws error if node is missing id', () => {
      const yaml = `
name: Test
nodes:
  - type: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('missing required "id" field');
    });

    it('throws error if node is missing type', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('missing required "type" field');
    });

    it('throws error if node is missing position', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('missing or invalid "position" field');
    });

    it('throws error if node is missing data', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('missing "data" field');
    });

    it('throws error if edge is missing id', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges:
  - source: start
    target: end
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('edge missing required "id" field');
    });

    it('throws error if edge is missing source', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges:
  - id: e1
    target: end
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('missing required "source" field');
    });

    it('throws error if edge is missing target', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges:
  - id: e1
    source: start
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      expect(() => loadWorkflowFile('test.yaml')).toThrow('missing required "target" field');
    });

    it('generates id if not provided', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      
      expect(workflow.id).toBeDefined();
      expect(typeof workflow.id).toBe('string');
    });

    it('provides default values for optional fields', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      
      expect(workflow.variables).toEqual({});
      expect(workflow.services).toEqual([]);
      expect(workflow.createdAt).toBeDefined();
      expect(workflow.updatedAt).toBeDefined();
    });

    it('preserves description if provided', () => {
      const yaml = `
name: Test
description: A test workflow for demonstration
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      
      expect(workflow.description).toBe('A test workflow for demonstration');
    });

    it('preserves services if provided', () => {
      const yaml = `
name: Test
nodes:
  - id: start
    type: start
    position: { x: 0, y: 0 }
    data: {}
edges: []
services:
  - id: svc-1
    name: api
    urls:
      production: https://api.example.com
`;
      mockReadFileSync.mockReturnValue(yaml);
      
      const workflow = loadWorkflowFile('test.yaml');
      
      expect(workflow.services).toHaveLength(1);
      expect(workflow.services?.[0].name).toBe('api');
    });
  });
});
