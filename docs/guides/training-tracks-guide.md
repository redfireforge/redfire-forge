# Training Tracks Guide

Follow structured learning paths — progress through tutorials, earn completion badges, and track your learning.

## Overview

**Training Tracks** provide:
- Structured learning paths
- Progressive difficulty
- Hands-on exercises
- Progress tracking

## Accessing Training Tracks

1. Go to **Gallery** tab
2. Click **Training Tracks** section
3. Browse available tracks

## Track Structure

### Tracks

A track is a complete learning path:

```
Track: API Testing Fundamentals
├── Phase 1: Getting Started
├── Phase 2: Basic Requests
├── Phase 3: Assertions
├── Phase 4: Parameterized Testing
└── Phase 5: Performance Testing
```

### Phases

Phases group related lessons:

```
Phase 2: Basic Requests
├── Lesson 2.1: Creating Requests
├── Lesson 2.2: Working with Headers
├── Lesson 2.3: Request Bodies
└── Lesson 2.4: Path Variables
```

### Lessons

Each lesson includes:
- Learning objectives
- Step-by-step instructions
- Hands-on exercises
- Knowledge check

## Available Tracks

### Getting Started Track

**Difficulty:** Easy
**Time:** ~1 hour

```
1. First Test (10 min)
2. Understanding Responses (10 min)
3. Basic Assertions (15 min)
4. Organizing Tests (15 min)
5. Running Performance Tests (10 min)
```

### Workflow Mastery Track

**Difficulty:** Medium
**Time:** ~2 hours

```
1. Workflow Basics (15 min)
2. Variables & Extraction (20 min)
3. Conditions & Branching (20 min)
4. Loops & Iteration (20 min)
5. Error Handling (20 min)
6. Advanced Patterns (25 min)
```

### Parameterized Testing Track

**Difficulty:** Medium
**Time:** ~1.5 hours

```
1. Data Source Basics (15 min)
2. CSV Import (15 min)
3. JSON Data Files (15 min)
4. Variable Substitution (20 min)
5. Row Filtering (15 min)
6. Shared Data Sources (20 min)
```

### Performance Testing Track

**Difficulty:** Advanced
**Time:** ~2.5 hours

```
1. Execution Modes (20 min)
2. Concurrency Patterns (25 min)
3. Load Profiles (25 min)
4. Comparison & Trends (30 min)
5. Baselines & Trends (25 min)
6. CI/CD Integration (25 min)
```

## Progress Tracking

### Progress Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Your Progress                                           │
├─────────────────────────────────────────────────────────┤
│ Getting Started        ████████████████████░░ 80%      │
│ Workflow Mastery       ████████░░░░░░░░░░░░░░ 30%      │
│ Parameterized Testing  ░░░░░░░░░░░░░░░░░░░░░░ 0%       │
│ Performance Testing    ░░░░░░░░░░░░░░░░░░░░░░ 0%       │
├─────────────────────────────────────────────────────────┤
│ Completed Lessons: 8                                    │
│ Time Spent: 2h 15m                                      │
│ Current Streak: 3 days                                  │
└─────────────────────────────────────────────────────────┘
```

### Lesson Status

| Status | Icon | Meaning |
|--------|------|---------|
| Not Started | ○ | Lesson available |
| In Progress | ◐ | Started but not complete |
| Completed | ● | Finished successfully |
| Skipped | ⊘ | Manually skipped |

### Resume Learning

The system remembers your progress:

```
Continue where you left off?

Getting Started > Phase 3 > Lesson 3.2
"Working with JSONPath Assertions"

[Continue]  [Start Over]
```

## Taking a Lesson

### Lesson View

```
┌─────────────────────────────────────────────────────────┐
│ Lesson 2.3: Request Bodies                              │
├─────────────────────────────────────────────────────────┤
│ Learning Objectives:                                    │
│ • Understand different body types                       │
│ • Create JSON request bodies                            │
│ • Use form data for file uploads                        │
│                                                         │
│ Estimated Time: 15 minutes                              │
│ Difficulty: Easy                                        │
│                                                         │
│ Prerequisites:                                          │
│ ✓ Lesson 2.1: Creating Requests                        │
│ ✓ Lesson 2.2: Working with Headers                     │
├─────────────────────────────────────────────────────────┤
│ [Start Lesson]                                          │
└─────────────────────────────────────────────────────────┘
```

### Step-by-Step Instructions

```
Step 1 of 5: Create a POST Request

1. Go to the Requests tab
2. Click "+ New Request"
3. Set the method to POST
4. Enter the URL: https://api.example.com/users

[Screenshot showing the request editor]

[✓ Done] [Skip Step]
```

### Hands-On Exercises

```
Exercise: Create a User

Create a POST request with the following JSON body:
{
  "name": "John Doe",
  "email": "john@example.com"
}

Expected Result:
• Status: 201 Created
• Response contains "id" field

[Open Exercise]  [Show Solution]
```

### Knowledge Check

```
Knowledge Check

Q: Which body type is best for sending JSON data?

○ Form URL-encoded
● JSON
○ Raw
○ Form Data

[Submit]
```

## Completion & Certificates

### Track Completion

When you finish all lessons in a track:

```
🎉 Congratulations!

You've completed "API Testing Fundamentals"

Lessons Completed: 15/15
Time Spent: 1h 45m
Score: 92%

[View Certificate]  [Share]
```

### Badges

Earn badges for achievements:

| Badge | Achievement |
|-------|-------------|
| 🌟 First Step | Complete first lesson |
| 📚 Scholar | Complete 10 lessons |
| 🏆 Master | Complete an entire track |
| 🔥 On Fire | 7-day learning streak |
| ⚡ Speed Learner | Complete lesson under time |

## Related Samples

### Lesson → Sample Connection

Lessons link to relevant gallery samples:

```
Related Samples:
  📦 JSONPlaceholder CRUD
  📦 User Authentication Flow
  📦 Parameterized User Tests

[Try Sample]
```

### Training Manuals

Detailed reference documents:

```
Related Training Manuals:
  📖 Assertions Deep Dive (Easy)
  📖 JSONPath Reference (Medium)
  
[Open Manual]
```

## Tips & Best Practices

### 1. Follow the Recommended Order

Tracks are designed for progressive learning.

### 2. Complete Exercises

Hands-on practice reinforces concepts.

### 3. Don't Skip Prerequisites

Later lessons assume earlier knowledge.

### 4. Use Related Samples

Practice with real examples after lessons.

### 5. Revisit Completed Lessons

Refresh knowledge periodically.

### 6. Track Your Streak

Consistent learning improves retention.

## Resetting Progress

### Reset Single Track

```
Track: API Testing Fundamentals
  [Reset Progress]
  
  This will clear all progress for this track.
  Completed lessons will be marked as not started.
  
  [Cancel]  [Reset]
```

### Reset All Progress

```
Settings > Training > [Reset All Training Progress]

This will reset progress for ALL tracks.
This cannot be undone.

[Cancel]  [Reset All]
```

## Related Guides

- [Gallery Guide](./gallery-guide.md) — Samples and gallery
- [Getting Started](./getting-started.md) — Quick start
