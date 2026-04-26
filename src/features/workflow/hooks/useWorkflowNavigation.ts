import { useState, useCallback } from 'react';
import type { BreadcrumbItem } from '../components/WorkflowBreadcrumb';
import type { Workflow } from '../types/workflow';

interface UseWorkflowNavigationOptions {
  selected: Workflow | null;
  workflows: Workflow[];
  select: (id: string) => void;
  persistWorkflow: () => void;
}

export function useWorkflowNavigation({
  selected,
  workflows,
  select,
  persistWorkflow,
}: UseWorkflowNavigationOptions) {
  const [navStack, setNavStack] = useState<BreadcrumbItem[]>([]);

  /** Navigate into a child sub-workflow, pushing current to breadcrumb stack. */
  const navigateToWorkflow = useCallback((workflowId: string) => {
    if (!selected) return;
    const target = workflows.find((w) => w.id === workflowId);
    if (!target) return;
    persistWorkflow();
    setNavStack((s) => [...s, { id: selected.id, name: selected.name }]);
    select(workflowId);
  }, [selected, workflows, select, persistWorkflow]);

  /** Navigate back to a breadcrumb ancestor. */
  const handleBreadcrumbNavigate = useCallback((index: number) => {
    const target = navStack[index];
    if (!target) return;
    persistWorkflow();
    setNavStack((s) => s.slice(0, index));
    select(target.id);
  }, [navStack, select, persistWorkflow]);

  return {
    navStack,
    setNavStack,
    navigateToWorkflow,
    handleBreadcrumbNavigate,
  };
}
