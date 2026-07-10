/**
 * Phase 10G acceptance tests — transport selector UX, persistence, and guardrails.
 *
 * Pure logic tests (no jsdom/rendering):
 *  - canChangeGrpcTabTransportMode: in-flight and idle tab states
 *  - resolveGrpcStudioTabTransportMode: tab isolation
 *  - isGrpcTransportCallTypeSupported: call-type/mode parity matrix
 *  - assertGrpcTransportExecutePreflight: execute-time guard when selection is stale
 *  - Source-scan: panel, drawer, hook, and page contain expected identifiers
 */
import { describe, expect, it, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pkg from '../../../package.json';
import {
  canChangeGrpcTabTransportMode,
  resolveGrpcStudioTabTransportMode,
  createGrpcStudioTab,
} from '../../features/grpc/grpcStudioTypes';
import {
  assertGrpcTransportExecutePreflight,
  GrpcWebTransportPreflightError,
  isGrpcTransportCallTypeSupported,
} from './grpcWebTransportContracts';
import {
  bindGrpcStreamTransportForTab,
  resetGrpcStreamTransportBindingsForTests,
} from './grpcTransportFallback';

const root = fileURLToPath(new URL('../..', import.meta.url));

// ── canChangeGrpcTabTransportMode — in-flight / idle guards ─────────────────

describe('Phase 10G — canChangeGrpcTabTransportMode', () => {
  afterEach(() => {
    resetGrpcStreamTransportBindingsForTests();
  });

  it('returns true for an idle tab', () => {
    const tab = createGrpcStudioTab();
    expect(canChangeGrpcTabTransportMode(tab)).toBe(true);
  });

  it('returns false when lifecycle is connecting (unary in-flight)', () => {
    const tab = { ...createGrpcStudioTab(), lifecycle: 'connecting' as const };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when lifecycle is calling (unary in-flight)', () => {
    const tab = { ...createGrpcStudioTab(), lifecycle: 'calling' as const };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when activeRequestId is set', () => {
    const tab = { ...createGrpcStudioTab(), activeRequestId: 'req-123' };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when streamLifecycle is streaming', () => {
    const tab = { ...createGrpcStudioTab(), streamLifecycle: 'streaming' as const };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when streamLifecycle is starting', () => {
    const tab = { ...createGrpcStudioTab(), streamLifecycle: 'starting' as const };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when streamLifecycle is ending', () => {
    const tab = { ...createGrpcStudioTab(), streamLifecycle: 'ending' as const };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when stream transport binding is active for tab', () => {
    const tab = createGrpcStudioTab();
    bindGrpcStreamTransportForTab(tab.id, 'express');
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when activeStreamId is set', () => {
    const tab = { ...createGrpcStudioTab(), activeStreamId: 'stream-456' };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns true for a tab that just completed (success lifecycle)', () => {
    const tab = { ...createGrpcStudioTab(), lifecycle: 'success' as const };
    expect(canChangeGrpcTabTransportMode(tab)).toBe(true);
  });
});

// ── resolveGrpcStudioTabTransportMode — tab isolation ───────────────────────

describe('Phase 10G — tab isolation: resolveGrpcStudioTabTransportMode', () => {
  it('two tabs can have different transport modes independently', () => {
    const tabA = { ...createGrpcStudioTab(), transportMode: 'grpc-web' as const };
    const tabB = { ...createGrpcStudioTab(), transportMode: 'spring-servlet' as const };
    expect(resolveGrpcStudioTabTransportMode(tabA)).toBe('grpc-web');
    expect(resolveGrpcStudioTabTransportMode(tabB)).toBe('spring-servlet');
  });

  it('changing one tab mode does not affect another (independent objects)', () => {
    const tabA = { ...createGrpcStudioTab(), transportMode: 'express' as const };
    const tabB = { ...createGrpcStudioTab(), transportMode: 'express' as const };
    const updatedTabA = { ...tabA, transportMode: 'grpc-web' as const };
    expect(resolveGrpcStudioTabTransportMode(updatedTabA)).toBe('grpc-web');
    expect(resolveGrpcStudioTabTransportMode(tabB)).toBe('express');
  });
});

// ── isGrpcTransportCallTypeSupported — parity matrix ────────────────────────

describe('Phase 10G — isGrpcTransportCallTypeSupported parity matrix', () => {
  it('client_streaming: blocked on grpc-web', () => {
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'client_streaming')).toBe(false);
  });

  it('client_streaming: blocked on spring-servlet', () => {
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'client_streaming')).toBe(false);
  });

  it('client_streaming: allowed on express', () => {
    expect(isGrpcTransportCallTypeSupported('express', 'client_streaming')).toBe(true);
  });

  it('client_streaming: allowed on tauri', () => {
    expect(isGrpcTransportCallTypeSupported('tauri', 'client_streaming')).toBe(true);
  });

  it('bidi_streaming: blocked on grpc-web', () => {
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'bidi_streaming')).toBe(false);
  });

  it('bidi_streaming: blocked on spring-servlet', () => {
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'bidi_streaming')).toBe(false);
  });

  it('bidi_streaming: allowed on express', () => {
    expect(isGrpcTransportCallTypeSupported('express', 'bidi_streaming')).toBe(true);
  });

  it('bidi_streaming: allowed on tauri', () => {
    expect(isGrpcTransportCallTypeSupported('tauri', 'bidi_streaming')).toBe(true);
  });

  it('server_streaming: allowed on grpc-web', () => {
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'server_streaming')).toBe(true);
  });

  it('server_streaming: allowed on spring-servlet', () => {
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'server_streaming')).toBe(true);
  });

  it('server_streaming: allowed on express', () => {
    expect(isGrpcTransportCallTypeSupported('express', 'server_streaming')).toBe(true);
  });

  it('server_streaming: allowed on tauri', () => {
    expect(isGrpcTransportCallTypeSupported('tauri', 'server_streaming')).toBe(true);
  });

  it('unary: allowed on all four modes', () => {
    for (const mode of ['express', 'tauri', 'grpc-web', 'spring-servlet'] as const) {
      expect(isGrpcTransportCallTypeSupported(mode, 'unary')).toBe(true);
    }
  });
});

// ── Execute preflight — stale transport selection guard ─────────────────────

describe('Phase 10G — assertGrpcTransportExecutePreflight', () => {
  it('rejects client_streaming on grpc-web at execute time', () => {
    expect(() => assertGrpcTransportExecutePreflight({
      transportMode: 'grpc-web',
      callType: 'client_streaming',
    })).toThrow(GrpcWebTransportPreflightError);
  });

  it('rejects bidi_streaming on spring-servlet at execute time', () => {
    expect(() => assertGrpcTransportExecutePreflight({
      transportMode: 'spring-servlet',
      callType: 'bidi_streaming',
    })).toThrow(GrpcWebTransportPreflightError);
  });

  it('allows server_streaming on grpc-web at execute time', () => {
    expect(() => assertGrpcTransportExecutePreflight({
      transportMode: 'grpc-web',
      callType: 'server_streaming',
    })).not.toThrow();
  });
});

// ── Source-scan: panel and drawer contain Phase 10G identifiers ──────────────

describe('Phase 10G — source-scan deliverables', () => {
  it('GrpcTransportPanel.tsx contains isGrpcTransportCallTypeSupported', async () => {
    const source = await readFile(
      `${root}/features/grpc/components/GrpcTransportPanel.tsx`,
      'utf8',
    );
    expect(source).toContain('isGrpcTransportCallTypeSupported');
  });

  it('GrpcTransportPanel.tsx contains callType prop', async () => {
    const source = await readFile(
      `${root}/features/grpc/components/GrpcTransportPanel.tsx`,
      'utf8',
    );
    expect(source).toContain('callType');
  });

  it('GrpcTransportPanel.tsx contains getModeDisabledReason', async () => {
    const source = await readFile(
      `${root}/features/grpc/components/GrpcTransportPanel.tsx`,
      'utf8',
    );
    expect(source).toContain('getModeDisabledReason');
  });

  it('GrpcTransportPanel.tsx renders grpc-transport-mode-reason spans', async () => {
    const source = await readFile(
      `${root}/features/grpc/components/GrpcTransportPanel.tsx`,
      'utf8',
    );
    expect(source).toContain('grpc-transport-mode-reason');
  });

  it('GrpcConnectionSettingsDrawer.tsx contains callType prop', async () => {
    const source = await readFile(
      `${root}/features/grpc/components/GrpcConnectionSettingsDrawer.tsx`,
      'utf8',
    );
    expect(source).toContain('callType');
  });

  it('GrpcStudioPage.tsx passes callType to the drawer', async () => {
    const source = await readFile(
      `${root}/features/grpc/grpcStudioPage/GrpcStudioPageOverlays.tsx`,
      'utf8',
    );
    expect(source).toContain('callType={tabCallTypes[activeTab.id]}');
  });

  it('useGrpcStudio.ts guards setTabTransportMode with canChangeGrpcTabTransportMode', async () => {
    const source = await readFile(
      `${root}/features/grpc/hooks/useGrpcStudio.ts`,
      'utf8',
    );
    expect(source).toContain('canChangeGrpcTabTransportMode');
    expect(source).toMatch(/if \(!tab \|\| !canChangeGrpcTabTransportMode\(tab\)\)/);
  });

  it('prepareExecuteSnapshot applies assertGrpcTransportExecutePreflight (unary + stream)', async () => {
    const source = await readFile(
      `${root}/features/grpc/hooks/grpcStudioUnaryCommands.ts`,
      'utf8',
    );
    expect(source).toContain('assertGrpcTransportExecutePreflight');
    expect(source).toMatch(/assertGrpcTransportExecutePreflight\(\{[\s\S]*transportMode,[\s\S]*callType/);
  });

  it('GrpcStudioPage.tsx locks transport while in-flight via canChangeGrpcTabTransportMode', async () => {
    const source = await readFile(
      `${root}/features/grpc/grpcStudioPage/GrpcStudioPageOverlays.tsx`,
      'utf8',
    );
    expect(source).toContain('transportChangeBlocked={!canChangeGrpcTabTransportMode(activeTab)}');
  });

  it('GrpcConnectionSettingsDrawer forwards callType to GrpcTransportPanel', async () => {
    const source = await readFile(
      `${root}/features/grpc/components/GrpcConnectionSettingsDrawer.tsx`,
      'utf8',
    );
    expect(source).toMatch(/callType=\{callType\}/);
  });
});

describe('Phase 10G acceptance checklist', () => {
  it('package.json exposes test:grpc:phase10g', () => {
    expect(pkg.scripts?.['test:grpc:phase10g']).toContain('test-grpc-phase10g.sh');
  });
});
