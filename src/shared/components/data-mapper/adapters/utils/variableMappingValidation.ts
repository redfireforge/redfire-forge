import type { Mapping, ValidationIssue } from '../../types';

export function validateVariableMappings(
  mappings: Mapping[],
  options: { emptyValueMessage: (targetPath: string) => string },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const names = new Set<string>();

  for (const m of mappings) {
    const targetPath = m.targetPath.trim();
    if (!targetPath) {
      issues.push({
        mappingId: m.id,
        severity: 'error',
        message: 'Variable name is required.',
      });
      continue;
    }

    const pathOrExpression = (m.expression ?? m.sourcePath).trim();
    if (!pathOrExpression) {
      issues.push({
        mappingId: m.id,
        severity: 'error',
        message: options.emptyValueMessage(targetPath),
      });
    }

    if (names.has(targetPath)) {
      issues.push({
        mappingId: m.id,
        severity: 'error',
        message: `Duplicate variable name "${targetPath}".`,
      });
    }
    names.add(targetPath);

    if (/[{}]/.test(targetPath)) {
      issues.push({
        mappingId: m.id,
        severity: 'warning',
        message: `Variable name "${targetPath}" should not contain braces.`,
      });
    }
  }

  return issues;
}