/**
 * Socket.IO v4 Echo Server
 *
 * - Echoes any event back to the sender with the same event name and data.
 * - CORS enabled for browser direct connections.
 * - Health check: GET /health → { status: "ok" }
 * - Logs connections, disconnections, and events to stdout.
 *
 * Used by WebSocket Studio E2E tests (ws-protocols-socketio.spec.ts).
 */
const http = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '3100', 10);

const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
  // Force WebSocket-only transport (no HTTP long-polling fallback)
  transports: ['websocket'],
});

io.on('connection', (socket) => {
  console.log(`[SIO] connected: ${socket.id}`);

  // Echo any event back with the same name + data
  socket.onAny((eventName, ...args) => {
    console.log(`[SIO] event: ${eventName}`, JSON.stringify(args).slice(0, 200));
    socket.emit(eventName, ...args);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SIO] disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[SIO] Socket.IO echo server listening on port ${PORT}`);
});
