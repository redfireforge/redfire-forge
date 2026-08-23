/**
 * Webhook Load Driver for Phase 7c
 * 
 * Sends HTTP requests to webhook endpoints at configurable rates
 * for load testing webhook-triggered workflows.
 * 
 * Rate modes:
 * - Fixed: N requests/second for D seconds
 * - Ramp: Gradually increase from startRps to endRps over duration
 * - Burst: Fire N requests as fast as possible
 */

import type { RequestResult, WorkflowIterationTrace } from '@shared/types';
import { expandPayloadTemplate, type PayloadGeneratorContext } from './payloadTemplateEngine';
import { toErrorMessage } from '@shared/utils/helpers';

export type WebhookRateMode = 'fixed' | 'ramp' | 'burst';

export interface WebhookRateConfig {
  mode: WebhookRateMode;
  /** Requests per second (fixed mode) or starting RPS (ramp mode). */
  rps?: number;
  /** Duration in seconds for fixed/ramp modes. */
  durationSec?: number;
  /** Ending requests per second (ramp mode only). */
  endRps?: number;
  /** Total number of requests to send (burst mode). */
  burstCount?: number;
}

export interface WebhookLoadDriverConfig {
  /** Full URL to the webhook endpoint. */
  webhookUrl: string;
  /** HTTP method (typically POST). */
  method: 'POST' | 'PUT' | 'PATCH';
  /** JSON payload template with {{$generator}} placeholders. */
  payloadTemplate: string;
  /** Rate configuration. */
  rate: WebhookRateConfig;
  /** Optional headers to include with each request. */
  headers?: Record<string, string>;
  /** Timeout per request in ms. Default 30000. */
  timeoutMs?: number;
  /** Capture execution traces for Results Explorer. */
  captureTraces?: boolean;
}

export interface WebhookLoadDriverCallbacks {
  /** Called after each request completes. */
  onRequestComplete?: (result: RequestResult, completed: number, total: number) => void;
  /** Called periodically with overall progress. */
  onProgress?: (completed: number, total: number, rps: number, elapsedMs: number) => void;
}

export interface WebhookLoadResult {
  results: RequestResult[];
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  actualDurationMs: number;
  actualRps: number;
  /** Collected iteration traces when captureTraces is enabled */
  iterationTraces?: WorkflowIterationTrace[];
}

/**
 * Calculates total requests for a given rate config.
 */
export function calculateTotalRequests(rate: WebhookRateConfig): number {
  switch (rate.mode) {
    case 'fixed':
      return Math.ceil((rate.rps || 1) * (rate.durationSec || 1));
    case 'ramp': {
      const startRps = rate.rps || 1;
      const endRps = rate.endRps || startRps;
      const avgRps = (startRps + endRps) / 2;
      return Math.ceil(avgRps * (rate.durationSec || 1));
    }
    case 'burst':
      return rate.burstCount || 1;
    default:
      return 1;
  }
}

/**
 * Calculates the current target RPS at a given elapsed time for ramp mode.
 */
function calculateRampRps(rate: WebhookRateConfig, elapsedSec: number): number {
  const startRps = rate.rps || 1;
  const endRps = rate.endRps || startRps;
  const durationSec = rate.durationSec || 1;
  
  const progress = Math.min(elapsedSec / durationSec, 1);
  return startRps + (endRps - startRps) * progress;
}

/** Response from webhook server when trace capture is enabled */
interface WebhookServerResponse {
  message: string;
  executionId: string;
  workflowId: string;
  duration: number;
  status: string;
  passed: boolean;
  stepsExecuted: number;
  results: Array<{ url: string; method: string; statusCode: number; responseTime: number; passed: boolean }>;
  iterationTrace?: WorkflowIterationTrace;
}

/**
 * Runs the webhook load test, sending requests at the configured rate.
 */
export async function runWebhookLoadTest(
  config: WebhookLoadDriverConfig,
  callbacks: WebhookLoadDriverCallbacks = {},
  abortSignal?: AbortSignal,
): Promise<WebhookLoadResult> {
  const { webhookUrl, method, payloadTemplate, rate, headers = {}, timeoutMs = 30000, captureTraces = false } = config;
  const { onRequestComplete, onProgress } = callbacks;
  
  const totalRequests = calculateTotalRequests(rate);
  const results: RequestResult[] = [];
  const iterationTraces: WorkflowIterationTrace[] = [];
  let completed = 0;
  let requestIndex = 0;
  
  const startTime = performance.now();
  
  // Generator context for payload templates
  const generatorContext: PayloadGeneratorContext = {
    requestIndex: 0,
    timestamp: Date.now(),
  };
  
  // Build webhook URL with trace parameter if needed
  const targetUrl = captureTraces 
    ? (webhookUrl.includes('?') ? `${webhookUrl}&_trace=true` : `${webhookUrl}?_trace=true`)
    : webhookUrl;

  const sendRequest = async (): Promise<RequestResult> => {
    const myIndex = requestIndex++;
    generatorContext.requestIndex = myIndex;
    generatorContext.timestamp = Date.now();
    
    // Expand the payload template with generators
    const payload = expandPayloadTemplate(payloadTemplate, generatorContext);
    
    const requestStart = performance.now();
    let result: RequestResult;
    
    try {
      // Use native fetch directly for webhook endpoints (same-origin to localhost:3001)
      // This avoids going through the Vite proxy which isn't needed for local webhooks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Combine abort signals if external signal provided
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => controller.abort());
      }
      
      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: payload,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const responseTimeMs = performance.now() - requestStart;
      const responseBody = await response.text();
      
      // Parse response to extract trace if available
      let serverResponse: WebhookServerResponse | undefined;
      if (captureTraces && responseBody) {
        try {
          serverResponse = JSON.parse(responseBody) as WebhookServerResponse;
          if (serverResponse.iterationTrace) {
            serverResponse.iterationTrace.index = myIndex;
            iterationTraces.push(serverResponse.iterationTrace);
          }
        } catch {
          // Response wasn't JSON or didn't contain trace data
        }
      }
      
      result = {
        id: crypto.randomUUID(),
        scenarioId: `webhook-load-${myIndex}`,
        scenarioName: 'Webhook Load Test',
        featureGroupName: 'Webhook Load Driver',
        groupName: `Request #${myIndex + 1}`,
        url: webhookUrl,
        method,
        httpStatus: response.status,
        responseTimeMs,
        responseBody,
        timestamp: Date.now(),
        passed: response.status >= 200 && response.status < 400,
        validationMode: 'none',
        failureDetails: [],
        iterationIndex: myIndex,
      };
      
      if (!result.passed) {
        result.errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (err) {
      const responseTimeMs = performance.now() - requestStart;
      result = {
        id: crypto.randomUUID(),
        scenarioId: `webhook-load-${myIndex}`,
        scenarioName: 'Webhook Load Test',
        featureGroupName: 'Webhook Load Driver',
        groupName: `Request #${myIndex + 1}`,
        url: webhookUrl,
        method,
        httpStatus: 0,
        responseTimeMs,
        responseBody: '',
        timestamp: Date.now(),
        passed: false,
        validationMode: 'none',
        failureDetails: [],
        errorMessage: toErrorMessage(err),
        iterationIndex: myIndex,
        cancelled: abortSignal?.aborted,
      };
    }
    
    return result;
  };

  // Execute based on rate mode
  if (rate.mode === 'burst') {
    // Burst mode: fire all requests concurrently
    const promises = Array.from({ length: totalRequests }, () => sendRequest());
    const allResults = await Promise.all(promises);
    
    for (const result of allResults) {
      results.push(result);
      completed++;
      onRequestComplete?.(result, completed, totalRequests);
    }
  } else {
    // Fixed or Ramp mode: pace requests over time
    const durationMs = (rate.durationSec || 1) * 1000;
    let lastProgressReport = startTime;
    const inFlight: Promise<void>[] = [];
    
    while (requestIndex < totalRequests && !abortSignal?.aborted) {
      const elapsedMs = performance.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      
      // Calculate current target RPS (capped at duration)
      const cappedElapsedSec = Math.min(elapsedSec, rate.durationSec || 1);
      const currentRps = rate.mode === 'ramp'
        ? calculateRampRps(rate, cappedElapsedSec)
        : (rate.rps || 1);
      
      // Calculate expected requests by now
      let expectedRequests: number;
      if (rate.mode === 'ramp') {
        // Integrate RPS over time for ramp
        const startRps = rate.rps || 1;
        const endRps = rate.endRps || startRps;
        const duration = rate.durationSec || 1;
        const t = Math.min(elapsedSec, duration);
        expectedRequests = startRps * t + (endRps - startRps) * t * t / (2 * duration);
      } else {
        expectedRequests = currentRps * elapsedSec;
      }
      
      // After duration, ensure we schedule all remaining requests
      if (elapsedMs >= durationMs) {
        expectedRequests = totalRequests;
      }
      
      // Launch requests to catch up to expected rate
      while (requestIndex < Math.min(expectedRequests, totalRequests) && !abortSignal?.aborted) {
        const promise = sendRequest().then(result => {
          results.push(result);
          completed++;
          onRequestComplete?.(result, completed, totalRequests);
        });
        inFlight.push(promise);
        
        // Bounded in-flight backlog: drop one settled slot after each race burst
        if (inFlight.length > 100) {
          const finishedIndex = await Promise.race(
            inFlight.map((pending, index) => pending.then(() => index)),
          );
          inFlight.splice(finishedIndex, 1);
        }
      }
      
      // Report progress periodically (every 500ms)
      if (performance.now() - lastProgressReport >= 500) {
        onProgress?.(completed, totalRequests, currentRps, elapsedMs);
        lastProgressReport = performance.now();
      }
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Wait for all in-flight requests to complete
    await Promise.all(inFlight);
  }
  
  const actualDurationMs = performance.now() - startTime;
  
  // Calculate statistics
  const responseTimes = results.map(r => r.responseTimeMs);
  const successCount = results.filter(r => r.passed).length;
  const failureCount = results.filter(r => !r.passed).length;
  
  return {
    results,
    totalRequests: results.length,
    successCount,
    failureCount,
    avgResponseTimeMs: responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0,
    minResponseTimeMs: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    maxResponseTimeMs: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    actualDurationMs,
    actualRps: results.length / (actualDurationMs / 1000),
    iterationTraces: captureTraces ? iterationTraces : undefined,
  };
}
