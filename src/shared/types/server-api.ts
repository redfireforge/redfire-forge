/**
 * Shared types between the browser UI and the webhook/schedule server.
 * Single source of truth — both client pages and src-server import from here.
 */

export type TriggerType = 'webhook' | 'schedule';
export type ExecutionStatus = 'success' | 'failed' | 'error';

export interface ExecutionResult {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerType: TriggerType;
  status: ExecutionStatus;
  duration: number;
  results: Array<{
    url: string;
    statusCode: number;
    responseTime: number;
    body?: string;
  }>;
  variables: Record<string, unknown>;
  timestamp: string;
  error?: string;
}

export interface WebhookDelivery {
  triggerId: string;
  method: string;
  payload: unknown;
  status: ExecutionStatus;
  duration?: number;
  timestamp: string;
  error?: string;
}

export type LogLinePrefix = string;

export interface LogLine {
  prefix: LogLinePrefix;
  text: string;
  ts?: number;
}

export interface ScheduleTrigger {
  id: string;
  workflowId: string;
  nodeId: string;
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  inputVariables?: Record<string, string>;
}

export interface WebhookTrigger {
  id: string;
  workflowId: string;
  nodeId: string;
  enabled: boolean;
  method: string;
  path: string;
}
