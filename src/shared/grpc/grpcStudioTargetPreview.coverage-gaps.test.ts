/**
 * Coverage gaps — grpcStudioTargetPreview.ts (Phase 9B).
 */
import { describe, expect, it } from 'vitest';
import { computeGrpcStudioTargetPreview } from './grpcStudioTargetPreview';

describe('grpcStudioTargetPreview coverage gaps', () => {
  it('returns hidden preview for empty or whitespace-only draft targets', () => {
    for (const draft of ['', '   ', '\n\t']) {
      const preview = computeGrpcStudioTargetPreview(draft, { grpcHost: 'localhost:50051' });
      expect(preview.resolvedUrl).toBe('');
      expect(preview.visible).toBe(false);
      expect(preview.status).toBe('unresolved');
    }
  });

  it('hides preview for plain targets without template tokens', () => {
    const preview = computeGrpcStudioTargetPreview('localhost:50051', {}, 'explicit');
    expect(preview.resolvedUrl).toBe('localhost:50051');
    expect(preview.visible).toBe(false);
    expect(preview.status).toBe('explicit');
  });

  it('marks unresolved when templates resolve to an empty target string', () => {
    const preview = computeGrpcStudioTargetPreview('{{grpcHost}}', { grpcHost: '' }, 'explicit');
    expect(preview.resolvedUrl).toBe('{{grpcHost}}');
    expect(preview.status).toBe('unresolved');
    expect(preview.statusSymbol).toBe('✗');
  });

  it('shows preview when resolved target differs from trimmed draft', () => {
    const preview = computeGrpcStudioTargetPreview(
      '  {{grpcHost}}  ',
      { grpcHost: 'resolved:50051' },
      'fallback',
    );
    expect(preview.resolvedUrl).toBe('resolved:50051');
    expect(preview.visible).toBe(true);
    expect(preview.status).toBe('fallback');
  });
});
