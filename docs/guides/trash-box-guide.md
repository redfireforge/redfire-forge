# Trash Box Guide

Recover accidentally deleted Feature Groups, Scenarios, Tests, and Shared Data Sources with the built-in Trash Box.

## Overview

The **Trash Box** provides soft-delete with automatic retention for all deletable entities in RedfireForge. Instead of permanently removing items on delete, they are moved to a Trash Box where they can be restored within a configurable retention period.

**Key features:**

- **Instant undo** — A 5-second toast appears after every delete with an Undo button
- **Trash Panel** — Browse, search, and restore deleted items at any time
- **Automatic purge** — Expired items are cleaned up on app startup
- **Configurable** — Adjust retention period (7–90 days) and max item count (50–200)

> **Supported entity types:** Feature Groups, Scenarios, Tests, and Shared Data Sources.

## How Deletion Works

When you delete any entity (Feature Group, Scenario, Test, or Shared Data Source), RedfireForge:

1. **Snapshots** the item — a deep copy of the data is saved, including all children (e.g., a Feature Group preserves its Scenarios and Tests)
2. **Moves to Trash** — the item appears in the Trash Panel with metadata (parent path, timestamps, child counts)
3. **Shows the Undo toast** — a 5-second notification at the bottom of the screen with an Undo button
4. **Removes from the tree** — the item disappears from the Harness sidebar

The original data is preserved in storage (IndexedDB on web, file system on desktop) until the retention period expires.

## Instant Undo

After deleting any item, an undo toast appears at the bottom of the screen:

```
┌───────────────────────────────────────────────────┐
│  −  Login Flow  moved to Trash     [Undo]  [✕]   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└───────────────────────────────────────────────────┘
```

- Click **Undo** within 5 seconds to instantly restore the item to its original location
- Click **✕** or wait for the timer to expire to dismiss the toast
- The progress bar shows remaining time

> **Tip:** If you accidentally delete something, click Undo immediately — it's the fastest recovery path.

## Trash Panel

Access the Trash Panel from the toolbar:

1. Click the **Trash** button in the Harness toolbar (top-right)
2. A badge shows the number of items currently in trash

### Browsing Items

The Trash Panel displays all deleted items with:

- **Entity icon** — indicates type (Feature Group, Scenario, Test, Shared Data Source)
- **Name** — the original entity name
- **Parent path** — where the item lived (e.g., "Auth Feature > Login Tests")
- **Child counts** — for Feature Groups: number of scenarios and tests; for Scenarios: number of tests
- **Deletion time** — relative timestamp (e.g., "2 hours ago")
- **Expiry** — days until automatic purge (e.g., "Expires in 28 days")
- **Entity type badge** — uppercase label (FEATURE GROUP, SCENARIO, TEST, etc.)

### Searching

Use the search bar at the top of the Trash Panel to filter items by:

- Entity name (e.g., "Login")
- Parent path (e.g., "Auth Feature")

### Restoring Items

Click the **Restore** button on any item to recover it:

| Situation | Behavior |
|-----------|----------|
| Parent still exists | Restored into the original parent |
| Parent Feature Group deleted | Created in a new "Restored Items" Feature Group |
| Parent Scenario deleted | Created in a new "Restored Tests" Scenario |
| ID collision with existing item | A new unique ID is generated automatically |
| Environment/microservice deleted | Restored as unassigned (env/svc IDs cleared) |

### Permanent Deletion

Click **Delete** on any item to permanently remove it. A confirmation dialog appears — this action cannot be undone.

### Empty Trash

Click **Empty Trash** in the panel footer to permanently delete all items at once. A confirmation dialog shows the total count.

## Settings

The Trash Panel footer contains two configuration dropdowns:

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| **Retention** | 7, 14, 30, 60, 90 days | 30 days | How long items stay in trash before auto-purge |
| **Max items** | 50, 100, 200 | 100 | Maximum number of items stored in trash |

When the trash exceeds **Max items**, the oldest expired items are evicted first, then the oldest non-expired items.

Settings are persisted and survive page reloads.

## Automatic Purge

On every app startup, RedfireForge automatically purges expired items from the trash. Items are expired when the current time exceeds their `expiresAt` timestamp (calculated as `deletedAt + retentionDays`).

The number of purged items is logged to the browser console.

## Storage

Trash data is stored using the same dual-mode persistence as all other RedfireForge data:

| Platform | Primary | Fallback |
|----------|---------|----------|
| **Web (browser)** | IndexedDB | localStorage |
| **Desktop (Tauri)** | File system | — |

Settings are stored via the standard key-value storage abstraction.

## Tips & Best Practices

### 1. Use Undo for Quick Recovery

The 5-second undo window is the fastest way to recover. If you see the toast, click Undo — it's faster than opening the Trash Panel.

### 2. Check Trash Before Importing

If you're re-importing a Feature Group that you previously deleted, check the Trash first — restoring preserves the original structure and history.

### 3. Review Before Emptying

The Empty Trash action is irreversible. Review the list first, especially if items are still within their retention period.

### 4. Adjust Retention for Your Workflow

- **Short retention (7 days)** — for active development with frequent deletions
- **Long retention (90 days)** — for shared environments where multiple users might need recovery

## Related Guides

- [Scenarios Guide](./scenarios-guide.md) — Creating and managing Feature Groups, Scenarios, Tests
- [Shared Data Sources Guide](./shared-data-sources-guide.md) — Shared Data Sources management
- [Preferences Guide](./preferences-guide.md) — Application settings
