import express, { type Request, type Response } from 'express';
import {
  getWorkflow,
  saveWorkflow,
  getExecutionHistory,
  getWebhookDeliveries,
  logWebhookDelivery,
} from './file-storage.js';
import { extractWebhookVariables } from './webhook-extractor.js';
import { executeWorkflow, saveErrorResult } from './executeWorkflow.js';
import { createCorrelationRouter } from './correlation-handler.js';
import { createKafkaRouter } from './routes/kafka-routes.js';
import { createKafkaTriggerRouter } from './routes/kafka-trigger-routes.js';
import { createWebSocketRouter } from './routes/websocket-routes.js';
import { createWebSocketMockRouter } from './routes/websocket-mock-routes.js';
import { createGraphqlRouter } from './routes/graphql/graphql-routes.js';
import { createGrpcRouter } from './routes/grpc/grpc-routes.js';
import { createGrpcMockRouter } from './routes/grpc/grpc-mock-routes.js';
import { createApiMockRouter } from './routes/api-mock/api-mock-routes.js';
import { kafkaTriggerSubscriptionManager } from './kafka/kafkaTriggerSubscriptionManager.js';
import type { WebhookTriggerNodeData } from '../src/features/workflow/types/workflow';
import type { LogLine } from '../src/shared/types/server-api';
import { generateExecutionId } from '../src/features/test-runner/utils/serverFormatters';
import { toErrorMessage } from '../src/shared/utils/helpers';
import { GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_LOOPBACK_URL } from '../src/shared/grpc/grpcSpringFixturePorts';

const app = express();

// ── SSE log broadcast ────────────────────────────────
const sseClients = new Set<Response>();

function broadcastLog(line: LogLine) {
  const data = JSON.stringify(line);
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware for UI (localhost:5173)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Last-Event-ID');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: 3001,
  });
});

// Demo Hub prerequisite health proxies.
// Always respond HTTP 200 with `{ status: 'ok' | 'down' }` so PrerequisiteGate
// polls do not flood Chrome DevTools with "Failed to load resource: 503" while
// Docker fixtures are offline. Clients must read the JSON `status` field.

// Spring fixture health proxy used by Demo Hub prerequisite checks.
app.get('/health/spring', async (_req: Request, res: Response) => {
  const controller = new AbortController();
  const timer = setTimeout(controller.abort.bind(controller), 2500);
  try {
    const response = await fetch(GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_LOOPBACK_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return res.status(200).json({
        status: 'down',
        source: 'spring-actuator',
        reason: `http_${response.status}`,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const springStatus = (payload && typeof payload === 'object' && 'status' in payload)
      ? String((payload as { status?: unknown }).status)
      : 'UP';
    const up = springStatus.toUpperCase() === 'UP';

    return res.status(200).json({
      status: up ? 'ok' : 'down',
      source: 'spring-actuator',
      springStatus,
      payload,
    });
  } catch (error) {
    return res.status(200).json({
      status: 'down',
      source: 'spring-actuator',
      reason: toErrorMessage(error),
    });
  } finally {
    clearTimeout(timer);
  }
});

// Envoy gRPC-Web sidecar probe (:50055) for Demo Hub prerequisites (GRPC-19).
// Bare GET / returns HTTP 415 — that still means the listener is up. Probe from
// the server so the browser console does not log two Failed-to-load 415s
// (localhost + 127.0.0.1 loopback candidates).
app.get('/health/envoy', async (_req: Request, res: Response) => {
  const controller = new AbortController();
  const timer = setTimeout(controller.abort.bind(controller), 2500);
  try {
    const response = await fetch('http://127.0.0.1:50055/', {
      signal: controller.signal,
    });
    return res.status(200).json({
      status: 'ok',
      source: 'envoy-grpc-web',
      httpStatus: response.status,
    });
  } catch (error) {
    return res.status(200).json({
      status: 'down',
      source: 'envoy-grpc-web',
      reason: toErrorMessage(error),
    });
  } finally {
    clearTimeout(timer);
  }
});

// Schema Registry health proxy used by Demo Hub prerequisite checks.
// Probes the registry's /subjects endpoint (lightweight) from the server side
// to avoid unreliable browser no-cors probes.
app.get('/health/schema-registry', async (req: Request, res: Response) => {
  const registryUrl = (req.query.url as string) || 'http://localhost:8085';
  const controller = new AbortController();
  const timer = setTimeout(controller.abort.bind(controller), 5000);
  try {
    const response = await fetch(`${registryUrl.replace(/\/$/, '')}/subjects`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (response.ok) {
      return res.status(200).json({ status: 'ok', source: 'schema-registry' });
    }
    return res.status(200).json({ status: 'down', source: 'schema-registry', reason: `http_${response.status}` });
  } catch (error) {
    clearTimeout(timer);
    return res.status(200).json({ status: 'down', source: 'schema-registry', reason: toErrorMessage(error) });
  }
});

// Redpanda Admin API health proxy used by Demo Hub prerequisite checks.
// Probes /v1 on the given port from the server side to avoid unreliable
// browser no-cors probes (e.g. in Tauri webviews).
app.get('/health/kafka-admin', async (req: Request, res: Response) => {
  const port = parseInt((req.query.port as string) || '19648', 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`http://localhost:${port}/v1`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    // Admin API returns 200 with Swagger spec — any non-error is fine.
    if (response.ok || response.status === 404) {
      return res.status(200).json({ status: 'ok', source: 'kafka-admin', port });
    }
    return res.status(200).json({ status: 'down', source: 'kafka-admin', port, reason: `http_${response.status}` });
  } catch (error) {
    clearTimeout(timer);
    return res.status(200).json({ status: 'down', source: 'kafka-admin', port, reason: toErrorMessage(error) });
  }
});

// API: Get execution history
app.get('/api/executions', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const workflowId = req.query.workflowId as string | undefined;

    const executions = await getExecutionHistory(workflowId, limit);

    res.json({
      executions,
      count: executions.length,
    });
  } catch (error) {
    console.error('[API] Failed to get execution history:', error);
    res.status(500).json({
      error: 'Failed to load execution history',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// API: Register/update a workflow so the server can execute it via webhooks
app.put('/api/workflows/:id', async (req: Request, res: Response) => {
  try {
    const workflow = req.body;
    if (!workflow || !workflow.id || !workflow.nodes) {
      return res.status(400).json({ error: 'Invalid workflow data' });
    }
    workflow.id = req.params.id;
    await saveWorkflow(workflow);
    console.log(`[API] Workflow registered: ${workflow.id} (${workflow.name})`);
    res.json({ message: 'Workflow registered', id: workflow.id });
  } catch (error) {
    console.error('[API] Failed to register workflow:', error);
    res.status(500).json({ error: 'Failed to register workflow' });
  }
});

// API: Get webhook deliveries for a specific date
app.get('/api/webhook-deliveries', async (req: Request, res: Response) => {
  try {
    // Date format: YYYY-MM-DD, defaults to today
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: 'Date must be in YYYY-MM-DD format',
      });
    }

    const deliveries = await getWebhookDeliveries(date);

    res.json({
      deliveries,
      date,
      count: deliveries.length,
    });
  } catch (error) {
    console.error('[API] Failed to get webhook deliveries:', error);
    res.status(500).json({
      error: 'Failed to load webhook deliveries',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Correlation webhook handler routes (must be before /webhooks/:workflowId/:triggerId)
app.use(createCorrelationRouter());

// Kafka transport routes
app.use(createKafkaRouter({ onLog: broadcastLog }));

// Kafka trigger subscription routes
app.use(createKafkaTriggerRouter({ onLog: broadcastLog }));

// WebSocket proxy routes
app.use(createWebSocketRouter({ onLog: broadcastLog }));

// GraphQL Studio proxy routes (Phase 2.0 — subscribe/SSE/upload)
app.use(createGraphqlRouter({ onLog: broadcastLog }));

app.use(createGrpcRouter({ onLog: broadcastLog }));
app.use(createGrpcMockRouter({ onLog: broadcastLog }));

// WebSocket mock server routes
app.use(createWebSocketMockRouter({ onLog: broadcastLog }));

// API Mock Studio control-plane routes (start/stop/restart/commit/status/journal)
app.use(createApiMockRouter({ onLog: broadcastLog }));

// Webhook endpoint - handles all HTTP methods
app.all('/webhooks/:workflowId/:triggerId', async (req: Request, res: Response) => {
  const { workflowId, triggerId } = req.params;
  const { method, headers, query, body } = req;
  const startTime = Date.now();
  const executionId = generateExecutionId(workflowId, triggerId);
  
  // Check for trace capture request via query parameter
  const captureTrace = query._trace === 'true' || query._trace === '1';

  console.log(`[Webhook] Received ${method} /webhooks/${workflowId}/${triggerId}${captureTrace ? ' (trace capture enabled)' : ''}`);

  try {
    // 1. Load workflow from AppData
    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      console.warn(`[Webhook] Workflow not found: ${workflowId}`);
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // 2. Find webhook trigger node
    const triggerNode = workflow.nodes.find(
      (n) => n.id === triggerId && n.type === 'webhook'
    );
    if (!triggerNode) {
      console.warn(`[Webhook] Trigger not found: ${triggerId}`);
      return res.status(404).json({ error: 'Webhook trigger not found' });
    }

    const triggerData = triggerNode.data as WebhookTriggerNodeData;

    // 3. Validate HTTP method
    if (method !== triggerData.method) {
      console.warn(`[Webhook] Method mismatch: expected ${triggerData.method}, got ${method}`);
      return res.status(405).json({
        error: `Method ${method} not allowed. Expected ${triggerData.method}`,
      });
    }

    // 4. Extract variables from webhook payload
    const extractedVars = extractWebhookVariables(triggerData.extractVariables, {
      body,
      headers: headers as Record<string, string | string[] | undefined>,
      query: query as Record<string, string | string[] | undefined>,
    });

    console.log(`[Webhook] Extracted variables:`, extractedVars);

    // 5. Execute workflow using shared execution logic
    const initialVariables = {
      ...workflow.variables,
      ...Object.fromEntries(
        Object.entries(extractedVars).map(([k, v]) => [k, String(v)])
      ),
    };

    broadcastLog({ prefix: '*', text: `[Webhook] ${method} /webhooks/${workflowId}/${triggerId}`, ts: Date.now() });
    broadcastLog({ prefix: '*', text: `[Webhook] Extracted ${Object.keys(extractedVars).length} variable(s)`, ts: Date.now() });

    const result = await executeWorkflow({
      executionId,
      workflow,
      initialVariables,
      triggerType: 'webhook',
      triggerId,
      startTime,
      onLog: broadcastLog,
      traceOptions: captureTrace ? { captureFullTrace: true, alwaysCaptureFailures: true } : undefined,
    });

    // 6. Log webhook delivery
    await logWebhookDelivery({
      triggerId,
      method,
      payload: body,
      status: result.status === 'success' ? 'success' : 'failed',
      duration: result.duration,
      timestamp: new Date(startTime).toISOString(),
    });

    // 7. Return results
    console.log(`[Webhook] Execution successful: ${executionId}`);
    const response: Record<string, unknown> = {
      message: 'Workflow executed successfully',
      executionId,
      workflowId,
      duration: result.duration,
      status: result.status,
      passed: result.passed,
      stepsExecuted: result.results.length,
      results: result.results.map((r) => ({
        url: r.url,
        method: r.method,
        statusCode: r.httpStatus,
        responseTime: r.responseTimeMs,
        passed: r.passed,
      })),
    };
    
    // Include iteration trace if capture was requested
    if (captureTrace && result.iterationTrace) {
      response.iterationTrace = result.iterationTrace;
    }
    
    res.status(200).json(response);
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = toErrorMessage(error);

    console.error(`[Webhook] Execution error:`, error);

    // Log failure (best-effort)
    try {
      await logWebhookDelivery({
        triggerId,
        method,
        payload: body,
        status: 'error',
        duration: totalDuration,
        error: errorMessage,
        timestamp: new Date(startTime).toISOString(),
      });
    } catch (logError) {
      console.error('[Webhook] Failed to log delivery:', logError);
    }

    // Save error result
    await saveErrorResult({
      executionId,
      workflowId,
      triggerId,
      triggerType: 'webhook',
      startTime,
      error: errorMessage,
    });

    res.status(500).json({
      error: 'Workflow execution failed',
      message: errorMessage,
      executionId,
    });
  }
});

// SSE test endpoint — sends periodic events for E2E testing
app.get('/api/sse-test', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let counter = 0;
  const lastEventId = req.headers['last-event-id'] as string | undefined;
  if (lastEventId) {
    counter = parseInt(lastEventId, 10) || 0;
  }

  // Send an initial event immediately
  counter++;
  res.write(`id: ${counter}\nevent: message\ndata: ${JSON.stringify({ type: 'greeting', text: 'Hello from SSE test server', counter })}\n\n`);

  const requestedIntervalMs = Number.parseInt(String(req.query.intervalMs ?? ''), 10);
  const intervalMs = Number.isFinite(requestedIntervalMs)
    ? Math.min(1000, Math.max(20, requestedIntervalMs))
    : 1000;

  // Then send events periodically (defaults to 1 second for manual testing)
  const interval = setInterval(() => {
    counter++;
    const eventType = counter % 3 === 0 ? 'status' : counter % 3 === 1 ? 'message' : 'update';
    res.write(`id: ${counter}\nevent: ${eventType}\ndata: ${JSON.stringify({ type: eventType, text: `Event #${counter}`, counter, ts: Date.now() })}\n\n`);
  }, intervalMs);

  req.on('close', () => {
    clearInterval(interval);
    console.log('[SSE-Test] Client disconnected');
  });
});

// SSE endpoint for live log streaming to the UI Console
app.get('/api/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  sseClients.add(res);
  console.log(`[SSE] Client connected (${sseClients.size} total)`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected (${sseClients.size} total)`);
  });
});

// Covered by tests via next(err) — only registered under Vitest.
if (process.env.VITEST) {
  app.get('/__vitest_unhandled_error__', (_req: Request, _res: Response, next) => {
    next(new Error('vitest'));
  });
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    hint: 'Use POST/PUT/PATCH /webhooks/:workflowId/:triggerId',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: (...args: unknown[]) => void) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Graceful shutdown: deactivate all Kafka trigger subscriptions
async function shutdown(signal: string): Promise<void> {
  console.log(`[Server] Received ${signal} — shutting down Kafka trigger subscriptions`);
  await kafkaTriggerSubscriptionManager.deactivateAll();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export { app };
