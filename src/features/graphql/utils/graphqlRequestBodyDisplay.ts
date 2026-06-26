import { parse as gqlParse, print as gqlPrint } from 'graphql';

export interface GraphqlRequestBodyDisplayOptions {
  /** When true, show multiline GraphQL query + variables instead of raw JSON. */
  graphqlView?: boolean;
}

const OPERATION_KEYWORD_RE = /^\s*(query|mutation|subscription)\b/i;

/** Best-effort GraphQL query formatting; preserves operation keyword and decodes \\n escapes. */
export function formatGraphqlQueryForDisplay(query: string): string {
  const normalized = query.replace(/\\n/g, '\n').trim();
  const keywordMatch = normalized.match(OPERATION_KEYWORD_RE);
  const keyword = keywordMatch?.[1] ?? null;
  try {
    const printed = gqlPrint(gqlParse(normalized)).trim();
    if (!keyword) return printed;
    const lowerPrinted = printed.toLowerCase();
    if (
      lowerPrinted.startsWith(`${keyword.toLowerCase()} `)
      || lowerPrinted.startsWith(`${keyword.toLowerCase()}\n`)
    ) {
      return printed;
    }
    if (printed.startsWith('{')) {
      return `${keyword} ${printed}`;
    }
    return printed;
  } catch {
    return normalized;
  }
}

function formatGraphqlViewRequestBody(body: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof body.operationName === 'string' && body.operationName.trim()) {
    parts.push(`// Operation: ${body.operationName.trim()}`);
    parts.push('');
  }

  if (typeof body.query === 'string' && body.query.trim()) {
    parts.push(formatGraphqlQueryForDisplay(body.query));
    parts.push('');
    parts.push('// Variables');
    parts.push(JSON.stringify(body.variables ?? {}, null, 2));
  }

  const extras = { ...body };
  delete extras.query;
  delete extras.variables;
  delete extras.operationName;
  if (Object.keys(extras).length > 0) {
    parts.push('');
    parts.push('// Additional fields');
    parts.push(JSON.stringify(extras, null, 2));
  }

  return parts.join('\n').trimEnd();
}

/** Serializes a GraphQL POST body for the Metadata tab request-body panel. */
export function serializeGraphqlRequestBody(
  body: Record<string, unknown>,
  options: GraphqlRequestBodyDisplayOptions = {},
): string {
  if (options.graphqlView) {
    return formatGraphqlViewRequestBody(body);
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return '// Could not serialize request body';
  }
}
