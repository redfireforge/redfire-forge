import type { NodeRunStatus, Workflow } from '../types/workflow';

type DetailModal =
  | null
  | { type: 'step'; nodeId: string }
  | { type: 'variable'; key: string }
  | { type: 'runError' };

/**
 * Compute the title, subtitle, and body for the WorkflowDetailModal
 * based on the current detail-modal state.
 */
export function getDetailModalProps(
  detailModal: DetailModal,
  stepDetailMeta: { title: string; body: string },
  selectedNodeType: string | undefined,
  lastRunError: string | null,
): { title: string; subtitle: string | undefined; body: string | undefined } {
  if (!detailModal) return { title: '', subtitle: undefined, body: undefined };

  switch (detailModal.type) {
    case 'step':
      return {
        title: `Response — ${stepDetailMeta.title}`,
        subtitle: 'Last Quick Test result for this step',
        body: stepDetailMeta.body,
      };
    case 'variable':
      return {
        title: `Variable {{${detailModal.key}}}`,
        subtitle: selectedNodeType === 'http'
          ? 'Edit the value and click Apply to save to this step\u2019s initial variables.'
          : 'Edit the value and click Apply to save to workflow defaults.',
        body: undefined,
      };
    case 'runError':
      return {
        title: 'Quick Test failed',
        subtitle: 'Full error message (same as the status line, not truncated).',
        body: lastRunError ?? '',
      };
  }
}

/**
 * Returns a colour for a node in the MiniMap based on its run status and type.
 * Extracted from the inline callback in WorkflowDesigner so it can be reused
 * and unit-tested.
 */
export function getNodeMiniMapColor(
  node: { id: string; type?: string },
  nodeStatuses: Record<string, NodeRunStatus>,
): string {
  const status = nodeStatuses[node.id];
  if (status?.state === 'fail') return '#ef4444';
  if (status?.state === 'running') return '#eab308';
  if (status?.state === 'pass') return '#22c55e';
  if (status?.state === 'skipped') return '#94a3b8';
  if (node.type === 'condition') return '#a78bfa';
  if (node.type === 'delay') return '#94a3b8';
  if (node.type === 'start') return '#22c55e';
  if (node.type === 'fork') return '#a855f7';
  return '#3b82f6';
}

/**
 * Builds the list of available workflows shown in the config-modal workflow
 * picker. Includes persisted workflows plus any companion workflows from
 * sample-preview entries.
 */
export function buildConfigModalWorkflowList(
  workflows: Workflow[],
  previewWorkflow: Workflow | null,
  sampleCatalog: { id: string; companionFactories?: (() => Workflow)[] }[],
): { id: string; name: string }[] {
  const base = workflows.map((w) => ({ id: w.id, name: w.name }));
  if (previewWorkflow) {
    const entry = sampleCatalog.find(e => e.id === previewWorkflow.id);
    if (entry?.companionFactories) {
      for (const cf of entry.companionFactories) {
        const companion = cf();
        if (!base.some(b => b.id === companion.id)) {
          base.push({ id: companion.id, name: companion.name });
        }
      }
    }
  }
  return base;
}
