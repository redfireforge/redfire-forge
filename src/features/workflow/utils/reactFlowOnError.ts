/**
 * React Flow's default onError is `devWarn`, which console.warns every #004
 * (zero-size parent). We gate mounting with useHasLayoutSize, but a one-frame
 * race can still trip the library — swallow only that code.
 */
export function reactFlowOnError(id: string, message: string): void {
  if (id === '004') return;
  if (import.meta.env.MODE === 'production') return;
  console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
}
