import { useState, useEffect } from 'react';

/**
 * Debounce a string value by the given delay (ms).
 * Returns the debounced value that updates only after the caller stops
 * changing `value` for at least `delay` milliseconds.
 */
export function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
