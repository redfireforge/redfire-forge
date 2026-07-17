# Demo Player v2 — Interactive Learning Hub

## Scope (Phase 1)
- Only **Protocols → WebSocket** domain (partial)
- 2 lessons: "WebSocket Basics" + "Auth & Transport"
- Full architecture built, but only WS content populated

---

## Navigation Flow

```
Header ▶ Button → Learning Hub (full-panel overlay)
  ├── Level 1: Domain Selection (cards with progress rings)
  │   API | Workflow | Harness | Protocols ← only this one populated
  │
  ├── Level 2: Lesson List (within Protocols domain)
  │   1. WebSocket Basics ← implemented
  │   2. Auth & Transport ← implemented
  │   3. Console & Debugging (placeholder)
  │   4. Advanced Filtering (placeholder)
  │
  └── Level 3: Lesson Playback (two phases per lesson)
      Phase A — "Concept" (rich text explanation, ~30s)
      Phase B — "Live Demo" (real UI actions with spotlight)
```

---

## Component Architecture

```
src/features/demo-player/
├── types.ts                    ← update with v2 types
├── DemoHub.tsx                 ← full-panel overlay (entry point)
├── DemoHubHeader.tsx           ← breadcrumb + close
├── DomainSelector.tsx          ← Level 1: domain cards with progress
├── LessonList.tsx              ← Level 2: lessons within a domain
├── LessonPlayer.tsx            ← Level 3: orchestrates phases
├── ConceptSlide.tsx            ← Phase A: rich explanation
├── LiveDemo.tsx                ← Phase B: spotlight + narration + actions
├── LessonControls.tsx          ← play/pause, speed slider, progress
├── LessonSidebar.tsx           ← step TOC (clickable)
├── DemoSpotlight.tsx           ← (keep existing, already works)
├── useDemoPlayer.ts            ← refactor for v2 state machine
├── useDemoProgress.ts          ← NEW: persisted progress tracking
├── suites/                     ← rename to lessons/
│   ├── index.ts
│   └── protocols/
│       ├── ws-basics.lesson.ts
│       └── ws-auth-transport.lesson.ts
└── demo-player.css             ← rename from styles/demo-player.css
```

---

## Type System (v2)

```typescript
/** Domain = top-level product area */
interface DemoDomain {
  id: 'api' | 'workflow' | 'harness' | 'protocols';
  name: string;
  icon: string;           // emoji
  description: string;
  lessons: DemoLesson[];
}

/** Lesson = one complete learning unit */
interface DemoLesson {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  initialTab?: string;    // navigate here before starting
  concept: ConceptSlide;  // Phase A
  steps: DemoStep[];      // Phase B (live demo)
}

/** Phase A — explain the concept before showing how */
interface ConceptSlide {
  title: string;
  /** Rich markdown content — supports headers, bullet lists, bold, code */
  body: string;
  /** Optional: key terms with short definitions */
  keyTerms?: { term: string; definition: string }[];
  /** Optional: diagram (rendered as inline SVG or simple illustration) */
  diagram?: string;       // SVG string or mermaid code
}

/** Phase B — a single step in the live demo */
interface DemoStep {
  id: string;
  title: string;
  description: string;
  highlight?: string;     // CSS selector to spotlight
  action?: (ctx: DemoActionContext) => Promise<void>;
  pauseAfter?: number;    // ms override for auto-play
}

/** Persisted progress */
interface DemoProgress {
  completedLessons: string[];  // lesson IDs
  currentLesson?: string;
  currentStep?: number;
  playSpeed: number;           // 0.5 | 1 | 1.5 | 2
}
```

---

## UI Layout

### Level 1 — Domain Selection
```
┌──────────────────────────────────────────────────────────────┐
│ 🎓 Learning Hub                                         [✕]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Choose a product area to explore:                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    🔌    │  │    ⚡    │  │    🧪    │  │    📡    │   │
│  │   API    │  │ Workflow │  │ Harness  │  │Protocols │   │
│  │          │  │          │  │          │  │          │   │
│  │ 4 lessons│  │ 3 lessons│  │ 5 lessons│  │ 2 lessons│   │
│  │ ░░░░░░░ │  │ ░░░░░░░ │  │ ░░░░░░░ │  │ ██░░░░░ │   │
│  │  0%     │  │  0%     │  │  0%     │  │  50%    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  "coming soon" badges on API/Workflow/Harness               │
└──────────────────────────────────────────────────────────────┘
```

### Level 2 — Lesson List (Protocols)
```
┌──────────────────────────────────────────────────────────────┐
│ 🎓 Learning Hub > Protocols                             [✕]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📡 Protocols — Real-time communication testing             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ✅ 1. WebSocket Basics                        ~3 min   │ │
│  │    Connect, send messages, monitor events              │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ ○  2. Auth & Transport                        ~4 min   │ │
│  │    Authentication types, proxy vs direct transport     │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 🔒 3. Console & Debugging                    coming    │ │
│  │    Command-line tools for protocol inspection         │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 🔒 4. Advanced Filtering                     coming    │ │
│  │    Search, diff, schema validation on events          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [← Back to domains]                                        │
└──────────────────────────────────────────────────────────────┘
```

### Level 3 — Lesson Player (Phase A: Concept)
```
┌──────────────────────────────────────────────────────────────┐
│ 🎓 Protocols > WebSocket Basics                         [✕]  │
├──────────┬───────────────────────────────────────────────────┤
│ Steps    │                                                   │
│          │  📖 Understanding WebSocket                       │
│ ● Concept│                                                   │
│ ○ Step 1 │  WebSocket is a full-duplex communication         │
│ ○ Step 2 │  protocol that provides persistent connections    │
│ ○ Step 3 │  between client and server.                       │
│ ○ Step 4 │                                                   │
│ ○ Step 5 │  Key Concepts:                                    │
│ ○ Step 6 │  • **Handshake** — HTTP upgrade to WS            │
│ ○ Step 7 │  • **Frames** — smallest data unit               │
│ ○ Step 8 │  • **Events** — open, message, close, error      │
│          │                                                   │
│          │  ┌─────────────────────────────────┐             │
│          │  │  Client ←──── frames ────→ Server│             │
│          │  │    ↕ full-duplex ↕               │             │
│          │  └─────────────────────────────────┘             │
│          │                                                   │
├──────────┴───────────────────────────────────────────────────┤
│ [← Back]   ●━━━━━━━━━━━━━━━━━━━━━○○○○○○○○   [Start Demo →] │
│            Phase: Concept          Speed: [0.5x][1x][1.5x][2x]│
└──────────────────────────────────────────────────────────────┘
```

### Level 3 — Lesson Player (Phase B: Live Demo)
```
The full-panel closes. App is visible. Floating panel appears:

┌─ App UI visible with spotlight on target element ───────────┐
│                                                              │
│  ┌─[spotlight on "Client" button]────┐                      │
│  │       Client                       │                      │
│  └────────────────────────────────────┘                      │
│                                                              │
│                                                              │
│                   ┌─────────────────────────────────────┐   │
│                   │ WebSocket Basics  ·  Step 1 of 8    │   │
│                   │                                     │   │
│                   │ Welcome to WebSocket Studio          │   │
│                   │ This is your workspace for real-time │   │
│                   │ WebSocket testing...                 │   │
│                   │                                     │   │
│                   │ [◀ Back] [▶ 1x ▼] [Next ▶] [TOC]  │   │
│                   │ ━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│                   └─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Lesson Content — WebSocket Basics

### Phase A: Concept Slide
```
Title: Understanding WebSocket

Body:
  WebSocket provides **full-duplex** communication over a single TCP 
  connection. Unlike HTTP request-response, both sides can send data 
  at any time.

  **How it works:**
  1. Client sends HTTP Upgrade request
  2. Server responds with 101 Switching Protocols
  3. Persistent connection established
  4. Both sides exchange frames freely

Key Terms:
  - Frame: The smallest unit of WebSocket data
  - Handshake: The initial HTTP→WS upgrade
  - Subprotocol: An agreed format for messages (STOMP, GraphQL-WS)

Diagram: (simple client↔server arrow diagram)
```

### Phase B: Live Demo Steps
1. Welcome to WebSocket Studio (highlight Client button)
2. Enter a WebSocket URL (highlight URL input)
3. Connect to the Server (highlight Connect button)
4. Compose a Message (navigate to Compose tab, highlight textarea)
5. Send Your Message (highlight Send button)
6. Monitor Live Events (switch to Events tab, highlight event list)
7. Multiple Connections (highlight + tab button)
8. Disconnect (highlight Disconnect button)

---

## Lesson Content — Auth & Transport

### Phase A: Concept Slide
```
Title: Authentication & Transport Modes

Body:
  WebSocket authentication is uniquely challenging because browsers 
  cannot set custom HTTP headers on the WebSocket handshake request.

  **Three Transport Modes:**
  • Direct — browser-native, no custom headers possible
  • Proxy — backend relays headers on your behalf  
  • Native — Tauri desktop app, full header control

  **Auth triggers transport:**
  When you use Bearer/Basic/API-Key auth with headers,
  RedfireForge automatically switches to Proxy transport.

Key Terms:
  - Transport: How the WS connection is physically established
  - Proxy mode: Server-side relay for header injection
  - TLS: Encryption layer (wss:// URLs)
```

### Phase B: Live Demo Steps
1. Open the Auth tab (highlight Auth tab)
2. Choose auth type (highlight type dropdown)
3. Bearer token example (fill token field)
4. Transport auto-switch callout (highlight info banner)
5. Protocol selector (highlight Connect tab, protocol dropdown)
6. TLS settings (scroll to TLS panel)
7. Transport badge on tab (highlight connection tab badge)

---

## Speed Control Behavior

| Speed | Step pause | Concept slide auto-advance |
|-------|-----------|---------------------------|
| 0.5x  | 6s        | 60s                       |
| 1x    | 3s        | 30s                       |
| 1.5x  | 2s        | 20s                       |
| 2x    | 1.5s      | 15s                       |

User can always:
- Click Next to skip immediately
- Click the speed button to cycle speeds
- Press Space to pause/resume
- Press ← → to manually navigate

---

## Progress Persistence

```typescript
// localStorage key: 'redfire-demo-progress-v2'
{
  completedLessons: ['ws-basics'],
  currentLesson: 'ws-auth-transport',
  currentStep: 3,
  playSpeed: 1
}
```

- Progress rings on domain cards show % of lessons completed
- Completed lessons show ✅ in the list
- Resuming shows "Continue where you left off?" prompt

---

## Implementation Order

### Phase 1 (this implementation)
- [x] Types (DemoDomain, DemoLesson, ConceptSlide)
- [ ] DemoHub full-panel overlay
- [ ] DemoHubHeader (breadcrumb nav)
- [ ] DomainSelector (4 cards, only Protocols active)
- [ ] LessonList (list within Protocols)
- [ ] LessonPlayer orchestrator
- [ ] ConceptSlide renderer (markdown-like rich text)
- [ ] LiveDemo (refactor existing spotlight + panel)
- [ ] LessonControls (speed slider, progress bar)
- [ ] LessonSidebar (step TOC)
- [ ] useDemoProgress hook (localStorage persistence)
- [ ] 2 lesson definitions (ws-basics, ws-auth-transport)
- [ ] CSS (full-panel layout, concept styling, controls)
- [ ] Integration (replace v1 trigger with Hub launch)

### Phase 2 (future)
- [ ] "Try It" challenges (Phase C)
- [ ] More lessons (Console, Filtering, SSE)
- [ ] API domain lessons
- [ ] Workflow domain lessons
- [ ] Harness domain lessons
- [ ] Animated diagrams in concept slides
- [ ] Video snippets option
