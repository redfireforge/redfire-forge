# Demo Player v2 — Implementation Plan (Option A)

## Philosophy
> **Offline-first, live-enhanced.** The demo always works via curated content.
> When the real UI is available, we overlay live automation as a bonus.
> The user experience is seamless regardless of mode.

## Scope
- Full Hub UI with polished transitions
- Live demo mode only (image fallback infrastructure typed but not populated)
- Only **Protocols → WebSocket** domain (2 lessons)
- Other domains show as "Coming Soon" cards

---

## Architecture Overview

```
User clicks ▶ in header
       │
       ▼
┌─────────────────────────────────────────────────┐
│  DemoHub (full-panel overlay, z-index: 10090)   │
│                                                 │
│  State Machine:                                 │
│  ┌─────────┐    ┌────────────┐    ┌─────────┐ │
│  │ DOMAINS │───▶│  LESSONS   │───▶│ PLAYING │ │
│  │         │◀───│            │◀───│         │ │
│  └─────────┘    └────────────┘    └─────────┘ │
│                                     │         │
│                                     ▼         │
│                              ┌────────────┐   │
│                              │  LIVE_DEMO │   │
│                              │(hub closes,│   │
│                              │ app shows) │   │
│                              └────────────┘   │
└─────────────────────────────────────────────────┘
```

### State Flow Detail

| State | What's Visible | User Actions |
|-------|---------------|--------------|
| `DOMAINS` | Full-panel with 4 domain cards | Click a domain card |
| `LESSONS` | Domain header + lesson list | Click a lesson, or ← back |
| `PLAYING_CONCEPT` | Concept slide (Phase A) inside hub panel | Read, then click "Start Demo →" |
| `PLAYING_LIVE` | Hub closes. Real app visible. Floating narration panel. | Next/Prev/Pause/Speed/Exit |

---

## Implementation Phases

### Phase 1: Foundation (Types + State + Progress)

**What we build:**
- Updated `types.ts` with v2 interfaces
- `useDemoHub.ts` — state machine hook (DOMAINS → LESSONS → PLAYING)
- `useDemoProgress.ts` — localStorage persistence of completed lessons + speed preference

**Why this first:**
Everything depends on the type system and state machine. Getting this right means all UI components plug in cleanly.

**Re-evaluation notes (Phase 1):**
- v1 `DemoActionContext` is robust — keep the exact same interface (click, fill, selectOption, waitFor, delay)
- Speed model changed: v2 uses multiplier (0.5x/1x/1.5x/2x) applied to `step.pauseAfter` (default 3000ms base)
- During `live` state, hub overlay hides but isn't destroyed — needs `hubVisible` boolean derived from view state
- Progress tracks per-step position (not just completed/not) so users can resume mid-lesson
- Added `DemoHubState` wrapper for clean prop drilling

**Key types:**
```typescript
type HubView = 'domains' | 'lessons' | 'concept' | 'live';
type SpeedMultiplier = 0.5 | 1 | 1.5 | 2;
const BASE_STEP_DELAY = 3000; // ms, used when step.pauseAfter not set

interface DemoDomain {
  id: string;
  name: string;
  icon: string;
  description: string;
  lessons: DemoLesson[];
  available: boolean;  // false = "Coming Soon"
}

interface DemoLesson {
  id: string;
  domainId: string;           // back-reference for progress tracking
  name: string;
  description: string;
  estimatedMinutes: number;
  initialTab?: string;
  concept: ConceptContent;
  steps: DemoStep[];
}

interface ConceptContent {
  title: string;
  body: string;              // Rich text (rendered with simple markdown parser)
  keyTerms?: KeyTerm[];
  diagram?: string;          // SVG string
}

interface KeyTerm {
  term: string;
  definition: string;
}

interface DemoStep {
  id: string;
  title: string;
  description: string;
  highlight?: string;        // CSS selector for live mode
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  action?: (ctx: DemoActionContext) => Promise<void>;
  fallbackImage?: string;    // future: path to screenshot
  pauseAfter?: number;       // ms override (default: BASE_STEP_DELAY)
}

interface DemoActionContext {
  navigateToTab: (tab: string) => void;
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  selectOption: (selector: string, value: string) => Promise<void>;
  waitFor: (selector: string, timeout?: number) => Promise<void>;
  delay: (ms: number) => Promise<void>;
}

interface DemoHubState {
  view: HubView;
  selectedDomain: DemoDomain | null;
  selectedLesson: DemoLesson | null;
  stepIndex: number;
  isPlaying: boolean;
  speed: SpeedMultiplier;
}

interface DemoProgress {
  completedLessons: string[];   // lesson IDs fully completed
  lessonSteps: Record<string, number>; // lessonId → last completed step index
  lastDomain?: string;
  lastLesson?: string;
  speed: SpeedMultiplier;
}
```

**Files created:**
- `src/features/demo-player/types.ts` (overwrite v1)
- `src/features/demo-player/useDemoHub.ts`
- `src/features/demo-player/useDemoProgress.ts`

---

### Phase 2: Lesson Content (WebSocket Only)

**What we build:**
- `protocols/ws-basics.lesson.ts` — concept + 8 live steps
- `protocols/ws-auth-transport.lesson.ts` — concept + 7 live steps
- `lessons/index.ts` — exports all domains with lesson arrays
- Domain definitions for API, Workflow, Harness (metadata only, `available: false`)

**Concept content for WS Basics:**
- Title: "Understanding WebSocket"
- Explains: full-duplex, handshake, frames, events
- Key terms: Frame, Handshake, Subprotocol, Close Code
- Diagram: simple Client ↔ Server arrow

**Concept content for Auth & Transport:**
- Title: "Authentication & Transport Modes"
- Explains: browser limitation, 3 transport modes, auto-switching
- Key terms: Direct, Proxy, Native, TLS
- Diagram: decision tree (header auth → proxy, query auth → direct)

**Live steps:** Reuse existing v1 step definitions (already written and working).

**Files created:**
- `src/features/demo-player/lessons/protocols/ws-basics.ts`
- `src/features/demo-player/lessons/protocols/ws-auth-transport.ts`
- `src/features/demo-player/lessons/index.ts`

---

### Phase 3: Hub UI — Domain Selection + Lesson List

**What we build:**
- `DemoHub.tsx` — the full-panel overlay container (manages view state)
- `DemoHubHeader.tsx` — breadcrumb navigation (Hub > Domain > Lesson) + close
- `DomainSelector.tsx` — 4 domain cards with progress rings + "Coming Soon" badges
- `LessonList.tsx` — ordered list within a domain, completion checkmarks, time estimates

**Design principles:**
- Full-panel overlay (same pattern as Gallery page: `position: fixed; inset: header/sidebar`)
- Animated transitions between views (slide left/right)
- Progress rings use SVG `<circle>` with `stroke-dasharray`
- "Coming Soon" cards are semi-transparent, not clickable
- Breadcrumb shows current location, each segment is clickable

**Layout (DomainSelector):**
```
┌──────────────────────────────────────────────────────┐
│  🎓 Learning Hub                                [✕]  │
│─────────────────────────────────────────────────────│
│                                                      │
│  Master RedfireForge with interactive lessons.       │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │   🔌 API   │ │ ⚡ Workflow│ │ 🧪 Harness │      │
│  │  4 lessons │ │  3 lessons │ │  5 lessons │      │
│  │ Coming Soon│ │ Coming Soon│ │ Coming Soon│      │
│  └────────────┘ └────────────┘ └────────────┘      │
│                                                      │
│  ┌────────────┐                                     │
│  │📡 Protocols│  ← highlighted, clickable           │
│  │  2 lessons │                                     │
│  │ ██░░░ 50% │  ← progress ring                   │
│  └────────────┘                                     │
└──────────────────────────────────────────────────────┘
```

**Layout (LessonList):**
```
┌──────────────────────────────────────────────────────┐
│  🎓 Learning Hub > 📡 Protocols                 [✕]  │
│─────────────────────────────────────────────────────│
│                                                      │
│  📡 Real-time communication testing                  │
│  Master WebSocket, SSE, and Kafka protocols.        │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ✅ 1. WebSocket Basics              ~3 min   │   │
│  │    Connect, send messages, events             │   │
│  │    [Resume] or [Restart]                      │   │
│  ├──────────────────────────────────────────────┤   │
│  │ ○  2. Auth & Transport              ~4 min   │   │
│  │    Authentication, proxy, TLS                 │   │
│  │    [Start]                                    │   │
│  ├──────────────────────────────────────────────┤   │
│  │ 🔒 3. Console & Debugging           Soon     │   │
│  ├──────────────────────────────────────────────┤   │
│  │ 🔒 4. Advanced Filtering            Soon     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [← Back to all domains]                            │
└──────────────────────────────────────────────────────┘
```

**Files created:**
- `src/features/demo-player/DemoHub.tsx`
- `src/features/demo-player/DemoHubHeader.tsx`
- `src/features/demo-player/DomainSelector.tsx`
- `src/features/demo-player/LessonList.tsx`

---

### Phase 4: Lesson Player — Concept Slide

**What we build:**
- `LessonPlayer.tsx` — orchestrates concept → live transition
- `ConceptSlide.tsx` — renders the concept content beautifully
- `LessonSidebar.tsx` — left sidebar showing step TOC

**ConceptSlide features:**
- Title with lesson icon
- Body text rendered as simple formatted content (bold, bullets, numbered lists)
- Key terms displayed as pill badges with tooltip definitions
- Diagram rendered as inline SVG (we author simple SVGs per concept)
- "Start Demo →" button at bottom to transition to live phase
- Auto-advance timer (configurable by speed) with visible countdown

**LessonSidebar features:**
- Shows: "📖 Concept" (always first), then numbered steps
- Current item highlighted with accent color
- Completed items show checkmark
- Clickable to jump (in live phase only)
- Collapses on narrow screens

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  🎓 Protocols > WebSocket Basics                [✕]  │
│─────────────────────────────────────────────────────│
│         │                                            │
│ STEPS   │   📖 Understanding WebSocket              │
│         │                                            │
│ ● Concept│   [rich formatted content...]             │
│ ○ Step 1 │                                           │
│ ○ Step 2 │   Key Terms:                             │
│ ○ Step 3 │   [Frame] [Handshake] [Subprotocol]      │
│ ○ Step 4 │                                           │
│ ○ Step 5 │   [  Client ◄══════► Server  ]           │
│ ○ Step 6 │   [       diagram SVG         ]           │
│ ○ Step 7 │                                           │
│ ○ Step 8 │                                           │
│         │                          [Start Demo →]   │
│─────────┼───────────────────────────────────────────│
│  Speed: [0.5x] [1x] [1.5x] [2x]                    │
└──────────────────────────────────────────────────────┘
```

**Files created:**
- `src/features/demo-player/LessonPlayer.tsx`
- `src/features/demo-player/ConceptSlide.tsx`
- `src/features/demo-player/LessonSidebar.tsx`

---

### Phase 5: Live Demo Mode

**What we build:**
- `LiveDemo.tsx` — refactored from v1's floating panel + spotlight
- `LessonControls.tsx` — bottom control bar (shared between concept + live)
- Update `DemoSpotlight.tsx` — keep existing, add smooth entrance animation

**How live mode works:**
1. Hub panel closes (slides out)
2. App is fully visible at its current state
3. Floating narration panel appears at bottom-right (existing v1 panel, refined)
4. Spotlight ring highlights the current step's target element
5. If target element NOT found → show step description only (no broken spotlight)
6. User controls: Next, Prev, Pause, Speed, Exit (returns to Hub)

**Resilience logic per step:**
```typescript
async function executeStep(step: DemoStep, ctx: DemoActionContext) {
  // 1. Try to find the target element
  if (step.highlight) {
    const el = document.querySelector(step.highlight);
    if (el && isElementVisible(el)) {
      // LIVE MODE: show spotlight, execute action
      setMode('live');
      if (step.action) await step.action(ctx);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // FALLBACK: just show narration, no spotlight
      setMode('narration-only');
    }
  } else {
    // No highlight defined — narration-only step
    setMode('narration-only');
  }
}
```

**Narration panel design (refined from v1):**
- Lesson name + step counter at top
- Step title (bold, 15px)
- Step description (muted, 13px, multi-line)
- Mode badge: 🟢 Live / 📖 Guide (tiny, top-right corner)
- Progress bar (thin, gradient, shows overall lesson progress)
- Controls: ◀ Back | ▶ Play/Pause + Speed | Next ▶ | ✕ Exit
- Keyboard hints at very bottom (subtle)

**Files created/modified:**
- `src/features/demo-player/LiveDemo.tsx` (new, replaces v1 DemoPlayerPanel)
- `src/features/demo-player/LessonControls.tsx` (new)
- `src/features/demo-player/DemoSpotlight.tsx` (minor update)

---

### Phase 6: CSS + Animations

**What we build:**
- Complete CSS rewrite for v2 (replace v1 demo-player.css)
- Smooth transitions between Hub views
- Professional animations

**Animation inventory:**
| Element | Animation |
|---------|-----------|
| Hub overlay open | Fade in + scale from 0.97 to 1 (200ms) |
| Hub overlay close | Fade out + scale to 0.97 (150ms) |
| Domain cards | Stagger fade-in on mount (50ms delay each) |
| View transitions | Slide left (forward) / slide right (back) |
| Concept → Live | Hub slides up and out, narration panel slides up from bottom |
| Spotlight ring | Pulse animation (existing) + position ease transition |
| Progress ring | Animated stroke-dashoffset on completion |
| Step TOC active | Left border accent slide in |

**z-index assignments:**
| Element | z-index |
|---------|---------|
| Hub overlay | 10090 (same as full-panel-modal) |
| Spotlight ring | 10101 (above everything during live demo) |
| Narration panel | 10110 (above spotlight) |
| Speed dropdown | 10115 (above narration) |

**Files created:**
- `src/styles/demo-player.css` (complete rewrite)

---

### Phase 7: Integration + Polish

**What we build:**
- Remove v1 components (DemoPlayer.tsx, DemoSuitePicker.tsx, DemoPlayerPanel.tsx, old suites/)
- Update `App.tsx` to mount `DemoHub` instead of old `DemoPlayer`
- Update header trigger button (same position, same icon)
- Wire `useDemoHub` with `setActiveTab` from App state
- Keyboard shortcut: `Cmd+Shift+D` opens Hub from anywhere
- On lesson completion → auto-mark progress, show brief "✅ Completed!" toast

**Entry point behavior:**
- First time user → Hub opens at Domains view
- Returning user with incomplete lesson → "Continue where you left off?" prompt
- Returning user all complete → Hub opens at Domains with progress shown

**Files modified:**
- `src/app/App.tsx` (swap DemoPlayer → DemoHub)
- `src/app/components/AppHeader.tsx` (trigger button stays same)
- Delete old files: `DemoPlayer.tsx`, `DemoSuitePicker.tsx`, `DemoPlayerPanel.tsx`, `suites/` folder

---

## File Inventory (Final State)

```
src/features/demo-player/
├── types.ts                  ← v2 types
├── DemoHub.tsx               ← full-panel entry point
├── DemoHubHeader.tsx         ← breadcrumb + close
├── DomainSelector.tsx        ← Level 1
├── LessonList.tsx            ← Level 2
├── LessonPlayer.tsx          ← Level 3 orchestrator
├── ConceptSlide.tsx          ← Phase A content
├── LiveDemo.tsx              ← Phase B narration panel
├── LessonControls.tsx        ← shared control bar
├── LessonSidebar.tsx         ← step TOC
├── DemoSpotlight.tsx         ← spotlight ring (kept from v1)
├── useDemoHub.ts             ← state machine
├── useDemoProgress.ts        ← persistence
└── lessons/
    ├── index.ts              ← all domains + lesson metadata
    └── protocols/
        ├── ws-basics.ts
        └── ws-auth-transport.ts

src/styles/
└── demo-player.css           ← complete v2 styles
```

---

## Implementation Order (Build Sequence)

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
 types     content    hub UI    concept    live      CSS       integrate
 hooks     lessons    domain    slide      demo      anims     polish
 state               list      sidebar    controls            cleanup
```

Each phase is independently testable:
- After Phase 3: Hub opens, shows domains + lessons (no playback yet)
- After Phase 4: Can view concept slides with TOC
- After Phase 5: Full lesson playback works
- After Phase 7: Production-ready

---

## Success Criteria

- [ ] Hub opens instantly from header button (< 100ms)
- [ ] Domain cards show progress rings accurately
- [ ] Lesson list shows completion state
- [ ] Concept slide renders formatted text + diagram + key terms
- [ ] Live demo spotlight finds elements and highlights them
- [ ] If element not found → graceful narration-only mode (no error)
- [ ] Speed control works: 0.5x, 1x, 1.5x, 2x
- [ ] Keyboard: Space, ←, →, Esc all work
- [ ] Progress persists across browser sessions
- [ ] Transitions are smooth (no jarring jumps)
- [ ] Works in all app themes (uses CSS variables)
- [ ] TypeScript: 0 errors
