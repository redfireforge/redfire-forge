import { useEffect, useState } from 'react';
import { isTauri } from '../../shared/utils/platform';

export interface UpdateInfo {
  version: string;
  body: string | null;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'error';

export interface AppUpdaterState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  errorMessage: string | null;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

export function useAppUpdater(): AppUpdaterState {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    const CHECK_DELAY_MS = 3000;
    const timer = setTimeout(() => checkForUpdate(), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  async function checkForUpdate() {
    try {
      setStatus('checking');
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        setUpdateInfo({ version: update.version, body: update.body ?? null });
        setStatus('available');
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('idle');
    }
  }

  async function installUpdate() {
    if (!updateInfo) return;
    try {
      setStatus('downloading');
      setDownloadProgress(0);

      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      if (!update?.available) return;

      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setDownloadProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === 'Finished') {
          setDownloadProgress(100);
        }
      });

      await relaunch();
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function dismissUpdate() {
    setStatus('idle');
    setUpdateInfo(null);
  }

  return { status, updateInfo, downloadProgress, errorMessage, installUpdate, dismissUpdate };
}
