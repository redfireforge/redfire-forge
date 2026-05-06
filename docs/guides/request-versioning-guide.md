# Request Versioning Guide

Track changes to requests with version history — compare, review, and restore previous versions.

## Overview

**Request versioning** helps you:
- Track changes over time
- Compare different versions
- Restore previous configurations
- Audit who changed what

## How Versioning Works

### Automatic Snapshots

Versions are automatically created when:
- Request URL or method changes
- Headers are modified
- Body content changes significantly
- Auth configuration changes

### Manual Snapshots

Create explicit versions:
1. Open the request
2. Click **Save as Version**
3. Add a descriptive message

## Viewing Version History

### Accessing History

1. Open the request
2. Click the **History** icon (🕒)
3. Version list appears

### Version List

```
┌─────────────────────────────────────────────────────────┐
│ Version History: Get User                               │
├─────────────────────────────────────────────────────────┤
│ ● v5 (Current)                                          │
│   2024-01-15 14:30 - Added auth header                 │
│                                                         │
│ ○ v4                                                    │
│   2024-01-15 10:15 - Updated URL path                  │
│                                                         │
│ ○ v3                                                    │
│   2024-01-14 16:45 - Changed to GET method             │
│                                                         │
│ ○ v2                                                    │
│   2024-01-14 09:20 - Initial creation                  │
└─────────────────────────────────────────────────────────┘
```

### Version Details

Click a version to see:
- Timestamp
- Change summary
- Full configuration at that point

## Comparing Versions

### Side-by-Side Diff

1. Select two versions
2. Click **Compare**
3. Differences are highlighted

```
┌──────────────────────────────────────────────────────────┐
│ Compare: v4 ↔ v5                                         │
├──────────────────────────────────────────────────────────┤
│                v4                    v5                  │
├──────────────────────────────────────────────────────────┤
│ URL:                                                     │
│   /users/{id}          →     /users/{id}  (unchanged)   │
│                                                         │
│ Headers:                                                │
│   Content-Type: json   →     Content-Type: json         │
│   (none)               →   + Authorization: Bearer ...  │
│                                                         │
│ Body:                                                   │
│   (unchanged)                                           │
└──────────────────────────────────────────────────────────┘
```

### Diff Highlighting

| Color | Meaning |
|-------|---------|
| Green | Added |
| Red | Removed |
| Yellow | Modified |
| Gray | Unchanged |

## Restoring Versions

### Full Restore

Replace current with a previous version:

1. Select the version to restore
2. Click **Restore**
3. Confirm the action

The current state becomes a new version (so you can undo the restore).

### Partial Restore

Restore specific parts:

1. View version details
2. Click **Copy URL** / **Copy Headers** / **Copy Body**
3. Paste into current request

## Version Labels

### Adding Labels

Mark important versions:

1. Click the label icon on a version
2. Enter a label (e.g., "Before refactor", "v1.0 release")

### Filtering by Label

Show only labeled versions:

```
Filter: [✓] Show all  [○] Labeled only
```

## Storage and Limits

### Version Retention

- Last 50 versions are kept by default
- Labeled versions are never auto-deleted
- Configurable in Settings

### Storage Impact

Versions are stored efficiently:
- Only changed fields are stored
- Shared data is deduplicated

## Tips & Best Practices

### 1. Label Important Versions

```
"Before API v2 migration"
"Working version - rollback if needed"
"Tested with production data"
```

### 2. Review Before Major Changes

Check history before making big modifications.

### 3. Use Manual Snapshots

Before experiments:
1. Save as Version with description
2. Make changes
3. Restore if experiment fails

### 4. Compare When Debugging

If a request stopped working:
1. Find last working version
2. Compare with current
3. Identify breaking change

## Related Guides

- [Requests Guide](./requests-guide.md) — Request basics
- [Test Versioning Guide](./test-versioning-guide.md) — Test version history
