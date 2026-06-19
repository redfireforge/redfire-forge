import { useEffect } from 'react';

export function useAutoDismiss(
  value: boolean,
  setValue: (v: false) => void,
  ms = 6000,
): void {
  useEffect(() => {
    if (!value) return;
    const t = setTimeout(() => setValue(false), ms);
    return () => clearTimeout(t);
  }, [value, setValue, ms]);
}
