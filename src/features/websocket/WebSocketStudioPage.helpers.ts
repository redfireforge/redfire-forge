import type { WsConnectionTabInfo } from './WsConnectionTabBar';

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
