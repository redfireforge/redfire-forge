/** Module-level constants for GraphqlStudioPage. */
import { getProxyBase } from './utils/graphqlProxyTransports';

/** Proxy base for batch + mock requests — evaluated once at module load time. */
export const GQL_STUDIO_PROXY_BASE = getProxyBase();
