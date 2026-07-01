/**
 * Phase 6F — collision-safe gRPC workflow output namespace publisher.
 */
import type { VariableContext } from '../engine/variableContext';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';

export class GrpcWorkflowOutputNamespaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrpcWorkflowOutputNamespaceError';
  }
}

function setJson(ctx: VariableContext, key: string, value: unknown): void {
  ctx.set(key, JSON.stringify(value ?? null));
}

/** Tracks saveAs aliases and publishes canonical + compatibility gRPC workflow outputs. */
export class GrpcWorkflowOutputRegistry {
  private readonly aliasToNodeId = new Map<string, string>();

  /** Register a saveAs alias for runtime collision detection (belt over graph validation). */
  registerSaveAsAlias(saveAs: string, nodeId: string): void {
    const trimmed = saveAs.trim();
    if (!trimmed) return;
    const existing = this.aliasToNodeId.get(trimmed);
    if (existing && existing !== nodeId) {
      throw new GrpcWorkflowOutputNamespaceError(
        `saveAs alias "${trimmed}" is already bound to node "${existing}"`,
      );
    }
    this.aliasToNodeId.set(trimmed, nodeId);
  }

  getAliasOwner(saveAs: string): string | undefined {
    return this.aliasToNodeId.get(saveAs.trim());
  }

  /**
   * Publish successful call-node outputs into workflow variables.
   * Only updates compatibility aliases (`grpc.response.*`, `grpc.stream`) on success.
   */
  publishCallNodeOutput(
    ctx: VariableContext,
    snapshot: GrpcWorkflowExecuteSnapshot,
    result: GrpcWorkflowStepResult,
  ): void {
    if (result.status !== 'success') return;

    const nodeId = snapshot.nodeId;
    const statusText = String(result.grpcStatus ?? 0);

    if (snapshot.saveAs) {
      this.registerSaveAsAlias(snapshot.saveAs, nodeId);
    }

    const scopedPrefix = `steps.${nodeId}.grpc`;
    ctx.set(`${scopedPrefix}.status`, statusText);
    ctx.setForNode(nodeId, 'grpc.status', statusText);

    if (result.durationMs !== undefined) {
      ctx.set(`${scopedPrefix}.durationMs`, String(result.durationMs));
      ctx.setForNode(nodeId, 'grpc.durationMs', String(result.durationMs));
    }

    if (result.body !== undefined) {
      setJson(ctx, `${scopedPrefix}.body`, result.body);
      ctx.setForNode(nodeId, 'grpc.body', JSON.stringify(result.body));
    }

    if (result.messages !== undefined) {
      setJson(ctx, `${scopedPrefix}.messages`, result.messages);
      ctx.setForNode(nodeId, 'grpc.messages', JSON.stringify(result.messages));
      ctx.set('grpc.stream', JSON.stringify(result.messages));
    }

    if (result.trailers !== undefined) {
      setJson(ctx, `${scopedPrefix}.trailers`, result.trailers);
      ctx.setForNode(nodeId, 'grpc.trailers', JSON.stringify(result.trailers));
    }

    ctx.set('grpc.response.status', statusText);
    if (result.body !== undefined) {
      setJson(ctx, 'grpc.response.body', result.body);
    }

    if (snapshot.saveAs) {
      const alias = snapshot.saveAs.trim();
      ctx.set(`grpc.${alias}.status`, statusText);
      if (result.durationMs !== undefined) {
        ctx.set(`grpc.${alias}.durationMs`, String(result.durationMs));
      }
      if (result.body !== undefined) {
        setJson(ctx, `grpc.${alias}.body`, result.body);
      }
      if (result.messages !== undefined) {
        setJson(ctx, `grpc.${alias}.messages`, result.messages);
      }
      if (result.trailers !== undefined) {
        setJson(ctx, `grpc.${alias}.trailers`, result.trailers);
      }
    }
  }
}
