/**
 * Lesson GRPC-24: Workflow Runner & Results
 *
 * Thin barrel — helpers and steps live in sibling modules.
 */
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import { grpcWorkflowRunnerSetup, grpcWorkflowRunnerCleanup } from './grpc-workflow-runner-helpers';
import { grpcWorkflowRunnerSteps } from './grpc-workflow-runner-steps';

const GRPC_WR_ROSTER = getGrpcLessonRosterEntry('grpc-workflow-runner')!;

export const grpcWorkflowRunnerLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC_WR_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  grpc: buildGrpcContractMetaFromRoster(GRPC_WR_ROSTER),
  description:
    'Build a gRPC Echo workflow with a grpcTarget variable, run Quick Test, then graduate it to the Workflow Runner — configure iterations, override variables per-run, and drill into the Results Dashboard.',

  setup: grpcWorkflowRunnerSetup,
  cleanup: grpcWorkflowRunnerCleanup,

  concept: {
    title: 'Workflow Runner & Results — Variables, Iterations, and Persistent History',
    body: `**Quick Test** in the Workflow Designer is a development tool: it runs once, shows pass/fail on the canvas, and discards the result when you navigate away. The **Workflow Runner** is where workflows graduate to production-grade test execution — every run is **saved, timestamped, and explorable** in the Results Dashboard.

**Why workflow variables before running?**
The gRPC Unary node can reference \`{{grpcTarget}}\` instead of a hardcoded \`localhost:50051\`. The Variables default (\`localhost:50051\`) also drives **design-time reflection**, so Service/Method stay as dropdowns while the field keeps the portable template. When you open the workflow in the Workflow Runner, that variable appears in the **Initial Variables** panel as an overridable row. You can point the exact same workflow at staging or production without ever editing a node — just change the value in the panel and click Run. This is the key difference between a workflow that is **configurable** and one that is hardwired.

**Why three iterations?**
Quick Test runs the workflow once. The Workflow Runner's **Iterations** field runs it N times, collecting one result row per call per iteration. With 3 iterations you get 3 Echo Call rows in the Results Dashboard — enough to see p50/p95 latency cards, the latency histogram, and per-request detail without a long wait.

**Why the Results Explorer after viewing the Dashboard?**
The Dashboard's metric cards summarize all iterations. The **Results Explorer** lets you drill into a single iteration: the canvas shows which node passed or failed, the detail panel shows the exact variable snapshot (\`echoReply\`), and the iteration matrix compares all runs side by side. This is the tool you reach for when a load test shows 3% failure rate and you need to find which iteration broke and why.`,
    keyTerms: [
      {
        term: 'Workflow Variable',
        definition:
          'A named default value defined in the Variables modal (Designer toolbar). Referenced as `{{name}}` inside any node field. Appears as an overridable row in the Workflow Runner\'s Initial Variables panel.',
      },
      {
        term: 'Initial Variables',
        definition:
          'The panel in the Workflow Runner that lists every workflow-level variable with its default value. Override any value before running without editing the workflow.',
      },
      {
        term: 'grpcTarget',
        definition:
          'The workflow variable defined in this lesson. Its default is `localhost:50051` — used for design-time reflection (Service/Method dropdowns) and as the runtime default. Override it to `localhost:50443` for TLS or to a remote address without changing the Echo Call node.',
      },
      {
        term: 'Iterations',
        definition:
          'How many times the full workflow runs in one Workflow Runner execution. Each iteration is independent and produces one row per gRPC call in the Results Dashboard.',
      },
      {
        term: 'Results Explorer',
        definition:
          'Three-panel modal (canvas overlay + detail panel + iteration matrix) for inspecting per-node execution state, variable snapshots, and pass/fail counts across all iterations.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 420" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,-apple-system,sans-serif">
  <!-- Window chrome -->
  <rect width="700" height="420" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
  <rect width="700" height="32" rx="10" fill="#1e293b"/>
  <rect y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="20" cy="16" r="5" fill="#ef4444" opacity="0.8"/>
  <circle cx="38" cy="16" r="5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="56" cy="16" r="5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="21" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="500">GRPC-24 — Workflow Runner &amp; Results</text>

  <!-- Tab bar -->
  <rect y="32" width="700" height="28" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <rect x="0" y="42" width="76" height="18" rx="3" fill="#0f172a"/>
  <text x="38" y="55" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="600">Workflow</text>
  <rect x="80" y="42" width="100" height="18" rx="3" fill="transparent"/>
  <text x="130" y="55" text-anchor="middle" fill="#64748b" font-size="9">Workflow Runner</text>
  <rect x="184" y="42" width="58" height="18" rx="3" fill="transparent"/>
  <text x="213" y="55" text-anchor="middle" fill="#64748b" font-size="9">Results</text>

  <!-- ── TOP ROW: Designer canvas (left) + Variables modal (right) ── -->
  <!-- Designer canvas -->
  <rect x="0" y="60" width="370" height="170" fill="#0f172a"/>
  <text x="14" y="78" fill="#94a3b8" font-size="8" font-weight="600" letter-spacing="0.3">WORKFLOW DESIGNER — gRPC Echo Demo</text>
  <!-- Grid dots -->
  <pattern id="grid24" x="0" y="60" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="10" cy="10" r="0.7" fill="#1e2d45" opacity="0.5"/>
  </pattern>
  <rect x="0" y="82" width="370" height="148" fill="url(#grid24)"/>
  <!-- Workflow nodes -->
  <rect x="20" y="140" width="48" height="30" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="44" y="159" text-anchor="middle" fill="#93c5fd" font-size="9">Start</text>
  <line x1="68" y1="155" x2="90" y2="155" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr24)"/>
  <!-- grpcUnary node -->
  <rect x="90" y="124" width="120" height="62" rx="7" fill="#14532d" stroke="#22c55e" stroke-width="1.8"/>
  <text x="150" y="143" text-anchor="middle" fill="#86efac" font-size="9" font-weight="700">Echo Call</text>
  <text x="150" y="155" text-anchor="middle" fill="#6ee7b7" font-size="7.5">grpcUnary</text>
  <text x="150" y="166" text-anchor="middle" fill="#94a3b8" font-size="7">target: {{grpcTarget}}</text>
  <text x="150" y="177" text-anchor="middle" fill="#94a3b8" font-size="7">echo.EchoService/Echo</text>
  <rect x="178" y="125" width="30" height="14" rx="4" fill="#22c55e"/>
  <text x="193" y="135" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">✓ 19ms</text>
  <line x1="210" y1="155" x2="232" y2="155" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr24)"/>
  <!-- grpcAssert node -->
  <rect x="232" y="130" width="100" height="50" rx="7" fill="#14532d" stroke="#22c55e" stroke-width="1.8"/>
  <text x="282" y="149" text-anchor="middle" fill="#86efac" font-size="9" font-weight="700">Assert Echo</text>
  <text x="282" y="161" text-anchor="middle" fill="#6ee7b7" font-size="7.5">source: echoReply</text>
  <text x="282" y="172" text-anchor="middle" fill="#94a3b8" font-size="7">grpcStatus==0, msg✓</text>
  <rect x="306" y="131" width="24" height="14" rx="4" fill="#22c55e"/>
  <text x="318" y="141" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">✓ OK</text>
  <line x1="332" y1="155" x2="348" y2="155" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr24)"/>
  <rect x="348" y="140" width="16" height="30" rx="6" fill="#1e293b" stroke="#3b4a60" stroke-width="1.5"/>
  <text x="356" y="159" text-anchor="middle" fill="#94a3b8" font-size="7">End</text>
  <!-- Arrowhead -->
  <defs>
    <marker id="arr24" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6"/>
    </marker>
  </defs>
  <!-- Canvas toolbar -->
  <rect x="0" y="210" width="370" height="20" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <rect x="6" y="213" width="72" height="14" rx="3" fill="#3b82f6"/>
  <text x="42" y="223" text-anchor="middle" fill="#fff" font-size="8">▶ Quick Test</text>
  <rect x="84" y="213" width="42" height="14" rx="3" fill="transparent" stroke="#3b4a60" stroke-width="1"/>
  <text x="105" y="223" text-anchor="middle" fill="#64748b" font-size="8">Debug</text>

  <!-- Divider -->
  <line x1="374" y1="60" x2="374" y2="230" stroke="#334155" stroke-width="1"/>

  <!-- Variables modal -->
  <rect x="378" y="60" width="318" height="170" fill="#0f172a"/>
  <text x="392" y="78" fill="#94a3b8" font-size="8" font-weight="600" letter-spacing="0.3">VARIABLES MODAL (Designer → Variables button)</text>
  <rect x="382" y="82" width="310" height="130" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="394" y="99" fill="#94a3b8" font-size="9" font-weight="700">Workflow Variables</text>
  <text x="394" y="113" fill="#475569" font-size="7.5">Values defined here are the defaults for every run. Reference them</text>
  <text x="394" y="123" fill="#475569" font-size="7.5">inside node fields as {{name}} — e.g. target: {{grpcTarget}}.</text>
  <line x1="382" y1="128" x2="692" y2="128" stroke="#334155" stroke-width="0.5"/>
  <!-- Variable row -->
  <text x="394" y="143" fill="#94a3b8" font-size="8" font-weight="600">Name</text>
  <text x="510" y="143" fill="#94a3b8" font-size="8" font-weight="600">Default Value</text>
  <rect x="388" y="148" width="108" height="16" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="395" y="159" fill="#60a5fa" font-size="8">grpcTarget</text>
  <rect x="502" y="148" width="180" height="16" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="509" y="159" fill="#e2e8f0" font-size="8">localhost:50051</text>
  <!-- Add row (empty) -->
  <rect x="388" y="168" width="108" height="16" rx="3" fill="#0f172a" stroke="#334155" stroke-width="1"/>
  <text x="395" y="179" fill="#475569" font-size="8">name</text>
  <rect x="502" y="168" width="180" height="16" rx="3" fill="#0f172a" stroke="#334155" stroke-width="1"/>
  <text x="509" y="179" fill="#475569" font-size="8">value</text>
  <rect x="688" y="148" width="0" height="0"/>
  <!-- Save button -->
  <rect x="618" y="196" width="68" height="14" rx="3" fill="#3b82f6"/>
  <text x="652" y="206" text-anchor="middle" fill="#fff" font-size="8">Save</text>

  <!-- ── BOTTOM ROW: Workflow Runner (left) + Initial Variables (right) ── -->
  <line x1="0" y1="234" x2="700" y2="234" stroke="#334155" stroke-width="1"/>

  <!-- Workflow Runner -->
  <rect x="0" y="238" width="340" height="182" fill="#0f172a"/>
  <text x="14" y="256" fill="#94a3b8" font-size="8" font-weight="600" letter-spacing="0.3">WORKFLOW RUNNER</text>
  <!-- Workflow selector -->
  <text x="14" y="272" fill="#94a3b8" font-size="8">Workflow</text>
  <rect x="10" y="276" width="240" height="18" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="22" y="288" fill="#e2e8f0" font-size="8">gRPC Echo Demo</text>
  <text x="236" y="288" fill="#64748b" font-size="9">▾</text>
  <!-- Run button -->
  <rect x="10" y="318" width="120" height="20" rx="5" fill="#3b82f6"/>
  <text x="70" y="332" text-anchor="middle" fill="#fff" font-size="9" font-weight="600">▶ Run Workflow</text>
  <!-- Progress bar -->
  <rect x="10" y="346" width="260" height="12" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
  <rect x="10" y="346" width="180" height="12" rx="3" fill="#1d4ed8" opacity="0.7"/>
  <text x="100" y="356" text-anchor="middle" fill="#fff" font-size="7">2 / 3 iterations · 0.6s</text>
  <!-- Completion banner -->
  <rect x="10" y="364" width="260" height="26" rx="5" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
  <text x="64" y="374" fill="#86efac" font-size="7.5">Completed — 3 requests in 0.87s</text>
  <text x="140" y="384" text-anchor="middle" fill="#22c55e" font-size="7.5" font-weight="600">View Full Results →</text>
  <!-- Exec config section -->
  <rect x="10" y="296" width="260" height="20" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="20" y="308" fill="#94a3b8" font-size="7.5">Iterations</text>
  <rect x="60" y="299" width="26" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="73" y="309" text-anchor="middle" fill="#e2e8f0" font-size="8">3</text>
  <text x="98" y="308" fill="#94a3b8" font-size="7.5">Concurrency</text>
  <rect x="158" y="299" width="24" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="170" y="309" text-anchor="middle" fill="#e2e8f0" font-size="8">1</text>

  <!-- Divider -->
  <line x1="344" y1="238" x2="344" y2="420" stroke="#334155" stroke-width="1"/>

  <!-- Initial Variables panel (key teaching area) -->
  <rect x="348" y="238" width="352" height="182" fill="#0f172a"/>
  <text x="362" y="256" fill="#94a3b8" font-size="8" font-weight="600" letter-spacing="0.3">INITIAL VARIABLES — Workflow Runner</text>
  <rect x="352" y="260" width="340" height="110" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="364" y="276" fill="#475569" font-size="7.5">Override workflow defaults for this run only — no canvas edits needed.</text>
  <line x1="352" y1="281" x2="692" y2="281" stroke="#334155" stroke-width="0.5"/>
  <!-- Variable row header -->
  <text x="364" y="294" fill="#94a3b8" font-size="7.5" font-weight="600">Variable</text>
  <text x="500" y="294" fill="#94a3b8" font-size="7.5" font-weight="600">Value (override per-run)</text>
  <line x1="352" y1="297" x2="692" y2="297" stroke="#334155" stroke-width="0.5"/>
  <!-- grpcTarget row - highlighted as the key element -->
  <rect x="354" y="300" width="336" height="20" rx="3" fill="#1e3a5f" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="364" y="313" fill="#93c5fd" font-size="8" font-weight="600">grpcTarget</text>
  <rect x="492" y="302" width="190" height="16" rx="3" fill="#0f172a" stroke="#3b82f6" stroke-width="1"/>
  <text x="499" y="313" fill="#e2e8f0" font-size="8">localhost:50051</text>
  <text x="620" y="313" fill="#60a5fa" font-size="7">← editable</text>
  <!-- Annotation: staging override -->
  <line x1="500" y1="322" x2="500" y2="336" stroke="#f59e0b" stroke-width="0.8" stroke-dasharray="3,2"/>
  <rect x="430" y="336" width="200" height="16" rx="3" fill="#431407" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="530" y="347" text-anchor="middle" fill="#fed7aa" font-size="7.5">e.g. staging-grpc.acme.com:443</text>
  <!-- Explanation -->
  <text x="362" y="382" fill="#475569" font-size="7.5">grpcTarget is defined in the workflow Variables modal.</text>
  <text x="362" y="393" fill="#475569" font-size="7.5">The Unary node uses target: {{grpcTarget}} — this row overrides</text>
  <text x="362" y="404" fill="#475569" font-size="7.5">the default for this run only, without editing the workflow.</text>

  <!-- Bottom caption -->
  <rect x="0" y="400" width="700" height="20" fill="#0f172a"/>
  <rect x="0" y="400" width="700" height="1" fill="#334155"/>
  <text x="350" y="415" text-anchor="middle" fill="#475569" font-size="9">Protocols → gRPC → GRPC-24 Workflow Runner &amp; Results</text>
</svg>`,
  },
  steps: grpcWorkflowRunnerSteps,
};
