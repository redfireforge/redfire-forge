# Global Modal Standards

## Overview

RedFireForge uses a **StandardProfessionalModal** component that establishes consistent styling, spacing, and behavior across all application modals.

## Global Standard Behavior

**All modals are by default:**
- ✅ **Fully Movable** — Drag the header to reposition anywhere on screen
- ✅ **Fully Resizable** — Drag corner/edge resize handles to adjust dimensions
- ✅ **Viewport-Constrained** — Modal stays within 8px of window edges when dragged
- ✅ **Overlay-Closeable** — Click outside modal to close (unless disabled)
- ✅ **Professional Visual Style** — White edge highlight, 20px edge padding, subtle shadows

This standard ensures consistent, intuitive interaction across the entire application.

## Component Import

```typescript
import StandardProfessionalModal from '@/shared/components/StandardProfessionalModal';
```

## Standard Properties

### Visual Standards
| Property | Value | Purpose |
|---|---|---|
| **Width** | `min(720px, calc(100vw - 16px))` | Responsive: 720px max on desktop, full-width on mobile with 8px edge gutters |
| **Max Height** | `min(74vh, 700px)` | Leaves room for header/keyboard on mobile; max 700px on desktop |
| **Border Radius** | `12px` | Subtle rounding, not harsh corners |
| **Border** | `1px solid rgba(255, 255, 255, 0.12)` | **White edge highlight** — subtle but visible |
| **Shadows** | Inset + outer | Inset glow: `rgba(255,255,255,0.035)` for depth; Outer: `0 10px 28px rgba(0,0,0,0.35)` for floating effect |

### Spacing Standards
| Element | Padding/Gap | Purpose |
|---|---|---|
| **Modal Edge** | `20px` (all four sides) | Breathing room on edges; comfortable reading/interaction |
| **Modal Header** | `18px 20px 16px` | Top: visual alignment with edge, Bottom: less than top to connect with body |
| **Modal Body** | `20px` | Matches edge padding for visual consistency |
| **Internal Gaps** | `14px` (sections), `6px` (form rows) | Hierarchy: section gaps > form gaps |

### Interaction Standards (All Enabled by Default)
| Feature | Default | Purpose | Override |
|---|---|---|---|
| **Dragging** | ✅ Enabled | Move modal by dragging header | `disableDrag={true}` |
| **Resizing** | ✅ Enabled | Resize via corner/edge handles | `showResizeHandles={false}` |
| **Viewport Constraint** | 8px edge padding | Prevent modal from leaving screen | `dragViewportPadding={N}` |
| **Overlay Click** | ✅ Closes modal | Click outside to close | `closeOnOverlayClick={false}` |
| **Expand Button** | ❌ Disabled | Toggle fullscreen expansion | `showExpandButton={true}` |

## Disabling Standard Features

All modals are **movable and resizable by default**. If you need to disable these for a specific modal, use:

### Disable Dragging
```typescript
<StandardProfessionalModal
  disableDrag={true}
  // Modal is no longer draggable, but still resizable
>
```
**Use case:** Modal content requires precise scrolling without accidental drag activation.

### Disable Resizing
```typescript
<StandardProfessionalModal
  showResizeHandles={false}
  // Modal is still draggable, but resize handles are hidden
>
```
**Use case:** Modal has fixed dimensions and should not be resized by users.

### Disable Both
```typescript
<StandardProfessionalModal
  disableDrag={true}
  showResizeHandles={false}
  // Modal is locked in place (only overlay click closes it)
>
```
**Use case:** Modal is informational or has very specific layout requirements.

### Disable Overlay Click
```typescript
<StandardProfessionalModal
  closeOnOverlayClick={false}
  // User must use a button/action to close, not just click outside
>
```
**Use case:** Modal contains unsaved changes; require explicit close/save confirmation.

### Customize Viewport Padding
```typescript
<StandardProfessionalModal
  dragViewportPadding={16}  // Default is 8px
  // Modal stays further from screen edges when dragged
>
```
**Use case:** Account for browser UI or system taskbars that would otherwise overlap.

## Drag Anchoring

When a modal should open in a specific position (e.g., below a button), use `dragAnchor`:

```typescript
<StandardProfessionalModal
  dragAnchor={{
    selector: '#trigger-button',      // Target element (CSS selector)
    hAlign: 'center',                  // 'left' | 'center' | 'right'
    vAlign: 'bottom',                  // 'top' | 'center' | 'bottom'
    padding: { top: 16 }               // Optional offset from anchor point
  }}
>
```

**Common patterns:**
- Below button, centered: `{ selector: '#btn', hAlign: 'center', vAlign: 'bottom', padding: { top: 8 } }`
- Top-center of container: `{ selector: '#container', hAlign: 'center', vAlign: 'top', padding: { top: -220 } }`
- Offset from top-left: `{ selector: '#panel', hAlign: 'left', vAlign: 'top', padding: { top: 40, left: 16 } }`

## Close Button Patterns

Close buttons should be selected **case-by-case** based on context:

#### Pattern 1: Icon Button (Default)
```typescript
<StandardProfessionalModal
  closeButtonKind="icon"
  onClose={handleClose}
>
```
- Small `×` in top-right corner of header
- Best for: Modals triggered by user action, can be dismissed safely
- Rendered as: `<button className="ram-modal-close">×</button>`

#### Pattern 2: Text Button
```typescript
<StandardProfessionalModal
  closeButtonKind="text"
  closeButtonText="Close"
  onClose={handleClose}
>
```
- "Close" text button in top-right corner
- Best for: Confirmation dialogs, informational modals where explicit action clarity matters
- Rendered as: `<button className="btn btn-sm">Close</button>`

#### Pattern 3: No Button
```typescript
<StandardProfessionalModal
  closeButtonKind="none"
  onClose={handleClose}
>
```
- No close button in header
- Best for: Wizard-style modals with explicit Next/Confirm buttons in footer
- Alternative close: overlay click or Escape key

#### Pattern 4: Custom Header
```typescript
<StandardProfessionalModal
  onClose={handleClose}
  headerContent={(state) => (
    <div className="modal-header">
      <h3>My Modal</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <CustomButton />
        {state.closeButton}
      </div>
    </div>
  )}
>
```
- Fully custom header rendering
- Best for: Complex header layouts with multiple actions

## Drag Anchoring

When a modal should open in a specific position (e.g., below a button), use `dragAnchor`:

```typescript
<StandardProfessionalModal
  dragAnchor={{
    selector: '#trigger-button',      // Target element (CSS selector)
    hAlign: 'center',                  // 'left' | 'center' | 'right'
    vAlign: 'bottom',                  // 'top' | 'center' | 'bottom'
    padding: { top: 16 }               // Optional offset from anchor point
  }}
>
```

**Common patterns:**
- Below button, centered: `{ selector: '#btn', hAlign: 'center', vAlign: 'bottom', padding: { top: 8 } }`
- Top-center of container: `{ selector: '#container', hAlign: 'center', vAlign: 'top', padding: { top: -220 } }`
- Offset from top-left: `{ selector: '#panel', hAlign: 'left', vAlign: 'top', padding: { top: 40, left: 16 } }`

## Migration Guide

### From Raw AppModalFrame
**Before:**
```typescript
<AppModalFrame
  dialogClassName="my-modal"
  overlayClassName="my-overlay"
  showResizeHandles={true}
  constrainDragToViewport={true}
  dragViewportPadding={8}
  closeButtonKind="icon"
>
```

**After:**
```typescript
<StandardProfessionalModal
  closeButtonKind="icon"
  // All other defaults already applied
>
```

### From Inline CSS
**Before:**
```css
.my-modal.modal {
  width: min(720px, calc(100vw - 16px));
  max-height: min(74vh, 700px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  /* ... many more rules ... */
}
```

**After:**
```typescript
<StandardProfessionalModal>
  {/* CSS automatically applied */}
</StandardProfessionalModal>
```

## Example: Dry-Run Tester Modal

```typescript
import StandardProfessionalModal from '@/shared/components/StandardProfessionalModal';

export function DryRunTesterModal({ isOpen, onClose }) {
  return (
    <StandardProfessionalModal
      open={isOpen}
      title="Dry-Run Test"
      onClose={onClose}
      closeButtonKind="icon"
      dragAnchor={{
        selector: '[data-testid="grpc-mock-builder-panel"]',
        hAlign: 'center',
        vAlign: 'top',
        padding: { top: -220 }
      }}
    >
      <div className="tester-content">
        {/* Content goes here with standard 20px edge spacing */}
      </div>
    </StandardProfessionalModal>
  );
}
```

## Responsive Behavior

On screens ≤ 720px width:
- Modal width: `calc(100vw - 16px)` (8px gutter on each side)
- Modal height: `calc(100vh - 16px)` (8px gutter on top/bottom)
- Interior layout may stack (design-dependent)
- All drag constraints remain active

## Related Components

- **AppModalFrame**: Low-level component for custom modals (use StandardProfessionalModal instead)
- **WorkflowEditorModalFrame**: Specialized for workflow editor modals (different styling)
- **ModalExpandButton**: Expand/collapse toggle (disabled by default in StandardProfessionalModal)
- **ModalResizeHandles**: Corner/edge resize (enabled by default)

## Testing Considerations

When creating E2E tests for modals using StandardProfessionalModal:

1. **Drag constraint testing**: Verify modal stays within 8px edge padding when dragged in all directions
2. **Resize testing**: Test corner/edge drag to verify resizing works smoothly
3. **Close button testing**: Test close button click closes modal (icon/text/none patterns)
4. **Overlay click testing**: Verify overlay click closes modal (unless `closeOnOverlayClick={false}`)
5. **Viewport resize testing**: Confirm modal resizes responsively on window resize
6. **Z-index testing**: Verify modal appears above other UI elements (z-index: 1800)

## CSS Classes Reference

```css
/* Overlay container */
.professional-modal-overlay { }

/* Modal dialog box */
.professional-modal { }

/* Modal header (title + close button) */
.professional-modal .modal-header { }

/* Modal title */
.professional-modal .modal-header h3 { }

/* Close button (icon style) */
.ram-modal-close { }

/* Close button (text style) */
.btn.btn-sm { }
```

## Troubleshooting

### Modal appears behind other elements
Check z-index: StandardProfessionalModal uses `z-index: 1800`. Ensure overlay elements have lower z-index or use `overlayClassName` to override.

### Modal doesn't drag
Ensure `disableDrag={false}` (default). Check that header is not in a `overflow: hidden` container. Verify header has `onMouseDown` and `onPointerDown` event handlers.

### Modal resizes unexpectedly during drag
This should not happen — height and width are locked during drag. If it does, check that `useModalDrag` hook is properly locking dimensions.

### Resize handles don't appear
Check if `showResizeHandles={false}` was set. Verify the modal has non-zero dimensions (check `minWidth`, `minHeight`).

### Drag anchor doesn't work
Verify:
1. Target selector matches an existing DOM element
2. Element is visible in DOM (not hidden or display:none)
3. `dragAnchor` object is passed to component (not AppModalFrame directly)

### Modal is stuck off-screen
This shouldn't happen with viewport constraints. If it does, manually reposition by opening your browser dev tools and checking the transform/position styles, then reload the page.

---

**Last Updated:** July 2026  
**Maintained By:** Design System Team  
**Current Version:** 1.0 (Global Standard - Movable, Resizable & Professional)
