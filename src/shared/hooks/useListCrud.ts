import { useCallback, useMemo } from 'react';

/**
 * Generic CRUD operations for an ordered list of items.
 * Shared by AggregateConfig, SetVariableConfig, SwitchConfig, and similar
 * config panels that manage a dynamic list with add/update/remove/reorder.
 */
export function useListCrud<T>(
  items: T[],
  setItems: (items: T[]) => void,
) {
  const update = useCallback((idx: number, patch: Partial<T>) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }, [items, setItems]);

  const remove = useCallback((idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  }, [items, setItems]);

  const move = useCallback((idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const arr = [...items];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setItems(arr);
  }, [items, setItems]);

  return useMemo(() => ({ update, remove, move }), [update, remove, move]);
}
