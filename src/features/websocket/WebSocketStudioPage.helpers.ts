import type { WsConnectionTabInfo } from './WsConnectionTabBar';
import { peekDemoInitialSurface } from '@shared/demoInitialSurface';
import type { WsStudioLocation } from '@shared/websocket/types';

export const MAX_TABS = 8;
export const MOCK_PORT_BASE = 9876;

export const isAutoMockPort = (port: number): boolean =>
  port >= MOCK_PORT_BASE && port < MOCK_PORT_BASE + MAX_TABS;

export const LOCALHOST_WS_URL_RE = /^ws:\/\/localhost:\d+(\/.*)?$/i;

let nextTabSeq = 1;

export function generateTabId(): string {
  return `ws-tab-${nextTabSeq++}`;
}

export function advanceSeqPastRestoredIds(tabs: WsConnectionTabInfo[]): void {
  for (const tab of tabs) {
    const match = tab.id.match(/^ws-tab-(\d+)$/);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (num >= nextTabSeq) nextTabSeq = num + 1;
  }
}

export function deriveTabLabel(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length < 6) return null;
  if (!/^wss?:\/\/.{2,}/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    if (!host || host.length < 2) return null;
    return parsed.port ? `${host}:${parsed.port}` : host;
  } catch {
    const match = trimmed.match(/wss?:\/\/([^/:\s]{2,})(?::(\d+))?/);
    if (match) {
      return match[2] ? `${match[1]}:${match[2]}` : match[1];
    }
    return null;
  }
}

/** Apply armed demo landing mode onto studio locations (non-destructive peek). */
export function applyDemoWsStudioMode(
  locs: Record<string, WsStudioLocation>,
): Record<string, WsStudioLocation> {
  const mode = peekDemoInitialSurface()?.wsStudioMode;
  if (!mode) return locs;
  const next: Record<string, WsStudioLocation> = {};
  for (const [id, loc] of Object.entries(locs)) {
    next[id] = { ...loc, mode };
  }
  return next;
}

/** Finds the lowest port >= base not already in `used`. */
export function nextFreePort(used: Set<number>, base = MOCK_PORT_BASE): number {
  let p = base;
  while (used.has(p)) p++;
  return p;
}

/**
 * Prune ghost port entries, optionally pin a sole survivor to base, then compute
 * the next available port for a new tab.
 */
export function preparePortsForNewTab(
  currentPorts: Record<string, number>,
  liveTabIds: string[],
): {
  ports: Record<string, number>;
  nextPort: number;
  remappedSoleTabId: string | null;
} {
  const live = new Set(liveTabIds);
  const ports: Record<string, number> = {};
  for (const [id, port] of Object.entries(currentPorts)) {
    if (live.has(id)) ports[id] = port;
  }
  let remappedSoleTabId: string | null = null;
  if (liveTabIds.length === 1) {
    const soleId = liveTabIds[0];
    const current = ports[soleId];
    if (current === undefined) {
      ports[soleId] = MOCK_PORT_BASE;
    } else if (current !== MOCK_PORT_BASE && isAutoMockPort(current)) {
      ports[soleId] = MOCK_PORT_BASE;
      remappedSoleTabId = soleId;
    }
  }
  const nextPort = nextFreePort(new Set(Object.values(ports)));
  return { ports, nextPort, remappedSoleTabId };
}
