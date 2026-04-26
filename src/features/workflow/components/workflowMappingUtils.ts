export function updateMappingEntry<T extends Record<string, string>>(
  mappings: T[],
  index: number,
  field: keyof T,
  value: string,
): T[] {
  const next = [...mappings];
  next[index] = { ...next[index], [field]: value };
  return next;
}

export function addMappingEntry<T extends Record<string, string>>(
  mappings: T[],
  emptyEntry: T,
): T[] {
  return [...mappings, emptyEntry];
}

export function removeMappingEntry<T extends Record<string, string>>(
  mappings: T[],
  index: number,
): T[] {
  return mappings.filter((_, currentIndex) => currentIndex !== index);
}