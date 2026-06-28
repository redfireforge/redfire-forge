import type { Workflow } from '../workflow/types/workflow';
import type { KafkaConsumeNodeData } from '../workflow/types/workflow';
import { resolveKafkaConsumeLoadPolicy } from '../workflow/engine/kafkaLoadPolicy';

export interface KafkaLoadBanners {
  blockNodes: string[];
  infoNodes: string[];
}

/** WorkflowRunner always runs as 'workflow' executionMode — compute banners against that fixed mode. */
export function computeKafkaLoadBanners(selectedWorkflow: Workflow | null): KafkaLoadBanners {
  const blockNodes: string[] = [];
  const infoNodes: string[] = [];
  if (selectedWorkflow) {
    for (const node of selectedWorkflow.nodes) {
      if (node.type !== 'kafkaConsume') continue;
      const consumeMode = (node.data as KafkaConsumeNodeData).loadTestBehavior?.mode;
      const label = (node.data as { label?: string }).label ?? node.id;
      const outcome = resolveKafkaConsumeLoadPolicy('workflow', consumeMode);
      if (outcome.decision === 'block') {
        blockNodes.push(label);
      } else if (outcome.fallbackMode !== undefined) {
        infoNodes.push(label);
      }
    }
  }
  return { blockNodes, infoNodes };
}
