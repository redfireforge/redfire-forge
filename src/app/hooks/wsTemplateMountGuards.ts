import type { WsMessageTemplate } from '@shared/websocket/types';

export function formatStorageError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function applyLoadedTemplates(
  mounted: boolean,
  loaded: WsMessageTemplate[],
  setTemplates: (next: WsMessageTemplate[]) => void,
  setLoading: (loading: boolean) => void,
): void {
  if (!mounted) return;
  setTemplates(loaded);
  setLoading(false);
}

export function applyLoadError(
  mounted: boolean,
  err: unknown,
  setError: (message: string) => void,
  setLoading: (loading: boolean) => void,
): void {
  if (!mounted) return;
  setError(formatStorageError(err));
  setLoading(false);
}

export function clearErrorIfMounted(mounted: boolean, setError: (message: string | null) => void): void {
  if (!mounted) return;
  setError(null);
}

export function applyPersistError(
  mounted: boolean,
  err: unknown,
  setError: (message: string) => void,
): void {
  if (!mounted) return;
  setError(formatStorageError(err));
}
