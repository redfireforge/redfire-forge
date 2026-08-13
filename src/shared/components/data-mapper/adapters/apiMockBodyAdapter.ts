/**
 * Maps request/faker/helper sources onto a mock response JSON body template.
 */
import { setByPath } from '../../../utils/jsonPath';
import type { MapperAdapter, Mapping, MapperSource, MapperTarget, ValidationIssue } from '../types';
import { hasUnsafePathSegment } from '../utils/bodyMappingShared';
import {
  collectBodyLeafPaths,
  extractBodyTemplateRefs,
  parseBodyJson,
} from './requestBodyAdapter';
import { FAKER_HELPER_PATHS } from '../../../api-mock/templateFaker';
import { pathParamNames } from '../../../api-mock/pathMatcher';

export interface ApiMockBodyAdapterOptions {
  existingBody?: string;
  pathParams?: string[];
  /** Route path pattern used when `pathParams` is empty (`/orders/:orderId`). */
  pathPattern?: string;
}

const DEFAULT_BODY = { id: '', name: '', createdAt: '' };

function defaultBody(): Record<string, string> {
  return { ...DEFAULT_BODY };
}

function innerExpr(sourceId: string, sourcePath: string): string {
  if (sourceId === 'faker') return `faker '${sourcePath}'`;
  if (sourceId === 'helpers') return sourcePath;
  if (sourceId === 'request') {
    const dot = sourcePath.indexOf('.');
    if (dot < 0) return sourcePath;
    return `${sourcePath.slice(0, dot)} '${sourcePath.slice(dot + 1)}'`;
  }
  return sourcePath;
}

function sourceIdForRef(ref: string): string {
  if (ref.startsWith('faker ')) return 'faker';
  if (ref.startsWith('pathParam ') || ref.startsWith('query ') || ref.startsWith('header ')) return 'request';
  return 'helpers';
}

function sourcePathForRef(ref: string, sourceId: string): string {
  if (sourceId === 'faker') {
    const m = ref.match(/faker\s+'([^']+)'/);
    return m?.[1] ?? ref;
  }
  if (sourceId === 'request') {
    const m = ref.match(/^(pathParam|query|header)\s+'([^']+)'/);
    return m ? `${m[1]}.${m[2]}` : ref;
  }
  return ref.replace(/[{}]/g, '').trim();
}

export function createApiMockBodyAdapter(opts: ApiMockBodyAdapterOptions = {}): MapperAdapter<string> {
  const fromPattern = opts.pathPattern ? pathParamNames(opts.pathPattern) : [];
  const pathParams = opts.pathParams?.length ? opts.pathParams : (fromPattern.length ? fromPattern : ['id']);
  const existingBody = opts.existingBody ?? '';
  const parsedJson = parseBodyJson(existingBody);
  const parsed = parsedJson ?? defaultBody();
  const leaves = collectBodyLeafPaths(parsed);

  const requestSample: Record<string, string> = {};
  for (const name of pathParams) requestSample[`pathParam.${name}`] = name;
  requestSample['query.q'] = 'search';
  requestSample['header.x-tenant'] = 'acme';

  const fakerSample: Record<string, string> = {};
  for (const path of FAKER_HELPER_PATHS) fakerSample[path] = path;

  const sources: MapperSource[] = [
    { id: 'request', label: 'Request', sampleData: requestSample, format: 'json' },
    { id: 'faker', label: 'Faker subset', sampleData: fakerSample, format: 'json' },
    {
      id: 'helpers',
      label: 'Helpers',
      sampleData: { uuid: 'uuid', now: 'now', requestId: 'requestId' },
      format: 'json',
    },
  ];

  const target: MapperTarget = {
    label: 'Mock response body',
    sampleData: parsed,
    fields: leaves.map(leaf => ({ path: leaf.path, label: leaf.path, type: 'string' })),
    allowCustomFields: true,
  };

  return {
    contextId: 'api-mock-body',
    title: 'Request → Mock body',
    category: 'http',
    sources,
    target,
    capabilities: { expressions: true, profiles: true },

    serialize(mappings: Mapping[]): string {
      // Non-object JSON (arrays, XML, text) cannot be mapped — never replace it
      // with the default `{id,name,createdAt}` shell.
      if (!parsedJson && existingBody.trim()) return existingBody;
      const result = structuredClone(parsed) as Record<string, unknown>;
      for (const m of mappings) {
        if (!m.targetPath.trim() || hasUnsafePathSegment(m.targetPath)) continue;
        const expr = innerExpr(m.sourceId, m.expression?.trim() || m.sourcePath);
        if (!expr) continue;
        setByPath(result, m.targetPath, `{{${expr}}}`);
      }
      return JSON.stringify(result, null, 2);
    },

    deserialize(existing: string): Mapping[] {
      const body = parseBodyJson(existing);
      if (!body) return [];
      const mappings: Mapping[] = [];
      for (const leaf of collectBodyLeafPaths(body)) {
        if (typeof leaf.value !== 'string') continue;
        for (const ref of extractBodyTemplateRefs(leaf.value)) {
          const sourceId = sourceIdForRef(ref);
          mappings.push({
            id: `am-${mappings.length}`,
            sourceId,
            sourcePath: sourcePathForRef(ref, sourceId),
            targetPath: leaf.path,
          });
        }
      }
      return mappings;
    },

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      if (mappings.length === 0) {
        issues.push({ severity: 'info', message: 'Drag request, faker, or helper fields onto the mock body.' });
        return issues;
      }
      for (const m of mappings) {
        if (!m.targetPath.trim()) {
          issues.push({ mappingId: m.id, severity: 'error', message: 'Target field path is required.' });
        } else if (hasUnsafePathSegment(m.targetPath)) {
          issues.push({ mappingId: m.id, severity: 'error', message: `Unsafe path "${m.targetPath}".` });
        }
        if (!(m.expression?.trim() || m.sourcePath?.trim())) {
          issues.push({ mappingId: m.id, severity: 'error', message: `No source bound to "${m.targetPath}".` });
        }
      }
      return issues;
    },
  };
}
