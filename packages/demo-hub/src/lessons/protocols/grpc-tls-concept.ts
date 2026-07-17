/** GRPC-5 TLS lesson — concept panel */

export const grpcTlsConcept = {
    title: 'TLS & mTLS in gRPC Studio',
    body: `gRPC runs over HTTP/2. By default the channel is **plaintext** — no encryption. In production, you almost always need **TLS** (server authentication) or **mTLS** (mutual authentication).

**Three channel modes — click the TLS badge (🔒) in the connection bar to choose:**

| Mode | Icon | What it does |
|---|---|---|
| **Plaintext** | 🔓 | No encryption — cleartext HTTP/2. Default. |
| **TLS** | 🔒 | Server presents a certificate; client verifies it. Optional custom CA cert. |
| **mTLS** | 🛡 | Both sides present certificates — server also verifies the client's identity. |

**Certificate fields (PEM paste):**
- **CA Certificate** — paste a custom root CA to trust self-signed or private PKI server certs
- **Client Certificate** + **Client Private Key** (mTLS only) — prove your identity to the server
- **Server Name Override (SNI)** — fix hostname mismatches between the target IP and the cert's CN/SAN

**Secret vault:** PEM content is held in an in-session secret vault. It is **never** written to localStorage, never included in collection/History exports, and stripped from grpcurl output. A "Set" badge appears on the field; a "Clear stored" button removes it.

**TLS connection test:** Click **Test TLS Connection** in the modal to run local PEM validation before sending a call — it checks that your cert and key are syntactically valid PEM but does not make a live network probe.

**What you will do in this lesson:**
1. **Tour** the TLS badge and three channel modes.
2. **See** Plaintext **Reflect** fail against the TLS-only server (:50443).
3. **Configure TLS** — switch mode, paste CA cert, run the local test, save.
4. **Reflect + Send** an Echo call over the encrypted channel.
5. **Server name override** — the SNI field for hostname mismatches.
6. **Configure mTLS** — switch mode, paste client cert + private key, save.
7. **Reflect + Send** over the mutual-auth channel (:50444).
8. **Secret vault** — learn how certs stay out of exports, then clean up.`,
    keyTerms: [
      {
        term: 'TLS (Transport Layer Security)',
        definition:
          'Encrypts the gRPC channel. The server presents a certificate; the client verifies it against a trusted CA. Prevents eavesdropping and impersonation.',
      },
      {
        term: 'Mutual TLS (mTLS)',
        definition:
          'Both client and server present certificates. The server additionally verifies the client\'s identity — used for zero-trust service-to-service auth.',
      },
      {
        term: 'CA Certificate',
        definition:
          'The Certificate Authority cert that signed the server\'s certificate. Required when the server uses a private or self-signed CA not in the system trust store.',
      },
      {
        term: 'Server name override (SNI)',
        definition:
          'Overrides the hostname used for TLS certificate verification. Use when the gRPC target is an IP address but the certificate CN/SAN uses a DNS name.',
      },
      {
        term: 'Secret vault',
        definition:
          'An in-session, in-memory store that holds PEM content. Material never lands in localStorage, collection exports, or History. A "Clear stored" button wipes it.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc5-arr-b" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc5-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc5-arr-r" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#ef4444"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="255" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — TLS Configuration</text>

  <!-- Connection bar -->
  <rect x="1" y="31" width="698" height="38" fill="#0f172a"/>
  <rect x="12" y="39" width="190" height="22" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="22" y="53" font-family="monospace" font-size="10" fill="#f1f5f9">localhost:50443</text>
  <!-- TLS badge — active -->
  <rect x="212" y="39" width="58" height="22" rx="11" fill="#1c3a2a" stroke="#22c55e" stroke-width="1"/>
  <text x="241" y="53" text-anchor="middle" font-size="9" fill="#22c55e">🔒 TLS ▸</text>
  <text x="215" y="71" font-size="7" fill="#22c55e">TLS badge</text>
  <!-- Auth badge -->
  <rect x="280" y="39" width="52" height="22" rx="11" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="306" y="53" text-anchor="middle" font-size="8.5" fill="#64748b">None ▸</text>
  <!-- Gear -->
  <rect x="342" y="39" width="22" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="353" y="53" text-anchor="middle" font-size="12" fill="#a8b8cc">⚙</text>

  <!-- TLS modal body (right half) -->
  <rect x="370" y="34" width="320" height="220" rx="6" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="380" y="53" font-size="9.5" fill="#22c55e">🔒 TLS / mTLS Configuration</text>

  <!-- Mode selector row -->
  <text x="380" y="70" font-size="8" fill="#a8b8cc">TLS mode</text>
  <!-- Plaintext button -->
  <rect x="380" y="75" width="84" height="34" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="422" y="91" text-anchor="middle" font-size="9" fill="#64748b">🔓</text>
  <text x="422" y="102" text-anchor="middle" font-size="7.5" fill="#64748b">Plaintext</text>
  <!-- TLS button — active -->
  <rect x="468" y="75" width="84" height="34" rx="4" fill="#1c3a2a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="510" y="91" text-anchor="middle" font-size="9" fill="#22c55e">🔒</text>
  <text x="510" y="102" text-anchor="middle" font-size="7.5" fill="#22c55e">TLS</text>
  <!-- mTLS button -->
  <rect x="556" y="75" width="84" height="34" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="598" y="91" text-anchor="middle" font-size="9" fill="#64748b">🛡</text>
  <text x="598" y="102" text-anchor="middle" font-size="7.5" fill="#64748b">mTLS</text>

  <!-- CA cert section -->
  <text x="380" y="122" font-size="8.5" fill="#a8b8cc">CA Certificate  <tspan fill="#64748b">(Optional)</tspan></text>
  <rect x="380" y="127" width="298" height="52" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="388" y="141" font-family="monospace" font-size="7" fill="#22c55e">-----BEGIN CERTIFICATE-----</text>
  <text x="388" y="151" font-family="monospace" font-size="7" fill="#4ade80">MIID1zCCAr+gAwIBAgIUeWV1...</text>
  <text x="388" y="161" font-family="monospace" font-size="7" fill="#22c55e">-----END CERTIFICATE-----</text>
  <!-- Set badge -->
  <rect x="642" y="127" width="28" height="14" rx="7" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.7"/>
  <text x="656" y="137" text-anchor="middle" font-size="7" fill="#22c55e">Set</text>
  <text x="380" y="191" font-size="7.5" fill="#64748b">🔒 PEM stored in session vault — not exported</text>

  <!-- SNI field -->
  <text x="380" y="207" font-size="8" fill="#a8b8cc">Server name override (SNI)</text>
  <rect x="380" y="211" width="200" height="18" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="388" y="223" font-family="monospace" font-size="8" fill="#64748b">grpc.example.com</text>

  <!-- Test / Save footer -->
  <rect x="380" y="234" width="126" height="16" rx="3" fill="#0f172a" stroke="#3b4a60"/>
  <text x="443" y="245" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Test TLS Connection</text>
  <rect x="558" y="234" width="56" height="16" rx="3" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="586" y="245" text-anchor="middle" font-size="7.5" fill="#93c5fd">Save</text>
  <rect x="620" y="234" width="46" height="16" rx="3" fill="#0f172a" stroke="#3b4a60"/>
  <text x="643" y="245" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Close</text>

  <!-- Left half — three-mode diagram -->
  <text x="20" y="60" font-size="10" fill="#a8b8cc">Channel modes</text>

  <!-- Plaintext row -->
  <rect x="20" y="68" width="322" height="44" rx="4" fill="#0f172a" stroke="#3b4a60"/>
  <text x="30" y="85" font-size="11" fill="#64748b">🔓</text>
  <text x="50" y="85" font-size="9" fill="#a8b8cc">Plaintext</text>
  <text x="50" y="97" font-size="7.5" fill="#64748b">No TLS — HTTP/2 cleartext (default)</text>
  <line x1="200" y1="90" x2="340" y2="90" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="350" y="94" font-size="8" fill="#64748b">:50051</text>

  <!-- TLS row -->
  <rect x="20" y="118" width="322" height="44" rx="4" fill="#051a0d" stroke="#22c55e" stroke-width="0.8"/>
  <text x="30" y="135" font-size="11" fill="#22c55e">🔒</text>
  <text x="50" y="135" font-size="9" fill="#22c55e">TLS</text>
  <text x="50" y="147" font-size="7.5" fill="#4ade80">Encrypted — server cert verified (CA cert optional)</text>
  <line x1="200" y1="140" x2="280" y2="140" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpc5-arr-g)"/>
  <text x="285" y="144" font-size="8" fill="#22c55e">:50443</text>

  <!-- mTLS row -->
  <rect x="20" y="168" width="322" height="44" rx="4" fill="#1a0533" stroke="#a855f7" stroke-width="0.8"/>
  <text x="30" y="185" font-size="11" fill="#a855f7">🛡</text>
  <text x="50" y="185" font-size="9" fill="#a855f7">mTLS</text>
  <text x="50" y="197" font-size="7.5" fill="#c084fc">Mutual TLS — client cert + key required</text>
  <line x1="200" y1="190" x2="280" y2="190" stroke="#a855f7" stroke-width="1.2" marker-end="url(#grpc5-arr-b)"/>
  <text x="285" y="194" font-size="8" fill="#a855f7">:50444</text>

  <!-- Legend: bottom row -->
  <text x="350" y="285" text-anchor="middle" font-size="11" fill="#a8b8cc">Lesson flow</text>

  <circle cx="42" cy="316" r="10" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="42" y="320" text-anchor="middle" font-size="9" fill="#3b82f6">1</text>
  <text x="42" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Tour</text>
  <line x1="53" y1="316" x2="82" y2="316" stroke="#3b82f6" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="93" cy="316" r="10" fill="#3b0a0a" stroke="#ef4444"/>
  <text x="93" y="320" text-anchor="middle" font-size="9" fill="#ef4444">2</text>
  <text x="93" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Fail plain</text>
  <line x1="104" y1="316" x2="133" y2="316" stroke="#3b82f6" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="144" cy="316" r="10" fill="#052e16" stroke="#22c55e"/>
  <text x="144" y="320" text-anchor="middle" font-size="9" fill="#22c55e">3</text>
  <text x="144" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Config TLS</text>
  <line x1="155" y1="316" x2="184" y2="316" stroke="#22c55e" marker-end="url(#grpc5-arr-g)"/>

  <circle cx="195" cy="316" r="10" fill="#052e16" stroke="#22c55e"/>
  <text x="195" y="320" text-anchor="middle" font-size="9" fill="#22c55e">4</text>
  <text x="195" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Send TLS</text>
  <line x1="206" y1="316" x2="235" y2="316" stroke="#3b82f6" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="246" cy="316" r="10" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="246" y="320" text-anchor="middle" font-size="9" fill="#3b82f6">5</text>
  <text x="246" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">SNI</text>
  <line x1="257" y1="316" x2="286" y2="316" stroke="#a855f7" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="297" cy="316" r="10" fill="#1a0533" stroke="#a855f7"/>
  <text x="297" y="320" text-anchor="middle" font-size="9" fill="#a855f7">6</text>
  <text x="297" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Config mTLS</text>
  <line x1="308" y1="316" x2="337" y2="316" stroke="#a855f7" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="348" cy="316" r="10" fill="#1a0533" stroke="#a855f7"/>
  <text x="348" y="320" text-anchor="middle" font-size="9" fill="#a855f7">7</text>
  <text x="348" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Send mTLS</text>
  <line x1="359" y1="316" x2="388" y2="316" stroke="#64748b" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="399" cy="316" r="10" fill="#1e293b" stroke="#64748b"/>
  <text x="399" y="320" text-anchor="middle" font-size="9" fill="#a8b8cc">8</text>
  <text x="399" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Vault</text>
</svg>`,
  };
