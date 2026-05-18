# Request Editor Guide

Master the request editor — headers, body types, query parameters, path variables, and advanced features.

## Overview

The **Request Editor** is your workspace for building and testing HTTP requests. This guide covers all editor features in detail.

## Editor Layout

```
┌────────────────────────────────────────────────────────────────┐
│ [GET ▼] [https://api.example.com/users/{{id}}        ] [Send] │
├────────────────────────────────────────────────────────────────┤
│ [Params] [Headers] [Body] [Auth] [Tests]                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                    Tab Content Area                            │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ Response                                                       │
│ [Body] [Headers] [Cookies] [Console]                           │
├────────────────────────────────────────────────────────────────┤
│ Status: 200 OK    Time: 145ms    Size: 1.2 KB                 │
└────────────────────────────────────────────────────────────────┘
```

## URL Bar

### Method Selector

Click the method dropdown to select:

| Method | Purpose |
|--------|---------|
| **GET** | Retrieve data |
| **POST** | Create new resource |
| **PUT** | Replace resource |
| **PATCH** | Partial update |
| **DELETE** | Remove resource |
| **HEAD** | Headers only (no body) |
| **OPTIONS** | Check allowed methods |

### URL Field

Enter the full URL or relative path:

```
Full URL:     https://api.example.com/users/123
Relative:     /users/123  (uses base URL from ENV mode)
With vars:    /users/{{userId}}
```

### Variable Highlighting

Variables in the URL are highlighted:

```
/users/{{userId}}/posts/{{postId}}
       ^^^^^^^^^^       ^^^^^^^^^^
       highlighted      highlighted
```

### Auto-Complete

- Type `{{` to see available variables
- Press Tab to insert selection
- Variables from data sources appear automatically

## Params Tab

### Query Parameters

Add query string parameters visually:

```
┌──────────┬─────────────┬───────┐
│ Key      │ Value       │ ⊗  □  │
├──────────┼─────────────┼───────┤
│ page     │ 1           │ ⊗  ☑  │
│ limit    │ 10          │ ⊗  ☑  │
│ sort     │ name        │ ⊗  ☐  │  ← disabled
│ filter   │ {{filter}}  │ ⊗  ☑  │
└──────────┴─────────────┴───────┘
              [+ Add Parameter]
```

- **Checkbox**: Enable/disable without deleting
- **X button**: Remove parameter

### Path Variables

When the URL contains `{variable}` or `:variable`:

```
URL: /users/{userId}/posts/{postId}

Path Variables:
┌──────────┬─────────────┐
│ Variable │ Value       │
├──────────┼─────────────┤
│ userId   │ 123         │
│ postId   │ 456         │
└──────────┴─────────────┘
```

Path variables are automatically detected and shown.

## Headers Tab

### Adding Headers

```
┌────────────────┬─────────────────────────┬───────┐
│ Key            │ Value                   │ ⊗  □  │
├────────────────┼─────────────────────────┼───────┤
│ Content-Type   │ application/json        │ ⊗  ☑  │
│ Accept         │ application/json        │ ⊗  ☑  │
│ Authorization  │ Bearer {{token}}        │ ⊗  ☑  │
│ X-Request-ID   │ {{$uuid}}               │ ⊗  ☑  │
└────────────────┴─────────────────────────┴───────┘
                    [+ Add Header]
```

### Auto-Suggest

Start typing to see suggestions:
- Common headers (Content-Type, Accept, Authorization)
- Previously used headers
- Standard header values

### Bulk Edit

Click **Bulk Edit** to edit as text:

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer {{token}}
```

## Body Tab

### Body Types

| Type | Use Case |
|------|----------|
| **None** | GET/DELETE requests |
| **JSON** | Most API requests |
| **Form URL-encoded** | HTML form data |
| **Form Data** | File uploads, multipart |
| **Raw** | Plain text, XML, custom |

### JSON Body

The JSON editor provides:
- Syntax highlighting
- Auto-formatting (beautify)
- Error detection (invalid JSON)
- Variable support

```json
{
  "name": "{{name}}",
  "email": "{{email}}",
  "metadata": {
    "createdBy": "{{$uuid}}",
    "timestamp": "{{$timestamp}}"
  }
}
```

### Form URL-encoded

Key-value pairs sent as `application/x-www-form-urlencoded`:

```
┌──────────────┬─────────────────┐
│ Key          │ Value           │
├──────────────┼─────────────────┤
│ username     │ john            │
│ password     │ ••••••••        │
│ remember     │ true            │
└──────────────┴─────────────────┘
```

### Form Data (Multipart)

For file uploads:

```
┌──────────────┬───────────┬───────────────────┐
│ Key          │ Type      │ Value             │
├──────────────┼───────────┼───────────────────┤
│ name         │ Text      │ John Doe          │
│ avatar       │ File      │ profile.jpg       │
│ documents    │ File      │ report.pdf        │
└──────────────┴───────────┴───────────────────┘
```

Click the file input to browse for files.

### Raw

Custom content types:

```
Content-Type: text/xml

<?xml version="1.0"?>
<user>
  <name>{{name}}</name>
  <email>{{email}}</email>
</user>
```

## Auth Tab

See [Request Auth Guide](./request-auth-guide.md) for detailed authentication options.

Quick reference:

| Type | Configuration |
|------|---------------|
| None | No auth |
| Basic | Username + Password |
| Bearer | Token |
| API Key | Key name, value, location |
| OAuth2 | Token URL, client credentials |
| Digest | Username + Password |

## Tests Tab

### Adding Assertions

```
┌───────────┬──────────────┬────────────┬────────────┐
│ Type      │ Path/Field   │ Operator   │ Value      │
├───────────┼──────────────┼────────────┼────────────┤
│ Status    │              │ equals     │ 200        │
│ JSONPath  │ $.data.id    │ exists     │            │
│ JSONPath  │ $.data.name  │ equals     │ {{name}}   │
│ Header    │ Content-Type │ contains   │ json       │
└───────────┴──────────────┴────────────┴────────────┘
                    [+ Add Assertion]
```

See [Assertions Guide](./assertions-guide.md) for details.

## Response Panel

### Body Tab

#### JSON Tree View

Collapsible, searchable tree:

```
▼ data
  ▼ user
      id: 123
    ▶ profile
      name: "John Doe"
      email: "john@example.com"
```

Features:
- Click to expand/collapse
- Right-click for options
- Search to find values
- Copy path to clipboard

#### Raw View

Toggle to see raw response text.

### Headers Tab

Response headers:

```
Content-Type: application/json; charset=utf-8
X-Request-ID: abc123
Cache-Control: no-cache
```

### Cookies Tab

Cookies set by the response:

```
┌────────────┬────────────┬────────────┬──────────┐
│ Name       │ Value      │ Domain     │ Expires  │
├────────────┼────────────┼────────────┼──────────┤
│ sessionId  │ xyz789     │ .example   │ Session  │
│ tracking   │ abc123     │ .example   │ 30 days  │
└────────────┴────────────┴────────────┴──────────┘
```

### Console Tab

Request/response trace:

```
▶ Request
  Method: POST
  URL: https://api.example.com/users
  Headers:
    Content-Type: application/json
  Body: {"name": "John"}

◀ Response
  Status: 201 Created
  Time: 145ms
  Headers:
    Content-Type: application/json
  Body: {"id": 123, "name": "John"}
```

## Status Bar

```
Status: 200 OK    Time: 145ms    Size: 1.2 KB
```

- **Status**: HTTP status code and text
- **Time**: Total response time
- **Size**: Response body size

## Special Features

### Variable Insert Modal

Press `Ctrl+I` or click the variable button to open the insert modal:

- Browse available variables
- See variable values
- Insert at cursor position

### Import cURL

1. Click **Import cURL**
2. Paste command:
   ```bash
   curl -X POST https://api.example.com/users \
     -H "Content-Type: application/json" \
     -d '{"name": "John"}'
   ```
3. Click **Import**

### Export cURL

1. Click **Export → cURL**
2. Copy generated command
3. For OAuth2, real token is embedded

### Request History

View and restore previous requests:

1. Click the history icon
2. Select a previous request
3. Click **Restore**

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send request |
| `Cmd/Ctrl + S` | Save request |
| `Cmd/Ctrl + I` | Insert variable |
| `Cmd/Ctrl + B` | Beautify JSON body |
| `Cmd/Ctrl + /` | Toggle comment (in body) |
| `Cmd/Ctrl + F` | Find in response |

## Tips & Best Practices

### 1. Use Tab Key for Navigation

Tab through fields quickly without clicking.

### 2. Disable Don't Delete

Toggle checkboxes to test with/without parameters.

### 3. Use Console for Debugging

Check exactly what was sent when things don't work.

### 4. Copy JSONPath from Response

Right-click response fields to copy paths for assertions.

### 5. Use Bulk Edit for Many Headers

Faster than adding one at a time.

## Related Guides

- [Requests Guide](./requests-guide.md) — Collections and organization
- [Request Auth Guide](./request-auth-guide.md) — Authentication
- [Assertions Guide](./assertions-guide.md) — Response validation
