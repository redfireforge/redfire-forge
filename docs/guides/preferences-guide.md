# Preferences Guide

Customize RedfireForge settings — theme, editor behavior, storage, and application preferences.

## Overview

Access preferences via **Settings** (⚙️ icon) in the sidebar.

## Theme Settings

### Theme Selection

```
Theme: [○ Light  ● Dark  ○ System]
```

| Option | Behavior |
|--------|----------|
| **Light** | Always use light theme |
| **Dark** | Always use dark theme |
| **System** | Follow OS preference |

### Accent Color

Choose accent color for UI elements:

```
Accent: [Blue ▼]
  Blue
  Purple
  Green
  Orange
  Red
```

## Editor Settings

### JSON Editor

```
JSON Editor:
  ☑ Auto-format on paste
  ☑ Syntax highlighting
  ☑ Line numbers
  ☐ Word wrap
  
  Tab size: [2 ▼]
  Font size: [14 ▼]
  Font family: [Mono ▼]
```

### Auto-Save

```
Auto-Save:
  ● Save automatically
  ○ Prompt before saving
  ○ Never auto-save
  
  Auto-save delay: [3___] seconds
```

### Request History

```
Request History:
  Keep last [100__] requests per collection
  ☑ Include response bodies
  ☐ Include response headers only
```

## Test Runner Settings

### Default Configuration

```
Default Test Configuration:
  Concurrency: [10___]
  Iterations:   [100__]
  Mode: [Pool ▼]
  Timeout: [30___] seconds
```

### Result Storage

```
Results:
  Keep last [50___] runs
  ☑ Auto-delete old runs
  ☑ Compress stored results
```

### Progress Display

```
Progress Display:
  ☑ Show live metrics
  ☑ Show response time graph
  ☐ Auto-expand error details
```

## Workflow Settings

### Canvas

```
Workflow Canvas:
  ☑ Snap to grid
  Grid size: [20___] pixels
  ☑ Show minimap
  ☑ Show node labels
```

### Quick Test

```
Quick Test:
  ☑ Auto-run on open
  ☐ Step-through by default
  ☑ Show variable values
```

### Auto-Layout

```
Auto-Layout:
  Direction: [Top to Bottom ▼]
  Node spacing: [50___] pixels
  Rank spacing: [80___] pixels
```

## Network Settings

### Timeout Defaults

```
Network:
  Default timeout: [30___] seconds
  Connection timeout: [10___] seconds
  ☑ Follow redirects
  Max redirects: [5___]
```

### Proxy

```
Proxy Settings:
  ☐ Use system proxy
  ○ No proxy
  ○ Custom proxy
  
  HTTP Proxy: [________________]
  HTTPS Proxy: [________________]
  No proxy for: [localhost, 127.0.0.1]
```

### SSL/TLS

```
SSL/TLS:
  ☐ Reject unauthorized certificates
  ☐ Use client certificate
```

## Storage Settings

### Data Location

**Desktop App:**
```
Data Directory: ~/Library/Application Support/RedfireForge
  [Open Folder]  [Change Location]
```

**Web Mode:**
```
Storage: Browser localStorage
  Used: 4.2 MB / 10 MB
  [Clear All Data]
```

### Export/Import

```
Data Management:
  [Export All Data]
  [Import Data]
  [Reset to Defaults]
```

### Sync (Future)

```
Cloud Sync:
  ☐ Enable sync
  Account: Not connected
  [Connect Account]
```

## Privacy Settings

### Telemetry

```
Usage Analytics:
  ☐ Send anonymous usage data
  ☐ Send crash reports
```

### Data Retention

```
Data Retention:
  ☑ Clear sensitive data on exit
  ☑ Don't store passwords in history
```

## Keyboard Settings

### Shortcuts

View and customize shortcuts:

```
Keyboard Shortcuts:
  Send Request: Cmd+Enter
  Save: Cmd+S
  New Request: Cmd+N
  ...
  
  [View All Shortcuts]
  [Reset to Defaults]
```

## Notification Settings

### Alerts

```
Notifications:
  ☑ Test run complete
  ☑ Test failures
  ☐ Background task complete
  
  Sound: [○ On  ● Off]
```

## Advanced Settings

### Performance

```
Performance:
  ☑ Hardware acceleration
  ☑ Lazy load large responses
  Max response size: [10___] MB
```

### Developer Options

```
Developer:
  ☐ Enable debug mode
  ☐ Show internal IDs
  ☐ Verbose logging
  
  [Open Dev Tools]
```

### Experimental Features

```
Experimental:
  ☐ Enable beta features
  ☐ Preview mode
```

## Settings Profiles

### Save Profile

Save current settings as a profile:

1. Click **Save Profile**
2. Enter name
3. Save

### Load Profile

```
Profiles:
  ○ Default
  ● Development
  ○ CI/CD
  ○ Production Testing
  
  [Load]  [Delete]
```

## Import/Export Settings

### Export

```
[Export Settings]
→ Downloads settings.json
```

### Import

```
[Import Settings]
→ Select settings.json
→ Choose what to import:
  ☑ Theme settings
  ☑ Editor settings
  ☑ Test runner defaults
  ☐ Network settings
```

### Reset

```
[Reset All Settings]
→ Confirm: This will reset all settings to defaults.
  [Cancel]  [Reset]
```

## Platform-Specific Settings

### Desktop Only

- File system access
- Native notifications
- System proxy detection
- Hardware acceleration

### Web Only

- localStorage limits
- Download behavior
- Browser integration

## Tips & Best Practices

### 1. Set Sensible Defaults

Configure default concurrency/iterations for your typical use case.

### 2. Enable Auto-Save

Avoid losing work with auto-save enabled.

### 3. Configure Result Retention

Balance storage usage with history needs.

### 4. Use Profiles

Create profiles for different scenarios:
- Development (verbose, small runs)
- Production Testing (quiet, large runs)

### 5. Export Before Major Changes

Export settings before updating RedfireForge.

## Related Guides

- [Getting Started](./getting-started.md) — Quick start
- [Keyboard Shortcuts](./keyboard-shortcuts.md) — All shortcuts
- [Cross-Platform Guide](./cross-platform.md) — Platform differences
