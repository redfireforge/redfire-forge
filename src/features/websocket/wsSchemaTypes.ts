/**
 * Types for WebSocket message schema validation (Phase 19).
 */

export type WsSchemaDirection = 'sent' | 'received' | 'both';

export interface WsSchemaDefinition {
  id: string;
  name: string;
  schema: string;
  direction: WsSchemaDirection;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WsValidationError {
  path: string;
  message: string;
  keyword: string;
}

export interface WsValidationResult {
  schemaId: string;
  schemaName: string;
  valid: boolean;
  errors: WsValidationError[];
}

export type WsValidationFilter = 'all' | 'valid' | 'invalid';

export function createSchemaDefinition(
  name: string,
  schema: string,
  direction: WsSchemaDirection,
): WsSchemaDefinition {
  return {
    id: `ws-schema-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    schema,
    direction,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const MAX_SCHEMAS = 20;
