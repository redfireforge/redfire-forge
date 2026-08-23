import type { Extraction } from '@shared/types';
import type { VariableContext } from '@workflow/engine/variableContext';
import { getByPath } from '@shared/utils/jsonPath';

export interface ResponseData {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Run extractions against a response and store results in the variable context.
 * Returns a record of extracted variable name → value for logging/UI.
 */
export function extractVariables(
  extractions: Extraction[],
  response: ResponseData,
  ctx: VariableContext,
  /** React Flow node id — enables `{{node:<id>.<name>}}` references. */
  httpNodeId: string,
): Record<string, string> {
  const extracted: Record<string, string> = {};

  for (const ext of extractions) {
    let value: string | undefined;

    switch (ext.source) {
      case 'body': {
        const raw = getByPath(response.body, ext.expression);
        if (raw !== undefined) {
          value = typeof raw === 'string' ? raw : JSON.stringify(raw);
        }
        break;
      }
      case 'header': {
        const headerName = ext.expression.toLowerCase();
        const entry = Object.entries(response.headers).find(
          ([k]) => k.toLowerCase() === headerName,
        );
        if (entry) value = entry[1];
        break;
      }
      case 'status':
        value = String(response.status);
        break;
    }

    const resolved = value ?? ext.fallback;
    if (resolved !== undefined) {
      ctx.set(ext.name, resolved);
      ctx.setForNode(httpNodeId, ext.name, resolved);
      extracted[ext.name] = resolved;
    }
  }

  return extracted;
}
