import { describe, it, expect } from 'vitest';
import { buildStudioEndpointPreviewState, computeStudioEndpointPreview } from './studioEndpointPreview';

describe('computeStudioEndpointPreview', () => {
  const map = {
    wsBaseUrl: 'wss://ws.example.com',
    sseUrl: 'https://events.example.com',
    graphqlUrl: 'https://api.example.com/graphql',
    baseUrl: 'https://api.example.com',
  };

  it('shows explicit preview for resolved websocket template (AC-EM Phase 4)', () => {
    const preview = computeStudioEndpointPreview('{{wsBaseUrl}}/ws', map, 'explicit');
    expect(preview.visible).toBe(true);
    expect(preview.resolvedUrl).toBe('wss://ws.example.com/ws');
    expect(preview.status).toBe('explicit');
    expect(preview.statusSymbol).toBe('✓');
  });

  it('shows fallback status when protocol endpoint uses HTTP derivation', () => {
    const preview = computeStudioEndpointPreview('{{sseUrl}}/events', map, 'fallback');
    expect(preview.resolvedUrl).toBe('https://events.example.com/events');
    expect(preview.status).toBe('fallback');
    expect(preview.statusSymbol).toBe('⚠');
  });

  it('shows unresolved when template keys are missing from env map', () => {
    const preview = computeStudioEndpointPreview('{{missing}}/path', map, 'fallback');
    expect(preview.status).toBe('unresolved');
    expect(preview.statusSymbol).toBe('✗');
  });

  it('hides preview for literal URLs without templates', () => {
    const preview = computeStudioEndpointPreview('https://api.example.com/ws', map, 'explicit');
    expect(preview.visible).toBe(false);
  });

  it('shows graphqlUrl template with explicit status', () => {
    const preview = computeStudioEndpointPreview('{{graphqlUrl}}', map, 'explicit');
    expect(preview.visible).toBe(true);
    expect(preview.resolvedUrl).toBe('https://api.example.com/graphql');
    expect(preview.statusSymbol).toBe('✓');
  });

  it('shows unresolved status when row status is unknown even if templates resolve', () => {
    const preview = computeStudioEndpointPreview('{{wsBaseUrl}}/ws', map, undefined);
    expect(preview.visible).toBe(true);
    expect(preview.resolvedUrl).toBe('wss://ws.example.com/ws');
    expect(preview.status).toBe('unresolved');
    expect(preview.statusSymbol).toBe('✗');
  });

  it('keeps unresolved status when row status is empty', () => {
    const preview = computeStudioEndpointPreview('{{wsBaseUrl}}/ws', map, 'empty');
    expect(preview.visible).toBe(true);
    expect(preview.status).toBe('unresolved');
    expect(preview.statusSymbol).toBe('✗');
  });

  it('keeps unresolved status when row status is unresolved', () => {
    const preview = computeStudioEndpointPreview('{{wsBaseUrl}}/ws', map, 'unresolved');
    expect(preview.visible).toBe(true);
    expect(preview.status).toBe('unresolved');
    expect(preview.statusSymbol).toBe('✗');
  });

  it('handles blank draft without showing preview', () => {
    const preview = computeStudioEndpointPreview('   ', map, 'explicit');
    expect(preview.resolvedUrl).toBe('');
    expect(preview.visible).toBe(false);
  });

  it('treats empty template resolution as unresolved', () => {
    const preview = computeStudioEndpointPreview('{{unknownVar}}', map, 'explicit');
    expect(preview.status).toBe('unresolved');
    expect(preview.resolvedUrl).toBe('{{unknownVar}}');
  });

  it('honors hasTemplates override for grammar-aware callers (Phase 9G)', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    const preview = buildStudioEndpointPreviewState(escaped, escaped, 'explicit', false, {
      hasTemplates: false,
    });
    expect(preview.visible).toBe(false);
  });
});
