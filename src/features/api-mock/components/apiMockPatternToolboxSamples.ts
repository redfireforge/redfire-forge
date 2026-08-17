/**
 * Pattern Toolbox sample bodies live only in modal state. Remember the last
 * JSON / XML sample per route path so closing and reopening the wand does not
 * wipe a pasted SOAP envelope (or JSON payload) back to the preset default.
 */
import { DEFAULT_JSON_SAMPLE, DEFAULT_XPATH_SAMPLE } from './apiMockPatternToolboxConstants';

export { DEFAULT_XPATH_SAMPLE };

export type ToolboxBodySampleKind = 'json' | 'xml';

const remembered = new Map<string, string>();

export function toolboxBodySampleKey(kind: ToolboxBodySampleKind, pathValue: string): string {
  return `${kind}:${pathValue || '/'}`;
}

export function rememberToolboxBodySample(
  kind: ToolboxBodySampleKind,
  pathValue: string,
  value: string,
): void {
  const key = toolboxBodySampleKey(kind, pathValue);
  if (!value.trim()) {
    remembered.delete(key);
    return;
  }
  remembered.set(key, value);
}

export function recallToolboxBodySample(
  kind: ToolboxBodySampleKind,
  pathValue: string,
  fallback: string,
): string {
  return remembered.get(toolboxBodySampleKey(kind, pathValue)) ?? fallback;
}

export function initialToolboxJsonSample(pathValue: string): string {
  return recallToolboxBodySample('json', pathValue, JSON.stringify(DEFAULT_JSON_SAMPLE, null, 2));
}

export function initialToolboxXmlSample(pathValue: string): string {
  return recallToolboxBodySample('xml', pathValue, DEFAULT_XPATH_SAMPLE);
}

/** Test-only — each modal spec starts from an empty memory. */
export function clearToolboxBodySamples(): void {
  remembered.clear();
}
