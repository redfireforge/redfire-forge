/**
 * Phase 9B — gRPC Studio target preview tests.
 */
import { describe, expect, it } from 'vitest';
import { computeGrpcStudioTargetPreview, resolveGrpcStudioEndpointPreviewDraft } from './grpcStudioTargetPreview';
import { computeStudioEndpointPreview } from '../utils/studioEndpointPreview';
import { resolveEnvVars } from '../../features/websocket/wsMessageUtils';

describe('computeGrpcStudioTargetPreview (Phase 9B)', () => {
  const env = { grpcHost: 'localhost:50051' };

  it('resolves canonical env tokens for header preview', () => {
    const preview = computeGrpcStudioTargetPreview('{{grpcHost}}', env, 'explicit');
    expect(preview.resolvedUrl).toBe('localhost:50051');
    expect(preview.status).toBe('explicit');
    expect(preview.visible).toBe(true);
  });

  it('preserves escaped literals unlike legacy WS preview resolver', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    const grpcPreview = computeGrpcStudioTargetPreview(escaped, env, 'explicit');
    const legacyPreview = computeStudioEndpointPreview(escaped, env, 'explicit');

    expect(grpcPreview.resolvedUrl).toBe(escaped);
    expect(grpcPreview.status).toBe('explicit');
    expect(grpcPreview.visible).toBe(false);
    expect(legacyPreview.resolvedUrl).toBe(resolveEnvVars(escaped, env));
    expect(legacyPreview.resolvedUrl).not.toBe(escaped);
  });

  it('marks invalid token syntax as unresolved', () => {
    const preview = computeGrpcStudioTargetPreview('{{9bad}}', env, 'explicit');
    expect(preview.status).toBe('unresolved');
    expect(preview.statusSymbol).toBe('✗');
  });

  it('shows resolved preview for profile template targets (pre-env draft)', () => {
    const preview = computeGrpcStudioTargetPreview('{{grpcHost}}', env, 'fallback');
    expect(preview.resolvedUrl).toBe('localhost:50051');
    expect(preview.visible).toBe(true);
    expect(preview.status).toBe('fallback');
  });

  it('marks missing env tokens as unresolved', () => {
    const preview = computeGrpcStudioTargetPreview('{{missingHost}}', env, 'explicit');
    expect(preview.resolvedUrl).toBe('{{missingHost}}');
    expect(preview.status).toBe('unresolved');
  });

  it('resolveGrpcStudioEndpointPreviewDraft follows tab → connection → grpcHost fallback', () => {
    expect(resolveGrpcStudioEndpointPreviewDraft('', '')).toBe('{{grpcHost}}');
    expect(resolveGrpcStudioEndpointPreviewDraft('', '{{grpcHost}}')).toBe('{{grpcHost}}');
    expect(resolveGrpcStudioEndpointPreviewDraft('localhost:50051', '{{grpcHost}}'))
      .toBe('localhost:50051');
  });
});
