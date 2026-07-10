const WORKFLOW_PREVIEW_SAMPLE_KEY = 'workflow_preview_sample_id';

export function loadPreviewSampleId(): string | null {
  try {
    return sessionStorage.getItem(WORKFLOW_PREVIEW_SAMPLE_KEY) || null;
  } catch {
    return null;
  }
}

export function savePreviewSampleId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(WORKFLOW_PREVIEW_SAMPLE_KEY, id);
    } else {
      sessionStorage.removeItem(WORKFLOW_PREVIEW_SAMPLE_KEY);
    }
  } catch {
    /* sessionStorage may be unavailable */
  }
}

export function formatStorageDiagnostics(usage: { usedBytes: number; entries: Record<string, number> }): string {
  const sorted = Object.entries(usage.entries).sort(([, a], [, b]) => b - a);
  const lines = [
    '=== Storage Diagnostics ===',
    `Total: ${(usage.usedBytes / 1024).toFixed(0)} KB (~5 MB limit)`,
    '',
    '--- Top Keys ---',
  ];
  for (const [key, size] of sorted.slice(0, 20)) {
    lines.push(`  ${(size / 1024).toFixed(1)} KB — ${key}`);
  }
  return lines.join('\n');
}
