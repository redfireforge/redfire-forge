import { describe, it, expect } from 'vitest';
import { resolveWebhookTriggerNode } from './resolveWebhookTriggerNode';
import { makeWorkflow, makeWorkflowNode, makeWorkflowEdge } from '@test-utils/factories';

describe('resolveWebhookTriggerNode — coverage gaps', () => {
  it('ignores incoming edge from orphaned Start node', () => {
    const webhook = makeWorkflowNode({ id: 'wh', type: 'webhook' });
    const start = makeWorkflowNode({ id: 'start', type: 'start' });
    const http = makeWorkflowNode({ id: 'http', type: 'http' });
    const wf = makeWorkflow({
      nodes: [start, webhook, http],
      edges: [
        makeWorkflowEdge({ source: 'start', target: 'wh' }),
        makeWorkflowEdge({ source: 'wh', target: 'http' }),
      ],
    });
    expect(resolveWebhookTriggerNode(wf)?.id).toBe('wh');
  });

  it('returns null when incoming edge source node is missing', () => {
    const webhook = makeWorkflowNode({ id: 'wh', type: 'webhook' });
    const http = makeWorkflowNode({ id: 'http', type: 'http' });
    const wf = makeWorkflow({
      nodes: [webhook, http],
      edges: [
        makeWorkflowEdge({ source: 'ghost', target: 'wh' }),
        makeWorkflowEdge({ source: 'wh', target: 'http' }),
      ],
    });
    expect(resolveWebhookTriggerNode(wf)?.id).toBe('wh');
  });
});
