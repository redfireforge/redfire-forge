# Test Versioning Guide

Track changes to test definitions with version history — compare, review, and restore previous versions.

## Overview

**Test versioning** provides:
- Change tracking for test definitions
- Comparison between versions
- Rollback capability
- Audit trail

## How Versioning Works

### Automatic Snapshots

Versions are created when:
- URL, method, or headers change
- Body structure changes
- Validation rules are modified
- Assertions are added/removed
- Data source configuration changes

### Manual Snapshots

Create explicit versions:
1. Open test editor
2. Click **Save as Version**
3. Enter description

## Version History

### Accessing History

1. Open test editor
2. Click **Version History** tab
3. See list of versions

### Version List

```
┌─────────────────────────────────────────────────────────┐
│ Test Version History: Create User                       │
├─────────────────────────────────────────────────────────┤
│ ● v8 (Current)                    2024-01-15 14:30      │
│   Added email validation assertion                      │
│                                                         │
│ ○ v7                              2024-01-15 10:15      │
│   Updated expected status to 201                        │
│                                                         │
│ ○ v6 ★ "API v2 Update"            2024-01-14 16:45      │
│   Changed endpoint from /user to /users                 │
│                                                         │
│ ○ v5                              2024-01-14 09:20      │
│   Added data source                                     │
└─────────────────────────────────────────────────────────┘
```

## Comparing Versions

### Opening Compare View

1. Select first version (checkbox)
2. Select second version (checkbox)
3. Click **Compare**

### Diff View

```
┌──────────────────────────────────────────────────────────┐
│ Test Definition Diff: v6 ↔ v8                            │
├──────────────────────────────────────────────────────────┤
│ URL:                                                     │
│ - POST /user                                             │
│ + POST /users                                            │
│                                                         │
│ Expected Status:                                         │
│ - 200                                                    │
│ + 201                                                    │
│                                                         │
│ Assertions:                                              │
│   [unchanged] Status = 2xx                               │
│   [unchanged] $.data.id exists                           │
│ + [added] $.data.email matches ^.+@.+$                   │
│                                                         │
│ Validation:                                              │
│   Mode: selective (unchanged)                            │
│   Include paths: (unchanged)                             │
└──────────────────────────────────────────────────────────┘
```

### Diff Types

| Change | Display |
|--------|---------|
| Added line | Green `+` |
| Removed line | Red `-` |
| Modified section | Yellow highlight |
| Unchanged | Normal text |

## Restoring Versions

### Full Restore

1. Click version to restore
2. Click **Restore**
3. Confirm

Current state is saved as new version before restore.

### Selective Restore

Restore specific parts:

```
Restore Options:
  ☑ URL and Method
  ☐ Headers
  ☑ Body Template
  ☐ Assertions
  ☐ Data Source
  
  [Restore Selected]
```

## Version Metadata

Each version tracks:
- Timestamp
- User who made change (if available)
- Auto-generated change summary
- Manual description (if provided)

## Labeled Versions

### Creating Labels

Mark important versions:

1. Click star icon on version
2. Enter label

```
★ "Pre-migration baseline"
★ "API v2 compatible"
★ "Production verified"
```

### Finding Labeled Versions

Filter to show only starred:

```
[★ Show starred only]
```

## Version Policies

### Auto-Version Triggers

Configure what triggers automatic versions:

```
Settings > Versioning:
  ☑ URL changes
  ☑ Assertion changes
  ☐ Header changes (minor)
  ☑ Body structure changes
  ☐ Every save (many versions)
```

### Retention

```
Keep versions:
  ○ Last 20
  ● Last 50
  ○ Last 100
  ○ All
  
  ☑ Never delete starred versions
```

## Use Cases

### Debugging Failures

Test suddenly fails:

1. Open version history
2. Find last passing version
3. Compare with current
4. Identify breaking change

### API Migration

Migrating to new API version:

1. Star current version: "Pre-migration"
2. Make changes for new API
3. If issues, restore starred version

### Team Collaboration

Review changes from teammates:

1. Open version history
2. See who changed what
3. Compare their changes
4. Discuss via diff view

## Tips & Best Practices

### 1. Star Before Major Changes

Always create a labeled version before:
- API migrations
- Large refactors
- Experimental changes

### 2. Write Descriptive Labels

```
✓ "API v2.1 - new auth flow"
✓ "Before adding email validation"
✗ "backup"
✗ "v1"
```

### 3. Review History Regularly

Periodically review to:
- Clean up unnecessary versions
- Label important milestones
- Understand evolution

### 4. Use Selective Restore

Don't restore everything if only one part needs reverting.

## Related Guides

- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Request Versioning Guide](./request-versioning-guide.md) — Request versions
- [Workflow Versioning Guide](./workflow-versioning-guide.md) — Workflow versions
