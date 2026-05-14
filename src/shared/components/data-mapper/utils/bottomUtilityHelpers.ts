export type BottomUtilityMode = 'none' | 'code' | 'preview' | 'table' | 'rules';

export function toggleUtilityMode(
  current: BottomUtilityMode,
  target: BottomUtilityMode,
): BottomUtilityMode {
  return current === target ? 'none' : target;
}

export function safeDeserialize<TOutput>(
  adapter: { deserialize: (data: TOutput) => import('../types').Mapping[] },
  data: TOutput | undefined,
): import('../types').Mapping[] {
  if (!data) return [];
  try {
    return adapter.deserialize(data);
  } catch {
    return [];
  }
}
