import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcTransportModesConcept: GrpcDemoLesson['concept'] = {
  title: 'Transport Modes in gRPC Studio',
  body: `Browsers cannot open a raw HTTP/2 gRPC channel — the Fetch and XHR APIs don't expose the trailer frames and binary framing gRPC needs. RedfireForge solves this with **four transport modes**, chosen per gRPC Studio tab:

| Mode | How it works | Call types | Platform |
|---|---|---|---|
| 🌐 **Express Proxy** | Local Node.js server relays calls via \`@grpc/grpc-js\` — real HTTP/2 gRPC | Unary, server/client/bidi streaming | Web + Desktop |
| 🦀 **Tauri Native** | Rust \`tonic\` client — true HTTP/2, no Node hop | Unary, server/client/bidi streaming | Desktop only |
| 🌍 **gRPC-Web** | Browser \`fetch\` with grpc-web framing — needs a grpc-web-aware server or proxy (e.g. Envoy) | Unary, server streaming | Web (browser-direct) |
| 🌿 **Spring Servlet** | Browser \`fetch\` with an HTTP/1.1 POST to \`/echo.EchoService/Echo\` | Unary, server streaming | Web (browser-direct) |

**Why it matters:** Express Proxy always works, but browser-direct modes (gRPC-Web, Spring Servlet) skip the Node hop entirely — useful when the browser must reach a gRPC-Web-fronted service directly (e.g. through an ingress/sidecar) without running RedfireForge's own Node server.

**The safety net:** if a browser-direct call fails because the target doesn't actually support that framing, gRPC Studio offers **Retry with Express Proxy** right in the response panel — one click switches the tab back to the universal proxy and resends the call.

**Per-tab, not global:** transport mode lives on the gRPC Studio *tab*, exactly like the target address and TLS mode. Two tabs connected to different servers can use two different transports at the same time.

**What you will do in this lesson:**
1. **Tour** the Transport panel — four mode cards, one at a time.
2. **Fill Form Input** and send the control-case call over Express Proxy (the default).
3. **Switch** to gRPC-Web, reflect on the Envoy sidecar (\`:50055\`), confirm **Form Input**, and send — browser-direct, no Node hop.
4. **See it fail** against the raw gRPC port (\`:50051\`), then **Retry with Express Proxy**.
5. **Meet** Spring Servlet — a one-sentence introduction (full walkthrough in Lesson 7).
6. **Enable gzip** request compression, confirm **Form Input**, and send.
7. **Prove** transport is per-tab — a second tab keeps its own mode independently.
8. **Meet** the fourth mode, Tauri Native — desktop-only, full walkthrough in Lesson 15.`,
  keyTerms: [
    {
      term: 'Express Proxy',
      definition:
        'The default transport. RedfireForge\'s local Node.js server makes the real HTTP/2 gRPC call via @grpc/grpc-js and relays the result back to the browser. Works for every call type, on web and desktop.',
    },
    {
      term: 'gRPC-Web',
      definition:
        'A browser-compatible subset of the gRPC wire protocol. The browser sends a fetch request with grpc-web framing; the server (or a proxy like Envoy) must understand that framing to respond correctly.',
    },
    {
      term: 'Spring Servlet transport',
      definition:
        'A browser-direct mode that POSTs JSON to /ServiceName/MethodName (e.g. /echo.EchoService/Echo) over plain HTTP/1.1 — matches how Spring Boot gRPC servers behave in servlet mode.',
    },
    {
      term: 'Retry with Express Proxy',
      definition:
        'A button that appears in the response panel when a browser-direct call (gRPC-Web/Spring Servlet) fails in a way that suggests the target doesn\'t support that framing. Switches the tab to Express Proxy and resends automatically.',
    },
    {
      term: 'Tauri Native',
      definition:
        'Desktop-only transport using Rust tonic for a true native HTTP/2 gRPC channel with no Node.js process in between. Grayed out with a "Desktop only" reason in the web app.',
    },
  ],
  diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 340" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc19-arr-b" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc19-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc19-arr-p" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#a855f7"/>
    </marker>
  </defs>

  <text x="20" y="24" font-size="12" fill="#f1f5f9">Browser (gRPC Studio)</text>
  <rect x="14" y="34" width="180" height="270" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="104" y="56" text-anchor="middle" font-size="10" fill="#a8b8cc">Studio tab</text>
  <rect x="30" y="66" width="148" height="26" rx="5" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="104" y="83" text-anchor="middle" font-size="9" fill="#93c5fd">🌐 Express Proxy</text>
  <rect x="30" y="100" width="148" height="26" rx="5" fill="#1e293b" stroke="#3b4a60"/>
  <text x="104" y="117" text-anchor="middle" font-size="9" fill="#64748b">🦀 Tauri Native</text>
  <rect x="30" y="134" width="148" height="26" rx="5" fill="#052e16" stroke="#22c55e"/>
  <text x="104" y="151" text-anchor="middle" font-size="9" fill="#4ade80">🌍 gRPC-Web</text>
  <rect x="30" y="168" width="148" height="26" rx="5" fill="#1a0533" stroke="#a855f7"/>
  <text x="104" y="185" text-anchor="middle" font-size="9" fill="#d8b4fe">🌿 Spring Servlet</text>
  <text x="30" y="220" font-size="7.5" fill="#64748b">Fetch cannot open raw</text>
  <text x="30" y="232" font-size="7.5" fill="#64748b">HTTP/2 gRPC — every mode</text>
  <text x="30" y="244" font-size="7.5" fill="#64748b">above works around that.</text>

  <!-- Express path -->
  <line x1="194" y1="79" x2="330" y2="79" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc19-arr-b)"/>
  <text x="200" y="72" font-size="7.5" fill="#93c5fd">HTTP/2 (@grpc/grpc-js)</text>
  <rect x="332" y="60" width="150" height="38" rx="6" fill="#0d1520" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="407" y="76" text-anchor="middle" font-size="9" fill="#93c5fd">Node.js Express</text>
  <text x="407" y="90" text-anchor="middle" font-size="8" fill="#64748b">local proxy :3001</text>
  <line x1="482" y1="79" x2="560" y2="79" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc19-arr-b)"/>

  <!-- gRPC-Web path -->
  <line x1="194" y1="147" x2="330" y2="147" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc19-arr-g)"/>
  <text x="200" y="140" font-size="7.5" fill="#4ade80">fetch + grpc-web framing</text>
  <rect x="332" y="128" width="150" height="38" rx="6" fill="#031a0d" stroke="#22c55e" stroke-width="1.2"/>
  <text x="407" y="144" text-anchor="middle" font-size="9" fill="#4ade80">Envoy sidecar</text>
  <text x="407" y="158" text-anchor="middle" font-size="8" fill="#64748b">grpc-web transcode :50055</text>
  <line x1="482" y1="147" x2="560" y2="147" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc19-arr-g)"/>

  <!-- Spring Servlet path -->
  <line x1="194" y1="181" x2="330" y2="181" stroke="#a855f7" stroke-width="1.4" marker-end="url(#grpc19-arr-p)"/>
  <text x="200" y="200" font-size="7.5" fill="#d8b4fe">HTTP/1.1 POST /svc/method</text>
  <rect x="332" y="196" width="150" height="34" rx="6" fill="#1a0533" stroke="#a855f7" stroke-width="1"/>
  <text x="407" y="217" text-anchor="middle" font-size="8.5" fill="#d8b4fe">Spring Boot servlet</text>

  <!-- Target -->
  <rect x="562" y="60" width="120" height="106" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="622" y="80" text-anchor="middle" font-size="9.5" fill="#f1f5f9">echo.EchoService</text>
  <text x="622" y="96" text-anchor="middle" font-size="8" fill="#64748b">Go gRPC server</text>
  <text x="622" y="112" text-anchor="middle" font-size="8" fill="#64748b">:50051</text>

  <!-- Retry fallback callout -->
  <rect x="330" y="248" width="330" height="70" rx="6" fill="#2b1206" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="345" y="266" font-size="9" fill="#fbbf24">⚠ gRPC-Web → :50051 (no grpc-web support)</text>
  <text x="345" y="282" font-size="8" fill="#fcd34d">Browser fetch fails — protocol mismatch</text>
  <rect x="345" y="290" width="180" height="18" rx="4" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="435" y="303" text-anchor="middle" font-size="8" fill="#93c5fd">Retry with Express Proxy</text>

  <text x="350" y="24" text-anchor="middle" font-size="11" fill="#a8b8cc">One target, three ways in — plus the Express safety net</text>
</svg>`,
};
