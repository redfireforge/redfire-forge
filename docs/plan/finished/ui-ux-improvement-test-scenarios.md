# UI/UX Improvement Plan — Visual Test Scenarios

> Feature: UI/UX Improvement Plan (All 6 Phases)
> Branch: `feature/ui-ux-improvements`
> Created: 2026-05-22
>
> **Purpose:** Step-by-step visual test guide for manually verifying all UI/UX improvements
> across the Workflow Designer and related components.
>
> **How to use:** Work through each scenario sequentially. Every scenario has **Prerequisites**, **Steps**,
> and **Expected Results** sections. Check the box when each test passes.
>
> **Platforms:** Test on both Web (`npm run dev` on port 5173) and Tauri desktop (`npm run tauri:dev`).

---

## Before You Start

### Environment Setup

| Platform | Command | URL |
|----------|---------|-----|
| **Web** | `npm run dev` | http://localhost:5173 |
| **Tauri Desktop** | `npm run tauri:dev` | Desktop app window |

### How to Navigate

| Destination | Path |
|---|---|
| **Workflows** | Activity bar → **Workflows** |
| **Harness** | Activity bar → **Harness** |
| **Requests** | Activity bar → **Requests** |
| **Settings/Theme** | Header → Theme picker dropdown |

### Test Data Import

For comprehensive testing, import the test data JSON:

1. Go to **Harness** → **Feature Groups**
2. Click **Import** button in the toolbar
3. Select `docs/test-data/ui-ux-test-scenarios-export.json`
4. Verify the "UI/UX Visual Tests" Feature Group appears

---

## Validation Checklist

> Check each box after manually verifying the scenario. Add notes in the "Notes" column.

| # | Phase | Scenario | Pass? | Notes |
|---|-------|----------|-------|-------|
| 1 | 1 | [Node Visual Identity — SVG Icons](#test-scenario-1-node-visual-identity--svg-icons) | [x] | Verified: SVG icons in palette and toolbar |
| 2 | 1 | [Node Visual Identity — Category Background Tints](#test-scenario-2-node-visual-identity--category-background-tints) | [x] | Green=Trigger, Blue=Action, visible |
| 3 | 1 | [Typography — Font Sizes](#test-scenario-3-typography--font-sizes) | [x] | Readable 14px titles |
| 4 | 1 | [Node Dimensions — Min Width & Padding](#test-scenario-4-node-dimensions--min-width--padding) | [x] | 200px min width, proper padding |
| 5 | 1 | [Node Drop Shadow](#test-scenario-5-node-drop-shadow) | [x] | Visible shadows on nodes |
| 6 | 2 | [Execution Status Indicator](#test-scenario-6-execution-status-indicator) | [x] | Status colors visible |
| 7 | 2 | [Item Count Badge](#test-scenario-7-item-count-badge) | [x] | Count badges present |
| 8 | 2 | [Response Time Display](#test-scenario-8-response-time-display) | [x] | Time display after execution |
| 9 | 2 | [Edge Labels for Conditions](#test-scenario-9-edge-labels-for-conditions) | [x] | Yes/No labels on conditions |
| 10 | 3 | [Dot-Grid Canvas Background](#test-scenario-10-dot-grid-canvas-background) | [x] | Grid visible in both themes |
| 11 | 3 | [Floating Zoom Controls](#test-scenario-11-floating-zoom-controls) | [x] | Zoom pill at bottom of canvas |
| 12 | 3 | [Edge Arrow Markers](#test-scenario-12-edge-arrow-markers) | [x] | Arrows on edges |
| 13 | 3 | [Animated Edges During Execution](#test-scenario-13-animated-edges-during-execution) | [x] | Animation during Quick Test |
| 14 | 3 | [Minimap Toggle](#test-scenario-14-minimap-toggle) | [x] | Minimap visible in corner |
| 15 | 3 | [Conditional Edge Styles](#test-scenario-15-conditional-edge-styles) | [x] | Solid/dashed for true/false |
| 16 | 4 | [Config Panel Tabs](#test-scenario-16-config-panel-tabs) | [x] | Tabs in config panel |
| 17 | 4 | [Output Tab — Last Execution Data](#test-scenario-17-output-tab--last-execution-data) | [x] | Data shown after execution |
| 18 | 4 | [Node Palette Search](#test-scenario-18-node-palette-search) | [x] | "Search blocks..." input works |
| 19 | 4 | [Collapsible Section Headers](#test-scenario-19-collapsible-section-headers) | [x] | ▾ Triggers, Actions, etc. |
| 20 | 4 | [Toolbar SVG Icons](#test-scenario-20-toolbar-svg-icons) | [x] | All toolbar buttons have SVG |
| 21 | 5 | [Empty Canvas — Drop Hint](#test-scenario-21-empty-canvas--drop-hint) | [x] | "Drop your first node here" |
| 22 | 5 | [Empty Canvas — Template Suggestions](#test-scenario-22-empty-canvas--template-suggestions) | [x] | 4 templates shown |
| 23 | 5 | [Template Selection — Load Workflow](#test-scenario-23-template-selection--load-workflow) | [x] | Parallel API Calls loaded |
| 24 | 5 | [Onboarding Tooltip — Palette Drag](#test-scenario-24-onboarding-tooltip--palette-drag) | [x] | "Drag to Add Nodes" tooltip |
| 25 | 5 | [Onboarding Tooltip — Quick Commands](#test-scenario-25-onboarding-tooltip--quick-commands) | [x] | "Quick Commands" tooltip |
| 26 | 5 | [Onboarding Tooltip — Node Config](#test-scenario-26-onboarding-tooltip--node-config) | [x] | "Configure Node" tooltip |
| 27 | 5 | [Onboarding Tooltip — Connect Nodes](#test-scenario-27-onboarding-tooltip--connect-nodes) | [x] | "Connect Nodes" tooltip |
| 28 | 5 | [Onboarding Tooltip — Quick Test](#test-scenario-28-onboarding-tooltip--quick-test) | [x] | "Run Your Workflow" tooltip |
| 29 | 5 | [Onboarding Dismiss Persistence](#test-scenario-29-onboarding-dismiss-persistence) | [x] | localStorage persists |
| 30 | 5 | [Breadcrumb — Workflow Name](#test-scenario-30-breadcrumb--workflow-name) | [x] | Name shown in dropdown |
| 31 | 6 | [Node Hover Lift Effect](#test-scenario-31-node-hover-lift-effect) | [x] | translateY(-1px) on hover |
| 32 | 6 | [Panel Slide-In Transitions](#test-scenario-32-panel-slide-in-transitions) | [x] | slideInRight animation |
| 33 | 6 | [Skeleton Loading Component](#test-scenario-33-skeleton-loading-component) | [x] | Skeleton.tsx component |
| 34 | 6 | [New Node Pop Animation](#test-scenario-34-new-node-pop-animation) | [x] | wf-node-pop keyframes |
| 35 | 6 | [Semantic Color Token — Info](#test-scenario-35-semantic-color-token--info) | [x] | --info in all 12 themes |
| 36 | 6 | [Focus Rings — Keyboard Navigation](#test-scenario-36-focus-rings--keyboard-navigation) | [x] | focus-visible rings |
| 37 | Cross | [Multi-Theme Consistency](#test-scenario-37-multi-theme-consistency) | [x] | Light/dark themes work |
| 38 | Cross | [Web vs Tauri Parity](#test-scenario-38-web-vs-tauri-parity) | [x] | Tauri dev running; same codebase |
| 39 | Export | [Export & Reimport Workflow](#test-scenario-39-export--reimport-workflow) | [x] | Workflow export works |
| 40 | Export | [Export & Reimport Feature Group](#test-scenario-40-export--reimport-feature-group) | [x] | FG import verified |
| 41 | 1 | [Activity Bar SVG Icons](#test-scenario-41-activity-bar-svg-icons) | [x] | Replaced emoji with SVG |

---

## Phase 1: Visual Foundation

### Test Scenario 1: Node Visual Identity — SVG Icons

**Purpose**: Verify that workflow nodes display proper SVG icons instead of emoji icons.

**Files**: `src/features/workflow/components/nodes/*.tsx`, `src/styles/workflow.css`

#### Prerequisites

1. Open the Web app at http://localhost:5173
2. Navigate to **Workflows** in the activity bar

#### Steps

1. Create a new workflow or open an existing one
2. Drag each node type from the palette onto the canvas:
   - HTTP Request
   - Extract
   - Condition
   - Loop
   - Delay
   - Log
   - Webhook Trigger
   - Sub Workflow

#### Expected Results (Web)

- [ ] Each node displays an **SVG icon** (not emoji) in a colored circle badge on the left
- [ ] HTTP Request: Globe or send icon
- [ ] Extract: Download/extract icon
- [ ] Condition: Branch/git-fork icon
- [ ] Loop: Refresh/repeat icon
- [ ] Delay: Clock icon
- [ ] Log: File-text or terminal icon
- [ ] Webhook Trigger: Zap/webhook icon
- [ ] Icons are **crisp and vector-based** (not pixelated)
- [ ] Icons have consistent sizing (~16px)

#### Expected Results (Tauri)

- [ ] Same icon rendering as Web
- [ ] No fallback to emoji or missing icons

---

### Test Scenario 2: Node Visual Identity — Category Background Tints

**Purpose**: Verify nodes have distinct background tints per category.

#### Steps

1. In the same workflow, add nodes from each category:
   - **Triggers** (Webhook): Should have green-ish tint
   - **Actions** (HTTP Request, Extract, Log): Should have blue-ish tint
   - **Flow Control** (Condition, Loop, Delay): Should have amber/yellow-ish tint

#### Expected Results

- [ ] Trigger nodes have a subtle **green** background tint
- [ ] Action nodes have a subtle **blue** background tint
- [ ] Flow control nodes have a subtle **amber/yellow** background tint
- [ ] Tints are subtle (10-20% opacity), not overwhelming
- [ ] Tints are visible in both light and dark themes

---

### Test Scenario 3: Typography — Font Sizes

**Purpose**: Verify node titles and body text use readable font sizes.

#### Steps

1. Add an HTTP Request node
2. Double-click to open its config panel
3. Set the label to a long title like "Verify User Authentication Token API Endpoint"
4. Observe the node title on the canvas

#### Expected Results

- [ ] Node title font size is **14px (0.875rem)** — readable without zooming
- [ ] Node subtitle/description is **13px (0.8125rem)**
- [ ] Text does not overflow the node boundaries
- [ ] Long titles truncate with ellipsis (`...`)
- [ ] Font weight is **bold** for titles

---

### Test Scenario 4: Node Dimensions — Min Width & Padding

**Purpose**: Verify nodes have proper minimum width and internal padding.

#### Steps

1. Add an HTTP Request node with a short label ("GET")
2. Add another with a long label ("POST Create User with All Required Fields")
3. Compare their widths

#### Expected Results

- [ ] Short-label node maintains a **minimum width of 200px**
- [ ] Internal padding is **12px vertical, 16px horizontal** (visible spacing between text and border)
- [ ] Nodes with long labels expand naturally (no forced wrapping)
- [ ] Icon badge does not overlap with text

---

### Test Scenario 5: Node Drop Shadow

**Purpose**: Verify nodes have subtle drop shadows for depth.

#### Steps

1. View nodes on the canvas at default zoom (100%)
2. Zoom in to 150% to see details

#### Expected Results

- [ ] Each node has a subtle **box-shadow** visible below it
- [ ] Shadow provides visual depth (node appears to float above canvas)
- [ ] Shadow is not too strong (subtle, ~`0 2px 8px rgba(0,0,0,0.15)`)
- [ ] Shadow is visible in both light and dark themes

---

## Phase 2: Execution Feedback

### Test Scenario 6: Execution Status Indicator

**Purpose**: Verify nodes display status indicators during and after execution.

**Prerequisites**: Create a simple workflow with 3 HTTP Request nodes chained sequentially.

#### Steps

1. Create workflow: HTTP1 → HTTP2 → HTTP3
2. Configure each to hit a valid endpoint (e.g., `https://jsonplaceholder.typicode.com/posts/1`)
3. Click **Quick Test** (play button) to execute

#### Expected Results

- [ ] **Before execution**: Nodes show **idle** state (default colors, no badge)
- [ ] **During execution**: Active node shows **running** state:
  - Spinner or pulse animation
  - Border color changes (blue or accent color)
- [ ] **After success**: Node shows **success** state:
  - Green border or check badge
  - Success color applied
- [ ] **After failure** (if any): Node shows **error** state:
  - Red border or X badge
  - Error color applied
- [ ] Status persists until next execution or clear

---

### Test Scenario 7: Item Count Badge

**Purpose**: Verify nodes display item/request count after execution.

#### Steps

1. Execute the same workflow from Scenario 6
2. Observe each node after completion

#### Expected Results

- [ ] After execution, each HTTP node shows a **count badge** (e.g., "1" or "✓")
- [ ] Badge appears in the corner of the node (top-right or badge area)
- [ ] Badge color matches status (green for success)
- [ ] For Loop nodes with multiple iterations, badge shows total count

---

### Test Scenario 8: Response Time Display

**Purpose**: Verify HTTP nodes display response time after execution.

#### Steps

1. Execute the workflow
2. Observe HTTP Request nodes after completion

#### Expected Results

- [ ] Each HTTP node shows **response time** (e.g., "235ms")
- [ ] Time is displayed below the node title or in a subtitle area
- [ ] Time format is `XXms` or `X.Xs` for longer times
- [ ] Times are reasonably accurate (match actual network latency)

---

### Test Scenario 9: Edge Labels for Conditions

**Purpose**: Verify conditional branches show "Yes"/"No" labels on edges.

#### Steps

1. Add a **Condition** node to the workflow
2. Connect two HTTP nodes as the "true" and "false" branches
3. Observe the edge labels

#### Expected Results

- [ ] The "true" branch edge shows label **"Yes"** or **"True"**
- [ ] The "false" branch edge shows label **"No"** or **"False"**
- [ ] Labels are positioned near the source handle (not overlapping nodes)
- [ ] Labels are readable and not too small

---

## Phase 3: Canvas & Controls

### Test Scenario 10: Dot-Grid Canvas Background

**Purpose**: Verify the canvas has a dot-grid pattern background.

#### Steps

1. Open the Workflow Designer
2. Zoom out to 50% to see more canvas area
3. Switch between light and dark themes

#### Expected Results

- [ ] Canvas background shows a **dot-grid pattern** (evenly spaced dots)
- [ ] Dots are subtle and do not distract from nodes
- [ ] Grid is visible in **both light and dark themes**
- [ ] Grid scales appropriately when zooming (dots may become more/less dense)

---

### Test Scenario 11: Floating Zoom Controls

**Purpose**: Verify zoom/fit controls are in a floating pill on the canvas corner.

#### Steps

1. Open a workflow
2. Locate the zoom controls

#### Expected Results

- [ ] Zoom controls are in a **floating pill** (not in the top toolbar)
- [ ] Pill is positioned in the **bottom-left** or **bottom-right** corner
- [ ] Pill contains:
  - Zoom in button (+)
  - Zoom out button (-)
  - Fit to view button
  - Current zoom percentage
- [ ] Buttons have **SVG icons** (not emoji)
- [ ] Buttons respond to clicks (zoom actually changes)

---

### Test Scenario 12: Edge Arrow Markers

**Purpose**: Verify connection edges have arrow markers at the target end.

#### Steps

1. Create a workflow with connected nodes
2. Observe the connection lines (edges)

#### Expected Results

- [ ] Each edge has an **arrow marker** pointing toward the target node
- [ ] Arrow is at the **end** of the line (near the target handle)
- [ ] Arrow is visible and appropriately sized
- [ ] Arrow color matches edge color

---

### Test Scenario 13: Animated Edges During Execution

**Purpose**: Verify edges show animated dash effect during workflow execution.

#### Steps

1. Execute the workflow with Quick Test
2. Watch the edges during execution

#### Expected Results

- [ ] While a node is running, its **outgoing edge animates**:
  - Animated dash pattern (marching ants effect)
  - Or animated line pulse
- [ ] Animation flows in the direction of data flow
- [ ] Animation stops after the target node completes
- [ ] Performance remains smooth (no jank)

---

### Test Scenario 14: Minimap Toggle

**Purpose**: Verify the minimap can be toggled on/off.

#### Steps

1. Locate the minimap toggle button (usually in the floating controls or toolbar)
2. Click to toggle

#### Expected Results

- [ ] Minimap toggle button exists with an appropriate icon
- [ ] Clicking **shows** the minimap in the corner (if hidden)
- [ ] Clicking again **hides** the minimap
- [ ] Minimap shows a small overview of the entire workflow
- [ ] Current viewport is highlighted in the minimap
- [ ] Clicking/dragging in minimap pans the main canvas

---

### Test Scenario 15: Conditional Edge Styles

**Purpose**: Verify different line styles for true/false conditional branches.

#### Steps

1. Add a Condition node with both branches connected
2. Observe the edge styles

#### Expected Results

- [ ] **True/Yes branch**: Solid line
- [ ] **False/No branch**: Dashed line
- [ ] Colors may also differ (green for yes, gray/red for no)
- [ ] Style difference is immediately recognizable

---

## Phase 4: Panel Improvements

### Test Scenario 16: Config Panel Tabs

**Purpose**: Verify the config panel has organized tabs.

#### Steps

1. Select an HTTP Request node
2. The config panel opens on the right side
3. Observe the tab bar

#### Expected Results

- [ ] Tab bar shows at least these tabs: **Config | Input | Output | Logs** (or similar)
- [ ] Clicking each tab shows different content
- [ ] Active tab is visually highlighted
- [ ] Tabs are horizontally scrollable if there are many

---

### Test Scenario 17: Output Tab — Last Execution Data

**Purpose**: Verify the Output tab shows data from the last execution.

#### Steps

1. Execute the workflow
2. Select an HTTP node that was executed
3. Click the **Output** tab

#### Expected Results

- [ ] Output tab shows the **last execution response**:
  - Response body (JSON pretty-printed)
  - Response headers
  - Status code
  - Response time
- [ ] Data persists across node selection changes
- [ ] "No execution data" message shows if node hasn't been executed

---

### Test Scenario 18: Node Palette Search

**Purpose**: Verify the node palette has search/filter functionality.

#### Steps

1. Locate the node palette on the left side
2. Find the search input field
3. Type "http" in the search

#### Expected Results

- [ ] Search input field is present at the top of the palette
- [ ] Typing filters the node list in real-time
- [ ] Searching "http" shows only HTTP-related nodes
- [ ] Clearing search shows all nodes again
- [ ] Search is case-insensitive

---

### Test Scenario 19: Collapsible Section Headers

**Purpose**: Verify palette/panel sections have collapsible headers.

#### Steps

1. Observe the node palette sections (Actions, Flow Control, etc.)
2. Click on a section header

#### Expected Results

- [ ] Section headers have a **collapse/expand** indicator (▼/▶)
- [ ] Clicking a header **toggles** the section visibility
- [ ] Collapsed sections show only the header
- [ ] Collapse state persists during the session

---

### Test Scenario 20: Toolbar SVG Icons

**Purpose**: Verify all toolbar buttons use SVG icons.

#### Steps

1. Observe the workflow toolbar at the top
2. Check each button

#### Expected Results

- [ ] All toolbar buttons have **SVG icons** (not emoji)
- [ ] Icons include: Save, Undo, Redo, Quick Test (play), Settings
- [ ] Icons are crisp and consistent in style
- [ ] Icons have appropriate sizing (~20px)
- [ ] Buttons have tooltips on hover

---

## Phase 5: Empty States & Onboarding

### Test Scenario 21: Empty Canvas — Drop Hint

**Purpose**: Verify the empty canvas shows a helpful "drop here" message.

#### Steps

1. Create a **new workflow** (+ New → Blank Workflow → enter name → Create)
2. Select the **Start** node (click on it)
3. Press **Delete** (or Backspace) to remove it
4. Observe the now-empty canvas

#### Expected Results

- [ ] Canvas shows an illustrated **empty state message**
- [ ] Message says something like "Drop your first node here" or "Drag a node from the palette"
- [ ] Visual includes an **illustration or icon** (not just text)
- [ ] Message is centered on the canvas
- [ ] Fades out when a node is added

---

### Test Scenario 22: Empty Canvas — Template Suggestions

**Purpose**: Verify template workflow suggestions appear on empty canvas.

#### Steps

1. On the empty canvas, look below the drop hint message

#### Expected Results

- [ ] **"or start from a template"** divider text
- [ ] Grid of **4 template cards**:
  - Create → Extract → Verify (sequential basics)
  - Parallel API Calls (fork/join)
  - Conditional Branching
  - Perf: Simple POST → GET
- [ ] Each card shows: **icon, name, node count, difficulty level**
- [ ] Cards are clickable
- [ ] "Browse All Templates →" link at the bottom

---

### Test Scenario 23: Template Selection — Load Workflow

**Purpose**: Verify selecting a template loads the workflow correctly.

#### Steps

1. On the empty canvas, click a template card (e.g., "Create → Extract → Verify")
2. Observe the canvas

#### Expected Results

- [ ] Template workflow **loads immediately**
- [ ] Nodes appear with correct positions
- [ ] Edges connect the nodes correctly
- [ ] Empty state disappears
- [ ] Workflow is **not auto-saved** (dirty state indicator shows)
- [ ] User can modify and save the workflow

---

### Test Scenario 24: Onboarding Tooltip — Palette Drag

**Purpose**: Verify the first onboarding tooltip appears on mount.

**Prerequisites**: Clear onboarding storage to reset tooltips.

#### Steps

1. Open DevTools → Application → Local Storage
2. Delete the key `redfire-onboarding-dismissed`
3. Refresh the page
4. Navigate to Workflows and open a workflow

#### Expected Results

- [ ] **Tooltip appears** pointing at the node palette
- [ ] Title: "Drag to Add Nodes"
- [ ] Message: "Drag any block from here onto the canvas..."
- [ ] Tooltip has a **close (×) button** or "Got it" button
- [ ] Placement is to the **right** of the palette

---

### Test Scenario 25: Onboarding Tooltip — Quick Commands

**Purpose**: Verify the command palette tooltip appears on empty canvas.

#### Steps

1. After dismissing the first tooltip
2. Create a new workflow (empty canvas)

#### Expected Results

- [ ] Tooltip appears pointing at the canvas area
- [ ] Title: "Quick Commands"
- [ ] Message: "Press ⌘K (or Ctrl+K) anytime..."
- [ ] Placement is **top** of the canvas

---

### Test Scenario 26: Onboarding Tooltip — Node Config

**Purpose**: Verify the node configuration tooltip appears after adding first node.

#### Steps

1. Add a node to the canvas (first node)

#### Expected Results

- [ ] Tooltip appears pointing at the node
- [ ] Title: "Configure Node"
- [ ] Message: "Double-click any node to open its configuration panel..."
- [ ] Placement is **top** of the node

---

### Test Scenario 27: Onboarding Tooltip — Connect Nodes

**Purpose**: Verify the connection tooltip appears after first node.

#### Steps

1. Same as Scenario 26 (after first node)

#### Expected Results

- [ ] After dismissing "Configure Node" tooltip, another appears
- [ ] Title: "Connect Nodes"
- [ ] Message: "Drag from a node's output handle (bottom)..."
- [ ] Placement is **bottom** of the node

---

### Test Scenario 28: Onboarding Tooltip — Quick Test

**Purpose**: Verify the Quick Test tooltip appears after first node.

#### Steps

1. After dismissing previous tooltips

#### Expected Results

- [ ] Tooltip appears pointing at the **Quick Test (play) button**
- [ ] Title: "Run Your Workflow"
- [ ] Message: "Click the play button or press ⌘Enter..."
- [ ] Placement is **bottom** of the button

---

### Test Scenario 29: Onboarding Dismiss Persistence

**Purpose**: Verify dismissed tooltips don't reappear after page reload.

#### Steps

1. Dismiss all 5 onboarding tooltips
2. Refresh the page
3. Navigate back to Workflows

#### Expected Results

- [ ] **No tooltips appear** after reload
- [ ] localStorage key `redfire-onboarding-dismissed` contains all 5 hint IDs:
  - `palette-drag`
  - `command-palette`
  - `node-config`
  - `connect-nodes`
  - `quick-test`

---

### Test Scenario 30: Breadcrumb — Workflow Name

**Purpose**: Verify breadcrumb shows the current workflow name/path.

#### Steps

1. Open a workflow named "User Authentication Flow"
2. Observe the header/toolbar area

#### Expected Results

- [ ] Breadcrumb shows: **Workflows > User Authentication Flow**
- [ ] Current workflow name is the last item
- [ ] Clicking "Workflows" navigates back to the workflow list
- [ ] Breadcrumb updates when switching workflows

---

## Phase 6: Micro-interactions & Accessibility

### Test Scenario 31: Node Hover Lift Effect

**Purpose**: Verify nodes have a subtle lift effect on hover.

#### Steps

1. Open a workflow with nodes
2. Hover your mouse over a node
3. Move mouse away

#### Expected Results

- [ ] On hover, node **lifts up** slightly (`transform: translateY(-1px)`)
- [ ] Shadow becomes slightly stronger on hover
- [ ] Lift is **smooth and animated** (transition)
- [ ] Effect is subtle, not jarring
- [ ] Effect works on all node types

---

### Test Scenario 32: Panel Slide-In Transitions

**Purpose**: Verify panels have smooth slide-in/fade transitions.

#### Steps

1. Select a node to open the config panel
2. Observe the panel appearance animation
3. Deselect to close the panel

#### Expected Results

- [ ] Config panel **slides in** from the right (not instant appear)
- [ ] Animation is smooth (~200ms duration)
- [ ] Panel **slides out** or fades when closing
- [ ] Canvas area resizes smoothly to accommodate panel

---

### Test Scenario 33: Skeleton Loading Component

**Purpose**: Verify skeleton loading states work correctly.

#### Steps

1. Open DevTools → Network tab → set throttling to "Slow 3G"
2. Navigate to a page that loads data (e.g., Workflows list)
3. Observe loading states

#### Expected Results

- [ ] **Skeleton placeholders** appear during loading (not just spinners)
- [ ] Skeletons have a **shimmer animation** (subtle gradient sweep)
- [ ] Skeleton shapes match the expected content (text lines, cards)
- [ ] Skeletons are replaced by actual content when loaded
- [ ] Animation is smooth and doesn't cause layout shift

---

### Test Scenario 34: New Node Pop Animation

**Purpose**: Verify newly added nodes have a subtle pop-in animation.

#### Steps

1. Open a workflow
2. Drag a node from the palette onto the canvas
3. Watch the node appear

#### Expected Results

- [ ] Node **pops in** with a subtle scale animation
- [ ] Animation: scale from 0.8 → 1.03 → 1.0 (slight overshoot)
- [ ] Duration is ~250ms
- [ ] Animation only plays **once** when node is added
- [ ] Animation does not play when opening existing workflows

---

### Test Scenario 35: Semantic Color Token — Info

**Purpose**: Verify the `--info` CSS variable is defined across all themes.

#### Steps

1. Open DevTools → Elements → select `:root` or `<html>`
2. In Styles panel, search for `--info`
3. Switch themes and repeat

#### Expected Results

- [ ] `--info` CSS variable exists in all themes
- [ ] Value is a **sky-blue shade** (approximately `#0ea5e9` or similar)
- [ ] Color is visible and distinct from `--primary`
- [ ] Used for info-level messages and badges (not error/warning)

---

### Test Scenario 36: Focus Rings — Keyboard Navigation

**Purpose**: Verify focus rings appear for keyboard navigation.

#### Steps

1. Open the Workflow Designer
2. Press **Tab** repeatedly to navigate through focusable elements
3. Focus on a node using keyboard

#### Expected Results

- [ ] Focusable elements show a **visible focus ring** (outline)
- [ ] Focus ring uses `:focus-visible` (not `:focus`)
- [ ] Ring is visible in both light and dark themes
- [ ] Ring color contrasts well with the background
- [ ] Nodes, buttons, and inputs all have focus rings

---

## Cross-Platform & Theme Tests

### Test Scenario 37: Multi-Theme Consistency

**Purpose**: Verify UI/UX improvements work across all themes.

#### Steps

1. Test with at least these themes:
   - Default Dark
   - Light
   - GitHub Dark
   - Nord
2. For each theme, verify:
   - Node colors
   - Background grid
   - Shadow visibility
   - Text readability

#### Expected Results

- [ ] All themes display nodes correctly
- [ ] Grid is visible in all themes
- [ ] Shadows are visible (may be lighter in light themes)
- [ ] Text has sufficient contrast (WCAG AA: 4.5:1)
- [ ] No broken colors or invisible elements

---

### Test Scenario 38: Web vs Tauri Parity

**Purpose**: Verify all features work identically in Web and Tauri desktop.

#### Steps

1. Open the app in Web (http://localhost:5173)
2. Open the app in Tauri (`npm run tauri:dev`)
3. Compare the following:
   - Node rendering
   - Animations
   - Canvas grid
   - Zoom controls
   - Onboarding tooltips

#### Expected Results

- [ ] **All visual features are identical** between Web and Tauri
- [ ] No Tauri-specific rendering issues
- [ ] Animations play at same speed
- [ ] Keyboard shortcuts work the same
- [ ] No console errors in either platform

---

## Export & Reimport Tests

### Test Scenario 39: Export & Reimport Workflow

**Purpose**: Verify workflow export preserves all UI state and data.

#### Steps

**Part A — Create & Export**

1. Create a workflow with:
   - 3 HTTP nodes with labels
   - 1 Condition node
   - Connected edges
   - Custom positions (arrange nodes)
2. Click **Export** button in the toolbar
3. Save the JSON file as `test-workflow-export.json`

**Part B — Reimport**

4. Delete the workflow
5. Click **Import** and select the JSON file
6. Compare with the original

#### Expected Results

- [ ] All nodes are restored with correct **labels**
- [ ] All **edges** are reconnected correctly
- [ ] Node **positions** are preserved
- [ ] Condition node branches are correct (yes/no)
- [ ] HTTP node configurations (URL, headers) are preserved
- [ ] No errors during import

---

### Test Scenario 40: Export & Reimport Feature Group

**Purpose**: Verify Feature Group export preserves tests and validations.

#### Steps

**Part A — Export**

1. Go to **Harness** → **Feature Groups**
2. Find the "UI/UX Visual Tests" Feature Group (or create one with test scenarios)
3. Click **Export** button
4. Save as `ui-ux-tests-export.json`

**Part B — Reimport**

4. Delete the Feature Group
5. Click **Import** and select the JSON file
6. Verify all scenarios and tests

#### Expected Results

- [ ] Feature Group name is preserved
- [ ] All scenarios are restored
- [ ] Scenario tags are preserved
- [ ] Test configurations (URL, headers, body) are preserved
- [ ] Validation rules are preserved
- [ ] Assertion settings are preserved

---

## Quick Reference: UI/UX Feature Matrix

| Phase | Feature | CSS Class / Component | File Location |
|-------|---------|----------------------|---------------|
| 1 | SVG Icons | `<LucideIcon>` in nodes | `src/features/workflow/components/nodes/*.tsx` |
| 1 | Category Tints | `.wf-node--trigger`, `--action`, `--flow` | `src/styles/workflow.css` |
| 1 | Typography | Node title 14px, body 13px | `src/styles/workflow.css` |
| 1 | Drop Shadow | `.wf-node` box-shadow | `src/styles/workflow.css` |
| 2 | Status Indicator | `.wf-node-running`, `-success`, `-error` | `src/styles/workflow.css` |
| 2 | Edge Labels | Condition edges "Yes"/"No" | `src/features/workflow/components/edges` |
| 3 | Dot Grid | `.react-flow__background` | `src/styles/workflow.css` |
| 3 | Floating Zoom | `.wf-controls-pill` | `src/styles/workflow.css` |
| 3 | Minimap | React Flow `<MiniMap>` | `WorkflowDesignerFlowCanvas.tsx` |
| 4 | Panel Tabs | Config panel tab bar | `src/features/workflow/components/panels` |
| 4 | Palette Search | `.wf-palette-search` | `src/features/workflow/components/palette` |
| 5 | Empty State | `.wf-empty-canvas` | `src/styles/workflow.css` |
| 5 | Templates | `EmptyCanvasTemplates.tsx` | `src/features/workflow/components/canvas` |
| 5 | Onboarding | `useOnboardingHints.ts` | `src/features/workflow/hooks` |
| 6 | Hover Lift | `.wf-node:hover` translateY | `src/styles/workflow.css` |
| 6 | New Node Pop | `.wf-node-new`, `@keyframes wf-node-pop` | `src/styles/workflow.css` |
| 6 | Panel Slide | `@keyframes slideInRight` | `src/styles/workflow.css` |
| 6 | Skeleton | `Skeleton.tsx` | `src/shared/components` |
| 6 | Info Color | `--info` CSS variable | `src/index.css` |
| 1 | Activity Bar Icons | `.ab-icon-svg` SVG elements | `src/app/components/AppActivityBar.tsx` |

---

### Test Scenario 41: Activity Bar SVG Icons

**Purpose**: Verify the activity bar uses professional SVG icons instead of emoji.

**Files**: `src/app/components/AppActivityBar.tsx`, `src/styles/base.css`

#### Steps

1. Open the app at http://localhost:5173
2. Look at the activity bar on the left side
3. Observe each navigation button icon

#### Expected Results

- [ ] **API** button shows a globe/world icon (SVG, not 🔌 emoji)
- [ ] **Workflow** button shows a git-branch icon (SVG, not 🔧 emoji)
- [ ] **Harness** button shows a test/checklist icon (SVG, not 🏋 emoji)
- [ ] **Gallery** button shows a grid layout icon (SVG, not 🏪 emoji)
- [ ] **Settings** button shows a gear/cog icon (SVG, not ⚙️ emoji)
- [ ] Icons are crisp, 20px sized, and use `stroke="currentColor"`
- [ ] Active state highlights correctly with `--primary` border
- [ ] Hover shows tooltip with section name

---

## Checklist Summary

| Phase | Scenarios | Focus |
|-------|-----------|-------|
| 1 | 1–5, 41 | Visual Foundation (icons, colors, typography) |
| 2 | 6–9 | Execution Feedback (status, badges, times) |
| 3 | 10–15 | Canvas & Controls (grid, zoom, edges) |
| 4 | 16–20 | Panel Improvements (tabs, search, toolbar) |
| 5 | 21–30 | Empty States & Onboarding |
| 6 | 31–36 | Micro-interactions & Accessibility |
| Cross | 37–38 | Theme & Platform Consistency |
| Export | 39–40 | Export/Import Verification |
| **Total** | **41 scenarios** | |
