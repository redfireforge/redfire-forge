/**
 * React hook for WebSocket message schema management and validation.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { WsFrame, WsFrameDirection } from '@shared/websocket/types';
import type {
  WsSchemaDefinition,
  WsSchemaDirection,
  WsValidationFilter,
  WsValidationResult,
} from './wsSchemaTypes';
import { createSchemaDefinition, MAX_SCHEMAS } from './wsSchemaTypes';
import {
  compileSchema,
  removeCompiledSchema,
  validateMessage,
  isSchemaJsonValid,
} from './wsSchemaValidator';
import { inferSchemaFromMessages } from './wsSchemaInference';

export interface UseWebSocketSchemaReturn {
  schemas: WsSchemaDefinition[];
  addSchema: (name: string, schemaJson: string, direction: WsSchemaDirection) => { ok: boolean; error?: string };
  updateSchema: (id: string, patch: Partial<Pick<WsSchemaDefinition, 'name' | 'schema' | 'direction' | 'enabled'>>) => { ok: boolean; error?: string };
  removeSchema: (id: string) => void;
  toggleSchema: (id: string) => void;
  validationEnabled: boolean;
  setValidationEnabled: (enabled: boolean) => void;
  validationFilter: WsValidationFilter;
  setValidationFilter: (filter: WsValidationFilter) => void;
  getValidation: (frame: WsFrame) => WsValidationResult[] | null;
  generateSchema: (messages: WsFrame[], direction: WsSchemaDirection) => string | null;
  schemasVisible: boolean;
  setSchemasVisible: (visible: boolean) => void;
  hasEnabledSchemas: boolean;
}

export function useWebSocketSchema(): UseWebSocketSchemaReturn {
  const [schemas, setSchemas] = useState<WsSchemaDefinition[]>([]);
  const [validationEnabled, setValidationEnabled] = useState(false);
  const [validationFilter, setValidationFilter] = useState<WsValidationFilter>('all');
  const [schemasVisible, setSchemasVisible] = useState(false);

  const schemasRef = useRef(schemas);
  schemasRef.current = schemas;

  const validationEnabledRef = useRef(validationEnabled);
  validationEnabledRef.current = validationEnabled;

  const hasEnabledSchemas = useMemo(
    () => schemas.some((s) => s.enabled),
    [schemas],
  );

  const addSchema = useCallback(
    (name: string, schemaJson: string, direction: WsSchemaDirection): { ok: boolean; error?: string } => {
      if (schemasRef.current.length >= MAX_SCHEMAS) {
        return { ok: false, error: `Maximum ${MAX_SCHEMAS} schemas reached` };
      }
      const check = isSchemaJsonValid(schemaJson);
      if (!check.valid) {
        return { ok: false, error: check.error };
      }
      const def = createSchemaDefinition(name, schemaJson, direction);
      compileSchema(def.id, schemaJson);
      setSchemas((prev) => [...prev, def]);
      return { ok: true };
    },
    [],
  );

  const updateSchema = useCallback(
    (id: string, patch: Partial<Pick<WsSchemaDefinition, 'name' | 'schema' | 'direction' | 'enabled'>>): { ok: boolean; error?: string } => {
      if (patch.schema !== undefined) {
        const check = isSchemaJsonValid(patch.schema);
        if (!check.valid) return { ok: false, error: check.error };
      }
      setSchemas((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const updated = { ...s, ...patch, updatedAt: new Date().toISOString() };
          if (patch.schema !== undefined) {
            compileSchema(id, patch.schema);
          }
          return updated;
        }),
      );
      return { ok: true };
    },
    [],
  );

  const removeSchema = useCallback((id: string) => {
    removeCompiledSchema(id);
    setSchemas((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleSchema = useCallback((id: string) => {
    setSchemas((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled, updatedAt: new Date().toISOString() } : s,
      ),
    );
  }, []);

  const getValidation = useCallback(
    (frame: WsFrame): WsValidationResult[] | null => {
      if (!validationEnabledRef.current) return null;
      if (frame.type !== 'text') return null;
      const enabled = schemasRef.current.filter((s) => s.enabled);
      if (enabled.length === 0) return null;
      return validateMessage(frame.data, frame.direction as WsFrameDirection, enabled);
    },
    [],
  );

  const generateSchema = useCallback(
    (messages: WsFrame[], direction: WsSchemaDirection): string | null => {
      return inferSchemaFromMessages(messages, direction);
    },
    [],
  );

  return {
    schemas,
    addSchema,
    updateSchema,
    removeSchema,
    toggleSchema,
    validationEnabled,
    setValidationEnabled,
    validationFilter,
    setValidationFilter,
    getValidation,
    generateSchema,
    schemasVisible,
    setSchemasVisible,
    hasEnabledSchemas,
  };
}
