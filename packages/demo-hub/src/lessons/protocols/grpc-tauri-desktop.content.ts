import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcTauriDesktopConcept: GrpcDemoLesson['concept'] = {
  title: 'Tauri Native — Rust All the Way to the Server',
  body:
    'RedfireForge ships two gRPC transport backends:\n\n' +
    '| Transport | Path | Available |\n' +
    '|---|---|---|\n' +
    '| **Express Proxy** | Browser → Node.js `@grpc/grpc-js` → gRPC server | Web + Desktop |\n' +
    '| **Tauri Native** | Desktop → Rust `tonic` channel pool → gRPC server | Desktop only |\n\n' +
    'The native path removes the JavaScript relay hop. This matters for:\n\n' +
    '- **Lower latency** in high-throughput streaming scenarios\n' +
    '- **Mock Network Listener** — a real Rust TCP server that external tools can connect to\n' +
    '- **Channel pool diagnostics** — runtime snapshot of open channels, call counters, and stream lifecycle state via the Tauri IPC bridge\n' +
    '- **Desktop secret vault behavior** — auth secrets persist via encrypted local storage path\n' +
    '- **Native fallback controls** — quick recovery path to Express when preflight checks fail\n\n' +
    '**Mock Network Listener** binds a `tonic` gRPC server to a local TCP port. When you change mock rules, the listener hot-swaps them in without restarting — the Listener generation counter increments each time. This lets CI pipelines and microservices connect to the mock over a real port without Studio acting as a proxy.',
  keyTerms: [
    { term: 'Tauri Native transport', definition: 'Rust tonic gRPC channel managed by the Tauri backend — no Node.js relay in the call path.' },
    { term: 'Channel pool', definition: 'Pool of reusable tonic channels keyed by target + TLS config. Stats visible in Native Diagnostics.' },
    { term: 'Native Diagnostics', definition: 'Read-only Advanced tab showing a runtime snapshot: channel pool, call registry, stream tracking, last error.' },
    { term: 'Mock Network Listener', definition: 'Desktop-only Rust gRPC server bound to a real TCP port — external clients connect directly.' },
    { term: 'Listener generation', definition: 'Counter that increments each time mock rules are hot-swapped without restarting the listener.' },
    { term: 'Desktop secret vault', definition: 'Desktop path stores auth secrets with encrypted-local persistence semantics for restore across sessions.' },
    { term: 'Native preflight fallback', definition: 'On transport start failures, Studio can offer a quick switch/retry path through Express Proxy.' },
  ],
  diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif"><rect width="700" height="400" rx="10" fill="#0d1520"/><text x="350" y="28" text-anchor="middle" font-size="13" fill="#e2e8f0" font-weight="600">Tauri Desktop — Native Transport Architecture</text></svg>`,
};

export const grpcTauriDesktopDescriptions = {
  intro:
    'Open the **Connection Settings** drawer and look at the **Transport** panel. ' +
    'On the web app, the **Tauri Native (tonic)** card is grayed out — it\'s ' +
    'a desktop-only feature. Here in the Tauri desktop app it is fully selectable.\n\n' +
    '**Express Proxy** routes every call through the Node.js `@grpc/grpc-js` layer ' +
    'on port 3001 before it reaches your gRPC server. **Tauri Native** routes calls ' +
    'directly from a Rust `tonic` channel pool — no JavaScript relay in the path. ' +
    'This gives lower per-call overhead and enables features that only Rust can provide: ' +
    'real TCP binding for the Mock Network Listener and a live channel pool diagnostic snapshot.',
  nativeMode:
    'Open **Settings → Transport** and select **Tauri Native (tonic)**. ' +
    'Notice the connection bar — a small native-transport indicator confirms the ' +
    'channel is now managed by the Rust backend.\n\n' +
    'From this point on, every call you make goes directly from Rust to your gRPC ' +
    'server. The Node.js Express proxy on port 3001 is no longer in the path.',
  nativeCall:
    'Select `echo.EchoService / Echo` and click **Send** with this request body:\n' +
    '```json\n{\n  "message": "native-test"\n}\n```\n' +
    'Watch the **response duration** — native tonic calls typically complete with lower ' +
    'latency than the Express proxy path because there is no JavaScript relay hop.\n\n' +
    'The response body and status code are identical:\n' +
    '```json\n{\n  "message": "native-test"\n}\n```\n' +
    'Status is **OK (0)**. The only difference is the transport path — Rust → gRPC target vs. Node.js relay → gRPC target.',
  diagnostics:
    'Navigate to **Advanced → Native Diagnostics**. The panel shows a read-only ' +
    'runtime snapshot for the Tauri backend: channel pool health, active call registry ' +
    'counter, stream session tracking, and last transport mode used.\n\n' +
    'On the web app this panel shows a "desktop only" notice instead. Click ' +
    '**Refresh snapshot** to pull the current state from the Rust backend over the Tauri IPC channel. ' +
    'Then click **Copy JSON** — the snapshot is great for bug reports because it captures exactly what the native transport layer was doing at a given instant.',
  nativeStream:
    'Switch back to the **Studio** sub-nav and select `echo.EchoService / ServerStream`. ' +
    'Set `repeat_count` to **5** and `interval_ms` to **300** in the request body, then click **Start** to open a ' +
    'native tonic server-streaming channel.\n\n' +
    'Five messages arrive through the Rust stream relay — no JavaScript in the path. ' +
    'When the stream finishes, return to **Advanced → Native Diagnostics** and click ' +
    '**Refresh** — the stream registry counter now reflects the completed stream.',
  mockSetup:
    'Navigate to **Advanced → Mock Server → Builder** and create a rule in full detail:\n\n' +
    '- **Rule name:** `ping match`\n' +
    '- **Predicate:** `Body path equals`\n' +
    '- **Body path:** `message`\n' +
    '- **Expected value:** `ping`\n' +
    '- **Response body:** `{"message":"pong"}`\n' +
    '- **Status code:** `OK`\n\n' +
    'Then switch to **Runtime** and click **Start mock runtime**. The status chip turns **Running**. ' +
    'From now on, matching calls are intercepted by this mock rule instead of the real backend.',
  listenerEnable:
    'In the **Runtime** tab, make sure **Network Listener** is enabled. If the toggle is off, ' +
    'turn it on — the Tauri backend starts a real Rust `tonic` gRPC server and binds it to ' +
    'a local TCP port (e.g. `127.0.0.1:50099`).\n\n' +
    'Once it\'s enabled, the listen address appears in the **Listen target** field. Click ' +
    '**Copy** to copy it — you\'ll paste it into a grpcurl command in the next step.\n\n' +
    '**What this unlocks:** external clients — terminal tools, microservices, CI pipelines — ' +
    'can now call your mock over a real TCP connection, not a Studio-internal channel.',
  externalCall:
    'The **listener port** (e.g. `localhost:50061`) is a real gRPC network socket for **external tools** ' +
    'like `grpcurl`, another microservice, or an integration test runner that needs an explicit address to connect to. ' +
    'It even answers **gRPC ServerReflection**, so tools can discover its services with no local proto files.\n\n' +
    '1. Set the target to the listener address (already copied in the previous step) — for example `localhost:50061`.\n' +
    '2. Click **Reflection** — the listener returns its service tree. Select **Echo**.\n' +
    '3. Enter `{"message":"ping"}` as the request body.\n' +
    '4. Click **Send Unary**.\n' +
    '5. The response is `{"message":"pong"}` — and the target bar still shows the listener port, not 50051.\n\n' +
    '**Contrast:** in a later step you\'ll see that sending to `localhost:50051` (the echo server port) also returns the mock response — because the mock intercepts all Tauri Native calls transparently. ' +
    'Port 50061 is only needed when an external client cannot go through the Tauri transport.',
  hotSwapBuilder:
    'Back in the **Builder** tab, add and configure another rule step-by-step:\n\n' +
    '- **Rule name:** `hello match`\n' +
    '- **Predicate:** `Body path equals`\n' +
    '- **Body path:** `message`\n' +
    '- **Expected value:** `hello`\n' +
    '- **Fallback:** leave unchecked\n' +
    '- **Response body:** `{"message":"world"}`\n\n' +
    'We will verify the hot-swap in Runtime in the next step.',
  hotSwapRuntime:
    'Switch to **Runtime** and watch the **Listener generation** chip increment — the rules were ' +
    'hot-swapped with no port restart.\n\n' +
    '**This time, keep the target at `localhost:50051`** — the real echo server\'s port. ' +
    'Send `{"message":"hello"}`. Even though you\'re not using the listener port (50061), ' +
    'the mock **transparently intercepts** the call and returns `{"message":"world"}`.\n\n' +
    '**Why both ports work:**\n' +
    '- `50061` — the external socket. External tools connect here explicitly.\n' +
    '- `50051` — the echo server\'s port. The mock intercepts all Tauri Native calls at the transport layer before they reach the real server, regardless of target port.\n\n' +
    'The target bar stays at `localhost:50051` the entire time — yet the mock\'s new rule replies. Then inspect the **Listener log** and stop the runtime.',
  defaultTauri:
    'On desktop, every newly created Studio tab starts in **Tauri Native** mode by default. ' +
    'That means you get the Rust `tonic` path immediately without re-opening Settings.\n\n' +
    'Create a fresh tab and check the transport badge in the connection bar. This default keeps everyday desktop workflows on the native stack unless you intentionally switch.',
  secretVault:
    'Open the **Auth** tab in the request panel, switch to **Bearer**, and enter a token. ' +
    'In desktop mode, auth secrets are stored via the desktop vault path so they can be restored later without keeping plain values in request JSON.\n\n' +
    'In the web build, auth secrets are session-scoped by default. This desktop vault behavior is one of the key platform differences for production-like workflows.',
  nativeFallback:
    'If a native call cannot start (TLS or reachability preflight issues), the error panel can offer **Retry with Express Proxy** so you can keep testing while you investigate.\n\n' +
    'In this clean demo state there may be no error banner, so we show the manual fallback path: open **Settings → Transport**, switch to **Express Proxy**, then switch back to **Tauri Native** once the issue is resolved.',
} as const;