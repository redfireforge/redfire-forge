interface ServerOpt { id: string; name?: string; port?: number }

/** Heal a blank or remapped-stale id so the picker does not stick on “No Studio servers”. */
export function pickHealedMockServerId(
  servers: ServerOpt[],
  value: string | undefined,
  activeId?: string,
): string | undefined {
  if (servers.length === 0) return undefined;
  if (value && servers.some(s => s.id === value)) return undefined;
  if (value) {
    if (activeId && servers.some(s => s.id === activeId)) return activeId;
    return servers[0]?.id;
  }
  return undefined;
}
