import { useMemo } from 'react';
import { groupedExpressionFunctions, EXPRESSION_CATEGORIES } from '@workflow/utils/expressionFunctions';
import type { ExpressionFunction } from '@workflow/utils/expressionFunctions/types';
import { TRANSFORMATION_LIBRARY, searchTemplates } from '../utils/transformationLibrary';
import { extractTemplateFunctionNames } from '../utils/expressionEditorHelpers';

interface FunctionCatalog {
  allFunctions: ExpressionFunction[];
  grouped: { category: string; functions: ExpressionFunction[] }[];
  filteredGroups: { category: string; functions: ExpressionFunction[] }[];
  allCategories: string[];
  supportedFunctionNames: Set<string>;
  templateCandidates: typeof TRANSFORMATION_LIBRARY;
}

export function useExpressionFunctionCatalog(
  customFunctions: ExpressionFunction[] | undefined,
  activeCategory: string,
  functionSearch: string,
  templateQuery: string,
): FunctionCatalog {
  const allFunctions = useMemo(() => {
    const base = groupedExpressionFunctions();
    const allFns: ExpressionFunction[] = [];
    for (const g of base) allFns.push(...g.functions);
    if (customFunctions?.length) allFns.push(...customFunctions);
    return allFns;
  }, [customFunctions]);

  const grouped = useMemo(() => {
    const base = groupedExpressionFunctions();
    if (!customFunctions?.length) return base;
    const customGroup = { category: 'Custom', functions: customFunctions };
    return [...base, customGroup];
  }, [customFunctions]);

  const filteredGroups = useMemo(() => {
    const byCategory = activeCategory === 'All' ? grouped : grouped.filter((g) => g.category === activeCategory);
    const q = functionSearch.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory
      .map((g) => ({
        ...g,
        functions: g.functions.filter((fn) =>
          fn.name.toLowerCase().includes(q) || fn.description.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.functions.length > 0);
  }, [grouped, activeCategory, functionSearch]);

  const allCategories = useMemo(() => {
    const cats = [...EXPRESSION_CATEGORIES] as string[];
    if (customFunctions?.length) cats.push('Custom');
    return cats;
  }, [customFunctions]);

  const supportedFunctionNames = useMemo(
    () => new Set(allFunctions.map((fn) => (fn.name.startsWith('$') ? fn.name : `$${fn.name}`))),
    [allFunctions],
  );

  const templateCandidates = useMemo(() => {
    const base = templateQuery.trim() ? searchTemplates(templateQuery.trim()) : TRANSFORMATION_LIBRARY;
    return [...base]
      .filter((template) => {
        const fnNames = extractTemplateFunctionNames(template.template);
        return fnNames.every((name) => supportedFunctionNames.has(name));
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);
  }, [templateQuery, supportedFunctionNames]);

  return { allFunctions, grouped, filteredGroups, allCategories, supportedFunctionNames, templateCandidates };
}
