/**
 * GraphQL Test Server — Apollo Server 4 on port 4010
 *
 * Used by GraphQL Studio E2E tests (task 4F-11) and manual workflow scenarios.
 *
 * Endpoints:
 *   HTTP  http://localhost:4010/graphql
 *   WS    ws://localhost:4010/graphql  (graphql-transport-ws / graphql-ws)
 *   GET   http://localhost:4010/health → { status: "ok" }
 *
 * Features:
 *   - Schema: user CRUD, createOrder, orderStatus subscription
 *   - Apollo Tracing v1 in extensions.tracing
 *   - APQ (Automatic Persisted Queries) via Apollo persistedQueries cache
 *   - @faker-js/faker for generated user data
 */
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { InMemoryLRUCache } = require('@apollo/utils.keyvaluecache');
const { faker } = require('@faker-js/faker');

const PORT = parseInt(process.env.PORT || '4010', 10);

// ── In-memory stores ────────────────────────────────────────────────────────

/** @type {Map<string, { id: string; name: string; email: string }>} */
const users = new Map();

/** @type {Map<string, { id: string; customerId: string; status: string }>} */
const orders = new Map();

let userIdCounter = 0;
let orderIdCounter = 0;

// ── GraphQL SDL ─────────────────────────────────────────────────────────────

const typeDefs = /* GraphQL */ `
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

// ── Resolvers ─────────────────────────────────────────────────────────────────

const resolvers = {
  Query: {
    health: () => 'ok',
    user: (_root, { id }) => users.get(id) ?? null,
  },

  Mutation: {
    createOrder: (_root, { input }) => {
      const id = `ord-${++orderIdCounter}`;
      const order = {
        id,
        customerId: input.customerId,
        status: 'PENDING',
      };
      orders.set(id, order);
      return order;
    },

    createUser: (_root, { name, email }) => {
      const id = `usr-${++userIdCounter}`;
      const user = {
        id,
        name: name || faker.person.fullName(),
        email: email || faker.internet.email(),
      };
      users.set(id, user);
      return user;
    },

    deleteUser: (_root, { id }) => {
      const existed = users.delete(id);
      return { success: existed };
    },
  },

  Subscription: {
    orderStatus: {
      subscribe: async function* (_root, { orderId }) {
        // 2s between events (~6s total) — long enough to exercise Pause/Resume in GraphQL Studio.
        // Override for faster CI: ORDER_STATUS_STEP_MS=300 docker compose up -d
        const stepMs = Number(process.env.ORDER_STATUS_STEP_MS ?? 2000);
        const progression = ['PENDING', 'PROCESSING', 'COMPLETE'];
        for (const status of progression) {
          await new Promise((r) => setTimeout(r, stepMs));
          const order = orders.get(orderId);
          if (order) order.status = status;
          yield {
            orderStatus: {
              status,
              updatedAt: new Date().toISOString(),
            },
          };
        }
      },
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

// ── Apollo Tracing v1 plugin ──────────────────────────────────────────────────

function createTracingPlugin() {
  return {
    async requestDidStart() {
      const requestStart = process.hrtime.bigint();
      /** @type {Array<Record<string, unknown>>} */
      const resolverTraces = [];

      return {
        async executionDidStart() {
          return {
            willResolveField({ info }) {
              const fieldStart = process.hrtime.bigint();
              return () => {
                const fieldEnd = process.hrtime.bigint();
                resolverTraces.push({
                  path: [info.fieldName],
                  parentType: info.parentType.name,
                  fieldName: info.fieldName,
                  returnType: String(info.returnType),
                  startOffset: Number(fieldStart - requestStart),
                  duration: Number(fieldEnd - fieldStart),
                });
              };
            },
          };
        },

        async willSendResponse(ctx) {
          const requestEnd = process.hrtime.bigint();
          const { response } = ctx;
          if (response.body.kind !== 'single') return;

          response.body.singleResult.extensions = {
            ...(response.body.singleResult.extensions ?? {}),
            tracing: {
              version: 1,
              start: Date.now() * 1_000_000,
              end: Number(requestEnd),
              duration: Number(requestEnd - requestStart),
              execution: { resolvers: resolverTraces },
            },
          };
        },
      };
    },
  };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const wsCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    persistedQueries: {
      cache: new InMemoryLRUCache({ maxSize: 500 }),
    },
    plugins: [
      createTracingPlugin(),
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'graphql-test-server', port: PORT });
  });

  app.use(
    '/graphql',
    cors({ origin: true }),
    express.json({ limit: '2mb' }),
    expressMiddleware(server, {
      context: async () => ({}),
    }),
  );

  httpServer.listen(PORT, () => {
    console.log(`[GQL-TEST] Apollo Server listening on port ${PORT}`);
    console.log(`[GQL-TEST]   HTTP:    http://localhost:${PORT}/graphql`);
    console.log(`[GQL-TEST]   WS:      ws://localhost:${PORT}/graphql`);
    console.log(`[GQL-TEST]   Health:  http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error('[GQL-TEST] Failed to start:', err);
  process.exit(1);
});
