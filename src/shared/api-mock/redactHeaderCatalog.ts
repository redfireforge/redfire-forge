/**
 * Reference names for journal / capture redaction.
 * Matching is case-insensitive; the field stores lowercase comma-separated names.
 */
import { DEFAULT_SETTINGS } from './defaults';

export type RedactHeaderGroup = 'default' | 'common';

export interface RedactHeaderCatalogEntry {
  /** Lowercase name stored in settings. */
  name: string;
  /** HTTP-style label shown on the chip. */
  label: string;
  group: RedactHeaderGroup;
  detail: string;
}

const DEFAULT_META: Record<string, { label: string; detail: string }> = {
  authorization: { label: 'Authorization', detail: 'Bearer, Basic, or Digest credentials' },
  'proxy-authorization': { label: 'Proxy-Authorization', detail: 'Credentials sent to an upstream proxy' },
  cookie: { label: 'Cookie', detail: 'Request session cookies' },
  'set-cookie': { label: 'Set-Cookie', detail: 'Response session cookies' },
  'x-api-key': { label: 'X-Api-Key', detail: 'Common API key header' },
  'api-key': { label: 'Api-Key', detail: 'Alternate API key header' },
  'x-auth-token': { label: 'X-Auth-Token', detail: 'Session or bearer-style token' },
};

const COMMON_HEADERS: RedactHeaderCatalogEntry[] = [
  { name: 'x-access-token', label: 'X-Access-Token', group: 'common', detail: 'OAuth / JWT access token' },
  { name: 'x-refresh-token', label: 'X-Refresh-Token', group: 'common', detail: 'OAuth refresh token' },
  { name: 'x-id-token', label: 'X-Id-Token', group: 'common', detail: 'OIDC identity token' },
  { name: 'x-csrf-token', label: 'X-Csrf-Token', group: 'common', detail: 'CSRF anti-forgery token' },
  { name: 'x-xsrf-token', label: 'X-Xsrf-Token', group: 'common', detail: 'Angular-style CSRF token' },
  { name: 'x-session-token', label: 'X-Session-Token', group: 'common', detail: 'Custom session identifier' },
  { name: 'x-amz-security-token', label: 'X-Amz-Security-Token', group: 'common', detail: 'AWS STS session token' },
];

export function titleCaseHeader(name: string): string {
  return name.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join('-');
}

export function redactHeaderDefaultEntry(name: string): RedactHeaderCatalogEntry {
  const meta = DEFAULT_META[name];
  return {
    name,
    label: meta?.label ?? titleCaseHeader(name),
    group: 'default',
    detail: meta?.detail ?? 'Default journal redaction header',
  };
}

function defaultEntries(): RedactHeaderCatalogEntry[] {
  return DEFAULT_SETTINGS.redaction.headerNames.map(redactHeaderDefaultEntry);
}

export const REDACT_HEADER_CATALOG: RedactHeaderCatalogEntry[] = [
  ...defaultEntries(),
  ...COMMON_HEADERS.filter(entry => !DEFAULT_SETTINGS.redaction.headerNames.includes(entry.name)),
];

export const REDACT_HEADER_GROUP_LABELS: Record<RedactHeaderGroup, string> = {
  default: 'Shipped defaults',
  common: 'Also common',
};

export function parseRedactHeaderList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim().toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function formatRedactHeaderList(names: string[]): string {
  return parseRedactHeaderList(names.join(', ')).join(', ');
}

export function defaultRedactHeaderList(): string {
  return formatRedactHeaderList(DEFAULT_SETTINGS.redaction.headerNames);
}

export function isRedactHeaderSelected(raw: string, name: string): boolean {
  return parseRedactHeaderList(raw).includes(name.trim().toLowerCase());
}

export function toggleRedactHeader(raw: string, name: string): string {
  const target = name.trim().toLowerCase();
  if (!target) return formatRedactHeaderList(parseRedactHeaderList(raw));
  const current = parseRedactHeaderList(raw);
  const next = current.includes(target)
    ? current.filter(item => item !== target)
    : [...current, target];
  return formatRedactHeaderList(next);
}

export function groupRedactHeaders(
  entries: RedactHeaderCatalogEntry[] = REDACT_HEADER_CATALOG,
): Array<{ group: RedactHeaderGroup; label: string; entries: RedactHeaderCatalogEntry[] }> {
  return (['default', 'common'] as const)
    .map(group => ({
      group,
      label: REDACT_HEADER_GROUP_LABELS[group],
      entries: entries.filter(entry => entry.group === group),
    }))
    .filter(section => section.entries.length > 0);
}
