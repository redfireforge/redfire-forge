import type { Dispatch, SetStateAction } from 'react';

/** Toggle an item in a Set state — adds if absent, removes if present. */
export function toggleSetItem<T>(setter: Dispatch<SetStateAction<Set<T>>>, item: T): void {
  setter(prev => {
    const n = new Set(prev);
    if (n.has(item)) n.delete(item);
    else n.add(item);
    return n;
  });
}
