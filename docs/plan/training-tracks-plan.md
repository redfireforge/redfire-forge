# Training Manual Tracks — Implementation Plan

## Overview

A new dedicated view that presents all training manuals organized by learning paths, with progress tracking, "What's New" highlights, and direct links to associated gallery samples.

**Mockup**: `docs/training-tracks-mockup.html`

---

## Goals

1. **Unified View** — All training manuals in one place, organized by paths and phases
2. **Progress Tracking** — Mark manuals as Not Started / In Progress / Completed
3. **What's New** — Highlight recently added or updated content
4. **Sample Integration** — One-click navigation to associated gallery samples
5. **Filtering & Search** — Find manuals by keyword, difficulty, or completion status

---

## Data Model

### New Types (`src/data/galleries/trainingPaths/types.ts`)

```typescript
/** Manual completion status */
export type ManualStatus = 'not_started' | 'in_progress' | 'completed';

/** User progress for a single manual */
export interface ManualProgress {
  manualPath: string;        // Unique identifier (file path)
  status: ManualStatus;
  lastViewedAt?: number;     // Unix timestamp
  completedAt?: number;      // Unix timestamp
}

/** Aggregated user progress across all manuals */
export interface TrainingProgress {
  manuals: Record<string, ManualProgress>;  // keyed by manualPath
  lastUpdated: number;
  streak?: number;           // consecutive days with activity
}

/** Manual metadata for "What's New" and versioning */
export interface ManualMetadata {
  manualPath: string;
  addedAt: number;           // Unix timestamp when first added
  updatedAt?: number;        // Unix timestamp of last update
  changeNote?: string;       // Brief description of what changed
}
```

### Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `training_progress` | `TrainingProgress` | User's completion status for all manuals |
| `training_metadata` | `ManualMetadata[]` | Version info for "What's New" detection |

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TrainingTracksView.tsx` | `src/features/training/` | Main page container |
| `TrainingProgressDashboard.tsx` | `src/features/training/components/` | Stats cards (completed, in progress, streak) |
| `WhatsNewBanner.tsx` | `src/features/training/components/` | Collapsible new/updated items |
| `TrainingPathCard.tsx` | `src/features/training/components/` | Expandable path with progress bar |
| `TrainingPhaseSection.tsx` | `src/features/training/components/` | Collapsible phase within a path |
| `ManualRow.tsx` | `src/features/training/components/` | Individual manual with status, actions |
| `ContinueLearningCard.tsx` | `src/features/training/components/` | Resume last-viewed manual |

### New Hooks

| Hook | Purpose |
|------|---------|
| `useTrainingProgress.ts` | Read/write progress to storage, calculate stats |
| `useWhatsNew.ts` | Detect new/updated manuals within last N days |
| `useManualSearch.ts` | Filter manuals by search term, difficulty, status |

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETED (2026-05-05)

**Scope**: Data model, storage, and basic hooks

| Task | Files | Status |
|------|-------|--------|
| Define new types | `src/data/galleries/trainingPaths/types.ts` | ✅ |
| Create `useTrainingProgress` hook | `src/features/training/hooks/useTrainingProgress.ts` | ✅ |
| Add metadata to existing manuals | `src/data/galleries/trainingPaths/manualMetadata.ts` | ✅ |
| Create `useWhatsNew` hook | `src/features/training/hooks/useWhatsNew.ts` | ✅ |
| Unit tests for hooks | `src/features/training/hooks/*.test.ts` | ✅ (45 tests) |
| Barrel export | `src/features/training/index.ts` | ✅ |

**Deliverable**: Progress persistence working, "What's New" detection functional

**Files Created**:
- `src/data/galleries/trainingPaths/types.ts` — Added `ManualStatus`, `ManualProgress`, `TrainingProgress`, `ManualMetadata` types
- `src/data/galleries/trainingPaths/manualMetadata.ts` — Metadata for ~80 manuals with addedAt/updatedAt timestamps
- `src/features/training/hooks/useTrainingProgress.ts` — Hook for progress CRUD, streak calculation, stats
- `src/features/training/hooks/useTrainingProgress.test.ts` — 19 unit tests
- `src/features/training/hooks/useWhatsNew.ts` — Hook for detecting new/updated content within N days
- `src/features/training/hooks/useWhatsNew.test.ts` — 26 unit tests
- `src/features/training/index.ts` — Barrel export for the training feature

---

### Phase 2: Main View & Navigation ✅ COMPLETED (2026-05-05)

**Scope**: Page structure, sidebar entry, routing

| Task | Files | Status |
|------|-------|--------|
| Add training tab to Gallery domain | `src/app/App.tsx` | ✅ |
| Create `TrainingTracksView` scaffold | `src/features/training/TrainingTracksView.tsx` | ✅ |
| Create `TrainingProgressDashboard` | `src/features/training/components/TrainingProgressDashboard.tsx` | ✅ |
| Create `ContinueLearningCard` | `src/features/training/components/ContinueLearningCard.tsx` | ✅ |
| Add CSS styles | `src/features/training/training.css` | ✅ |
| Unit tests for components | `*.test.tsx` | ✅ (16 tests) |

**Deliverable**: Navigate to Training Tracks page via Gallery → Training Tracks tab, see progress stats

**Files Created/Modified**:
- `src/app/App.tsx` — Added 'training' tab, sub-nav for Gallery domain, TrainingTracksView render
- `src/features/training/TrainingTracksView.tsx` — Main page with header, dashboard, "What's New", paths list
- `src/features/training/components/TrainingProgressDashboard.tsx` — 4 stat cards
- `src/features/training/components/TrainingProgressDashboard.test.tsx` — 8 unit tests
- `src/features/training/components/ContinueLearningCard.tsx` — Resume last-viewed card
- `src/features/training/components/ContinueLearningCard.test.tsx` — 8 unit tests
- `src/features/training/training.css` — Full styling for all training components

**Note**: Integrated as a tab within the Gallery domain (Gallery → Samples | Training Tracks) rather than a separate sidebar item, since both are learning resources.

---

### Phase 3: Path & Manual Display ✅ COMPLETED (2026-05-05)

**Scope**: Expandable paths, phases, manual rows

| Task | Files | Status |
|------|-------|--------|
| Create `TrainingPathCard` | `src/features/training/components/TrainingPathCard.tsx` | ✅ |
| Create `TrainingPhaseSection` | `src/features/training/components/TrainingPhaseSection.tsx` | ✅ |
| Create `ManualRow` | `src/features/training/components/ManualRow.tsx` | ✅ |
| Wire up expand/collapse state | Components + TrainingTracksView.tsx | ✅ |
| Add CSS styles for chevrons | `src/features/training/training.css` | ✅ |
| Unit tests for components | `*.test.tsx` | ✅ (37 new tests) |

**Deliverable**: Full hierarchy visible, paths expand to show phases and manuals

**Files Created**:
- `src/features/training/components/ManualRow.tsx` — Individual manual row with status, title, badges, difficulty, sample button
- `src/features/training/components/ManualRow.test.tsx` — 13 unit tests
- `src/features/training/components/TrainingPhaseSection.tsx` — Collapsible phase with keyboard a11y
- `src/features/training/components/TrainingPhaseSection.test.tsx` — 11 unit tests
- `src/features/training/components/TrainingPathCard.tsx` — Collapsible path card with progress bar
- `src/features/training/components/TrainingPathCard.test.tsx` — 13 unit tests
- Updated `src/features/training/training.css` — Chevron styling for expand/collapse
- Updated `src/features/training/TrainingTracksView.tsx` — Now uses extracted components

---

### Phase 4: Progress Interaction ✅ COMPLETED (2026-05-05)

**Scope**: Status toggling, progress updates, sample navigation

| Task | Files | Status |
|------|-------|--------|
| Implement status toggle in `ManualRow` | `ManualRow.tsx` | ✅ |
| Connect toggle to `useTrainingProgress` | `TrainingTracksView.tsx`, `ManualRow.tsx` | ✅ |
| Add "Open Manual" click handler | `ManualRow.tsx`, `TrainingTracksView.tsx` | ✅ |
| Add "View Sample" navigation | All components chain | ✅ |
| Wire `ContinueLearningCard` to `markViewed` | `TrainingTracksView.tsx`, `ContinueLearningCard.tsx` | ✅ |
| Update unit tests | `ManualRow.test.tsx`, `TrainingPhaseSection.test.tsx` | ✅ (8 new tests) |

**Deliverable**: Users can track progress, open manuals, jump to samples

**Changes Made**:
- `ManualRow.tsx` — Status button is now clickable, cycles through not_started → in_progress → completed. Shows ○/◐/✓ icons with hover effects. Added `onStatusChange`, `onOpenManual` callbacks.
- `TrainingPhaseSection.tsx` — Pass-through for new callbacks
- `TrainingPathCard.tsx` — Pass-through for new callbacks
- `TrainingTracksView.tsx` — Wires `useTrainingProgress.updateManualStatus` and `markViewed` to component tree
- `ContinueLearningCard.tsx` — Added `onContinue` prop for parent-controlled behavior
- `training.css` — Interactive status button styling with hover/active states
- Updated tests with 8 new test cases for interaction behavior

---

### Phase 5: What's New Banner ✅ COMPLETED (2026-05-05)

**Scope**: Highlight new/updated content

| Task | Files | Status |
|------|-------|--------|
| Create `WhatsNewBanner` component | `src/features/training/components/WhatsNewBanner.tsx` | ✅ |
| Add NEW/UPDATED badges to `ManualRow` | `ManualRow.tsx` | ✅ (Phase 3) |
| Add collapse/expand toggle | `WhatsNewBanner.tsx` | ✅ |
| Persist "dismissed" state | `WhatsNewBanner.tsx` + storage | ✅ |
| Unit tests for WhatsNewBanner | `WhatsNewBanner.test.tsx` | ✅ (20 tests) |

**Deliverable**: Users see what's new, can dismiss until new content arrives

**Changes Made**:
- `src/features/training/components/WhatsNewBanner.tsx` — Extracted component with dismiss functionality
- `src/features/training/components/WhatsNewBanner.test.tsx` — 20 unit tests covering render, dismiss, persistence
- `src/features/training/TrainingTracksView.tsx` — Now uses WhatsNewBanner component
- `src/features/training/training.css` — Added dismiss button styling

**Dismiss Logic**:
- Clicking ✕ dismisses the banner and stores timestamp
- Banner reappears automatically when new content arrives (item.timestamp > dismissedTimestamp)
- Users don't miss new content even after dismissing

---

### Phase 6: Search & Filtering

**Scope**: Search box, difficulty filter, status tabs

| Task | Files | Estimate |
|------|-------|----------|
| Create `useManualSearch` hook | `src/features/training/hooks/useManualSearch.ts` | M |
| Add search input UI | `TrainingTracksView.tsx` | S |
| Add difficulty filter buttons | `TrainingTracksView.tsx` | S |
| Add status tabs (All / In Progress / Completed) | `TrainingTracksView.tsx` | S |
| Filter path/phase display based on filters | Integration | M |

**Deliverable**: Full search and filter functionality

---

### Phase 7: Polish & Testing

**Scope**: Animations, accessibility, tests

| Task | Files | Estimate |
|------|-------|----------|
| Add expand/collapse animations | CSS | S |
| Add keyboard navigation | Components | M |
| Unit tests for hooks | `*.test.ts` | M |
| Unit tests for components | `*.test.tsx` | M |
| E2E test for Training Tracks | `e2e/training-tracks.spec.ts` | M |
| Responsive design adjustments | CSS | S |

**Deliverable**: Production-ready feature with >90% test coverage

---

## File Structure

```
src/features/training/
├── TrainingTracksView.tsx          # Main page
├── training.css                    # Styles
├── components/
│   ├── TrainingProgressDashboard.tsx
│   ├── ContinueLearningCard.tsx
│   ├── WhatsNewBanner.tsx
│   ├── TrainingPathCard.tsx
│   ├── TrainingPhaseSection.tsx
│   └── ManualRow.tsx
├── hooks/
│   ├── useTrainingProgress.ts
│   ├── useTrainingProgress.test.ts
│   ├── useWhatsNew.ts
│   ├── useWhatsNew.test.ts
│   ├── useManualSearch.ts
│   └── useManualSearch.test.ts
└── index.ts                        # Barrel export
```

---

## Integration Points

### Sidebar (`src/app/Sidebar.tsx`)

Add new nav item after "Gallery":

```tsx
{ icon: '📖', label: 'Training Tracks', path: '/training' }
```

### Router (`src/app/App.tsx`)

Add route:

```tsx
<Route path="/training" element={<TrainingTracksView />} />
```

### Gallery Detail Panel

Keep existing "Training Manuals" section in `GalleryDetailPanel.tsx` — it provides context-sensitive manual links when viewing a sample.

---

## Storage Format

### `training_progress` Example

```json
{
  "manuals": {
    "tests/parameterized-basics-easy.html": {
      "manualPath": "tests/parameterized-basics-easy.html",
      "status": "completed",
      "lastViewedAt": 1714924800000,
      "completedAt": 1714924800000
    },
    "tests/parameterized-country-validation-medium.html": {
      "manualPath": "tests/parameterized-country-validation-medium.html",
      "status": "in_progress",
      "lastViewedAt": 1714928400000
    }
  },
  "lastUpdated": 1714928400000,
  "streak": 4
}
```

### Manual Metadata Example

```typescript
// In contentPaths.ts or separate metadata file
export const manualMetadata: ManualMetadata[] = [
  {
    manualPath: 'tests/parameterized-auth-rotation-advanced.html',
    addedAt: 1714838400000,  // May 4, 2026
    changeNote: 'New manual for Auth Token Rotation sample'
  },
  {
    manualPath: 'tests/parameterized-basics-easy.html',
    addedAt: 1704067200000,  // Jan 1, 2024
    updatedAt: 1714752000000, // May 3, 2026
    changeNote: 'Added new section on column types'
  }
];
```

---

## "What's New" Logic

1. **New Content**: `addedAt` within last 14 days
2. **Updated Content**: `updatedAt` within last 14 days AND `updatedAt > addedAt`
3. **Sort Order**: Most recent first
4. **Limit**: Show top 5, with "Show all" option

---

## Progress Calculation

```typescript
function calculatePathProgress(path: TrainingPath, progress: TrainingProgress) {
  const allManuals = path.phases.flatMap(p => p.manuals);
  const completed = allManuals.filter(m => 
    progress.manuals[m.manualPath]?.status === 'completed'
  ).length;
  return {
    completed,
    total: allManuals.length,
    percentage: Math.round((completed / allManuals.length) * 100)
  };
}
```

---

## Streak Calculation

- Increment streak when user completes a manual on a new calendar day
- Reset to 1 if >24 hours since last completion
- Store `lastCompletionDate` to track day boundaries

---

## Accessibility

- All interactive elements keyboard-accessible
- ARIA labels for status buttons
- `aria-expanded` for collapsible sections
- Focus management on expand/collapse
- Screen reader announcements for status changes

---

## Testing Strategy

### Unit Tests

| Area | Coverage Target |
|------|-----------------|
| `useTrainingProgress` | 95% |
| `useWhatsNew` | 90% |
| `useManualSearch` | 90% |
| Component rendering | 90% |

### E2E Tests

| Test Case | Priority |
|-----------|----------|
| Navigate to Training Tracks page | High |
| Expand/collapse path | High |
| Toggle manual status | High |
| Search filters results | Medium |
| "Continue Learning" navigates correctly | Medium |
| Progress persists across reload | High |
| "View Sample" navigates to gallery | Medium |

---

## Dependencies

- No new npm packages required
- Uses existing storage abstraction (`src/shared/utils/storage.ts`)
- Uses existing gallery data structures

---

## Success Metrics

1. **Adoption**: >50% of users visit Training Tracks within first week
2. **Engagement**: Average 3+ manuals marked per user
3. **Completion**: >20% of started paths reach 50% completion
4. **Retention**: Users return to continue learning (streak > 1)

---

## Open Questions

1. **Sync Progress?** — Should progress sync across devices (requires backend)?
2. **Gamification** — Add badges/achievements for completing paths?
3. **Recommendations** — Suggest next manual based on current progress?
4. **Export** — Allow users to export their progress?

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-05 | Initial plan created |
| 2026-05-05 | Phase 1 completed: types, hooks, metadata, tests (45 passing) |
| 2026-05-05 | Phase 2 completed: main view, dashboard, continue card, CSS, tests (61 total passing) |
| 2026-05-05 | Phase 3 completed: extracted components (TrainingPathCard, TrainingPhaseSection, ManualRow), expand/collapse, tests (98 total passing) |
| 2026-05-05 | Phase 4 completed: status toggle, open manual, view sample, continue learning wiring, tests (106 total passing) |
| 2026-05-05 | Phase 5 completed: WhatsNewBanner component with dismiss persistence, tests (126 total passing) |
