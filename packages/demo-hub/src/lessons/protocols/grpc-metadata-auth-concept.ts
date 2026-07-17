export const grpcMetadataAuthConcept = {
    title: 'gRPC Metadata & Auth',
    body: `**Request metadata** is gRPC's equivalent of HTTP request headers — key-value pairs transmitted as HTTP/2 headers alongside the RPC payload. Common uses:
- **Tracing** — \`x-request-id\`, \`x-trace-id\`
- **Auth** — \`authorization: bearer <token>\`
- **Feature flags** — \`x-feature: dark-mode\`

RedfireForge's **gRPC session settings** panel (gear icon ⚙ in the connection bar) centralises per-session call behavior. It has **five tabs**:

| Tab | What it controls |
|---|---|
| **Call** | Deadline / timeout, max response size, keepalive interval |
| **Compression** | Payload compression algorithm (gzip, deflate) |
| **Health** | gRPC Health Protocol probe (grpc.health.v1) |
| **K8s** | Kubernetes port-forward tunnel setup |
| **Transport** | Call routing mode: Express Proxy, Tauri Native, gRPC-Web, Spring Servlet |

**Authentication** is configured in the **Auth tab** of the Call Panel (the panel below the service explorer) — not in **gRPC session settings**. Click the **Auth** tab or the **Auth badge** in the connection bar to open it. Auth settings are **per-tab** — each gRPC Studio tab can have its own auth configuration.

**TLS** is accessed via the **TLS badge** in the connection bar, which opens a separate TLS config modal.

**What you will do in this lesson:**
1. **gRPC session settings** — tour the five tabs to see available call-session options.
2. **Metadata tab** — add a custom \`x-request-id\` header and send an Echo call.
3. **Bearer auth** — click the Auth badge, select Bearer, and fill a demo token.
4. **Basic auth** — switch to Basic (username + password).
5. **API Key auth** — switch to API Key (\`x-api-key\` header).
6. **Conflict detection** — manually add the same key as the API Key auth → Studio flags the conflict.
7. **OAuth2** — fill token URL + client credentials; Studio fetches the token server-side.
8. **Env-var interpolation** — add \`{{authToken}}\` as a metadata value and watch the preview strip resolve it.

**Auth precedence rule:** when the Auth tab has a type other than \`none\`, it owns the \`authorization\` header. Adding the same key manually in the Metadata tab creates a conflict — Studio highlights it with a warning badge.`,
    keyTerms: [
      {
        term: 'Request metadata',
        definition:
          'Key-value pairs sent as HTTP/2 headers alongside the RPC — gRPC\'s equivalent of HTTP request headers. Metadata travels before (initial) and after (trailing) the message body.',
      },
      {
        term: 'Auth tab (Call Panel)',
        definition:
          'The Auth tab inside the Call Panel configures per-tab authentication. Click the Auth badge in the connection bar or the Auth tab button to open it. Each gRPC Studio tab has independent auth settings.',
      },
      {
        term: 'Auth precedence',
        definition:
          'When the Auth tab has a type other than `none`, it auto-generates the `authorization` header. A matching key in the manual Metadata tab creates a conflict that Studio flags with a warning.',
      },
      {
        term: 'Bearer token',
        definition:
          'An opaque token (often a JWT) sent in the `authorization: bearer <token>` header. Studio stores the value in the session vault, not in localStorage.',
      },
      {
        term: 'OAuth2 client-credentials',
        definition:
          'Studio fetches a token from the token URL using client ID + secret before each call. The raw credentials are held in the session secret vault — they never appear in History exports.',
      },
      {
        term: '{{variable}} interpolation',
        definition:
          'Template syntax to inject environment variable values into metadata, target, auth, or body fields at execute time. Unresolved tokens surface an orange error banner.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc4-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc4-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc4-arr-o" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="270" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — Request Metadata &amp; Authentication</text>

  <!-- Connection bar -->
  <rect x="1" y="31" width="698" height="38" fill="#0f172a"/>
  <rect x="12" y="39" width="200" height="22" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="22" y="53" font-family="monospace" font-size="10" fill="#f1f5f9">localhost:50051</text>
  <!-- Gear icon (gRPC session settings) -->
  <rect x="222" y="39" width="22" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="233" y="53" text-anchor="middle" font-size="12" fill="#a8b8cc">⚙</text>
  <text x="222" y="71" font-size="7" fill="#64748b">Settings</text>
  <!-- Status badge -->
  <rect x="254" y="39" width="100" height="22" rx="11" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="304" y="53" text-anchor="middle" font-size="9" fill="#22c55e">Ready — Plaintext</text>
  <!-- Auth badge (in connection bar) -->
  <rect x="364" y="39" width="52" height="22" rx="11" fill="#172554" stroke="#3b82f6" stroke-width="1"/>
  <text x="390" y="53" text-anchor="middle" font-size="8.5" fill="#3b82f6">Bearer ▸</text>
  <text x="370" y="71" font-size="7" fill="#3b82f6">Auth badge</text>
  <!-- TLS badge -->
  <rect x="424" y="39" width="42" height="22" rx="11" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="445" y="53" text-anchor="middle" font-size="8" fill="#64748b">TLS ▸</text>

  <!-- gRPC session settings panel (5 tabs) -->
  <rect x="12" y="80" width="180" height="168" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="24" y="98" font-size="9.5" fill="#a8b8cc">gRPC session settings</text>
  <text x="24" y="110" font-size="7.5" fill="#64748b">5 tabs — call behavior</text>
  <line x1="24" y1="115" x2="184" y2="115" stroke="#1e293b"/>
  <rect x="24" y="120" width="156" height="18" rx="3" fill="#1e3a5f" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="35" y="132" font-size="8" fill="#93c5fd">Call  (timeout / size / keepalive)</text>
  <rect x="24" y="141" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="153" font-size="8" fill="#64748b">Compression  (gzip / deflate)</text>
  <rect x="24" y="161" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="173" font-size="8" fill="#64748b">Health  (grpc.health.v1 probe)</text>
  <rect x="24" y="181" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="193" font-size="8" fill="#64748b">K8s  (port-forward tunnel)</text>
  <rect x="24" y="201" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="213" font-size="8" fill="#64748b">Transport  (Express / Tauri / gRPC-Web / Spring)</text>
  <text x="24" y="238" font-size="7" fill="#475569">Auth &amp; TLS are NOT here →</text>

  <!-- Call panel with Auth tab active -->
  <rect x="205" y="80" width="480" height="168" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="218" y="98" font-size="9.5" fill="#a8b8cc">Call Panel</text>
  <!-- Tabs -->
  <rect x="218" y="104" width="54" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="245" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">Form Input</text>
  <rect x="275" y="104" width="30" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="290" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">JSON</text>
  <rect x="308" y="104" width="44" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="330" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">Metadata</text>
  <!-- Auth tab — active/highlighted -->
  <rect x="355" y="104" width="30" height="18" rx="3" fill="#172554" stroke="#3b82f6" stroke-width="1"/>
  <text x="370" y="116" text-anchor="middle" font-size="7.5" fill="#3b82f6">Auth</text>
  <rect x="388" y="104" width="28" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="402" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">Files</text>

  <!-- Auth panel content -->
  <text x="218" y="140" font-size="8" fill="#64748b">Auth type</text>
  <rect x="218" y="145" width="200" height="20" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1"/>
  <text x="318" y="158" text-anchor="middle" font-size="9" fill="#93c5fd">Bearer Token ▾</text>
  <text x="218" y="178" font-size="8" fill="#64748b">Bearer token</text>
  <rect x="218" y="182" width="200" height="20" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="228" y="195" font-family="monospace" font-size="8" fill="#4ade80">eyJ•••••••••••••••</text>
  <text x="218" y="215" font-size="8" fill="#64748b">Outgoing metadata (auth merged)</text>
  <rect x="218" y="220" width="200" height="16" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="228" y="231" font-family="monospace" font-size="7.5" fill="#a8b8cc">authorization: bearer eyJ…</text>
  <text x="218" y="245" font-size="7.5" fill="#3b82f6">✓ token stored in session vault</text>

  <!-- Metadata editor panel (right side of call panel) -->
  <text x="435" y="140" font-size="9" fill="#a8b8cc">Metadata tab</text>
  <rect x="435" y="145" width="232" height="18" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="443" y="157" font-family="monospace" font-size="8" fill="#f1f5f9">x-request-id</text>
  <text x="555" y="157" font-family="monospace" font-size="8" fill="#4ade80">lesson-4-demo</text>
  <rect x="435" y="166" width="232" height="18" rx="3" fill="#0a1118" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="443" y="178" font-family="monospace" font-size="8" fill="#f1f5f9">x-api-key</text>
  <text x="555" y="178" font-family="monospace" font-size="8" fill="#f59e0b">conflicting-value</text>
  <rect x="435" y="188" width="232" height="14" rx="3" fill="#451a03" stroke="#f59e0b" stroke-width="0.7"/>
  <text x="443" y="198" font-size="7" fill="#fbbf24">⚠ x-api-key conflicts with API Key auth</text>
  <rect x="435" y="206" width="232" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="443" y="217" font-family="monospace" font-size="7.5" fill="#f59e0b">{{authToken}}</text>
  <text x="510" y="217" font-family="monospace" font-size="7.5" fill="#22c55e">→ Bearer abc123…</text>
  <rect x="435" y="226" width="80" height="14" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.7"/>
  <text x="475" y="235" text-anchor="middle" font-size="7.5" fill="#4ade80">+ Add row</text>

  <!-- Legend -->
  <text x="350" y="300" text-anchor="middle" font-size="11" fill="#a8b8cc">Lesson flow</text>

  <circle cx="50" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="50" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">1</text>
  <text x="50" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Session</text>
  <text x="50" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">settings</text>
  <line x1="62" y1="330" x2="98" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="110" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="110" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">2</text>
  <text x="110" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Add</text>
  <text x="110" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">metadata</text>
  <line x1="122" y1="330" x2="158" y2="330" stroke="#22c55e" marker-end="url(#grpc4-arr-g)"/>

  <circle cx="170" cy="330" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="170" y="334" text-anchor="middle" font-size="9" fill="#22c55e">3</text>
  <text x="170" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Send</text>
  <text x="170" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">call</text>
  <line x1="182" y1="330" x2="218" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="230" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="230" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">4</text>
  <text x="230" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Bearer</text>
  <text x="230" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">auth</text>
  <line x1="242" y1="330" x2="278" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="290" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="290" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">5-6</text>
  <text x="290" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Basic /</text>
  <text x="290" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">API Key</text>
  <line x1="302" y1="330" x2="338" y2="330" stroke="#f59e0b" marker-end="url(#grpc4-arr-o)"/>

  <circle cx="350" cy="330" r="11" fill="#451a03" stroke="#f59e0b"/>
  <text x="350" y="334" text-anchor="middle" font-size="9" fill="#f59e0b">7</text>
  <text x="350" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Conflict</text>
  <text x="350" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">detect</text>
  <line x1="362" y1="330" x2="398" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="410" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="410" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">8</text>
  <text x="410" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">OAuth2</text>
  <line x1="422" y1="330" x2="458" y2="330" stroke="#22c55e" marker-end="url(#grpc4-arr-g)"/>

  <circle cx="470" cy="330" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="470" y="334" text-anchor="middle" font-size="9" fill="#22c55e">9</text>
  <text x="470" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Env var</text>
  <text x="470" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">interp.</text>

  <!-- Callout: Auth badge → Auth tab -->
  <line x1="390" y1="61" x2="370" y2="104" stroke="#3b82f6" stroke-width="0.8" stroke-dasharray="3,2"/>
  <text x="395" y="85" font-size="7" fill="#3b82f6">click opens</text>
  <text x="395" y="94" font-size="7" fill="#3b82f6">Auth tab</text>
</svg>`,
};
