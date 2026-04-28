# Training Manuals — Naming Conventions

## File Naming Rules

### Main Feature Manuals
- Named after the feature: `<feature-name>.html`
- Examples: `async-correlation.html`, `script-node.html`

### Sample / Tutorial Files
- **Do NOT use `-sample` in the filename.**
- Use a difficulty suffix: `-easy`, `-medium`, `-advanced`
- Format: `<topic>-<difficulty>.html`

| Difficulty | Suffix       | Example                              |
|------------|--------------|--------------------------------------|
| Easy       | `-easy`      | `payment-callback-easy.html`         |
| Medium     | `-medium`    | `approval-workflow-medium.html`      |
| Advanced   | `-advanced`  | `parallel-payment-advanced.html`     |

### Folder Structure
Each feature gets its own subfolder under `docs/training-manuals/`:
```
docs/training-manuals/
  <feature>/
    <feature>.html                  ← main manual
    <topic-a>-easy.html             ← easy sample
    <topic-b>-medium.html           ← medium sample
    <topic-c>-advanced.html         ← advanced sample
```
