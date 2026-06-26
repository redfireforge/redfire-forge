import { useCallback, useState } from 'react';

export const GQL_RV_DATA_ONLY_STORAGE_KEY = 'gql_rv_data_only_v1';

function readPersistedDataOnly(): boolean {
  try {
    const raw = localStorage.getItem(GQL_RV_DATA_ONLY_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch { /* silent */ }
  return false;
}

/** Persisted preference: hide `extensions` in response Body tab and Copy output. */
export function useGraphqlResponseDataOnly() {
  const [dataOnly, setDataOnlyState] = useState<boolean>(readPersistedDataOnly);

  const setDataOnly = useCallback((next: boolean) => {
    setDataOnlyState(next);
    try {
      localStorage.setItem(GQL_RV_DATA_ONLY_STORAGE_KEY, String(next));
    } catch { /* silent */ }
  }, []);

  return { dataOnly, setDataOnly };
}
