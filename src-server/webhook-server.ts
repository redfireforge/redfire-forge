import express, { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getWorkflow,
  saveExecutionResult,
  logWebhookDelivery,
  type ExecutionResult,
} from './file-storage.js';
import { extractWebhookVariables } from './webhook-extractor.js';
import { runGraph } from '../src/engine/workflow/graphRunner.js';
import type { WebhookTriggerNodeData, NodeRunStatus } from '../src/types/workflow.js';
import type { RequestResult } from '../src/types/index.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: 3001,
  });
});

// Webhook endpoint - handles all HTTP methods
app.all('/webhooks/:workflowId/:triggerId', async (req: Request, res: Response) => {
  const { workflowId, triggerId } = req.params;
  const { method, headers, query, body } = req;
  const startTime = Date.now();
  const executionId = `${workflowId}-${triggerId}-${Date.now()}`;

  console.log(`[Webhook] Received ${method} /webhooks/${workflowId}/${triggerId}`);

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

    // 5. Execute workflow synchronously using graph runner
    const executionResults: RequestResult[] = [];
    let executionPassed = true;
    let executionDuration = 0;

    await runGraph(
      workflow.nodes,
      workflow.edges,
      {
        ...workflow.variables,
        ...Object.fromEntries(
          Object.entries(extractedVars).map(([k, v]) => [k, String(v)])
        ),
      },
      {
        onNodeStateChange: (nodeId: string, status: NodeRunStatus) => {
          // Could log state changes or send to UI via websocket
          console.log(`[Workflow] Node ${nodeId} → ${status.state}`);
        },
        onVariablesChange: (variables: Record<string, string>) => {
          // Variables updated during execution
          console.log(`[Workflow] Variables updated:`, Object.keys(variables).length);
        },
        onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => {
          executionResults.push(...results);
          executionPassed = passed;
          executionDuration = durationMs;
          console.log(`[Workflow] Execution complete: passed=${passed}, duration=${durationMs}ms`);
        },
      }
    );

    const totalDuration = Date.now() - startTime;
    const status: ExecutionResult['status'] = executionPassed ? 'success' : 'failed';

    // 6. Save execution result
    const executionResult: ExecutionResult = {
      id: executionId,
      workflowId,
      triggerId,
      triggerType: 'webhook',
      status,
      duration: totalDuration,
      results: executionResults.map((r) => ({
        url: r.url,
        statusCode: r.httpStatus,
        responseTime: r.responseTimeMs,
        body: r.responseBody,
      })),
      variables: extractedVars,
      timestamp: new Date(startTime).toISOString(),
    };

    await saveExecutionResult(executionResult);

    // 7. Log webhook delivery
    await logWebhookDelivery({
      triggerId,
      method,
      payload: body,
      status: status === 'success' ? 'success' : 'failed',
      duration: totalDuration,
      timestamp: new Date(startTime).toISOString(),
    });

    // 8. Return results
    console.log(`[Webhook] Execution successful: ${executionId}`);
    res.status(200).json({
      message: 'Workflow executed successfully',
      executionId,
      workflowId,
      duration: totalDuration,
      status,
      passed: executionPassed,
      stepsExecuted: executionResults.length,
      results: executionResults.map((r) => ({
        url: r.url,
        method: r.method,
        statusCode: r.httpStatus,
        responseTime: r.responseTimeMs,
        passed: r.passed,
      })),
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Webhook] Execution error:`, error);

    // Log failure
    await logWebhookDelivery({
      triggerId,
      method,
      payload: body,
      status: 'error',
      duration: totalDuration,
      error: errorMessage,
      timestamp: new Date(startTime).toISOString(),
    });

    // Save error result
    try {
      await saveExecutionResult({
        id: executionId,
        workflowId,
        triggerId,
        triggerType: 'webhook',
        status: 'error',
        duration: totalDuration,
        results: [],
        variables: {},
        timestamp: new Date(startTime).toISOString(),
        error: errorMessage,
      });
    } catch (saveError) {
      console.error('[Webhook] Failed to save error result:', saveError);
    }

    res.status(500).json({
      error: 'Workflow execution failed',
      message: errorMessage,
      executionId,
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    hint: 'Use POST/PUT/PATCH /webhooks/:workflowId/:triggerId',
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

export { app };
