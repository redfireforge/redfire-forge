import type { Page } from '@playwright/test';
import { REDFIREFORGE_IDB_VERSION } from '../helpers';

/** Normalized connection id — Studio maps localhost → 127.0.0.1 for snapshot keys. */
const GQL12_SCHEMA_CONN_ID = 'http://127.0.0.1:4010/graphql';
const GQL12_BASELINE_LABEL = 'Prior release (demo)';

/** Older SDL variant seeded for GQL-12 diff (matches lesson12-schema-diff helper). */
const GQL12_BASELINE_SDL = `
type Query {
  health: String
  user(id: ID!): User
  users: [User!]!
}

type User {
  id: ID!
  name: String!
}

input OrderInput {
  customerId: ID!
  items: [String!]
}

type Order {
  id: ID!
  status: OrderStatusEnum!
  customerId: ID!
}

enum OrderStatusEnum {
  PENDING
  PROCESSING
  COMPLETE
}

type OrderStatus {
  status: OrderStatusEnum!
  updatedAt: String!
}

type Mutation {
  createOrder(input: OrderInput!): Order!
  createUser(name: String!, email: String!): User!
  deleteUser(id: ID!): DeleteResult!
}

type DeleteResult {
  success: Boolean!
}

type Subscription {
  orderStatus(orderId: ID!): OrderStatus!
}
`;

/** Seed baseline snapshot on normalized endpoint (lesson setup uses localhost — invisible in UI). */
export async function seedGql12BaselineSnapshotForE2e(page: Page): Promise<void> {
  const snapshot = {
    id: `e2e-gql12-baseline-${Date.now()}`,
    connectionId: GQL12_SCHEMA_CONN_ID,
    sdl: GQL12_BASELINE_SDL,
    typesCount: 10,
    capturedAt: Date.now() - 7 * 86_400_000,
    label: GQL12_BASELINE_LABEL,
  };
  await page.evaluate(
    ({ snap, dbName, dbVersion }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('graphql-schema-snapshots')) {
            const store = db.createObjectStore('graphql-schema-snapshots', { keyPath: 'id' });
            store.createIndex('connectionId', 'connectionId', { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('graphql-schema-snapshots', 'readwrite');
          tx.objectStore('graphql-schema-snapshots').put(snap);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { snap: snapshot, dbName: 'redfireforge', dbVersion: REDFIREFORGE_IDB_VERSION },
  );
}
