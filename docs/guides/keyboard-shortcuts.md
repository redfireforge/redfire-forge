# Keyboard Shortcuts Reference

Complete reference for all keyboard shortcuts in RedfireForge.

## Global Shortcuts

Available throughout the application.

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + Shift + T` | Toggle dark/light theme |
| `Escape` | Close modal / Cancel action |
| `F1` | Open help |

## Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + 1` | Go to Requests tab |
| `Cmd/Ctrl + 2` | Go to Catalog tab |
| `Cmd/Ctrl + 3` | Go to Harness tab |
| `Cmd/Ctrl + 4` | Go to Workflow tab |
| `Cmd/Ctrl + \`` | Toggle sidebar |

## Requests

### Request Editor

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send request |
| `Cmd/Ctrl + S` | Save request |
| `Cmd/Ctrl + N` | New request |
| `Cmd/Ctrl + D` | Duplicate request |
| `Cmd/Ctrl + I` | Insert variable |
| `Cmd/Ctrl + B` | Beautify JSON body |
| `Cmd/Ctrl + /` | Toggle comment |

### Request List

| Shortcut | Action |
|----------|--------|
| `↑ / ↓` | Navigate requests |
| `Enter` | Open selected request |
| `Delete` | Delete selected request |
| `Cmd/Ctrl + Shift + N` | New folder |

### Response Panel

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + F` | Search in response |
| `Cmd/Ctrl + C` | Copy selected value |
| `Cmd/Ctrl + Shift + C` | Copy JSONPath |
| `F3` / `Shift + F3` | Next / Previous match |

## Test Harness

### Scenario List

| Shortcut | Action |
|----------|--------|
| `↑ / ↓` | Navigate items |
| `Space` | Toggle selection |
| `Cmd/Ctrl + A` | Select all |
| `Enter` | Edit selected test |

### Test Runner

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Start test run |
| `Escape` | Stop test run |
| `Cmd/Ctrl + R` | Reset configuration |

### Test Editor

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save test |
| `Tab` | Next field |
| `Shift + Tab` | Previous field |
| `Cmd/Ctrl + Enter` | Save and close |
| `Escape` | Cancel and close |

## Workflow Designer

### Canvas

| Shortcut | Action |
|----------|--------|
| `Space + Drag` | Pan canvas |
| `Scroll` | Zoom in/out |
| `Cmd/Ctrl + 0` | Fit to screen |
| `Cmd/Ctrl + 1` | Zoom to 100% |
| `Cmd/Ctrl + +` | Zoom in |
| `Cmd/Ctrl + -` | Zoom out |
| `L` | Auto-layout |

### Node Selection

| Shortcut | Action |
|----------|--------|
| `Click` | Select node |
| `Cmd/Ctrl + Click` | Add to selection |
| `Shift + Click` | Add range to selection |
| `Cmd/Ctrl + A` | Select all nodes |
| `Escape` | Clear selection |

### Node Operations

| Shortcut | Action |
|----------|--------|
| `Delete` | Delete selected nodes |
| `Cmd/Ctrl + C` | Copy selected nodes |
| `Cmd/Ctrl + V` | Paste nodes |
| `Cmd/Ctrl + D` | Duplicate selected |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |

### Quick Test

| Shortcut | Action |
|----------|--------|
| `F5` | Run quick test |
| `F6` | Step (in step mode) |
| `F7` | Resume |
| `F8` | Stop |
| `B` | Toggle breakpoint on selected |

### Node Editing

| Shortcut | Action |
|----------|--------|
| `Enter` | Open node editor |
| `E` | Edit node label |
| `Tab` | Next node (in graph order) |

## Results Dashboard

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + F` | Search results |
| `Cmd/Ctrl + E` | Export results |
| `↑ / ↓` | Navigate results |
| `Enter` | Expand/collapse group |
| `R` | Refresh |

## Results Explorer (Workflow Trace)

| Shortcut | Action |
|----------|--------|
| `← / →` | Previous / Next iteration |
| `1` – `9` | Jump to iteration N |
| `Space` | Toggle aggregate ↔ iteration #1 |
| `A` | Return to aggregate view |
| `M` | Toggle iteration matrix panel |
| `Escape` | Deselect node / Close modal |

## Data Source Editor

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Save and run verify |
| `Tab` | Next cell |
| `Shift + Tab` | Previous cell |
| `Enter` | Edit cell / Move down |
| `Escape` | Cancel edit |
| `Delete` | Clear cell |
| `Cmd/Ctrl + Shift + D` | Duplicate row |

## Modal Dialogs

| Shortcut | Action |
|----------|--------|
| `Escape` | Close / Cancel |
| `Enter` | Confirm / Submit |
| `Tab` | Next input |
| `Shift + Tab` | Previous input |

## Text Editing

Standard text editing shortcuts work in all text fields:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + A` | Select all |
| `Cmd/Ctrl + C` | Copy |
| `Cmd/Ctrl + V` | Paste |
| `Cmd/Ctrl + X` | Cut |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + ←/→` | Word jump |
| `Cmd/Ctrl + Shift + ←/→` | Select word |
| `Home / End` | Line start / end |
| `Cmd/Ctrl + Home/End` | Document start / end |

## JSON Editor

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Format / Beautify |
| `Cmd/Ctrl + Shift + M` | Minify |
| `Cmd/Ctrl + /` | Toggle comment |
| `Cmd/Ctrl + ]` | Indent |
| `Cmd/Ctrl + [` | Outdent |
| `Alt + ↑/↓` | Move line up/down |
| `Cmd/Ctrl + D` | Duplicate line |

## Platform Differences

### macOS

Uses `Cmd` key for most shortcuts.

### Windows / Linux

Uses `Ctrl` key for most shortcuts.

### Common Variations

| macOS | Windows/Linux |
|-------|---------------|
| `Cmd` | `Ctrl` |
| `Option` | `Alt` |
| `Cmd + Q` | `Alt + F4` |
| `Cmd + Backspace` | `Ctrl + Backspace` |

## Customization

Currently, keyboard shortcuts cannot be customized. This is planned for a future release.

## Shortcut Conflicts

If a shortcut doesn't work:
- Check if another application is capturing it
- Ensure focus is in the correct area
- Some shortcuts only work in specific contexts

## Tips

### Learning Shortcuts

1. Start with essentials: `Cmd/Ctrl + Enter` (send/run), `Cmd/Ctrl + S` (save)
2. Learn navigation: `Cmd/Ctrl + 1-4` for tabs
3. Add workflow shortcuts: `F5` (run), `Space` (pan)

### Efficiency

- Use `Tab` to navigate between fields
- Use `Enter` to confirm and move forward
- Use `Escape` to cancel and go back

## Related Guides

- [Getting Started](./getting-started.md) — Quick start
- [Workflow Designer Guide](./workflow-designer-guide.md) — Workflow canvas
- [Preferences Guide](./preferences-guide.md) — Settings
