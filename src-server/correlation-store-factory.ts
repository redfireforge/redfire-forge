/**
 * Correlation store factory.
 *
 * Reads CORRELATION_STORE_TYPE env variable and creates the appropriate store:
 *   - 'memory'   (default) — InMemoryServerStore
 *   - 'sqlite'              — SqliteServerStore (write-through, file-based)
 *   - 'postgres'            — PostgresServerStore (event-driven, production)
 *
 * Env variables:
 *   CORRELATION_STORE_TYPE  — 'memory' | 'sqlite' | 'postgres'
 *   CORRELATION_DB_PATH     — SQLite file path (default: ./data/correlations.db)
 *   DATABASE_URL            — PostgreSQL connection string
 */

import type { IServerCorrelationStore } from './correlation-store-interface.js';
import { InMemoryServerStore } from './correlation-store-memory.js';

export type StoreType = 'memory' | 'sqlite' | 'postgres';

/**
 * Create and initialize the appropriate correlation store.
 */
export async function createCorrelationStore(
  type?: StoreType,
): Promise<IServerCorrelationStore> {
  const storeType = type ?? (process.env.CORRELATION_STORE_TYPE as StoreType) ?? 'memory';

  let store: IServerCorrelationStore;

  switch (storeType) {
    case 'sqlite': {
      const { SqliteServerStore } = await import('./correlation-store-sqlite.js');
      const dbPath = process.env.CORRELATION_DB_PATH ?? './data/correlations.db';
      store = new SqliteServerStore(dbPath);
      break;
    }
    case 'postgres': {
      const { PostgresServerStore } = await import('./correlation-store-postgres.js');
      store = new PostgresServerStore();
      break;
    }
    case 'memory':
    default:
      store = new InMemoryServerStore();
      break;
  }

  await store.init();
  console.log(`[Correlation Store] Using "${storeType}" store`);
  return store;
}
