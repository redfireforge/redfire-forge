/**
 * @vitest-environment node
 */
import http from 'node:http';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './webhook-server';
import type { Workflow } from '../src/features/workflow/types/workflow';

// Mock file storage
vi.mock('./file-storage.js', () => ({
  getWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
  getExecutionHistory: vi.fn(),
  getWebhookDeliveries: vi.fn(),
  logWebhookDelivery: vi.fn(),
}));

vi.mock('./webhook-extractor.js', () => ({
  extractWebhookVariables: vi.fn(),
}));

vi.mock('./executeWorkflow.js', () => ({
  executeWorkflow: vi.fn(),
  saveErrorResult: vi.fn(),
}));

vi.mock('./correlation-handler.js', () => ({
  createCorrelationRouter: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  setCorrelationStore: vi.fn(),
}));

vi.mock('./correlation-store-factory.js', () => ({
  createCorrelationStore: vi.fn(),
}));

import {
  getWorkflow,
  saveWorkflow,
  getExecutionHistory,
  getWebhookDeliveries,
  logWebhookDelivery,
} from './file-storage.js';
import { extractWebhookVariables } from './webhook-extractor.js';
import { executeWorkflow, saveErrorResult } from './executeWorkflow.js';

const mockGetWorkflow = vi.mocked(getWorkflow);
const mockSaveWorkflow = vi.mocked(saveWorkflow);
const mockGetExecutionHistory = vi.mocked(getExecutionHistory);
const mockGetWebhookDeliveries = vi.mocked(getWebhookDeliveries);
const mockLogWebhookDelivery = vi.mocked(logWebhookDelivery);
const mockExtractWebhookVariables = vi.mocked(extractWebhookVariables);
const mockExecuteWorkflow = vi.mocked(executeWorkflow);
const mockSaveErrorResult = vi.mocked(saveErrorResult);

function createMockWorkflow(): Workflow {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    nodes: [
      {
        id: 'trigger-1',
        type: 'webhook',
        position: { x: 0, y: 0 },
        data: {
          label: 'Webhook Trigger',
          method: 'POST',
          path: '/api/webhook',
          samplePayload: '{}',
          extractVariables: [],
        },
      },
      {
        id: 'http-1',
        type: 'http',
        position: { x: 0, y: 100 },
        data: { label: 'HTTP', scenario: { id: 'sc-1', url: '/test', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
    ],
    edges: [],
    variables: { baseUrl: 'https://api.example.com' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('webhook-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns health status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.port).toBe(3001);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/executions', () => {
    it('returns execution history', async () => {
      const mockExecutions = [{ id: 'exec-1', workflowId: 'wf-1', status: 'success' }];
      mockGetExecutionHistory.mockResolvedValue(mockExecutions);

      const res = await request(app).get('/api/executions');

      expect(res.status).toBe(200);
      expect(res.body.executions).toEqual(mockExecutions);
      expect(res.body.count).toBe(1);
      expect(mockGetExecutionHistory).toHaveBeenCalledWith(undefined, 50);
    });

    it('accepts limit parameter', async () => {
      mockGetExecutionHistory.mockResolvedValue([]);

      await request(app).get('/api/executions?limit=10');

      expect(mockGetExecutionHistory).toHaveBeenCalledWith(undefined, 10);
    });

    it('accepts workflowId filter', async () => {
      mockGetExecutionHistory.mockResolvedValue([]);

      await request(app).get('/api/executions?workflowId=wf-1');

      expect(mockGetExecutionHistory).toHaveBeenCalledWith('wf-1', 50);
    });

    it('handles errors', async () => {
      mockGetExecutionHistory.mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/api/executions');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to load execution history');
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('registers a workflow', async () => {
      mockSaveWorkflow.mockResolvedValue(undefined);
      const workflow = createMockWorkflow();

      const res = await request(app)
        .put('/api/workflows/wf-1')
        .send(workflow);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workflow registered');
      expect(res.body.id).toBe('wf-1');
      expect(mockSaveWorkflow).toHaveBeenCalled();
    });

    it('rejects invalid workflow data', async () => {
      const res = await request(app)
        .put('/api/workflows/wf-1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid workflow data');
    });

    it('handles save errors', async () => {
      mockSaveWorkflow.mockRejectedValue(new Error('Save failed'));

      const res = await request(app)
        .put('/api/workflows/wf-1')
        .send(createMockWorkflow());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to register workflow');
    });
  });

  describe('GET /api/webhook-deliveries', () => {
    it('returns webhook deliveries for today', async () => {
      const mockDeliveries = [{ id: 'd1', triggerId: 't1', status: 'success' }];
      mockGetWebhookDeliveries.mockResolvedValue(mockDeliveries);

      const res = await request(app).get('/api/webhook-deliveries');

      expect(res.status).toBe(200);
      expect(res.body.deliveries).toEqual(mockDeliveries);
      expect(res.body.count).toBe(1);
    });

    it('accepts date parameter', async () => {
      mockGetWebhookDeliveries.mockResolvedValue([]);

      await request(app).get('/api/webhook-deliveries?date=2024-01-15');

      expect(mockGetWebhookDeliveries).toHaveBeenCalledWith('2024-01-15');
    });

    it('rejects invalid date format', async () => {
      const res = await request(app).get('/api/webhook-deliveries?date=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid date format');
    });

    it('handles errors', async () => {
      mockGetWebhookDeliveries.mockRejectedValue(new Error('Read error'));

      const res = await request(app).get('/api/webhook-deliveries');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to load webhook deliveries');
    });
  });

  describe('POST /webhooks/:workflowId/:triggerId', () => {
    it('executes workflow on webhook trigger', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({ event: 'test' });
      mockExecuteWorkflow.mockResolvedValue({
        status: 'success',
        passed: true,
        duration: 100,
        results: [],
      });
      mockLogWebhookDelivery.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1')
        .send({ event: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workflow executed successfully');
      expect(res.body.workflowId).toBe('wf-1');
      expect(mockExecuteWorkflow).toHaveBeenCalled();
      expect(mockLogWebhookDelivery).toHaveBeenCalledWith(expect.objectContaining({
        triggerId: 'trigger-1',
        method: 'POST',
        status: 'success',
      }));
    });

    it('returns 404 when workflow not found', async () => {
      mockGetWorkflow.mockResolvedValue(null);

      const res = await request(app)
        .post('/webhooks/unknown/trigger-1')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workflow not found');
    });

    it('returns 404 when trigger not found', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);

      const res = await request(app)
        .post('/webhooks/wf-1/unknown-trigger')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Webhook trigger not found');
    });

    it('returns 405 for method mismatch', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);

      const res = await request(app)
        .get('/webhooks/wf-1/trigger-1');

      expect(res.status).toBe(405);
      expect(res.body.error).toContain('Method GET not allowed');
    });

    it('handles execution errors', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockRejectedValue(new Error('Execution failed'));
      mockLogWebhookDelivery.mockResolvedValue(undefined);
      mockSaveErrorResult.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Workflow execution failed');
      expect(mockSaveErrorResult).toHaveBeenCalled();
      expect(mockLogWebhookDelivery).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
      }));
    });
  });

  describe('CORS', () => {
    it('allows cross-origin requests', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown/path');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
      expect(res.body.hint).toBeDefined();
    });
  });

  describe('GET /api/logs/stream', () => {
    it('streams events and broadcasts webhook logs to connected clients', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockResolvedValue({
        status: 'success',
        passed: true,
        duration: 1,
        results: [],
      });
      mockLogWebhookDelivery.mockResolvedValue(undefined);

      const server = await new Promise<http.Server>((resolve, reject) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
        s.on('error', reject);
      });
      const { port } = server.address() as import('net').AddressInfo;

      const sseChunks: string[] = [];
      await new Promise<void>((resolve, reject) => {
        const sseReq = http.get(`http://127.0.0.1:${port}/api/logs/stream`, (res) => {
          expect(String(res.headers['content-type'])).toContain('text/event-stream');
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => sseChunks.push(chunk));

          const agent = request(server);
          agent
            .post('/webhooks/wf-1/trigger-1')
            .send({})
            .end((err, webhookRes) => {
              if (err) return reject(err);
              expect(webhookRes?.status).toBe(200);
              setTimeout(() => {
                res.socket?.destroy();
                server.close(() => resolve());
              }, 40);
            });
        });
        sseReq.on('error', reject);
      });

      const joined = sseChunks.join('');
      expect(joined).toMatch(/data:.*Webhook/i);
    });
  });

  describe('Express error handler (Vitest-only route)', () => {
    it('returns 500 JSON for next(err)', async () => {
      const res = await request(app).get('/__vitest_unhandled_error__');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(res.body.message).toBe('vitest');
    });
  });

  describe('Webhook trace capture', () => {
    it('includes iterationTrace when _trace=true', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockResolvedValue({
        status: 'success',
        passed: true,
        duration: 100,
        results: [
          {
            id: 'r1',
            scenarioId: 's1',
            url: '/test',
            method: 'GET',
            httpStatus: 200,
            responseTimeMs: 50,
            passed: true,
          },
        ],
        iterationTrace: {
          iterationId: 'iter-1',
          nodeResults: [],
        },
      });
      mockLogWebhookDelivery.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1?_trace=true')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.iterationTrace).toBeDefined();
      expect(res.body.iterationTrace.iterationId).toBe('iter-1');
      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          traceOptions: { captureFullTrace: true, alwaysCaptureFailures: true },
        }),
      );
    });

    it('includes iterationTrace when _trace=1', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockResolvedValue({
        status: 'success',
        passed: true,
        duration: 100,
        results: [],
        iterationTrace: { iterationId: 'iter-2', nodeResults: [] },
      });
      mockLogWebhookDelivery.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1?_trace=1')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.iterationTrace).toBeDefined();
    });

    it('does not include iterationTrace when trace not requested', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockResolvedValue({
        status: 'success',
        passed: true,
        duration: 100,
        results: [],
        iterationTrace: { iterationId: 'iter-3', nodeResults: [] },
      });
      mockLogWebhookDelivery.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.iterationTrace).toBeUndefined();
    });
  });

  describe('Webhook execution with failed status', () => {
    it('logs delivery with failed status when execution fails but does not throw', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockResolvedValue({
        status: 'failed',
        passed: false,
        duration: 100,
        results: [],
      });
      mockLogWebhookDelivery.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('failed');
      expect(mockLogWebhookDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
        }),
      );
    });
  });

  describe('Webhook error handling edge cases', () => {
    it('handles logWebhookDelivery failure in error path gracefully', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockRejectedValue(new Error('Execution error'));
      mockLogWebhookDelivery.mockRejectedValue(new Error('Log delivery failed'));
      mockSaveErrorResult.mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1')
        .send({});

      expect(res.status).toBe(500);
      expect(consoleSpy).toHaveBeenCalledWith('[Webhook] Failed to log delivery:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles non-Error objects in error path', async () => {
      const workflow = createMockWorkflow();
      mockGetWorkflow.mockResolvedValue(workflow);
      mockExtractWebhookVariables.mockReturnValue({});
      mockExecuteWorkflow.mockRejectedValue('string error');
      mockLogWebhookDelivery.mockResolvedValue(undefined);
      mockSaveErrorResult.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/webhooks/wf-1/trigger-1')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('string error');
    });
  });
});
