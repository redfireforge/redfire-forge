/**
 * Ajv-based JSON Schema validator for WebSocket messages.
 * Compiles schemas once and caches ValidateFunction instances.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import type { WsSchemaDefinition, WsValidationError, WsValidationResult } from './wsSchemaTypes';
import type { WsFrameDirection } from '../../shared/websocket/types';

let _ajv: Ajv | null = null;

function getAjv(): Ajv {
  if (!_ajv) {
    _ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(_ajv);
  }
  return _ajv;
}

const validatorCache = new Map<string, ValidateFunction | null>();

export function compileSchema(schemaId: string, schemaJson: string): { valid: boolean; error?: string } {
  try {
    const parsed = JSON.parse(schemaJson);
    delete parsed.$id;
    delete parsed.id;
    const ajv = getAjv();
    const validate = ajv.compile(parsed);
    validatorCache.set(schemaId, validate);
    return { valid: true };
  } catch (err: unknown) {
    validatorCache.set(schemaId, null);
    const message = err instanceof Error ? err.message : 'Invalid schema';
    return { valid: false, error: message };
  }
}

export function removeCompiledSchema(schemaId: string): void {
  validatorCache.delete(schemaId);
}

export function clearCompiledSchemas(): void {
  validatorCache.clear();
  _ajv = null;
}

function directionMatches(schemaDir: WsSchemaDefinition['direction'], frameDir: WsFrameDirection): boolean {
  if (schemaDir === 'both') return true;
  return schemaDir === frameDir;
}

function tryParseJson(data: string): unknown | undefined {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function validateMessage(
  data: string,
  direction: WsFrameDirection,
  schemas: WsSchemaDefinition[],
): WsValidationResult[] {
  const parsed = tryParseJson(data);
  if (parsed === undefined) return [];

  const results: WsValidationResult[] = [];

  for (const schema of schemas) {
    if (!schema.enabled) continue;
    if (!directionMatches(schema.direction, direction)) continue;

    const validate = validatorCache.get(schema.id);
    if (validate === undefined) {
      compileSchema(schema.id, schema.schema);
    }
    const cachedValidate = validatorCache.get(schema.id);
    if (!cachedValidate) continue;

    const valid = cachedValidate(parsed) as boolean;
    const errors: WsValidationError[] = [];

    if (!valid && cachedValidate.errors) {
      for (const err of cachedValidate.errors.slice(0, 20)) {
        errors.push({
          path: err.instancePath || '/',
          message: err.message ?? 'Validation error',
          keyword: err.keyword,
        });
      }
    }

    results.push({
      schemaId: schema.id,
      schemaName: schema.name,
      valid,
      errors,
    });
  }

  return results;
}

export function isSchemaJsonValid(schemaJson: string): { valid: boolean; error?: string } {
  try {
    const parsed = JSON.parse(schemaJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: 'Schema must be a JSON object' };
    }
    delete parsed.$id;
    delete parsed.id;
    const ajv = getAjv();
    ajv.compile(parsed);
    return { valid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON Schema';
    return { valid: false, error: message };
  }
}
