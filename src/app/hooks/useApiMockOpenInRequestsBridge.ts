import { useEffect } from 'react';
import {
  API_MOCK_OPEN_IN_REQUESTS_EVENT,
  type ApiMockOpenInRequestsDetail,
} from '../../features/api-mock/apiMockJournalActions';
import type { RequestCollection, RequestItem } from '../../shared/types';

interface RequestsBridge {
  collections: RequestCollection[];
  addCollection: (input: Omit<RequestCollection, 'id' | 'requests'>) => string;
  addRequest: (collectionId: string, folderId?: string, name?: string) => string;
  updateRequest: (collectionId: string, requestId: string, patch: Partial<RequestItem>) => void;
}

interface RequestTabsBridge {
  selectRequest: (collectionId: string, requestId: string) => void;
}

/** Routes API Mock journal "open in requests" events into the Requests workspace. */
export function useApiMockOpenInRequestsBridge(
  wb: RequestsBridge,
  reqTabs: RequestTabsBridge,
  setActiveTab: (tab: 'requests') => void,
): void {
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ApiMockOpenInRequestsDetail>).detail;
      if (!detail) return;
      const colName = 'API Mock Journal';
      const existing = wb.collections.find(c => c.name === colName);
      const colId = existing
        ? existing.id
        : wb.addCollection({ name: colName, mode: 'direct' });
      const reqId = wb.addRequest(colId, undefined, detail.name);
      wb.updateRequest(colId, reqId, {
        name: detail.name,
        method: detail.method,
        url: detail.url,
        headers: detail.headers,
        body: detail.body,
        bodyType: detail.body ? 'json' : 'none',
        auth: { type: 'none' },
      });
      reqTabs.selectRequest(colId, reqId);
      setActiveTab('requests');
    };
    window.addEventListener(API_MOCK_OPEN_IN_REQUESTS_EVENT, onOpen);
    return () => window.removeEventListener(API_MOCK_OPEN_IN_REQUESTS_EVENT, onOpen);
  }, [wb, reqTabs, setActiveTab]);
}
