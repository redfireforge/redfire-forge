import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';
import type { FieldOperator, Mapping } from '../types';
import type { OperatorMeta } from '../utils/operatorRegistry';
import { OPERATOR_REGISTRY } from '../utils/operatorRegistry';

interface OperatorCapabilities {
  operators?: boolean;
  autoMapDefaultOperator?: FieldOperator;
}

export interface UseOperatorEditingArgs {
  mapping: Mapping | undefined;
  capabilities?: OperatorCapabilities;
  onUpdateMappingOperator?: (id: string, op: FieldOperator | undefined, value: string | undefined) => void;
  operatorPillRef: RefObject<HTMLButtonElement | null>;
}

export interface UseOperatorEditingResult {
  currentOp: FieldOperator;
  currentOpMeta: OperatorMeta;
  showOperators: boolean;
  isRangeOperator: boolean;
  showOperatorPicker: boolean;
  operatorSearch: string;
  editingOperatorValue: boolean;
  localOperatorValue: string;
  pickerPos: { top: number; left: number; openUp: boolean };
  rangeSecondRef: RefObject<HTMLInputElement | null>;
  typeSelectRef: RefObject<HTMLSelectElement | null>;
  operatorValueRef: RefObject<HTMLInputElement | null>;
  pickerRef: RefObject<HTMLDivElement | null>;
  setOperatorSearch: (s: string) => void;
  setShowOperatorPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLocalOperatorValue: (v: string) => void;
  setEditingOperatorValue: (v: boolean) => void;
  setPickerPos: (v: { top: number; left: number; openUp: boolean }) => void;
  handleOperatorSelect: (op: FieldOperator) => void;
  toggleOperatorPicker: (e: React.MouseEvent) => void;
  handleOperatorValueCommit: () => void;
  handleRangeCommit: (part1: string, part2: string) => void;
  handleOperatorValueKeyDown: (e: React.KeyboardEvent) => void;
  startEditOperatorValue: () => void;
  handleTypeSelectChange: (value: string) => void;
}

export function useOperatorEditing({
  mapping,
  capabilities,
  onUpdateMappingOperator,
  operatorPillRef,
}: UseOperatorEditingArgs): UseOperatorEditingResult {
  const [showOperatorPicker, setShowOperatorPicker] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [editingOperatorValue, setEditingOperatorValue] = useState(false);
  const [localOperatorValue, setLocalOperatorValue] = useState('');
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });
  const rangeSecondRef = useRef<HTMLInputElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const operatorValueRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const currentOp = (mapping?.operator
    ?? (mapping?.isAutoMapped ? capabilities?.autoMapDefaultOperator : undefined)
    ?? 'equals') as FieldOperator;
  const currentOpMeta = OPERATOR_REGISTRY[currentOp] ?? OPERATOR_REGISTRY['equals'];
  const showOperators = !!(capabilities?.operators && mapping && onUpdateMappingOperator);
  const isRangeOperator = currentOp === 'between' || currentOp === 'close_to';

  const handleOperatorSelect = useCallback((op: FieldOperator) => {
    if (!mapping || !onUpdateMappingOperator) return;
    const meta = OPERATOR_REGISTRY[op];
    if (meta.needsValue) {
      const existingValue = mapping.operatorValue ?? '';
      onUpdateMappingOperator(mapping.id, op, existingValue);
      setLocalOperatorValue(existingValue);
      if (!existingValue) {
        setEditingOperatorValue(true);
      }
    } else {
      onUpdateMappingOperator(mapping.id, op, undefined);
      setEditingOperatorValue(false);
      setLocalOperatorValue('');
    }
    setShowOperatorPicker(false);
    setOperatorSearch('');
  }, [mapping, onUpdateMappingOperator]);

  const toggleOperatorPicker = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showOperatorPicker && operatorPillRef.current) {
      const rect = operatorPillRef.current.getBoundingClientRect();
      const dmBody = operatorPillRef.current.closest('.dm-body');
      const sourcePanel = dmBody?.querySelector('.dm-panel-wrapper');
      const sourcePanelRect = sourcePanel?.getBoundingClientRect();
      const pickerWidth = 240;
      const pickerHeight = 400;
      let left: number;
      if (sourcePanelRect) {
        const fitWidth = Math.min(pickerWidth, sourcePanelRect.width - 16);
        left = sourcePanelRect.left + 8;
        if (fitWidth < pickerWidth) {
          left = sourcePanelRect.left + 4;
        }
      } else {
        left = 8;
      }
      const spaceBelow = window.innerHeight - rect.top;
      const openUp = spaceBelow < pickerHeight && rect.top > spaceBelow;
      setPickerPos({
        top: openUp ? Math.max(8, rect.top - pickerHeight + 30) : rect.top,
        left: Math.max(8, left),
        openUp,
      });
    }
    setShowOperatorPicker(prev => !prev);
  }, [showOperatorPicker, operatorPillRef]);

  const handleOperatorValueCommit = useCallback(() => {
    if (!mapping || !onUpdateMappingOperator) return;
    onUpdateMappingOperator(mapping.id, mapping.operator, localOperatorValue);
    setEditingOperatorValue(false);
  }, [mapping, onUpdateMappingOperator, localOperatorValue]);

  const handleRangeCommit = useCallback((part1: string, part2: string) => {
    if (!mapping || !onUpdateMappingOperator) return;
    const combined = `${part1.trim()}, ${part2.trim()}`;
    onUpdateMappingOperator(mapping.id, mapping.operator, combined);
    setEditingOperatorValue(false);
  }, [mapping, onUpdateMappingOperator]);

  const handleOperatorValueKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleOperatorValueCommit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditingOperatorValue(false); }
  }, [handleOperatorValueCommit]);

  const startEditOperatorValue = useCallback(() => {
    if (!mapping) return;
    setLocalOperatorValue(mapping.operatorValue ?? '');
    setEditingOperatorValue(true);
  }, [mapping]);

  const handleTypeSelectChange = useCallback((value: string) => {
    setLocalOperatorValue(value);
    if (mapping && onUpdateMappingOperator) {
      onUpdateMappingOperator(mapping.id, mapping.operator, value);
    }
    setEditingOperatorValue(false);
  }, [mapping, onUpdateMappingOperator]);

  useEffect(() => {
    if (editingOperatorValue) {
      if (currentOp === 'is_type') {
        typeSelectRef.current?.focus();
      } else {
        operatorValueRef.current?.focus();
      }
    }
  }, [editingOperatorValue, currentOp]);

  useEffect(() => {
    if (!showOperatorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          operatorPillRef.current && !operatorPillRef.current.contains(e.target as Node)) {
        setShowOperatorPicker(false);
        setOperatorSearch('');
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOperatorPicker, operatorPillRef]);

  return {
    currentOp,
    currentOpMeta,
    showOperators,
    isRangeOperator,
    showOperatorPicker,
    operatorSearch,
    editingOperatorValue,
    localOperatorValue,
    pickerPos,
    rangeSecondRef,
    typeSelectRef,
    operatorValueRef,
    pickerRef,
    setPickerPos,
    setOperatorSearch,
    setShowOperatorPicker,
    setLocalOperatorValue,
    setEditingOperatorValue,
    handleOperatorSelect,
    toggleOperatorPicker,
    handleOperatorValueCommit,
    handleRangeCommit,
    handleOperatorValueKeyDown,
    startEditOperatorValue,
    handleTypeSelectChange,
  };
}
