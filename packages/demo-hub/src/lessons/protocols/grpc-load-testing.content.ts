import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcLoadTestingConcept: GrpcDemoLesson['concept'] = {
  title: 'Load Testing: Concurrent Calls & Metrics',
  body:
    'gRPC Studio\'s **Load testing** panel runs **ghz-style** concurrent benchmarks from the browser — '
    + 'no extra tooling required. Configure Concurrency (parallel in-flight calls), Total requests, '
    + 'Duration or Ramp-up caps, a **Request rate (RPS)** throttle, and an optional '
    + '**Request body template** with `{{runId}}` interpolation.\n\n'
    + 'After the run you get a rich results panel: a **metrics grid** (Throughput, p50/p95/p99, '
    + 'Error rate), a **status breakdown** bar chart, a **latency histogram**, and a '
    + '**throughput over time** timeline.\n\n'
    + 'When two or more runs exist a **Run-to-run compare** section appears — colour-coded '
    + 'delta cards and a full metric detail table let you gate deployments against a saved baseline.\n\n'
    + 'Results export as **Copy / Download JSON** (with `sourceMetadata` for traceability) or '
    + '**Copy / Download CSV** for spreadsheets. The **run history selector** lets you switch '
    + 'between all recorded runs in the session.\n\n'
    + '**Saved profiles** store named configurations for repeatable benchmarks — reload in one click.',
  keyTerms: [
    {
      term: 'Concurrency',
      definition:
        'The number of parallel in-flight calls the load runner keeps open at any moment. Higher concurrency stresses connection pooling and server thread limits.',
    },
    {
      term: 'Throughput (RPS)',
      definition:
        'Requests per second — the rate at which completed calls are returned. The metrics grid shows actual achieved RPS alongside your configured rate cap.',
    },
    {
      term: 'Latency percentiles (p50/p95/p99)',
      definition:
        'The median, 95th, and 99th percentile response times. p99 catches tail latency that averages hide — critical for SLA evaluation.',
    },
    {
      term: 'Run-to-run compare',
      definition:
        'A diff view that appears after two or more runs. Delta cards show metric changes with colour coding (green = improved, red = regressed) so you can gate releases against a baseline.',
    },
    {
      term: 'Saved profile',
      definition:
        'A named snapshot of load test configuration (concurrency, total, duration, RPS, body template). Reload it in one click for repeatable benchmarks across sessions.',
    },
  ],
  diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 380" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc12-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc12-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
  </defs>

  <!-- Background -->
  <rect width="700" height="380" rx="10" fill="#0d1520"/>

  <!-- Title -->
  <text x="350" y="28" text-anchor="middle" font-size="13" fill="#e2e8f0" font-weight="600">Load Testing Flow</text>

  <!-- ── Left: Configuration panel ── -->
  <rect x="20" y="48" width="190" height="175" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="115" y="68" text-anchor="middle" font-size="10" fill="#93c5fd" font-weight="600">⚙ Configuration</text>

  <text x="32" y="90" font-size="8.5" fill="#a8b8cc">Concurrency</text>
  <rect x="120" y="80" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="92" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">10</text>

  <text x="32" y="114" font-size="8.5" fill="#a8b8cc">Total requests</text>
  <rect x="120" y="104" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="116" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">200</text>

  <text x="32" y="138" font-size="8.5" fill="#a8b8cc">RPS cap</text>
  <rect x="120" y="128" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">50</text>

  <text x="32" y="162" font-size="8.5" fill="#a8b8cc">Duration cap</text>
  <rect x="120" y="152" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="164" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">30s</text>

  <!-- Start button -->
  <rect x="55" y="185" width="120" height="26" rx="13" fill="#1d4ed8" stroke="#3b82f6" stroke-width="1"/>
  <text x="115" y="202" text-anchor="middle" font-size="10" fill="#ffffff" font-weight="600">▶ Start</text>

  <!-- ── Center: concurrent calls ── -->
  <line x1="210" y1="135" x2="265" y2="100" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc12-arr)"/>
  <line x1="210" y1="135" x2="265" y2="135" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc12-arr)"/>
  <line x1="210" y1="135" x2="265" y2="170" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc12-arr)"/>

  <rect x="268" y="80" width="130" height="28" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="333" y="98" text-anchor="middle" font-size="8" fill="#93c5fd">⚡ call 1  →  OK (2ms)</text>
  <rect x="268" y="115" width="130" height="28" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="333" y="133" text-anchor="middle" font-size="8" fill="#93c5fd">⚡ call 2  →  OK (4ms)</text>
  <rect x="268" y="150" width="130" height="28" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="333" y="168" text-anchor="middle" font-size="8" fill="#93c5fd">⚡ call N  →  OK (3ms)</text>
  <text x="333" y="198" text-anchor="middle" font-size="8" fill="#64748b">× 10 concurrent</text>

  <!-- Arrow to results -->
  <line x1="398" y1="135" x2="430" y2="135" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc12-arr-g)"/>

  <!-- ── Right: Metrics results panel ── -->
  <rect x="435" y="48" width="245" height="175" rx="6" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="557" y="68" text-anchor="middle" font-size="10" fill="#4ade80" font-weight="600">📊 Results</text>

  <!-- Metrics grid -->
  <rect x="445" y="78" width="108" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="499" y="92" text-anchor="middle" font-size="7.5" fill="#64748b">Throughput</text>
  <text x="499" y="105" text-anchor="middle" font-size="11" fill="#4ade80" font-weight="600">48.2 rps</text>

  <rect x="562" y="78" width="108" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="616" y="92" text-anchor="middle" font-size="7.5" fill="#64748b">Error rate</text>
  <text x="616" y="105" text-anchor="middle" font-size="11" fill="#4ade80" font-weight="600">0.0%</text>

  <rect x="445" y="118" width="70" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="480" y="132" text-anchor="middle" font-size="7.5" fill="#64748b">p50</text>
  <text x="480" y="145" text-anchor="middle" font-size="10" fill="#f1f5f9" font-weight="600">2ms</text>

  <rect x="522" y="118" width="70" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="557" y="132" text-anchor="middle" font-size="7.5" fill="#64748b">p95</text>
  <text x="557" y="145" text-anchor="middle" font-size="10" fill="#fbbf24" font-weight="600">8ms</text>

  <rect x="599" y="118" width="70" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="634" y="132" text-anchor="middle" font-size="7.5" fill="#64748b">p99</text>
  <text x="634" y="145" text-anchor="middle" font-size="10" fill="#f87171" font-weight="600">14ms</text>

  <!-- Mini histogram bars -->
  <text x="455" y="168" font-size="7.5" fill="#a8b8cc">Latency histogram</text>
  <rect x="445" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="445" y="190" width="14" height="20" rx="2" fill="#3b82f6"/>
  <rect x="463" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="463" y="178" width="14" height="32" rx="2" fill="#3b82f6"/>
  <rect x="481" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="481" y="184" width="14" height="26" rx="2" fill="#3b82f6"/>
  <rect x="499" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="499" y="196" width="14" height="14" rx="2" fill="#3b82f6"/>
  <rect x="517" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="517" y="202" width="14" height="8" rx="2" fill="#3b82f6"/>

  <!-- Run-to-run compare -->
  <text x="555" y="168" font-size="7.5" fill="#a8b8cc">Run compare</text>
  <rect x="545" y="174" width="60" height="18" rx="3" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="575" y="186" text-anchor="middle" font-size="7" fill="#4ade80">▲ +12% rps</text>
  <rect x="610" y="174" width="60" height="18" rx="3" fill="#2a1c1c" stroke="#ef4444" stroke-width="0.8"/>
  <text x="640" y="186" text-anchor="middle" font-size="7" fill="#f87171">▼ +3ms p99</text>

  <!-- Saved profile -->
  <rect x="545" y="198" width="125" height="16" rx="3" fill="#1e293b" stroke="#3b4a60"/>
  <text x="607" y="210" text-anchor="middle" font-size="7" fill="#a8b8cc">💾 Saved profile: baseline-v1</text>

  <!-- ── Bottom: Export/flow labels ── -->
  <text x="115" y="248" text-anchor="middle" font-size="9" fill="#64748b">Configure</text>
  <text x="333" y="248" text-anchor="middle" font-size="9" fill="#64748b">Execute (concurrent)</text>
  <text x="557" y="248" text-anchor="middle" font-size="9" fill="#64748b">Analyse &amp; Compare</text>

  <line x1="175" y1="244" x2="250" y2="244" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc12-arr)"/>
  <line x1="410" y1="244" x2="475" y2="244" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc12-arr-g)"/>

  <!-- Caption -->
  <text x="350" y="275" text-anchor="middle" font-size="9.5" fill="#a8b8cc">Configure → Fire concurrent calls → Read metrics, compare runs, export &amp; save profiles</text>
</svg>`,
};
