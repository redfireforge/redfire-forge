# Getting Started with RedfireForge

Get up and running with RedfireForge in 5 minutes. This guide walks you through your first API test.

## Overview

RedfireForge is a cross-platform API performance testing tool that lets you:
- Design and run HTTP tests with configurable concurrency
- Create visual workflows for multi-step API testing
- Validate responses with rich assertions
- Analyze results with detailed metrics and charts

## Installation

### Desktop App (Recommended)

Download the installer for your platform:

| Platform | Download |
|----------|----------|
| **macOS (Apple Silicon)** | `RedfireForge_x.x.x_aarch64.dmg` |
| **macOS (Intel)** | `RedfireForge_x.x.x_x64.dmg` |
| **Windows** | `RedfireForge_x.x.x_x64.msi` |
| **Linux** | `RedfireForge_x.x.x_amd64.deb` or `.AppImage` |

### Web Mode

For development or when desktop installation isn't possible:

```bash
git clone https://github.com/your-org/redfireforge.git
cd redfireforge
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Quick Tour

### The Main Interface

RedfireForge has four main areas:

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  Requests  Catalog  Harness  Workflow    [⚙ Theme] │  ← Header
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│ Sidebar │              Main Content Area                    │
│         │                                                   │
│ - Envs  │    (Changes based on selected tab)               │
│ - Svcs  │                                                   │
│ - Items │                                                   │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

### Tabs Overview

| Tab | Purpose |
|-----|---------|
| **Requests** | Ad-hoc API testing (like Postman/Insomnia) |
| **Catalog** | Browse and test OpenAPI/Swagger specs |
| **Harness** | Regression and performance testing |
| **Workflow** | Visual workflow designer for complex API flows |

## Your First Test in 5 Minutes

### Step 1: Create a Request

1. Click the **Requests** tab
2. Click **+ New Collection** and name it "My First Tests"
3. Right-click the collection → **Add Request**
4. Name it "List Users"

### Step 2: Configure the Request

In the request editor:

1. Set the **Method** to `GET`
2. Enter the **URL**: `https://jsonplaceholder.typicode.com/users`
3. Click **Send**

You should see a JSON response with 10 users.

### Step 3: Add an Assertion

1. Click the **Tests** tab in the request editor
2. Add an assertion:
   - Type: **Status Code**
   - Expected: `200`
3. Click **Send** again

The assertion passes (green checkmark).

### Step 4: Run a Performance Test

1. Go to the **Harness** tab
2. Click **Feature Groups** → **+ New Feature Group** → Name it "API Tests"
3. Click **+ Scenario** → Name it "User Tests"
4. Click **+ Add Test** and configure:
   - Name: "List Users"
   - Method: GET
   - URL: `https://jsonplaceholder.typicode.com/users`
5. Save the test
6. Go to **Test Runner** tab
7. Check the "User Tests" scenario
8. Set:
   - Concurrency: `5`
   - Iterations: `20`
9. Click **▶ Run Test**

Watch the live progress and view results when complete!

## Next Steps

Now that you've run your first test, explore these guides:

| Guide | Description |
|-------|-------------|
| [Concepts Overview](./concepts-overview.md) | Understand key concepts |
| [Requests Guide](./requests-guide.md) | Master the request editor |
| [Scenarios Guide](./scenarios-guide.md) | Organize your tests |
| [Test Runner Guide](./test-runner-guide.md) | Configure performance runs |
| [Workflow Designer Guide](./workflow-designer-guide.md) | Build multi-step workflows |

## Getting Help

- **Training Manuals**: Click **Gallery** → **Training Tracks** for step-by-step tutorials
- **Samples**: Browse pre-built examples in the Gallery
- **CLI Reference**: See [CLI Reference](./cli-reference.md) for command-line usage

## Tips for Beginners

1. **Start Simple**: Begin with single requests before building complex workflows
2. **Use the Gallery**: Import samples to learn patterns and best practices
3. **Validate First**: Always run `validate` mode before full performance tests
4. **Save Often**: Create version snapshots before making major changes
5. **Check Results**: Review failed requests in detail to understand issues

## Related Guides

- [Cross-Platform Guide](./cross-platform.md) — Desktop vs Web differences
- [Environments Guide](./environments-guide.md) — Configure test environments
- [CLI Reference](./cli-reference.md) — Command-line usage
