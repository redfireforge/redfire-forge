# UI/UX Improvement Plan

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

### Phase 1: Visual Foundation
- [ ] Replace emoji icons with SVG icons (Lucide icon set)
- [ ] Increase typography sizes (node title 14px, body 13px)
- [ ] Add node category background tints (triggers/actions/flow-control)
- [ ] Add drop shadows to nodes
- [ ] Increase min node width to 200px
- [ ] Consistent padding inside nodes (12px 16px)

**Impact**: HIGH — Immediate professional feel

### Phase 2: Execution Feedback
- [ ] Add status indicator per node (idle/running/success/error)
- [ ] Show item/request count badge after execution
- [ ] Add colored border pulse animation during execution
- [ ] Show response time on HTTP nodes after execution
- [ ] Add edge labels for condition branches ("Yes"/"No")

**Impact**: HIGH — Key differentiator for a testing tool

### Phase 3: Canvas & Controls
- [ ] Add dot-grid pattern to canvas background (both themes)
- [ ] Move zoom/fit controls to floating pill on canvas corner
- [ ] Add arrow markers on connection edges
- [ ] Add animated dash effect on edges during execution
- [ ] Add minimap toggle
- [ ] Different line styles for conditional branches

**Impact**: MEDIUM — Polish & usability

### Phase 4: Panel Improvements
- [ ] Add tabs to config panel (Config | Input | Output | Logs)
- [ ] Show last execution data in Output tab
- [ ] Add search/filter in node palette
- [ ] Better section headers with collapsible groups
- [ ] Replace toolbar emoji icons with SVG icons

**Impact**: MEDIUM — Workflow efficiency

### Phase 5: Empty States & Onboarding
- [ ] Illustrated empty state with "Drop your first node here"
- [ ] Template workflow suggestions on empty canvas
- [ ] Contextual hints/tooltips on first use
- [ ] Breadcrumb showing current workflow name/path

**Impact**: LOW-MEDIUM — First impression

### Phase 6: Micro-interactions & Accessibility
- [ ] Hover lift effect on nodes
- [ ] Smooth panel slide-in/fade transitions
- [ ] Skeleton loading states
- [ ] Subtle scale animation when adding new node
- [ ] Define semantic color tokens (success/error/warning/info)
- [ ] Ensure WCAG AA contrast ratios
- [ ] Add focus rings for keyboard navigation

**Impact**: LOW — Polish & accessibility
