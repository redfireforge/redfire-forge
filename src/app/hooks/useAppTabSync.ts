import { useEffect } from 'react';
import type { GalleryDomain } from '../../data/galleries/types';
import {
  LAST_PROTOCOLS_TAB_STORAGE_KEY,
  isProtocolsTab,
  setLastProtocolsTab,
  type Tab,
  writeTabToUrl,
} from '../utils/appTabUtils';
import { writeKey } from '../../shared/utils/storage';

/** Syncs tab side effects (URL, protocol memory, gallery reset, catalog modal reset). */
export function useAppTabSync(
  activeTab: Tab,
  setExportToMockItems: (items: null) => void,
  setGalleryInitialDomain: (domain: GalleryDomain | undefined) => void,
): void {
  useEffect(() => {
    if (activeTab !== 'catalog') setExportToMockItems(null);
  }, [activeTab, setExportToMockItems]);

  useEffect(() => {
    writeTabToUrl(activeTab);
    if (activeTab !== 'gallery') setGalleryInitialDomain(undefined);
    if (isProtocolsTab(activeTab)) {
      setLastProtocolsTab(activeTab);
      void writeKey(LAST_PROTOCOLS_TAB_STORAGE_KEY, activeTab).catch(() => { /* silent */ });
    }
  }, [activeTab, setGalleryInitialDomain]);
}
