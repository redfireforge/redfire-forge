/**
 * Phase 6E/6F — frozen per-run gRPC step result store for assert evaluation.
 */
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';
import { GrpcWorkflowOutputNamespaceError } from './grpcWorkflowOutputRegistry';

function freezeStepResult(result: GrpcWorkflowStepResult): GrpcWorkflowStepResult {
  const frozen: GrpcWorkflowStepResult = {
    ...result,
    body: result.body ? { ...result.body } : undefined,
    messages: result.messages ? result.messages.map((m) => ({ ...m })) : undefined,
    trailers: result.trailers ? { ...result.trailers } : undefined,
    assertionFailures: result.assertionFailures ? [...result.assertionFailures] : undefined,
  };
  return Object.freeze(frozen) as GrpcWorkflowStepResult;
}

/** Immutable registry of committed gRPC call step results for the current workflow run. */
export class GrpcWorkflowStepResultStore {
  private readonly byNodeId = new Map<string, GrpcWorkflowStepResult>();
  private readonly aliasToNodeId = new Map<string, string>();

  /** Commit a step result (success or failure) and optional saveAs alias mapping. */
  commit(nodeId: string, saveAs: string | undefined, result: GrpcWorkflowStepResult): void {
    if (saveAs?.trim()) {
      const trimmed = saveAs.trim();
      const existing = this.aliasToNodeId.get(trimmed);
      if (existing && existing !== nodeId) {
        throw new GrpcWorkflowOutputNamespaceError(
          `saveAs alias "${trimmed}" is already bound to node "${existing}"`,
        );
      }
      this.aliasToNodeId.set(trimmed, nodeId);
    }
    this.byNodeId.set(nodeId, freezeStepResult({ ...result, nodeId }));
  }

  getByNodeId(nodeId: string): GrpcWorkflowStepResult | undefined {
    return this.byNodeId.get(nodeId);
  }

  /** Resolve assert `source` (node id or saveAs alias) to a frozen step result. */
  resolveSource(source: string): GrpcWorkflowStepResult | undefined {
    const trimmed = source.trim();
    if (!trimmed) return undefined;
    const nodeId = this.aliasToNodeId.get(trimmed) ?? (this.byNodeId.has(trimmed) ? trimmed : undefined);
    if (!nodeId) return undefined;
    return this.byNodeId.get(nodeId);
  }

  listNodeIds(): string[] {
    return [...this.byNodeId.keys()];
  }
}
