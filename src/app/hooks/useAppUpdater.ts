import { useEffect, useState } from 'react';
import { isTauri, isLocalhost } from '@shared/utils/platform';
import { fetchLatestRelease, getCurrentVersion, isNewerVersion } from '@shared/utils/latestRelease';

export interface UpdateInfo {
  version: string;
  body: string | null;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'error';
export type UpdateMode = 'tauri' | 'localhost';

export interface AppUpdaterState {
  status: UpdateStatus;
  mode: UpdateMode;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  errorMessage: string | null;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

function dismissKey(version: string) {
  return `rff-update-dismissed-v${version}`;
}

export function useAppUpdater(): AppUpdaterState {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [mode, setMode] = useState<UpdateMode>('tauri');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const CHECK_DELAY_MS = 3000;

    if (isTauri()) {
      const timer = setTimeout(() => checkTauriUpdate(), CHECK_DELAY_MS);
      return () => clearTimeout(timer);
    }

    if (isLocalhost()) {
      setMode('localhost');
      const timer = setTimeout(() => checkLocalhostUpdate(), CHECK_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, []);

  async function checkTauriUpdate() {
    try {
      setStatus('checking');
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        const info = { version: update.version, body: update.body ?? null };
        if (localStorage.getItem(dismissKey(info.version))) {
          setStatus('idle');
          return;
        }
        setUpdateInfo(info);
        setStatus('available');
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('idle');
    }
  }

  async function checkLocalhostUpdate() {
    try {
      setStatus('checking');
      const release = await fetchLatestRelease();
      if (release && isNewerVersion(getCurrentVersion(), release.version)) {
        if (localStorage.getItem(dismissKey(release.version))) {
          setStatus('idle');
          return;
        }
        setUpdateInfo({ version: release.version, body: release.body || null });
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
    if (updateInfo) {
      try {
        localStorage.setItem(dismissKey(updateInfo.version), '1');
      } catch {
        // localStorage unavailable — ignore
      }
    }
    setStatus('idle');
    setUpdateInfo(null);
  }

  return { status, mode, updateInfo, downloadProgress, errorMessage, installUpdate, dismissUpdate };
}
