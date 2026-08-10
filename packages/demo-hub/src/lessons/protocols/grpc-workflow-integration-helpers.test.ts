/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WF } from '@shared/selectors';
import * as adapters from '../../adapters';
import { makeCtx } from './ws-test-utils';
import {
  WF14_NODE_GRPC,
  WF14_PALETTE_SCRATCH_NAME,
  clearPaletteScratchQuiet,
  isUnaryNodeOnCanvas,
  resolveWf14UnaryNodeId,
} from './grpc-workflow-integration-helpers';

describe('grpc-workflow-integration-helpers unary resolve', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers the preset Echo Call id when present', () => {
    document.body.innerHTML = `
      <div class="react-flow__node react-flow__node-grpcUnary" data-id="${WF14_NODE_GRPC}">
        <div data-testid="grpc-canvas-unary-node"></div>
      </div>
    `;
    expect(isUnaryNodeOnCanvas()).toBe(true);
    expect(resolveWf14UnaryNodeId()).toBe(WF14_NODE_GRPC);
  });

  it('adopts a palette-generated unary node id', () => {
    document.body.innerHTML = `
      <div class="react-flow__node react-flow__node-grpcUnary" data-id="uuid-echo-1">
        <div data-testid="grpc-canvas-unary-node"></div>
      </div>
    `;
    expect(isUnaryNodeOnCanvas()).toBe(true);
    expect(resolveWf14UnaryNodeId()).toBe('uuid-echo-1');
    expect(document.querySelector(WF.NODE_GRPC_UNARY)).toBeTruthy();
  });
});

describe('grpc-workflow-integration-helpers palette scratch cleanup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clearPaletteScratchQuiet deletes scratch when present', async () => {
    const ctx = makeCtx();
    vi.spyOn(adapters, 'getWorkflowByName').mockImplementation((name) =>
      name === WF14_PALETTE_SCRATCH_NAME ? { name: WF14_PALETTE_SCRATCH_NAME } : null,
    );
    const deleteSpy = vi.spyOn(adapters, 'deleteWorkflowByName').mockReturnValue(true);

    await clearPaletteScratchQuiet(ctx);

    expect(deleteSpy).toHaveBeenCalledWith(WF14_PALETTE_SCRATCH_NAME);
    expect(ctx.delay).toHaveBeenCalledWith(80);
  });
});
