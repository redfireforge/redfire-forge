# UI/UX Improvement Plan

> **Status:** ✅ **Phase 1–6 COMPLETE** — Phase 7 (Workflow Sidebar & Navigation) in progress.
>
> _Last updated: 2026-05-22_

## Commercial Products Researched

| Product | Layout Model | Theme | Node Design | Key UX Strength |
|---------|-------------|-------|-------------|-----------------|
| **n8n** | Left-to-right DAG | Light (dark option) | Rounded cards with brand-colored icons, item count badges | Data preview on nodes, inline output table |
| **Make (Integromat)** | Radial/circular free-form | Light purple/white | Circles with brand logos | Visual module status bubbles, real-time data flow animation |
| **Zapier Canvas** | Visual diagram + linear Zaps | White/clean | Rounded cards with app icons | AI-powered generation, diagramming-first approach |
| **Power Automate** | Vertical linear flow | White/Fluent UI | Wide rectangular cards | Step-by-step form wizard, condition tree view |
| **Node-RED** | Left-to-right wire flow | Light gray | Compact colored tabs by category | Lightweight, info sidebar, debug panel |
| **Retool Workflows** | Horizontal DAG | White/modern | Clean rectangular blocks | Code-first + visual hybrid, inline code editor |
| **Postman Flows** | Free-form canvas | White/clean | Rounded blocks with port dots | API-specific UX, request/response preview inline |

---

## Key Gaps & Recommendations

### 1. Node Visual Identity (HIGH PRIORITY)

**Current**: All nodes look the same (same shape/size, only border color differs). Uses emoji icons (🔗, 📋).

**Commercial standard**:
- n8n: Each node has a colored icon badge (unique per type), rounded corners, subtle shadow
- Make: Circular modules with brand-specific colors and icons
- Power Automate: Wide cards with colored left-border + icon

**Recommendation**:
- Add SVG icons per node type (not emojis) in a colored circle/badge
- Use distinct background tints per node category (triggers = green tint, actions = blue, flow control = amber)
- Add subtle drop shadow for depth (`box-shadow: 0 2px 8px rgba(0,0,0,0.15)`)

### 2. Typography & Readability (HIGH PRIORITY)

**Current**: Font sizes 0.65-0.82rem (very small), hard to read at normal zoom.

**Commercial standard**:
- n8n: Node titles ~14px bold, descriptions ~13px
- Make: Module names 14px, clear hierarchy
- Power Automate: 14-16px titles, clean spacing

**Recommendation**:
- Increase node title to 0.875rem (14px) bold
- Increase body text to 0.8125rem (13px)
- Increase minimum node width from 180px to 200px
- Add consistent padding: 12px 16px inside nodes

### 3. Canvas Background & Grid (MEDIUM)

**Current**: Dark solid background.

**Commercial standard**:
- n8n: Light gray dotted grid
- Make: Clean light canvas with subtle grid
- Zapier Canvas: Clean white with faint grid dots

**Recommendation**:
- Add dot-grid pattern to canvas (both themes)
- Increase canvas contrast with nodes

### 4. Node Status & Execution Feedback (HIGH PRIORITY)

**Current**: No visible execution status on nodes.

**Commercial standard**:
- n8n: Green checkmark + item count badge after execution ("3 items")
- Make: Animated data flow dots along connections, green/red module borders
- Power Automate: Green check/red X overlay, duration display

**Recommendation**:
- Add status indicator on each node (idle/running/success/error)
- Show item/request count badge after execution
- Add colored border pulse during execution (animated)
- Show response time on HTTP nodes after execution

### 5. Connection Lines (MEDIUM)

**Current**: Basic bezier curves.

**Commercial standard**:
- n8n: Smooth bezier with arrow markers, animated during execution
- Make: Thick rounded connectors with data flow animation dots
- Power Automate: Straight vertical lines with arrow heads

**Recommendation**:
- Add arrow markers on edges
- Add animated dash effect during execution (stroke-dasharray animation)
- Use different line styles for conditional branches (dashed for false, solid for true)
- Add edge labels for condition outcomes ("Yes"/"No")

### 6. Toolbar & Controls (MEDIUM)

**Current**: 40px compact toolbar using emoji icons.

**Commercial standard**:
- n8n: Floating buttons on canvas (zoom, fit, minimap), clean top bar
- Make: Floating toolbar bottom-center, clean icons
- Zapier: Minimal floating controls

**Recommendation**:
- Replace emoji icons with proper SVG icons (Lucide or Heroicons)
- Move zoom/fit controls to a floating pill on canvas corner
- Add minimap toggle (small overview in corner)
- Add breadcrumb showing current workflow name/path

### 7. Sidebar & Panel Design (MEDIUM)

**Current**: Left palette, right config panel.

**Commercial standard**:
- n8n: Right-side slide-out node panel with tabs (Parameters, Settings, Input, Output)
- Make: Full-screen modal for module config with sections
- Power Automate: Inline expandable cards

**Recommendation**:
- Add tabs to config panel (Config | Input | Output | Logs)
- Show last execution data in Output tab
- Add search/filter in the node palette
- Better section headers with collapsible groups

### 8. Empty States & Onboarding (LOW-MEDIUM)

**Current**: Basic empty canvas.

**Commercial standard**:
- n8n: "Add first step" placeholder with dotted border
- Make: "Create a new scenario" with template suggestions
- Zapier Canvas: AI-driven "Describe what you want to automate"

**Recommendation**:
- Add illustrated empty state with "Drop your first node here" + quick-start tips
- Add template workflow suggestions on empty canvas
- Add contextual hints on first use (tooltips for key actions)

### 9. Color System & Accessibility (MEDIUM)

**Current**: Status colors are basic, no consistent semantic color system.

**Commercial standard**: All products use a clear semantic color palette (green=success, red=error, amber=warning, blue=info).

**Recommendation**:
- Define semantic color tokens: `--color-success`, `--color-error`, `--color-warning`, `--color-info`
- Ensure WCAG AA contrast (4.5:1 for text, 3:1 for UI elements)
- Add focus rings for keyboard navigation
- Use color + icon together (never color alone) for status

### 10. Micro-interactions & Polish (LOW)

**Commercial standard**: Smooth transitions, hover effects, subtle animations.

**Recommendation**:
- Add hover lift on nodes (`transform: translateY(-1px)`)
- Add smooth panel transitions (slide-in/fade for sidebars)
- Add skeleton loading states
- Add subtle scale animation when adding new node

---

## Phased Implementation Plan

### Phase 1: Visual Foundation — ✅ COMPLETE
- [x] Replace emoji icons with SVG icons (Lucide icon set)
- [x] Increase typography sizes (node title 14px, body 13px)
- [x] Add node category background tints (triggers/actions/flow-control)
- [x] Add drop shadows to nodes
- [x] Increase min node width to 200px
- [x] Consistent padding inside nodes (12px 16px)

**Impact**: HIGH — Immediate professional feel

### Phase 2: Execution Feedback — ✅ COMPLETE
- [x] Add status indicator per node (idle/running/success/error)
- [x] Show item/request count badge after execution
- [x] Add colored border pulse animation during execution
- [x] Show response time on HTTP nodes after execution
- [x] Add edge labels for condition branches ("Yes"/"No")

**Impact**: HIGH — Key differentiator for a testing tool

### Phase 3: Canvas & Controls — ✅ COMPLETE
- [x] Add dot-grid pattern to canvas background (both themes)
- [x] Move zoom/fit controls to floating pill on canvas corner
- [x] Add arrow markers on connection edges (+ colored markers for pass/fail/animated states)
- [x] Add animated dash effect on edges during execution
- [x] Add minimap toggle
- [x] Different line styles for conditional branches (dashed "No" edges, solid "Yes" edges)

**Impact**: MEDIUM — Polish & usability

### Phase 4: Panel Improvements — ✅ COMPLETE
- [x] Add tabs to config panel (Config | Input | Output | Logs)
- [x] Show last execution data in Output tab
- [x] Add search/filter in node palette
- [x] Better section headers with collapsible groups
- [x] Replace toolbar emoji icons with SVG icons

**Impact**: MEDIUM — Workflow efficiency

### Phase 5: Empty States & Onboarding — ✅ COMPLETE
- [x] Illustrated empty state with "Drop your first node here"
- [x] Template workflow suggestions on empty canvas
- [x] Contextual hints/tooltips on first use
- [x] Breadcrumb showing current workflow name/path

**Impact**: LOW-MEDIUM — First impression

### Phase 6: Micro-interactions & Accessibility — ✅ COMPLETE
- [x] Hover lift effect on nodes (`translateY(-1px)` + shadow on `.wf-node:hover`)
- [x] Smooth panel slide-in/fade transitions (canvas fade-in, exec strip slide, detail panel `slideInRight`)
- [x] Skeleton loading states
  - [x] 6A: Create reusable `Skeleton` component with shimmer animation (`src/shared/components/Skeleton.tsx`)
  - [x] 6B: CSS preset classes for workflow list skeleton (`skeleton-workflow-item`)
  - [x] 6C: CSS preset classes for config panel skeleton (`skeleton-config-panel`)
- [x] Subtle scale animation when adding new node
  - [x] 6D: Add `@keyframes wf-node-pop` animation (scale 0.8 → 1.0 with overshoot)
  - [x] 6E: Apply via `.wf-node-new` class, auto-removed after 300ms via `markNodeAsNew()`
- [x] Define semantic color tokens
  - [x] 6F: Add `--info` token to `:root` and all 12 theme variants (sky-blue shades)
  - [~] 6G: `--color-*` aliases deferred — current `--success/--warning/--danger/--info` naming is sufficient
- [x] Add focus rings for keyboard navigation (`focus-visible` on React Flow nodes and controls)

**Impact**: LOW — Polish & accessibility

### Phase 7: Workflow Sidebar & Navigation — ✅ COMPLETE
- [x] **"From Template" navigation fix** — clicking "From Template" in the `+ New` dropdown now opens Gallery pre-filtered to the Workflows domain instead of showing "All"
- [x] **"Browse All Templates" navigation fix** — clicking "Browse All Templates →" on the empty canvas now opens Gallery pre-filtered to Workflows domain
- [x] **Removed "UNFILED" label** — root-level workflows no longer show a confusing "UNFILED" section header; they appear directly below folders without a label
- [x] **Renamed folder-related labels** — "Move to Unfiled" → "Move out of Folder"; "Unfiled (root)" → "Workflows (root)" in folder picker; delete folder confirmation no longer references "Unfiled"
- [x] **Added "Import Workflow" to `+ New` dropdown** — users can now import workflows from JSON at the root level without needing to right-click a folder
- [x] **Fixed broken `--bg-hover` CSS variable** — `var(--bg-hover)` was used across 7 CSS files but never defined in any theme, causing invisible hover/active states; replaced with `var(--surface-hover)` (26 occurrences fixed)
- [x] **Enhanced active/selected highlight** — workflow items and folder headers now use a visible accent-tinted background (`rgba(primary, 0.12)`) when selected, making the active item clearly distinguishable
- [x] **Widened "Move to Folder" submenu** — increased from 160px to 220px so folder names are not truncated
- [x] **Conditional "Move out of Folder"** — the option is hidden when the workflow is already at root level (not inside any folder)

**Impact**: MEDIUM — Navigation clarity & sidebar usability

### Phase 8: Workflow ↔ Requests/Catalog Integration — ✅ COMPLETE

Deeply integrates the Workflow Designer with the Requests and API Catalog features, allowing users to build workflows from existing API definitions with full service/environment/auth preservation.

#### Catalog → Workflow ("Expose to Workflow")
- [x] **"Expose to Workflow" checkbox** on individual API endpoints in the Catalog — saves parameter values, headers, and request body for reuse in the Workflow Designer
- [x] **CATALOG tab in Workflow palette** — shows only exposed endpoints; clicking adds an HTTP Request node with full pre-populated scenario (URL, method, headers, body, auth)
- [x] **Saved endpoint values** — parameter/header/body values captured at expose-time are persisted in `CatalogEndpointWorkflowValues` and auto-applied when adding to canvas
- [x] **Filtered visibility** — non-exposed endpoints do not appear in the Workflow's CATALOG palette

#### Requests → Workflow
- [x] **REQUESTS tab in Workflow palette** — browse Request collections with folder tree navigation
- [x] **Add from Requests** — clicking a request item adds an HTTP node with full scenario, inheriting microservice/environment bindings via `buildServiceFromCollection`
- [x] **Service preservation** — `WorkflowService` objects created from Request collections retain `microserviceId`, environment bindings, and auth configuration across hard refreshes

#### Persistence & Storage Fixes
- [x] **`fixupOverGroupedServices` bug fix** — migration function was incorrectly splitting microservice-bound services on every load; added guard to skip services with `microserviceId`
- [x] **IndexedDB migration for large data** — migrated workflows, requests, catalog entries, catalog specs, endpoint values, and projects from `localStorage` to IndexedDB to eliminate `QuotaExceededError`; automatic one-time migration with `localStorage` fallback
- [x] **New IDB utility files** — `idbWorkflows.ts`, `idbRequests.ts`, `idbCatalog.ts`, `idbProjects.ts` for dedicated IndexedDB load/save/migrate operations
- [x] **Storage UI update** — Settings storage tab shows accurate combined usage (IndexedDB + localStorage) with "LS" badge for items still in localStorage

**Impact**: HIGH — Core workflow building experience; eliminates manual re-entry of API configurations
