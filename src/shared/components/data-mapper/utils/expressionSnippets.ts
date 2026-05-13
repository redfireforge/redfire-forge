import { readKey, writeKey } from '../../../utils/storage';

const STORAGE_KEY = 'dm-expression-snippets-v1';
const MAX_SNIPPETS = 50;

export interface ExpressionSnippet {
  id: string;
  name: string;
  expression: string;
  updatedAt: number;
}

function normalizeSnippet(raw: unknown): ExpressionSnippet | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<ExpressionSnippet>;
  if (!candidate.id || !candidate.name || !candidate.expression) return null;
  const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now();
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    expression: candidate.expression.trim(),
    updatedAt,
  };
}

function sortSnippets(snippets: ExpressionSnippet[]): ExpressionSnippet[] {
  return [...snippets].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function persist(snippets: ExpressionSnippet[]): Promise<void> {
  try {
    await writeKey(STORAGE_KEY, JSON.stringify(sortSnippets(snippets).slice(0, MAX_SNIPPETS)));
  } catch {
    // Best effort only. Editor can still work without persistence.
  }
}

export async function loadExpressionSnippets(): Promise<ExpressionSnippet[]> {
  try {
    const raw = await readKey(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortSnippets(parsed.map(normalizeSnippet).filter((v): v is ExpressionSnippet => Boolean(v)));
  } catch {
    return [];
  }
}

export async function saveExpressionSnippet(name: string, expression: string): Promise<ExpressionSnippet[]> {
  const normalizedName = name.trim();
  const normalizedExpression = expression.trim();
  if (!normalizedName || !normalizedExpression) return loadExpressionSnippets();

  const current = await loadExpressionSnippets();
  const now = Date.now();
  const existingIndex = current.findIndex((snippet) => snippet.name.toLowerCase() === normalizedName.toLowerCase());
  if (existingIndex >= 0) {
    const updated = [...current];
    updated[existingIndex] = {
      ...updated[existingIndex],
      name: normalizedName,
      expression: normalizedExpression,
      updatedAt: now,
    };
    await persist(updated);
    return sortSnippets(updated);
  }

  const next: ExpressionSnippet = {
    id: `snippet-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    expression: normalizedExpression,
    updatedAt: now,
  };
  const merged = [next, ...current];
  await persist(merged);
  return sortSnippets(merged);
}

export async function deleteExpressionSnippet(snippetId: string): Promise<ExpressionSnippet[]> {
  const current = await loadExpressionSnippets();
  const next = current.filter((snippet) => snippet.id !== snippetId);
  await persist(next);
  return sortSnippets(next);
}
