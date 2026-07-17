/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketSchema } from './useWebSocketSchema';
import type { WsFrame } from '../../shared/websocket/types';

vi.mock('./wsSchemaValidator', () => ({
  compileSchema: vi.fn(),
  removeCompiledSchema: vi.fn(),
  validateMessage: vi.fn(),
  isSchemaJsonValid: vi.fn(),
}));

vi.mock('./wsSchemaInference', () => ({
  inferSchemaFromMessages: vi.fn(),
}));

import { compileSchema, removeCompiledSchema, validateMessage, isSchemaJsonValid } from './wsSchemaValidator';
import { inferSchemaFromMessages } from './wsSchemaInference';
import { MAX_SCHEMAS } from './wsSchemaTypes';

const mockedIsSchemaJsonValid = vi.mocked(isSchemaJsonValid);
const mockedCompileSchema = vi.mocked(compileSchema);
const mockedRemoveCompiledSchema = vi.mocked(removeCompiledSchema);
const mockedValidateMessage = vi.mocked(validateMessage);
const mockedInferSchema = vi.mocked(inferSchemaFromMessages);

function makeFrame(overrides: Partial<WsFrame> = {}): WsFrame {
  return {
    id: 'f1',
    direction: 'received',
    type: 'text',
    data: '{"hello":"world"}',
    size: 17,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('useWebSocketSchema', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ── Initial state ──────────────────────────────────────────────────
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useWebSocketSchema());
    expect(result.current.schemas).toEqual([]);
    expect(result.current.validationEnabled).toBe(false);
    expect(result.current.schemasVisible).toBe(false);
    expect(result.current.hasEnabledSchemas).toBe(false);
    expect(result.current.validationFilter).toBe('all');
  });

  // ── addSchema ──────────────────────────────────────────────────────
  describe('addSchema', () => {
    it('adds a valid schema', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      let res: { ok: boolean; error?: string };
      act(() => {
        res = result.current.addSchema('Test', '{"type":"object"}', 'both');
      });
      expect(res!.ok).toBe(true);
      expect(result.current.schemas).toHaveLength(1);
      expect(result.current.schemas[0].name).toBe('Test');
      expect(result.current.schemas[0].schema).toBe('{"type":"object"}');
      expect(result.current.schemas[0].direction).toBe('both');
      expect(result.current.schemas[0].enabled).toBe(true);
      expect(mockedCompileSchema).toHaveBeenCalledOnce();
    });

    it('rejects invalid schema JSON', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: false, error: 'bad json' });
      const { result } = renderHook(() => useWebSocketSchema());

      let res: { ok: boolean; error?: string };
      act(() => {
        res = result.current.addSchema('Bad', 'not-json', 'sent');
      });
      expect(res!.ok).toBe(false);
      expect(res!.error).toBe('bad json');
      expect(result.current.schemas).toHaveLength(0);
      expect(mockedCompileSchema).not.toHaveBeenCalled();
    });

    it('rejects when max schemas reached', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      // Fill to max
      for (let i = 0; i < MAX_SCHEMAS; i++) {
        act(() => {
          result.current.addSchema(`S${i}`, '{}', 'both');
        });
      }
      expect(result.current.schemas).toHaveLength(MAX_SCHEMAS);

      let res: { ok: boolean; error?: string };
      act(() => {
        res = result.current.addSchema('Overflow', '{}', 'both');
      });
      expect(res!.ok).toBe(false);
      expect(res!.error).toContain('Maximum');
      expect(result.current.schemas).toHaveLength(MAX_SCHEMAS);
    });
  });

  // ── updateSchema ───────────────────────────────────────────────────
  describe('updateSchema', () => {
    it('updates name without recompiling', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('Original', '{}', 'both'); });
      const id = result.current.schemas[0].id;
      mockedCompileSchema.mockClear();

      let res: { ok: boolean; error?: string };
      act(() => {
        res = result.current.updateSchema(id, { name: 'Renamed' });
      });
      expect(res!.ok).toBe(true);
      expect(result.current.schemas[0].name).toBe('Renamed');
      expect(mockedCompileSchema).not.toHaveBeenCalled();
    });

    it('updates schema content and recompiles', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      const id = result.current.schemas[0].id;
      mockedCompileSchema.mockClear();

      act(() => {
        result.current.updateSchema(id, { schema: '{"type":"string"}' });
      });
      expect(result.current.schemas[0].schema).toBe('{"type":"string"}');
      expect(mockedCompileSchema).toHaveBeenCalledWith(id, '{"type":"string"}');
    });

    it('rejects invalid schema content on update', () => {
      mockedIsSchemaJsonValid
        .mockReturnValueOnce({ valid: true })
        .mockReturnValueOnce({ valid: false, error: 'invalid' });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      const id = result.current.schemas[0].id;

      let res: { ok: boolean; error?: string };
      act(() => {
        res = result.current.updateSchema(id, { schema: 'bad' });
      });
      expect(res!.ok).toBe(false);
      expect(res!.error).toBe('invalid');
    });

    it('updates direction', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      const id = result.current.schemas[0].id;

      act(() => {
        result.current.updateSchema(id, { direction: 'sent' });
      });
      expect(result.current.schemas[0].direction).toBe('sent');
    });
  });

  // ── removeSchema ───────────────────────────────────────────────────
  describe('removeSchema', () => {
    it('removes schema and cleans up compiled schema', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      const id = result.current.schemas[0].id;

      act(() => { result.current.removeSchema(id); });
      expect(result.current.schemas).toHaveLength(0);
      expect(mockedRemoveCompiledSchema).toHaveBeenCalledWith(id);
    });
  });

  // ── toggleSchema ───────────────────────────────────────────────────
  describe('toggleSchema', () => {
    it('toggles enabled state', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      const id = result.current.schemas[0].id;
      expect(result.current.schemas[0].enabled).toBe(true);

      act(() => { result.current.toggleSchema(id); });
      expect(result.current.schemas[0].enabled).toBe(false);

      act(() => { result.current.toggleSchema(id); });
      expect(result.current.schemas[0].enabled).toBe(true);
    });
  });

  // ── hasEnabledSchemas ──────────────────────────────────────────────
  describe('hasEnabledSchemas', () => {
    it('is false when no schemas', () => {
      const { result } = renderHook(() => useWebSocketSchema());
      expect(result.current.hasEnabledSchemas).toBe(false);
    });

    it('is true when at least one schema is enabled', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      expect(result.current.hasEnabledSchemas).toBe(true);
    });

    it('is false when all schemas are disabled', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.addSchema('S', '{}', 'both'); });
      const id = result.current.schemas[0].id;
      act(() => { result.current.toggleSchema(id); });
      expect(result.current.hasEnabledSchemas).toBe(false);
    });
  });

  // ── getValidation ──────────────────────────────────────────────────
  describe('getValidation', () => {
    it('returns null when validation is disabled', () => {
      const { result } = renderHook(() => useWebSocketSchema());
      const frame = makeFrame();
      expect(result.current.getValidation(frame)).toBeNull();
    });

    it('returns null for binary frames', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.setValidationEnabled(true); });
      act(() => { result.current.addSchema('S', '{}', 'both'); });

      const frame = makeFrame({ type: 'binary' });
      expect(result.current.getValidation(frame)).toBeNull();
    });

    it('returns null when no enabled schemas', () => {
      const { result } = renderHook(() => useWebSocketSchema());
      act(() => { result.current.setValidationEnabled(true); });

      const frame = makeFrame();
      expect(result.current.getValidation(frame)).toBeNull();
    });

    it('validates text frames against enabled schemas', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      mockedValidateMessage.mockReturnValue([
        { schemaId: 's1', schemaName: 'S', valid: true, errors: [] },
      ]);
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.setValidationEnabled(true); });
      act(() => { result.current.addSchema('S', '{}', 'both'); });

      const frame = makeFrame();
      const validation = result.current.getValidation(frame);
      expect(validation).toHaveLength(1);
      expect(validation![0].valid).toBe(true);
      expect(mockedValidateMessage).toHaveBeenCalledWith(
        frame.data,
        frame.direction,
        expect.any(Array),
      );
    });

    it('skips disabled schemas when validating', () => {
      mockedIsSchemaJsonValid.mockReturnValue({ valid: true });
      mockedValidateMessage.mockReturnValue([]);
      const { result } = renderHook(() => useWebSocketSchema());

      act(() => { result.current.setValidationEnabled(true); });
      act(() => { result.current.addSchema('S1', '{}', 'both'); });
      act(() => { result.current.addSchema('S2', '{}', 'both'); });
      const id1 = result.current.schemas[0].id;
      act(() => { result.current.toggleSchema(id1); }); // disable S1

      const frame = makeFrame();
      result.current.getValidation(frame);

      // validateMessage should be called with only the enabled schema (S2)
      const calledSchemas = mockedValidateMessage.mock.calls[0][2];
      expect(calledSchemas).toHaveLength(1);
      expect(calledSchemas[0].name).toBe('S2');
    });
  });

  // ── generateSchema ─────────────────────────────────────────────────
  describe('generateSchema', () => {
    it('delegates to inferSchemaFromMessages', () => {
      mockedInferSchema.mockReturnValue('{"type":"object"}');
      const { result } = renderHook(() => useWebSocketSchema());
      const frames = [makeFrame()];

      const schema = result.current.generateSchema(frames, 'received');
      expect(schema).toBe('{"type":"object"}');
      expect(mockedInferSchema).toHaveBeenCalledWith(frames, 'received');
    });

    it('returns null when inference fails', () => {
      mockedInferSchema.mockReturnValue(null);
      const { result } = renderHook(() => useWebSocketSchema());

      const schema = result.current.generateSchema([], 'sent');
      expect(schema).toBeNull();
    });
  });

  // ── State setters ──────────────────────────────────────────────────
  describe('state setters', () => {
    it('setValidationEnabled toggles validation', () => {
      const { result } = renderHook(() => useWebSocketSchema());
      expect(result.current.validationEnabled).toBe(false);

      act(() => { result.current.setValidationEnabled(true); });
      expect(result.current.validationEnabled).toBe(true);

      act(() => { result.current.setValidationEnabled(false); });
      expect(result.current.validationEnabled).toBe(false);
    });

    it('setValidationFilter updates filter', () => {
      const { result } = renderHook(() => useWebSocketSchema());
      expect(result.current.validationFilter).toBe('all');

      act(() => { result.current.setValidationFilter('valid'); });
      expect(result.current.validationFilter).toBe('valid');

      act(() => { result.current.setValidationFilter('invalid'); });
      expect(result.current.validationFilter).toBe('invalid');
    });

    it('setSchemasVisible toggles visibility', () => {
      const { result } = renderHook(() => useWebSocketSchema());
      expect(result.current.schemasVisible).toBe(false);

      act(() => { result.current.setSchemasVisible(true); });
      expect(result.current.schemasVisible).toBe(true);
    });
  });
});
