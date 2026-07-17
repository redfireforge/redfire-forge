/** GRPC-21 Environments & Collections — concept panel content */
import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcEnvCollectionsConcept: GrpcDemoLesson['concept'] = {
    title: 'Environments, Collections & History',
    body: `gRPC Studio supports **template variables** (\`{{name}}\`) in four places: the **target** address, **metadata** headers, the **request body**, and **auth** credentials. Variables are resolved at call time from two layered sources — the active microservice configuration and profile overrides.

| Variable source | Where it lives | Who sets it |
|---|---|---|
| \`{{grpcHost}}\` | Active env (gRPC endpoint) | Environment Manager → microservice Configure → gRPC tab |
| \`{{requestId}}\`, \`{{userId}}\`, … | **Protocol vars** (all environments) | Environment Manager → microservice Configure → Protocol vars badge |
| Env-specific overrides | **Env vars** (per environment) | Environment Manager → microservice Configure → Env vars badge |
| Profile-level overrides | Named connection profile | gRPC Studio settings |

**Interpolation Preview Strip** — appears below the target input whenever the field contains \`{{\`; shows the raw template and the fully resolved address side by side. An **Interpolation Error banner** blocks the call when a token cannot be resolved.

**Collections** store full call snapshots (target, method, metadata, body, auth template) in IndexedDB. Organise them into named folders; export to JSON to version-control or share with teammates.

**History** auto-logs every invocation. Auth token *values* are stripped before persist — shared history entries are safe. Click **Replay** to restore any historical call into the active Studio tab.

**What you will do in this lesson:**
1. **Open** the Environment Manager — configure the gRPC endpoint (provides \`{{grpcHost}}\`) and add Protocol Variables (\`requestId\`, \`userId\`) via the **Protocol vars** badge on the gRPC tab.
2. **Type** \`{{grpcHost}}\` in the target field and observe the Preview Strip.
3. **Switch** to a staging environment in the header and watch the strip update instantly.
4. **Add** \`x-request-id: {{requestId}}\` in the Metadata tab.
5. **Add** \`"userId": "{{userId}}"\` in the JSON body; view the resolved payload preview.
6. **Trigger** the Interpolation Error banner with an unknown token.
7. **Execute** an Echo call and **save** it to a new collection folder.
8. **Browse** the Collections tree; identify the rename button.
9. **Open** a saved request in Studio and confirm all settings are restored.
10. **Replay** a History entry into the active tab.
11. **Export** the collection to JSON; note the Import button for round-trip sharing.`,
    keyTerms: [
      {
        term: '{{grpcHost}}',
        definition:
          'Reserved gRPC interpolation variable. Resolves to the `host:port` of the active gRPC endpoint — no scheme. Set via the deployed endpoint in the microservice Configure panel → gRPC tab.',
      },
      {
        term: 'Protocol vars & Env vars',
        definition:
          'Two layers of custom variables per microservice. **Protocol vars** (opened via the Protocol vars badge on any protocol tab) are global — same key/value for all environments. **Env vars** (opened via the Env vars badge on a deployed row) are per-environment overrides; an empty value deletes the inherited Protocol var for that env. Both layers are lower priority than protocol-derived vars (e.g. `{{grpcHost}}` from the gRPC endpoint).',
      },
      {
        term: 'Interpolation Preview Strip',
        definition:
          'The blue bar that appears below the target input when `{{` is detected. Shows the raw template and the resolved address. A toggle switches between the two views.',
      },
      {
        term: 'Collections',
        definition:
          'Persistent, folder-organised snapshots of gRPC call configurations stored in IndexedDB. Survives browser restarts; exportable as JSON.',
      },
      {
        term: 'History',
        definition:
          'Automatic log of every gRPC invocation, including metadata, body, and response. Auth token values are stripped before storage. Replay restores a historical call into the active Studio tab.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 300" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc21-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
  </defs>

  <!-- Workspace Defaults box -->
  <rect x="14" y="20" width="190" height="100" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="109" y="38" text-anchor="middle" font-size="10" fill="#94a3b8">Workspace Defaults</text>
  <rect x="24" y="46" width="170" height="22" rx="4" fill="#1e293b"/>
  <text x="109" y="61" text-anchor="middle" font-size="9" fill="#60a5fa">grpcHost = localhost:50051</text>
  <rect x="24" y="72" width="170" height="22" rx="4" fill="#1e293b"/>
  <text x="109" y="87" text-anchor="middle" font-size="9" fill="#60a5fa">requestId = req-demo-001</text>
  <rect x="24" y="98" width="170" height="22" rx="4" fill="#1e293b"/>
  <text x="109" y="113" text-anchor="middle" font-size="9" fill="#60a5fa">userId = user-42</text>

  <!-- Arrow right to Target -->
  <line x1="204" y1="70" x2="268" y2="70" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc21-arr)"/>
  <text x="236" y="64" text-anchor="middle" font-size="8" fill="#64748b">resolves</text>

  <!-- Target field box -->
  <rect x="268" y="44" width="200" height="50" rx="8" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="368" y="62" text-anchor="middle" font-size="9" fill="#94a3b8">Target field</text>
  <text x="368" y="82" text-anchor="middle" font-size="10" fill="#f1f5f9" font-weight="600">{{grpcHost}}</text>

  <!-- Arrow down to Preview Strip -->
  <line x1="368" y1="94" x2="368" y2="128" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc21-arr)"/>

  <!-- Interpolation Preview Strip -->
  <rect x="268" y="128" width="200" height="38" rx="6" fill="#172554" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="368" y="148" text-anchor="middle" font-size="8" fill="#93c5fd">Preview Strip</text>
  <text x="368" y="162" text-anchor="middle" font-size="9" fill="#bfdbfe">localhost:50051</text>

  <!-- Collections -->
  <rect x="14" y="160" width="190" height="70" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="109" y="178" text-anchor="middle" font-size="10" fill="#94a3b8">Collections (IndexedDB)</text>
  <rect x="24" y="186" width="170" height="36" rx="4" fill="#1e293b"/>
  <text x="109" y="200" text-anchor="middle" font-size="9" fill="#a78bfa">📁 Echo Demos</text>
  <text x="125" y="216" text-anchor="middle" font-size="8" fill="#8b5cf6">  Echo — Hello World</text>

  <!-- Arrow Collections → Studio -->
  <line x1="204" y1="196" x2="268" y2="196" stroke="#8b5cf6" stroke-width="1.2" marker-end="url(#grpc21-arr)"/>
  <text x="236" y="190" text-anchor="middle" font-size="7.5" fill="#64748b">Open in Studio</text>

  <!-- History -->
  <rect x="488" y="20" width="180" height="100" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="578" y="38" text-anchor="middle" font-size="10" fill="#94a3b8">History (IndexedDB)</text>
  <rect x="498" y="46" width="160" height="22" rx="4" fill="#1e293b"/>
  <text x="578" y="61" text-anchor="middle" font-size="8" fill="#86efac">Echo ✓  12ms  localhost:50051</text>
  <rect x="498" y="72" width="160" height="22" rx="4" fill="#1e293b"/>
  <text x="578" y="87" text-anchor="middle" font-size="8" fill="#86efac">Echo ✓  9ms   localhost:50051</text>
  <text x="578" y="106" text-anchor="middle" font-size="8" fill="#64748b">auth tokens stripped ✓</text>

  <!-- Arrow History → Studio -->
  <line x1="488" y1="80" x2="468" y2="150" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpc21-arr)"/>
  <text x="494" y="120" text-anchor="middle" font-size="7.5" fill="#64748b">Replay</text>

  <!-- Studio Call Panel -->
  <rect x="268" y="180" width="200" height="60" rx="8" fill="#0f2b1a" stroke="#22c55e" stroke-width="1.5"/>
  <text x="368" y="200" text-anchor="middle" font-size="10" fill="#94a3b8">Studio Tab</text>
  <text x="368" y="218" text-anchor="middle" font-size="9" fill="#4ade80">Echo ▶ Send</text>
  <text x="368" y="234" text-anchor="middle" font-size="8" fill="#86efac">x-request-id: req-demo-001</text>
</svg>`,
};
