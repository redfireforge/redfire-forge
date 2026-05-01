interface ParseClampedIntegerOptions {
  defaultValue: number;
  min: number;
  max?: number;
}

export function parseClampedInteger(
  value: string,
  { defaultValue, min, max }: ParseClampedIntegerOptions,
): number {
  const parsed = parseInt(value, 10);
  const normalized = Number.isNaN(parsed) ? defaultValue : parsed;
  const clampedMin = Math.max(min, normalized);
  return typeof max === 'number' ? Math.min(max, clampedMin) : clampedMin;
}