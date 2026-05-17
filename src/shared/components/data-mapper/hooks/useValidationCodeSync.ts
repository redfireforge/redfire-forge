import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ExpectedField, Assertion } from '../../../types';
import type { Mapping } from '../types';
import type { ParseError, DslModel } from '../utils/validationDsl';
import { serializeToDsl, parseDsl, dslToModel, exportAsJson, importAutoDetect, DSL_ASSERTION_TYPES, countDslRuleLines } from '../utils/validationDsl';

export interface ValidationCodeSyncState {
  dslText: string;
  parseErrors: ParseError[];
  ruleCount: number;
}

interface UseValidationCodeSyncOptions {
  mappings: Mapping[];  // reserved for future expression-based DSL serialization
  assertions: Assertion[];
  fields: ExpectedField[];
  onUpdateFields: (fields: ExpectedField[]) => void;
  onUpdateAssertions: (assertions: Assertion[]) => void;
  enabled: boolean;
}

export function useValidationCodeSync({
  mappings: _mappings,
  assertions,
  fields,
  onUpdateFields,
  onUpdateAssertions,
  enabled,
}: UseValidationCodeSyncOptions): ValidationCodeSyncState & {
  handleCodeChange: (text: string) => void;
  syncVisualToCode: () => void;
  flushPending: () => void;
  exportJson: () => string;
  importText: (text: string) => ParseError | null;
} {
  const [dslText, setDslText] = useState('');
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const syncDirection = useRef<'visual' | 'code' | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonDslAssertionsRef = useRef<Assertion[]>([]);
  const dslTextRef = useRef(dslText);
  dslTextRef.current = dslText;

  const ruleCount = useMemo(() => countDslRuleLines(dslText), [dslText]);

  // pendingCodeSyncs tracks how many code→visual updates are in-flight so
  // the visual→code guard isn't cleared until React has flushed all of them.
  const pendingCodeSyncs = useRef(0);
  // When the last code→visual push had parse errors, suppress the echo
  // re-serialization so the user's DSL text (including error lines) stays intact.
  const lastCodeHadErrors = useRef(false);

  // Visual → Code: re-serialize when fields/assertions change from visual side
  const syncVisualToCode = useCallback(() => {
    nonDslAssertionsRef.current = assertions.filter(a => !DSL_ASSERTION_TYPES.has(a.type));

    if (syncDirection.current === 'code') {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      pendingCodeSyncs.current = Math.max(0, pendingCodeSyncs.current - 1);
      if (pendingCodeSyncs.current === 0) {
        syncDirection.current = null;
        if (lastCodeHadErrors.current) {
          const { errors } = parseDsl(dslTextRef.current);
          setParseErrors(errors);
          return;
        }
      } else {
        return;
      }
    }

    if (lastCodeHadErrors.current) {
      const { errors } = parseDsl(dslTextRef.current);
      setParseErrors(errors);
      return;
    }

    const dslAssertions = assertions.filter(a => DSL_ASSERTION_TYPES.has(a.type));
    const text = serializeToDsl(fields, dslAssertions);
    setDslText(text);
    const { errors } = parseDsl(text);
    setParseErrors(errors);
  }, [fields, assertions]);

  // Auto-sync visual → code when enabled and fields/assertions change
  useEffect(() => {
    if (!enabled) return;
    syncVisualToCode();
  }, [enabled, fields, assertions, syncVisualToCode]);

  const handleCodeChange = useCallback((text: string) => {
    setDslText(text);
    syncDirection.current = 'code';
    pendingCodeSyncs.current++;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const { rules, errors } = parseDsl(text);
      setParseErrors(errors);
      lastCodeHadErrors.current = errors.length > 0;

      // Always push valid rules to the visual model, even when there are
      // parse errors on some lines.  Only skip if the ENTIRE text is empty
      // but there are errors (i.e. transient typing state).
      if (rules.length > 0 || text.trim() === '') {
        const model = dslToModel(rules);
        onUpdateFields(model.fields);
        onUpdateAssertions([...nonDslAssertionsRef.current, ...model.assertions]);
      }
    }, 300);
  }, [onUpdateFields, onUpdateAssertions]);

  // Flush pending debounce when disabled (instead of dropping edits), clear on unmount
  const onUpdateFieldsRef = useRef(onUpdateFields);
  onUpdateFieldsRef.current = onUpdateFields;
  const onUpdateAssertionsRef = useRef(onUpdateAssertions);
  onUpdateAssertionsRef.current = onUpdateAssertions;

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        const text = dslTextRef.current;
        const { rules, errors } = parseDsl(text);
        lastCodeHadErrors.current = errors.length > 0;
        if (rules.length > 0 || text.trim() === '') {
          const model = dslToModel(rules);
          onUpdateFieldsRef.current(model.fields);
          onUpdateAssertionsRef.current([...nonDslAssertionsRef.current, ...model.assertions]);
        }
      }
    };
  }, [enabled]);

  // Synchronously flush any pending debounced DSL changes
  const flushPending = useCallback(() => {
    if (!debounceTimer.current) return;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    const text = dslTextRef.current;
    const { rules } = parseDsl(text);
    if (rules.length > 0 || text.trim() === '') {
      const model = dslToModel(rules);
      onUpdateFields(model.fields);
      onUpdateAssertions([...nonDslAssertionsRef.current, ...model.assertions]);
    }
    pendingCodeSyncs.current = 0;
    syncDirection.current = null;
  }, [onUpdateFields, onUpdateAssertions]);

  // Export
  const exportJson = useCallback(() => {
    return exportAsJson(fields, assertions);
  }, [fields, assertions]);

  // Import — merge imported DSL assertions with preserved non-DSL assertions
  const importText = useCallback((text: string): ParseError | null => {
    const result = importAutoDetect(text);
    if ('message' in result) return result;
    const model = result as DslModel;
    onUpdateFields(model.fields);
    onUpdateAssertions([...nonDslAssertionsRef.current, ...model.assertions]);
    syncDirection.current = null;
    const newDsl = serializeToDsl(model.fields, model.assertions);
    setDslText(newDsl);
    setParseErrors([]);
    return null;
  }, [onUpdateFields, onUpdateAssertions]);

  return {
    dslText,
    parseErrors,
    ruleCount,
    handleCodeChange,
    syncVisualToCode,
    flushPending,
    exportJson,
    importText,
  };
}
