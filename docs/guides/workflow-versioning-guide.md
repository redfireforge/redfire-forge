# Workflow Versioning Guide

Track changes to workflows with version history — compare, review, and restore previous versions.

## Overview

**Workflow versioning** provides:
- Complete change history
- Visual diff between versions
- Rollback capability
- Node-level change tracking

## How Versioning Works

### Automatic Snapshots

Versions are created when:
- Nodes are added, removed, or modified
- Edges (connections) change
- Variables are updated
- Service configurations change

### Manual Snapshots

Create explicit versions:
1. Click **Save as Version** in toolbar
2. Enter description
3. Save

## Version History

### Accessing History

1. Click **Version History** in toolbar
2. Version list appears in panel

### Version List

```
┌─────────────────────────────────────────────────────────┐
│ Workflow Version History                                │
├─────────────────────────────────────────────────────────┤
│ ● v12 (Current)                   2024-01-15 14:30      │
│   Added error handler branch                            │
│                                                         │
│ ○ v11                             2024-01-15 10:15      │
│   Modified HTTP node: Create User                       │
│                                                         │
│ ○ v10 ★ "Production Release"      2024-01-14 16:45      │
│   Complete flow with all features                       │
│                                                         │
│ ○ v9                              2024-01-14 09:20      │
│   Added parallel processing fork/join                   │
└─────────────────────────────────────────────────────────┘
```

### Version Details

Click a version to see:
- Node count
- Edge count
- Variable definitions
- Changed elements

## Visual Diff

### Comparing Versions

1. Select two versions (checkboxes)
2. Click **Compare**
3. Visual diff shows changes

### Diff View

```
┌─────────────────────────────────────────────────────────┐
│ Compare: v10 ↔ v12                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Canvas View:                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Start] → [Create User] → [Get Token]          │   │
│  │               │(modified)       │               │   │
│  │               ↓                 ↓               │   │
│  │         [Error Handler]    [Continue] (added)   │   │
│  │            (added)              │               │   │
│  │                                 ↓               │   │
│  │                            [End]                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Legend:                                                │
│  🟢 Added   🔴 Removed   🟡 Modified   ⚪ Unchanged     │
└─────────────────────────────────────────────────────────┘
```

### Node-Level Diff

Click a modified node to see details:

```
┌─────────────────────────────────────────────────────────┐
│ Node: Create User (HTTP)                    Modified    │
├─────────────────────────────────────────────────────────┤
│ URL:                                                    │
│   v10: POST /user                                       │
│   v12: POST /users  (changed)                           │
│                                                         │
│ Headers:                                                │
│   (unchanged)                                           │
│                                                         │
│ Body:                                                   │
│   v10: {"name": "{{name}}"}                            │
│   v12: {"name": "{{name}}", "email": "{{email}}"}      │
│                                                         │
│ Assertions:                                             │
│   + Added: $.data.email exists                          │
└─────────────────────────────────────────────────────────┘
```

## Restoring Versions

### Full Restore

1. Select version to restore
2. Click **Restore**
3. Confirm

Current state is saved as new version before restore.

### Partial Restore

Restore specific elements:

```
Restore from v10:
  ☑ HTTP Node: Create User
  ☐ HTTP Node: Get Token
  ☑ Variables
  ☐ Services
  
  [Restore Selected]
```

## Edge Versioning

Connections are also tracked:

```
Edge Changes:
  + Added: "Create User" → "Error Handler"
  - Removed: "Create User" → "End"
  ~ Modified: "Fork" outputs (2 → 3)
```

## Variable Versioning

Track variable definition changes:

```
Variables Diff (v10 → v12):
  
  baseUrl:
    v10: "https://api.example.com"
    v12: "https://api.example.com"  (unchanged)
  
  timeout:
    v10: 30
    v12: 60  (changed)
  
  retryCount:
    v10: (not defined)
    v12: 3  (added)
```

## Labeled Versions

### Creating Labels

Star important versions:

```
★ "Pre-migration baseline"
★ "Production v1.0"
★ "After adding error handling"
```

### Label Usage

- Quick identification of milestones
- Never auto-deleted
- Easy reference points

## Version Export/Import

### Export Version

Save a specific version:

1. Select version
2. Click **Export**
3. Saves as `.workflow.json`

### Import Version

Restore from exported file:

1. Click **Import Version**
2. Select file
3. Creates new version from import

## Collaboration

### Change Attribution

If user tracking is enabled:

```
v12 - 2024-01-15 14:30
  By: john.doe@example.com
  Changed: Added error handler branch
```

### Reviewing Changes

Before accepting changes:

1. View version history
2. Compare with previous
3. Understand what changed
4. Restore if needed

## Tips & Best Practices

### 1. Label Before Major Changes

```
Before migration: ★ "Pre-API-v2"
After success: ★ "Post-API-v2-verified"
```

### 2. Use Descriptive Messages

```
✓ "Added retry logic for payment failures"
✓ "Integrated new notification service"
✗ "updates"
✗ "v2"
```

### 3. Review Diffs Regularly

Understand evolution of complex workflows.

### 4. Export Important Versions

Keep backups of critical milestones.

### 5. Test After Restore

Always run Quick Test after restoring a version.

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Test Versioning Guide](./test-versioning-guide.md) — Test versions
- [Request Versioning Guide](./request-versioning-guide.md) — Request versions
