/** GRPC-15 Spring Boot — concept panel content */
import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcSpringBootConcept: GrpcDemoLesson['concept'] = 
{
    title: 'Spring Boot gRPC Integration',
    body: `A single Spring Boot fixture exposes the **same** \`echo.EchoService\` two different ways from one JVM:

| Port | Stack | RedfireForge transport | Call types |
|---|---|---|---|
| \`:9090\` | \`net.devh\` gRPC starter (Netty, real HTTP/2) | 🌐 Express Proxy | Unary, streaming — everything |
| \`:8081\` | Spring MVC servlet bridge (HTTP/1.1, same JVM) | 🌿 Spring Servlet | Unary only (this fixture) |

**Reflection works out of the box.** The \`net.devh\` starter auto-registers both \`grpc.reflection.v1alpha.ServerReflection\` and the standard \`grpc.health.v1.Health\` service the moment \`grpc-services\` is on the classpath — no \`application.yml\` flag required. This fixture also ships a **second**, differently-named health service, \`health.v1.Health\`, because gRPC Studio's own Health Check panel looks for that exact name rather than the gRPC-standard one.

**Authentication mirrors Spring Security.** The \`SecureEcho\` method is guarded by a \`ServerInterceptor\` that rejects any call missing \`authorization: Bearer demo-secret-token\` with \`UNAUTHENTICATED\` — the same shape a real Spring Security gRPC filter would produce.

**What you will do in this lesson:**
1. **Connect** to the Netty port over Express Proxy and Reflect — see both health services appear.
2. **Send** a plain Echo call — the control case.
3. **Probe health** — unary Check, then a live Watch stream every 3 seconds.
4. **Hit the auth gate** — call \`SecureEcho\` without a token (denied), then with one (accepted).
5. **Switch transports** — same JVM, same Echo method, now over Spring Servlet on \`:8081\`.
6. **Interpolate** the target with \`{{grpcHost}}\` and watch the live preview resolve it.
7. **Browse the schema** — the same message/enum types the Java code defines.`,
    keyTerms: [
      {
        term: 'net.devh starter',
        definition:
          '`grpc-server-spring-boot-starter` — the most common third-party Spring Boot gRPC integration. Starts a Netty gRPC server (default port `:9090`) and auto-registers reflection and the standard health service.',
      },
      {
        term: 'Spring Servlet transport',
        definition:
          'A RedfireForge browser-direct transport that POSTs gRPC-Web-framed bytes to `/ServiceName/MethodName` over plain HTTP/1.1 — matches a Spring MVC controller bridging gRPC calls onto the servlet port, with no gRPC/HTTP2 channel involved.',
      },
      {
        term: 'health.v1.Health',
        definition:
          'This fixture\'s custom health service name. gRPC Studio\'s Health Check panel specifically looks for a service named `health.v1.Health` — not the industry-standard `grpc.health.v1.Health` that `net.devh` also registers automatically.',
      },
      {
        term: 'Spring hint card',
        definition:
          'A contextual tip that appears in the Health panel when the selected method is `health.v1.Health/Check` or `/Watch`, explaining the service-name field and `ServingStatus` enum.',
      },
      {
        term: 'Bearer-gated RPC',
        definition:
          'A `ServerInterceptor` inspects the `authorization` metadata for one specific method (`SecureEcho`) and closes the call with `UNAUTHENTICATED` if the exact bearer token is missing — every other RPC on the service passes through untouched.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 360" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc15-arr-b" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc15-arr-p" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#a855f7"/>
    </marker>
  </defs>

  <text x="20" y="24" font-size="12" fill="#f1f5f9">gRPC Studio</text>
  <rect x="14" y="34" width="170" height="130" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="99" y="56" text-anchor="middle" font-size="10" fill="#a8b8cc">Studio tab</text>
  <rect x="28" y="66" width="142" height="26" rx="5" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="99" y="83" text-anchor="middle" font-size="9" fill="#93c5fd">🌐 Express Proxy</text>
  <rect x="28" y="100" width="142" height="26" rx="5" fill="#1a0533" stroke="#a855f7"/>
  <text x="99" y="117" text-anchor="middle" font-size="9" fill="#d8b4fe">🌿 Spring Servlet</text>
  <text x="28" y="146" font-size="7.5" fill="#64748b">Same tab, one target</text>
  <text x="28" y="157" font-size="7.5" fill="#64748b">field switches port.</text>

  <!-- Express -> Netty -->
  <line x1="184" y1="79" x2="330" y2="79" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc15-arr-b)"/>
  <text x="192" y="72" font-size="7.5" fill="#93c5fd">HTTP/2 (@grpc/grpc-js)</text>

  <!-- Servlet -> Tomcat -->
  <line x1="184" y1="113" x2="330" y2="200" stroke="#a855f7" stroke-width="1.4" marker-end="url(#grpc15-arr-p)"/>
  <text x="188" y="150" font-size="7.5" fill="#d8b4fe">HTTP/1.1 POST</text>
  <text x="188" y="161" font-size="7.5" fill="#d8b4fe">/echo.EchoService/Echo</text>

  <!-- Spring Boot JVM box -->
  <rect x="332" y="46" width="340" height="270" rx="10" fill="#0d1520" stroke="#22c55e" stroke-width="1.4"/>
  <text x="502" y="66" text-anchor="middle" font-size="10.5" fill="#4ade80">Spring Boot JVM (one process)</text>

  <rect x="350" y="78" width="150" height="76" rx="6" fill="#0f2b1a" stroke="#22c55e" stroke-width="1"/>
  <text x="425" y="96" text-anchor="middle" font-size="9" fill="#4ade80">Netty gRPC :9090</text>
  <text x="425" y="110" text-anchor="middle" font-size="7.5" fill="#86efac">echo.EchoService</text>
  <text x="425" y="122" text-anchor="middle" font-size="7.5" fill="#86efac">health.v1.Health</text>
  <text x="425" y="134" text-anchor="middle" font-size="7.5" fill="#86efac">grpc.health.v1.Health</text>
  <text x="425" y="146" text-anchor="middle" font-size="7.5" fill="#86efac">reflection (auto)</text>

  <rect x="510" y="78" width="146" height="76" rx="6" fill="#1a0533" stroke="#a855f7" stroke-width="1"/>
  <text x="583" y="96" text-anchor="middle" font-size="9" fill="#d8b4fe">Servlet bridge :8081</text>
  <text x="583" y="112" text-anchor="middle" font-size="7.5" fill="#e9d5ff">MVC controller</text>
  <text x="583" y="126" text-anchor="middle" font-size="7.5" fill="#e9d5ff">Echo only</text>
  <text x="583" y="140" text-anchor="middle" font-size="7.5" fill="#e9d5ff">gRPC-Web framing</text>

  <rect x="350" y="166" width="306" height="52" rx="6" fill="#1e1206" stroke="#f59e0b" stroke-width="1"/>
  <text x="503" y="184" text-anchor="middle" font-size="9" fill="#fbbf24">BearerAuthServerInterceptor</text>
  <text x="503" y="198" text-anchor="middle" font-size="7.5" fill="#fcd34d">guards SecureEcho — needs</text>
  <text x="503" y="210" text-anchor="middle" font-size="7.5" fill="#fcd34d">authorization: Bearer demo-secret-token</text>

  <rect x="350" y="230" width="306" height="70" rx="6" fill="#0d1520" stroke="#3b4a60" stroke-width="1"/>
  <text x="503" y="248" text-anchor="middle" font-size="9" fill="#f1f5f9">HealthFixtureGrpcService</text>
  <text x="503" y="264" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Check → SERVING (unary)</text>
  <text x="503" y="278" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Watch → SERVING every 3s (stream)</text>
  <text x="503" y="292" text-anchor="middle" font-size="7.5" fill="#a8b8cc">named health.v1.Health for the Health panel</text>

  <text x="350" y="336" text-anchor="middle" font-size="11" fill="#a8b8cc">One JVM, one service — two transports, one auth gate, two health names</text>
</svg>`,
};
