import { useState, useCallback, useMemo, useRef } from 'react';
import type { WorkflowVariableHint } from '../utils/workflowVariableHints';
import { EXPRESSION_FUNCTIONS, type ExpressionFunction } from '../utils/expressionFunctions';

export interface HintItem {
  kind: 'variable' | 'function' | 'jsonpath';
  label: string;
  detail: string;
  insertText: string;
  /** Original hint or function for tooltip display. */
  meta?: WorkflowVariableHint | ExpressionFunction;
}

interface HintState {
  open: boolean;
  items: HintItem[];
  selectedIndex: number;
  /** Cursor position where the trigger token started (index of first `{` or `$`). */
  triggerStart: number;
  /** Whether triggered by `{{` (braces), bare `$` (bare), or `$.` (jsonpath). */
  triggerKind: 'braces' | 'bare' | 'jsonpath';
  /** The partial text after `{{` or `$` that the user has typed so far. */
  filter: string;
}

const CLOSED: HintState = { open: false, items: [], selectedIndex: 0, triggerStart: -1, triggerKind: 'braces', filter: '' };

/**
 * Hook that provides inline autocomplete hints for expression input fields.
 *
 * Triggers:
 *  - `{{`  → variable name hints from `variableHints`
 *  - `{{$` → expression function hints from the global registry
 *  - `$.`  → JSONPath hints from `jsonPathHints` (extraction fields)
 *
 * Returns state + handlers to wire up to an `<input>` element.
 */
export function useExpressionHints(variableHints: WorkflowVariableHint[], jsonPathHints?: string[]) {
  const [state, setState] = useState<HintState>(CLOSED);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  /** Extract the short variable name from a scoped ref like `node:"Label".name`. */
  const varName = useCallback((ref: string): string => {
    const m = ref.match(/^node:"[^"]+"\.(.+)$/) ?? ref.match(/^node:[^.]+\.(.+)$/);
    return m ? m[1] : ref;
  }, []);

  /** De-duplicated variable hints (prefer unscoped when both exist). */
  const uniqueVarHints = useMemo((): HintItem[] => {
    const seen = new Map<string, HintItem>();
    for (const h of variableHints) {
      const name = varName(h.ref);
      if (!seen.has(name)) {
        seen.set(name, {
          kind: 'variable',
          label: name,
          detail: h.source?.nodeLabel ?? h.description ?? '',
          insertText: name,
          meta: h,
        });
      }
    }
    return Array.from(seen.values());
  }, [variableHints, varName]);

  /** All expression functions as hint items. */
  const fnHints = useMemo((): HintItem[] => {
    return EXPRESSION_FUNCTIONS.map((f) => ({
      kind: 'function' as const,
      label: f.name,
      detail: f.signature,
      insertText: f.args.length > 0
        ? `${f.name}(`
        : `${f.name}()`,
      meta: f,
    }));
  }, []);

  /** JSONPath hints derived from sample response. */
  const jpHints = useMemo((): HintItem[] => {
    if (!jsonPathHints || jsonPathHints.length === 0) return [];
    return jsonPathHints.map((p) => ({
      kind: 'jsonpath' as const,
      label: p.startsWith('$.') ? p : `$.${p}`,
      detail: 'JSONPath',
      insertText: p.startsWith('$.') ? p : `$.${p}`,
    }));
  }, [jsonPathHints]);

  /** Analyse current input value + cursor position and decide whether to show hints. */
  const analyse = useCallback((value: string, cursorPos: number) => {
    const before = value.slice(0, cursorPos);

    // ── Try `$.` trigger for JSONPath hints ──
    if (jpHints.length > 0) {
      const jpMatch = /(?:^|[\s,(])(\$\.[.\w[\]*]*)$/.exec(before);
      if (jpMatch) {
        const fragment = jpMatch[1];
        const q = fragment.toLowerCase();
        const filtered = jpHints.filter((h) => h.label.toLowerCase().startsWith(q));
        if (filtered.length > 0) {
          setState({
            open: true,
            items: filtered.slice(0, 15),
            selectedIndex: 0,
            triggerStart: cursorPos - fragment.length,
            triggerKind: 'jsonpath',
            filter: fragment,
          });
          return;
        }
      }
    }

    // ── Try `{{` trigger first (variable or function inside template braces) ──
    const lastOpen = before.lastIndexOf('{{');
    if (lastOpen !== -1) {
      const between = before.slice(lastOpen + 2);
      if (!between.includes('}}')) {
        const fragment = between.trim();
        if (fragment.startsWith('$')) {
          const q = fragment.toLowerCase();
          const filtered = fnHints.filter((f) => f.label.toLowerCase().startsWith(q));
          setState({
            open: filtered.length > 0,
            items: filtered.slice(0, 12),
            selectedIndex: 0,
            triggerStart: lastOpen,
            triggerKind: 'braces',
            filter: fragment,
          });
          return;
        }
        const q = fragment.toLowerCase();
        const filtered = q
          ? uniqueVarHints.filter((v) => v.label.toLowerCase().includes(q))
          : uniqueVarHints;
        setState({
          open: filtered.length > 0,
          items: filtered.slice(0, 12),
          selectedIndex: 0,
          triggerStart: lastOpen,
          triggerKind: 'braces',
          filter: fragment,
        });
        return;
      }
    }

    // ── Try bare `$` trigger (function name without braces) ──
    // Find the last `$` that starts a token (preceded by start-of-string, space, comma, or paren)
    const dollarMatch = /(?:^|[\s,(])(\$\w*)$/.exec(before);
    if (dollarMatch) {
      const fragment = dollarMatch[1];
      const q = fragment.toLowerCase();
      const filtered = fnHints.filter((f) => f.label.toLowerCase().startsWith(q));
      setState({
        open: filtered.length > 0,
        items: filtered.slice(0, 12),
        selectedIndex: 0,
        triggerStart: cursorPos - fragment.length,
        triggerKind: 'bare',
        filter: fragment,
      });
      return;
    }

    setState(CLOSED);
  }, [fnHints, uniqueVarHints, jpHints]);

  /** Call on every `onChange` event from the input. */
  const onInputChange = useCallback((value: string, cursorPos: number) => {
    analyse(value, cursorPos);
  }, [analyse]);

  /** Accept the currently selected hint → replace the trigger fragment with the completed text. */
  const accept = useCallback((
    item: HintItem,
    currentValue: string,
    onChange: (newValue: string) => void,
  ) => {
    const { triggerStart, triggerKind } = state;
    if (triggerStart === -1) return;

    let replacement: string;
    let cursorOffset: number;

    if (triggerKind === 'jsonpath') {
      replacement = item.insertText;
      cursorOffset = replacement.length;
    } else if (triggerKind === 'bare') {
      // Bare `$` trigger — insert function name with parens, no `{{` wrapping
      const fn = item.meta as ExpressionFunction;
      if (fn.args.length > 0) {
        replacement = `${item.insertText}`;
        cursorOffset = replacement.length;
      } else {
        replacement = `${item.insertText}`;
        cursorOffset = replacement.length;
      }
    } else if (item.kind === 'function') {
      // `{{` trigger + function — insert `{{$fn(` or `{{$fn()}}`
      const fn = item.meta as ExpressionFunction;
      if (fn.args.length > 0) {
        replacement = `{{${item.insertText}`;
        cursorOffset = replacement.length;
      } else {
        replacement = `{{${item.insertText}}}`;
        cursorOffset = replacement.length;
      }
    } else {
      // `{{` trigger + variable — insert `{{varName}}`
      const afterTrigger = currentValue.slice(triggerStart);
      const closingIdx = afterTrigger.indexOf('}}');
      if (closingIdx !== -1 && closingIdx <= state.filter.length + 4) {
        const endPos = triggerStart + closingIdx + 2;
        const before = currentValue.slice(0, triggerStart);
        const after = currentValue.slice(endPos);
        const newVal = before + `{{${item.insertText}}}` + after;
        cursorOffset = before.length + `{{${item.insertText}}}`.length;
        onChange(newVal);
        setState(CLOSED);
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(cursorOffset, cursorOffset);
        });
        return;
      }
      replacement = `{{${item.insertText}}}`;
      cursorOffset = replacement.length;
    }

    const cursorPos = inputRef.current?.selectionStart ?? currentValue.length;
    const before = currentValue.slice(0, triggerStart);
    const after = currentValue.slice(cursorPos);
    const newVal = before + replacement + after;
    cursorOffset = before.length + cursorOffset;

    onChange(newVal);
    setState(CLOSED);

    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cursorOffset, cursorOffset);
    });
  }, [state]);

  /** Handle keyboard navigation inside the dropdown. Returns true if event was consumed. */
  const onKeyDown = useCallback((
    e: React.KeyboardEvent,
    currentValue: string,
    onChange: (newValue: string) => void,
  ): boolean => {
    if (!state.open) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setState((s) => ({ ...s, selectedIndex: Math.min(s.selectedIndex + 1, s.items.length - 1) }));
        return true;
      case 'ArrowUp':
        e.preventDefault();
        setState((s) => ({ ...s, selectedIndex: Math.max(s.selectedIndex - 1, 0) }));
        return true;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (state.items[state.selectedIndex]) {
          accept(state.items[state.selectedIndex], currentValue, onChange);
        }
        return true;
      case 'Escape':
        e.preventDefault();
        setState(CLOSED);
        return true;
      default:
        return false;
    }
  }, [state, accept]);

  const close = useCallback(() => setState(CLOSED), []);

  return {
    hintState: state,
    inputRef,
    onInputChange,
    onKeyDown,
    accept,
    close,
  };
}
