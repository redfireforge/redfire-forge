/** GRPC-16 Schema Discovery — concept panel */
import { GRPC_DEMO_TARGET } from './grpc-lesson-helpers';
import {
  SAMPLE_BSR_MODULE,
  SAMPLE_BSR_VERSION,
  SAMPLE_PROTO_SERVICE,
  SAMPLE_PROTO_SHARED,
  SAMPLE_PROTOSET,
  SAMPLE_URL_PROTO,
} from './grpc-schema-discovery-helpers';

export const grpcSchemaDiscoveryConcept = {
    title: 'How gRPC Studio Loads Schemas',
    body: `Before you can invoke an RPC, gRPC Studio needs the **service descriptor** — the compiled protobuf schema that defines method signatures, request shapes, and response shapes.

Studio supports five descriptor sources, in priority order:
1. **Server reflection** — pull live from the running server (fastest in dev/staging)
2. **Proto files** — upload raw .proto files + configure import paths
3. **Protoset** — upload a pre-compiled binary descriptor bundle (ideal for CI)
4. **URL** — reference a hosted descriptor file
5. **BSR (Buf Schema Registry)** — load from a module registry

Concrete samples used in this lesson:
- **Proto Files:** \`${SAMPLE_PROTO_SERVICE}\` + \`${SAMPLE_PROTO_SHARED}\`
- **Protoset:** \`${SAMPLE_PROTOSET}\`
- **URL:** \`${SAMPLE_URL_PROTO}\`
- **BSR:** \`${SAMPLE_BSR_MODULE}\` @ \`${SAMPLE_BSR_VERSION}\` (requires internet / public module availability)

In this lesson you will:
1. Set target \`${GRPC_DEMO_TARGET}\` and run **Reflect** to populate the explorer.
2. Confirm reflection as the active source and use explorer search.
3. Open **Manage Schemas** and orient across all source tabs.
4. Review the **root-aware Proto Files model** (\`protoRoots\`) with canonical preview and collision diagnostics.
5. Complete a full **Proto Files** workflow: select/create the **shared** root, upload two files, and load.
6. Use **Schema Browser** to inspect descriptors, copy a grpcurl command, and open a method in the call panel.
7. Run a concrete **Protoset** upload and verify source switch only after a successful load.
8. Run a concrete **URL** descriptor workflow and verify validation/parse behavior.
9. Run a concrete **BSR** registry workflow and verify real network-backed load behavior.
10. Review drift awareness and how descriptor source changes are surfaced in Studio.

Notes on runtime behavior:
- Source tab actions use real load outcomes (no simulated success path).
- Manage Schemas draft inputs are persisted per tab across refresh.
- Demo-run hygiene clears stale gRPC Studio draft/session keys before setup to keep lessons deterministic.

**Schema drift** — when a server's reflection changes after Studio has already cached descriptors, a drift banner appears. Studio lets you rebind per-service or dismiss the warning. Live drift simulation is covered in **Lesson 13 (\`grpc-schema-diff\`)**.`,
    keyTerms: [
      {
        term: 'Descriptor source',
        definition:
          'Where gRPC Studio gets proto type information — reflection, local file, binary protoset, URL, or BSR.',
      },
      {
        term: 'Server reflection',
        definition:
          'A built-in gRPC API that returns service descriptors at runtime so clients can discover services without local .proto files.',
      },
      {
        term: 'Import path',
        definition:
          'A search directory used to resolve relative imports across multi-file protobuf packages (e.g. "shared" for shared/common.proto).',
      },
      {
        term: 'Proto root',
        definition:
          'A virtual mount (`protoRoots`) that groups uploaded proto files by folder-like context and generates canonical paths for import resolution.',
      },
      {
        term: 'Canonical path preview',
        definition:
          'A live list of effective `<mountPath>/<file.path>` values used during descriptor resolution, helping catch path mistakes before loading.',
      },
      {
        term: 'Collision diagnostics',
        definition:
          'Warnings when file basenames or canonical paths conflict across roots, signaling potential ambiguous import resolution.',
      },
      {
        term: 'Protoset',
        definition:
          'A pre-compiled binary bundle (.pb) containing all proto descriptors — useful for CI and offline environments.',
      },
      {
        term: 'Schema Browser',
        definition:
          'A navigable tree of all services, messages, and enum types in the loaded descriptor — supports grpcurl copy and open-in-tab.',
      },
      {
        term: 'Schema drift',
        definition:
          'When the descriptors on file no longer match the running server\'s reflection. Studio surfaces a banner to guide rebinding.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 460" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpcd-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpcd-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpcd-arr-v" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#c084fc"/>
    </marker>
    <marker id="grpcd-arr-o" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="308" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — Schema Discovery: Reflection &amp; Proto Import</text>

  <!-- Connection bar -->
  <rect x="1" y="31" width="698" height="40" fill="#0f172a"/>
  <rect x="12" y="39" width="200" height="24" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1"/>
  <text x="22" y="55" font-family="monospace" font-size="10" fill="#f1f5f9">${GRPC_DEMO_TARGET}</text>
  <rect x="220" y="40" width="72" height="22" rx="11" fill="#052e16" stroke="#22c55e"/>
  <text x="256" y="55" text-anchor="middle" font-size="9" fill="#22c55e">Target OK</text>
  <rect x="302" y="40" width="72" height="22" rx="4" fill="#1e293b" stroke="#3b82f6"/>
  <text x="338" y="55" text-anchor="middle" font-size="10" fill="#3b82f6">Reflect</text>
  <rect x="384" y="40" width="116" height="22" rx="4" fill="#1e293b" stroke="#c084fc"/>
  <text x="442" y="55" text-anchor="middle" font-size="9.5" fill="#c084fc">Manage Schemas</text>

  <!-- Left: Service Explorer panel -->
  <rect x="12" y="84" width="200" height="212" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="24" y="103" font-size="10" fill="#a8b8cc">Service Explorer</text>
  <rect x="22" y="110" width="180" height="22" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="32" y="124" font-size="9" fill="#64748b">Search...</text>
  <text x="24" y="148" font-size="9.5" fill="#22d3ee">echo.EchoService</text>
  <text x="34" y="165" font-size="9" fill="#f1f5f9">Echo</text>
  <text x="34" y="181" font-size="8.5" fill="#64748b">ServerStream</text>
  <text x="34" y="196" font-size="8.5" fill="#64748b">ClientStream</text>
  <text x="34" y="211" font-size="8.5" fill="#64748b">BidiStream</text>
  <rect x="22" y="268" width="116" height="18" rx="9" fill="#1e293b" stroke="#22c55e"/>
  <text x="80" y="280" text-anchor="middle" font-size="8.5" fill="#22c55e">source: reflection</text>
  <circle cx="196" cy="148" r="8" fill="#3b82f6"/><text x="196" y="152" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">2</text>

  <!-- Middle: Manage Schemas modal -->
  <rect x="224" y="84" width="236" height="212" rx="5" fill="#0f172a" stroke="#c084fc"/>
  <text x="236" y="103" font-size="10" fill="#a8b8cc">Manage Schemas modal</text>
  <!-- tabs -->
  <rect x="236" y="110" width="60" height="18" rx="3" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="266" y="122" text-anchor="middle" font-size="8" fill="#93c5fd">Proto Files</text>
  <rect x="300" y="110" width="48" height="18" rx="3" fill="#111827" stroke="#334155"/>
  <text x="324" y="122" text-anchor="middle" font-size="8" fill="#64748b">Protoset</text>
  <rect x="352" y="110" width="28" height="18" rx="3" fill="#111827" stroke="#334155"/>
  <text x="366" y="122" text-anchor="middle" font-size="8" fill="#64748b">URL</text>
  <rect x="384" y="110" width="28" height="18" rx="3" fill="#111827" stroke="#334155"/>
  <text x="398" y="122" text-anchor="middle" font-size="8" fill="#64748b">BSR</text>
  <rect x="416" y="110" width="38" height="18" rx="3" fill="#111827" stroke="#c084fc"/>
  <text x="435" y="122" text-anchor="middle" font-size="8" fill="#c084fc">Schema</text>
  <!-- import path row -->
  <rect x="236" y="136" width="212" height="18" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="246" y="148" font-size="8.5" fill="#cbd5e1">Import path: shared</text>
  <!-- upload zone -->
  <rect x="236" y="162" width="212" height="80" rx="4" fill="#0a1118" stroke="#334155" stroke-dasharray="4,3"/>
  <text x="342" y="202" text-anchor="middle" font-size="9" fill="#64748b">Drop .proto files here</text>
  <text x="342" y="218" text-anchor="middle" font-size="8" fill="#475569">or browse</text>
  <circle cx="454" cy="136" r="8" fill="#c084fc"/><text x="454" y="140" text-anchor="middle" font-size="9" font-weight="700" fill="#0f172a">3</text>

  <!-- Right: Schema Browser -->
  <rect x="472" y="84" width="216" height="212" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="484" y="103" font-size="10" fill="#a8b8cc">Schema Browser</text>
  <rect x="484" y="110" width="192" height="22" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="494" y="124" font-size="8.5" fill="#60a5fa">Search: Echo</text>
  <text x="484" y="150" font-size="9.5" fill="#22d3ee">echo.EchoService</text>
  <text x="494" y="167" font-size="9" fill="#f1f5f9">Echo</text>
  <text x="494" y="183" font-size="8.5" fill="#64748b">ServerStream</text>
  <rect x="484" y="242" width="82" height="20" rx="10" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="525" y="256" text-anchor="middle" font-size="8.5" fill="#93c5fd">Copy grpcurl</text>
  <rect x="574" y="242" width="72" height="20" rx="10" fill="#052e16" stroke="#22c55e"/>
  <text x="610" y="256" text-anchor="middle" font-size="8.5" fill="#86efac">Open in tab</text>
  <circle cx="678" cy="150" r="8" fill="#22c55e"/><text x="678" y="154" text-anchor="middle" font-size="9" font-weight="700" fill="#052e16">4</text>

  <!-- Arrows -->
  <line x1="338" y1="55" x2="140" y2="84" stroke="#3b82f6" stroke-width="1.2" marker-end="url(#grpcd-arr)"/>
  <line x1="442" y1="62" x2="342" y2="84" stroke="#c084fc" stroke-width="1.2" marker-end="url(#grpcd-arr-v)"/>
  <line x1="460" y1="160" x2="472" y2="165" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpcd-arr-g)"/>
  <line x1="574" y1="252" x2="212" y2="200" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#grpcd-arr-o)"/>
  <text x="388" y="238" font-size="8" fill="#f59e0b" transform="rotate(-14, 388, 238)">open in call panel</text>

  <!-- Bottom: step legend -->
  <text x="350" y="338" text-anchor="middle" font-size="11" fill="#a8b8cc">Discovery workflow</text>

  <circle cx="70" cy="366" r="13" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="70" y="370" text-anchor="middle" font-size="10" fill="#3b82f6">1</text>
  <text x="70" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Set target</text>
  <text x="70" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">+ Reflect</text>
  <line x1="84" y1="366" x2="146" y2="366" stroke="#3b82f6" marker-end="url(#grpcd-arr)"/>

  <circle cx="160" cy="366" r="13" fill="#052e16" stroke="#22c55e"/>
  <text x="160" y="370" text-anchor="middle" font-size="10" fill="#22c55e">2</text>
  <text x="160" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Explorer</text>
  <text x="160" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">+ source badge</text>
  <line x1="174" y1="366" x2="236" y2="366" stroke="#c084fc" marker-end="url(#grpcd-arr-v)"/>

  <circle cx="250" cy="366" r="13" fill="#1f1736" stroke="#c084fc"/>
  <text x="250" y="370" text-anchor="middle" font-size="10" fill="#c084fc">3</text>
  <text x="250" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Manage</text>
  <text x="250" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">Schemas</text>
  <line x1="264" y1="366" x2="326" y2="366" stroke="#3b82f6" marker-end="url(#grpcd-arr)"/>

  <circle cx="340" cy="366" r="13" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="340" y="370" text-anchor="middle" font-size="10" fill="#3b82f6">4</text>
  <text x="340" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Schema</text>
  <text x="340" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">Browser</text>
  <line x1="354" y1="366" x2="416" y2="366" stroke="#22c55e" marker-end="url(#grpcd-arr-g)"/>

  <circle cx="430" cy="366" r="13" fill="#052e16" stroke="#22c55e"/>
  <text x="430" y="370" text-anchor="middle" font-size="10" fill="#22c55e">5</text>
  <text x="430" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Open Echo</text>
  <text x="430" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">in call panel</text>
</svg>`,
  };
