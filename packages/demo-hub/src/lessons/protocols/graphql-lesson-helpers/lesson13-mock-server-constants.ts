// Lesson 13 mock server — shared constants
import { GQL } from '@shared/selectors';

/** Desktop mock endpoint proxied by the Tauri app. */
export const GQL_MOCK_HTTP = 'http://localhost:3001/api/graphql/mock';
/** Playwright E2E configures mock via the Vite `/api` proxy (not absolute :3001). */
export const GQL13_E2E_MOCK_CONFIG_URL = '/api/graphql/mock/config';
/** Fixed resolver value used in the lesson so restore-vs-live is obvious. */
export const LESSON13_HEALTH_OVERRIDE = 'mock-ok';
/** Spotlight targets on the Query.health resolver row (set during lesson actions). */
export const LESSON13_MOCK_HEALTH_ROW = GQL.LESSON13_MOCK_HEALTH_ROW;
export const LESSON13_MOCK_HEALTH_RESOLVER = `${LESSON13_MOCK_HEALTH_ROW} ${GQL.MOCK_RESOLVER_SELECT}`;
export const LESSON13_MOCK_HEALTH_FIXED = `${LESSON13_MOCK_HEALTH_ROW} ${GQL.MOCK_FIXED_INPUT}`;
/** Docker test-server SDL — matches docker/graphql/server.js (used by Playwright E2E). */
export const LESSON13_E2E_DOCKER_SDL = `
  type Query {
    health: String
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    email: String!
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
