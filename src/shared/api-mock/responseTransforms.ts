/**
 * Phase 9D — typed response transforms (no arbitrary JS).
 * Applied after template render, before delivery. Failures are isolated.
 */
import type { ApiMockTransformRuleV1 } from './callbackContracts';
import type { RenderedVariant } from './responseRenderer';
import type { ApiMockTemplateContextV1 } from './contracts';
import { renderTemplate } from './templateEngine';

export interface TransformApplyResult {
  rendered: RenderedVariant;
  applied: string[];
  errors: string[];
}

function resolveValue(raw: string | undefined, ctx?: ApiMockTemplateContextV1): string {
  if (raw == null) return '';
  if (!ctx || !raw.includes('{{')) return raw;
  try {
    return renderTemplate(raw, ctx).output;
  } catch {
    return raw;
  }
}

/** Apply enabled response transforms. Never throws. */
export function applyResponseTransforms(
  rendered: RenderedVariant,
  rules: ApiMockTransformRuleV1[] | undefined,
  ctx?: ApiMockTemplateContextV1,
): TransformApplyResult {
  const applied: string[] = [];
  const errors: string[] = [];
  if (!rules?.length) return { rendered, applied, errors };

  let status = rendered.status;
  const headers: Record<string, string | string[]> = { ...rendered.headers };
  let body = rendered.body;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      switch (rule.op) {
        case 'setHeader': {
          if (!rule.key) { errors.push(`${rule.id}: setHeader missing key`); break; }
          headers[rule.key] = resolveValue(rule.value, ctx);
          applied.push(rule.id);
          break;
        }
        case 'appendHeader': {
          if (!rule.key) { errors.push(`${rule.id}: appendHeader missing key`); break; }
          const next = resolveValue(rule.value, ctx);
          const prev = headers[rule.key];
          if (prev == null) headers[rule.key] = next;
          else if (Array.isArray(prev)) headers[rule.key] = [...prev, next];
          else headers[rule.key] = [prev, next];
          applied.push(rule.id);
          break;
        }
        case 'removeHeader': {
          if (!rule.key) { errors.push(`${rule.id}: removeHeader missing key`); break; }
          delete headers[rule.key];
          // case-insensitive cleanup
          for (const k of Object.keys(headers)) {
            if (k.toLowerCase() === rule.key.toLowerCase()) delete headers[k];
          }
          applied.push(rule.id);
          break;
        }
        case 'setStatus': {
          const n = parseInt(resolveValue(rule.value, ctx), 10);
          if (!Number.isFinite(n) || n < 100 || n > 599) {
            errors.push(`${rule.id}: invalid status "${rule.value}"`);
            break;
          }
          status = n;
          applied.push(rule.id);
          break;
        }
        case 'replaceBody': {
          body = resolveValue(rule.value, ctx);
          applied.push(rule.id);
          break;
        }
        default:
          errors.push(`${rule.id}: unknown op`);
      }
    } catch (e) {
      errors.push(`${rule.id}: ${e instanceof Error ? e.message : 'transform failed'}`);
    }
  }

  return { rendered: { ...rendered, status, headers, body }, applied, errors };
}
