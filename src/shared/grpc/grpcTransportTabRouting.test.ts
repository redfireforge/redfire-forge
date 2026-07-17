import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGrpcTabTransportRegistration,
  defaultGrpcStudioTransportMode,
  extractTabIdFromGrpcStreamPath,
  getGrpcTabTransportMode,
  resolveGrpcTransportForTab,
  resetGrpcTabTransportRoutingForTests,
  setGrpcTransportMode,
  isGrpcBrowserDirectTransportMode,
  isGrpcProxyTransportMode,
  shouldUseNativeGrpcTransportForTab,
  syncGrpcTabTransportMode,
} from './grpcTransportTabRouting';
import {
  bindGrpcStreamTransportForTab,
  clearGrpcStreamTransportBinding,
} from './grpcTransportFallback';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from '../utils/platform';

describe('grpcTransportTabRouting (Phase 7F)', () => {
  beforeEach(() => {
    resetGrpcTabTransportRoutingForTests();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('defaultGrpcStudioTransportMode is express on web', () => {
    expect(defaultGrpcStudioTransportMode()).toBe('express');
  });

  it('defaultGrpcStudioTransportMode is tauri on desktop', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    expect(defaultGrpcStudioTransportMode()).toBe('tauri');
  });

  it('resolveGrpcTransportForTab uses synced per-tab mode', () => {
    syncGrpcTabTransportMode('tab-a', 'express');
    vi.mocked(isTauri).mockReturnValue(true);
    expect(resolveGrpcTransportForTab('tab-a')).toBe('express');
    expect(resolveGrpcTransportForTab('tab-b')).toBe('tauri');
  });

  it('global override wins over per-tab mode', () => {
    syncGrpcTabTransportMode('tab-a', 'express');
    setGrpcTransportMode('tauri');
    expect(resolveGrpcTransportForTab('tab-a')).toBe('tauri');
  });

  it('clearGrpcTabTransportRegistration removes tab mode', () => {
    syncGrpcTabTransportMode('tab-a', 'express');
    clearGrpcTabTransportRegistration('tab-a');
    vi.mocked(isTauri).mockReturnValue(true);
    expect(resolveGrpcTransportForTab('tab-a')).toBe('tauri');
  });

  it('extractTabIdFromGrpcStreamPath reads tabId query param', () => {
    expect(extractTabIdFromGrpcStreamPath('/api/grpc/stream/s1/events?tabId=tab-1&lastSequence=0'))
      .toBe('tab-1');
    expect(extractTabIdFromGrpcStreamPath('/api/grpc/stream/s1/events')).toBeUndefined();
  });

  it('shouldUseNativeGrpcTransportForTab reflects resolved mode', () => {
    syncGrpcTabTransportMode('tab-native', 'tauri');
    expect(shouldUseNativeGrpcTransportForTab('tab-native')).toBe(true);
    expect(getGrpcTabTransportMode('tab-native')).toBe('tauri');
  });

  it('resolveGrpcTransportForTab locks to stream binding after stream_start', () => {
    syncGrpcTabTransportMode('tab-stream', 'tauri');
    bindGrpcStreamTransportForTab('tab-stream', 'tauri');
    syncGrpcTabTransportMode('tab-stream', 'express');
    expect(resolveGrpcTransportForTab('tab-stream')).toBe('tauri');
    clearGrpcStreamTransportBinding('tab-stream');
    expect(resolveGrpcTransportForTab('tab-stream')).toBe('express');
  });

  it('isGrpcProxyTransportMode identifies express only (Phase 10A)', () => {
    expect(isGrpcProxyTransportMode('express')).toBe(true);
    expect(isGrpcProxyTransportMode('tauri')).toBe(false);
    expect(isGrpcProxyTransportMode('grpc-web')).toBe(false);
  });

  it('isGrpcBrowserDirectTransportMode identifies grpc-web and spring-servlet (Phase 10A)', () => {
    expect(isGrpcBrowserDirectTransportMode('grpc-web')).toBe(true);
    expect(isGrpcBrowserDirectTransportMode('spring-servlet')).toBe(true);
    expect(isGrpcBrowserDirectTransportMode('express')).toBe(false);
  });
});
