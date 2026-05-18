# Gallery Guide

Explore pre-built samples and training content — learn best practices, import examples, and follow guided tutorials.

## Overview

The **Gallery** provides:
- Ready-to-use test samples
- Step-by-step training manuals
- Learning paths for different skill levels
- Quick-start templates

## Gallery Sections

### Samples

Pre-built tests and workflows:

```
┌─────────────────────────────────────────────────────────┐
│ Gallery > Samples                                       │
├─────────────────────────────────────────────────────────┤
│ [Search...                                  ] [Filters] │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ★ JSONPlaceholder API Tests                         │ │
│ │   Basic CRUD operations against a public API        │ │
│ │   [Try It] [Import]                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ★ User Registration Workflow                        │ │
│ │   Multi-step workflow with conditions and loops     │ │
│ │   [Try It] [Import]                                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Training Tracks

Structured learning paths:

```
┌─────────────────────────────────────────────────────────┐
│ Gallery > Training Tracks                               │
├─────────────────────────────────────────────────────────┤
│ ▼ Getting Started Track                                 │
│   ├── ① First Test (5 min) ✓                           │
│   ├── ② Understanding Assertions (10 min) ✓            │
│   └── ③ Running Performance Tests (15 min) ○           │
│                                                         │
│ ▼ Workflow Mastery Track                                │
│   ├── ① Workflow Basics (10 min) ○                     │
│   ├── ② Variables & Extraction (15 min) ○              │
│   └── ③ Advanced Patterns (20 min) ○                   │
└─────────────────────────────────────────────────────────┘
```

## Using Samples

### Browsing Samples

1. Go to **Gallery** tab
2. Browse or search samples
3. Click a sample to see details

### Sample Details

```
┌─────────────────────────────────────────────────────────┐
│ JSONPlaceholder CRUD Tests                              │
├─────────────────────────────────────────────────────────┤
│ Description:                                            │
│   Complete CRUD test suite using the public             │
│   JSONPlaceholder API. Demonstrates GET, POST, PUT,     │
│   and DELETE operations with assertions.                │
│                                                         │
│ What you'll learn:                                      │
│   • Basic HTTP requests                                 │
│   • Status code assertions                              │
│   • JSONPath validation                                 │
│   • Data-driven testing                                 │
│                                                         │
│ Difficulty: ● Easy                                      │
│ Time: ~10 minutes                                       │
│                                                         │
│ Includes:                                               │
│   • 5 test scenarios                                    │
│   • Sample data source                                  │
│   • Assertions                                          │
│                                                         │
│ [Try It]  [Import to My Tests]  [View Source]           │
└─────────────────────────────────────────────────────────┘
```

### Try It Mode

Test a sample without importing:

1. Click **Try It**
2. Sample loads in a temporary workspace
3. Run tests, explore configuration
4. Nothing is saved unless you import

### Importing Samples

Add a sample to your workspace:

1. Click **Import**
2. Choose destination:
   - Create new feature group
   - Add to existing feature group
3. Sample is copied to your workspace

## Training Tracks

### What are Training Tracks?

Structured learning paths with:
- Progressive difficulty
- Hands-on exercises
- Progress tracking
- Related samples

### Following a Track

1. Go to **Training Tracks**
2. Select a track
3. Start with the first lesson
4. Complete exercises
5. Progress automatically tracked

### Track Structure

```
Track: API Testing Fundamentals
├── Phase 1: Basics
│   ├── Lesson 1.1: Your First Request
│   ├── Lesson 1.2: Understanding Responses
│   └── Lesson 1.3: Basic Assertions
├── Phase 2: Intermediate
│   ├── Lesson 2.1: Data-Driven Testing
│   ├── Lesson 2.2: Complex Assertions
│   └── Lesson 2.3: Test Organization
└── Phase 3: Advanced
    ├── Lesson 3.1: Performance Testing
    ├── Lesson 3.2: Error Handling
    └── Lesson 3.3: CI Integration
```

### Progress Tracking

Your progress is saved:

```
Track Progress: API Testing Fundamentals

Phase 1: Basics ████████░░ 80%
  ✓ Your First Request
  ✓ Understanding Responses
  ○ Basic Assertions (in progress)

Phase 2: Intermediate ░░░░░░░░░░ 0%
Phase 3: Advanced ░░░░░░░░░░ 0%
```

### Resetting Progress

Start over if needed:

1. Open track settings
2. Click **Reset Progress**
3. Confirm

## Sample Categories

### By Feature

| Category | Description |
|----------|-------------|
| **Requests** | Basic HTTP request patterns |
| **Assertions** | Validation techniques |
| **Data Sources** | Parameterized testing |
| **Workflows** | Multi-step flows |
| **Performance** | Load testing examples |
| **Authentication** | Auth configuration |
| **Catalog** | API spec import, export, and testing |

### By Difficulty

| Level | Description |
|-------|-------------|
| **Easy** | Simple, single concepts |
| **Medium** | Combined features |
| **Advanced** | Complex patterns |

### By API Type

| API | Description |
|-----|-------------|
| **JSONPlaceholder** | Fake REST API |
| **PetStore** | OpenAPI example |
| **HTTPBin** | Request inspection |
| **ReqRes** | User management |

## Search and Filter

### Search

Search by:
- Sample name
- Description
- Tags
- Feature type

### Filters

```
Category: [All ▼]
Difficulty: [○ All ○ Easy ● Medium ○ Advanced]
API: [All ▼]
Type: [○ All ○ Tests ○ Workflows]
```

## Creating Your Own Samples

### Export as Sample

Share your tests as samples:

1. Select tests in your workspace
2. Right-click → **Export as Sample**
3. Add metadata:
   - Title
   - Description
   - Difficulty
   - Tags
4. Save to gallery

### Sample Metadata

```yaml
name: My Custom Sample
description: |
  Demonstrates authentication flow with
  token refresh and error handling.
difficulty: medium
tags:
  - authentication
  - oauth2
  - error-handling
api: custom
estimatedTime: 15
includes:
  - 3 scenarios
  - OAuth2 configuration
  - Error handling tests
```

## Training Manual Integration

### Related Manuals

Samples link to relevant training manuals:

```
Sample: Parameterized User Tests

Related Training Manuals:
  📖 Parameterized Basics (Easy)
  📖 CSV Import (Easy)
  📖 Data Validation (Medium)
```

### Opening Manuals

Click a manual link to:
- View step-by-step instructions
- See annotated screenshots
- Follow exercises

## Tips & Best Practices

### 1. Start with Easy Samples

Build foundation before advanced topics.

### 2. Follow Tracks in Order

Tracks are designed for progressive learning.

### 3. Try Before Import

Use "Try It" to explore without cluttering your workspace.

### 4. Modify Imported Samples

Samples are starting points — customize for your needs.

### 5. Check Related Manuals

Manuals provide deeper explanations than samples alone.

### 6. Track Your Progress

Return to training tracks to continue where you left off.

## Sample vs Template

### Samples

- Complete, working examples
- Educational focus
- Uses public APIs
- Import and explore

### Templates

- Starting points
- Requires customization
- Placeholders for your data
- Import and modify

## Contributing Samples

### Submitting Samples

Share samples with the community:

1. Create a well-documented sample
2. Test thoroughly
3. Export as sample package
4. Submit via GitHub PR

### Sample Guidelines

Good samples:
- Use public, stable APIs
- Include clear descriptions
- Have appropriate difficulty rating
- Work without additional setup
- Demonstrate specific features

## Related Guides

- [Getting Started](./getting-started.md) — Quick start
- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Workflow Designer Guide](./workflow-designer-guide.md) — Workflows
