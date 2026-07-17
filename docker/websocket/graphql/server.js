/**
 * GraphQL-WS Subscription Server
 *
 * - Supports `graphql-transport-ws` subprotocol
 * - Schema:
 *   - Query { hello: String }
 *   - Subscription { messageAdded: Message }
 *   - Subscription { countdown(from: Int!): Int }
 * - HTTP POST /publish { text: "..." } → injects into messageAdded subscription
 * - HTTP GET /health → { status: "ok" }
 *
 * Used by WebSocket Studio E2E tests (ws-protocols-graphql.spec.ts).
 */
const http = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLID,
} = require('graphql');

const PORT = parseInt(process.env.PORT || '4100', 10);

// ── Simple PubSub ──────────────────────────────────────
const subscribers = new Set();

function publish(message) {
  for (const cb of subscribers) {
    cb(message);
  }
}

function subscribe() {
  const queue = [];
  let resolve = null;

  const pushValue = (val) => {
    if (resolve) {
      resolve({ value: { messageAdded: val }, done: false });
      resolve = null;
    } else {
      queue.push(val);
    }
  };

  subscribers.add(pushValue);

  return {
    [Symbol.asyncIterator]() { return this; },
    next() {
      if (queue.length > 0) {
        return Promise.resolve({ value: { messageAdded: queue.shift() }, done: false });
      }
      return new Promise((r) => { resolve = r; });
    },
    return() {
      subscribers.delete(pushValue);
      return Promise.resolve({ value: undefined, done: true });
    },
  };
}

// ── Auto-incrementing message ID ───────────────────────
let messageIdCounter = 0;

// ── GraphQL Schema ─────────────────────────────────────
const MessageType = new GraphQLObjectType({
  name: 'Message',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    text: { type: new GraphQLNonNull(GraphQLString) },
    timestamp: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      hello: {
        type: GraphQLString,
        resolve: () => 'Hello from GraphQL-WS test server',
      },
    },
  }),
  subscription: new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      messageAdded: {
        type: MessageType,
        subscribe: () => subscribe(),
      },
      countdown: {
        type: GraphQLInt,
        args: {
          from: { type: new GraphQLNonNull(GraphQLInt) },
        },
        subscribe: async function* (_root, { from }) {
          for (let i = from; i >= 0; i--) {
            yield { countdown: i };
            if (i > 0) {
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        },
      },
    },
  }),
});

// ── HTTP Server (health check + publish endpoint) ──────
const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/publish') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      };
      try {
        const { text } = JSON.parse(body);
        if (!text) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'Missing "text" field' }));
          return;
        }
        const message = {
          id: String(++messageIdCounter),
          text,
          timestamp: new Date().toISOString(),
        };
        publish(message);
        console.log(`[GQL] published: ${JSON.stringify(message)}`);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ published: message }));
      } catch {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ── WebSocket Server (graphql-ws) ──────────────────────
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

useServer({ schema }, wsServer);

httpServer.listen(PORT, () => {
  console.log(`[GQL] GraphQL-WS server listening on port ${PORT}`);
  console.log(`[GQL]   WS endpoint: ws://localhost:${PORT}/graphql`);
  console.log(`[GQL]   Health:      http://localhost:${PORT}/health`);
  console.log(`[GQL]   Publish:     POST http://localhost:${PORT}/publish { "text": "..." }`);
});
