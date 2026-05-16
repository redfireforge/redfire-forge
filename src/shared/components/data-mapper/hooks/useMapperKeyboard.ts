import { useEffect } from 'react';

interface UseMapperKeyboardArgs {
  undo: () => void;
  redo: () => void;
  selectedMappingId: string | null;
  removeMapping: (id: string) => void;
  removeMappings: (ids: string[]) => void;
  selectMapping: (id: string | null) => void;
  editingMappingId: string | null;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  sourceSearchRef: React.RefObject<HTMLInputElement | null>;
}

export function useMapperKeyboard({
  undo,
  redo,
  selectedMappingId,
  removeMapping,
  removeMappings,
  selectMapping,
  editingMappingId,
  selectedIds,
  setSelectedIds,
  sourceSearchRef,
}: UseMapperKeyboardArgs): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingMappingId) return;
      if (document.querySelector('.dm-expr-overlay') || document.querySelector('.dm-diff-overlay')) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (isEditable) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (isEditable) return;
        if (selectedIds.size > 0) {
          e.preventDefault();
          removeMappings(Array.from(selectedIds));
          setSelectedIds(new Set());
          return;
        }
        if (selectedMappingId) {
          e.preventDefault();
          removeMapping(selectedMappingId);
          return;
        }
      }
      if (e.key === 'Escape' && selectedMappingId) {
        if (isEditable) return;
        e.preventDefault();
        selectMapping(null);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        if (isEditable) return;
        e.preventDefault();
        sourceSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedMappingId, removeMapping, removeMappings, selectMapping, editingMappingId, selectedIds, setSelectedIds, sourceSearchRef]);
}
