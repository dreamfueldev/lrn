# lrn Authoring Skill

You are building a **lrn package** — structured, token-optimized documentation that AI coding agents query at runtime. This file teaches you the full pipeline: crawl raw docs, restructure into the lrn markdown spec, validate, parse to IR, and configure for local use.

Follow this file when a user asks you to create lrn docs for a library, API, CLI tool, or any other programming interface.

---

## Pipeline Overview

```
Raw docs (URL)
  │  lrn crawl <url>
  ▼
Markdown files (flat)
  │  Restructure into lrn directory format (you do this)
  ▼
lrn-compatible markdown (structured)
  │  lrn health ./package
  ▼
Validated package
  │  lrn parse ./package --out package.lrn.json
  ▼
IR JSON file
  │  Configure in lrn.config.json
  ▼
Queryable package (lrn <package> list, lrn <package> <member>, etc.)
```

---

## Step 1: Crawl Raw Documentation

Fetch documentation from a URL and convert it to markdown:

```bash
lrn crawl https://docs.example.com --output ./raw-docs
```

Useful flags:

| Flag | Purpose |
|------|---------|
| `--output <dir>` | Output directory |
| `--include <pattern>` | Only crawl matching URLs |
| `--exclude <pattern>` | Skip matching URLs |
| `--max-pages <n>` | Limit pages crawled |
| `--rate <n>` | Requests per second (default: 5) |
| `--dry-run` | Preview without downloading |

The output is flat markdown files — one per page. This is raw material, not yet in lrn format.

If the user already has markdown files or you have documentation in another form, skip this step.

---

## Step 2: Restructure into lrn Directory Format

This is the creative step. You must organize the raw docs into this directory structure:

```
my-package/
├── index.md              # Package metadata and member list (required)
├── members/              # One file per API member
│   ├── createUser.md
│   ├── deleteUser.md
│   └── UserClient/       # Nested members use subdirectories
│       ├── connect.md
│       └── disconnect.md
├── guides/               # Prose documentation
│   ├── getting-started.md
│   └── authentication.md
└── types/                # Type/schema definitions
    ├── User.md
    └── Config.md
```

Rules:
- `index.md` is required. Everything else is optional.
- Member filenames match the member name (e.g., `createUser.md` for a member named `createUser`).
- Nested members (class methods, namespace members) use subdirectories: `ClassName/methodName.md`.
- Guide filenames become the slug (e.g., `getting-started.md` → slug `getting-started`).
- Type filenames match the type name.

---

## File Format Reference

### index.md — Package Metadata

```markdown
# my-package v1.0.0

> A one-line summary for package lists.

Longer description of the package. Can span multiple
paragraphs with **formatting**.

## Members

- `createUser` - Create a new user account
- `deleteUser` - Delete a user by ID
- `UserClient` - Client for managing user connections
- `UserClient.connect` - Open a connection
- `UserClient.disconnect` - Close a connection

## Guides

- **Getting Started** (`getting-started`) - Set up and make your first call
- **Authentication** (`authentication`) - Auth flow details

## Links

- Homepage: https://example.com
- Repository: https://github.com/example/my-package
- Documentation: https://docs.example.com
```

Parsing rules:
- **H1** = package name + optional version (`# name` or `# name vX.Y.Z`)
- **First blockquote** after H1 = summary
- **Text** between blockquote and first H2 = description
- **`## Members`** = bullet list of members with backtick-wrapped dot-notation names and dash-separated summaries
- **`## Guides`** = bold title, slug in parens, dash-separated summary
- **`## Links`** = key-value pairs (`Key: URL`)

### Member Files — API Documentation

```markdown
# createUser

**Kind:** function

> Create a new user account with the specified options.

**Endpoint:** `POST /v1/users`

```typescript
(options: CreateUserOptions) => Promise<User>
```

Full description of what this function does. Can span
multiple paragraphs with **formatting**.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | CreateUserOptions | ✓ | Configuration for the new user |
| `options.name` | string | ✓ | Display name |
| `options.email` | string | ✓ | Email address |
| `options.role` | `"admin" \| "user"` | | User role (default: `"user"`) |

## Returns

**Type:** `Promise<User>`

The newly created user object.

## Examples

### Basic Usage

```typescript
const user = await createUser({
  name: "Alice",
  email: "alice@example.com",
});
```

### With Role

```typescript
const admin = await createUser({
  name: "Bob",
  email: "bob@example.com",
  role: "admin",
});
```

## See Also

- `deleteUser` - Delete a user
- Guide: `getting-started` - Setup walkthrough

**Tags:** `users`, `async`, `crud`

> **Deprecated:** Use `createUserV2` instead.
```

Parsing rules:
- **H1** = member name
- **`**Kind:**`** = one of: `function`, `method`, `class`, `namespace`, `constant`, `type`, `property`, `component`, `command`, `resource`
- **First blockquote** after kind = summary (one line, for list views)
- **`**Endpoint:**`** = HTTP method + path (optional, REST APIs only)
- **First code block** (language `typescript` unless otherwise specified) = signature
- **Text** after signature until next H2 = description
- **`## Parameters`** = table with columns: Name, Type, Required, Description. Use `✓` for required. Add `In` column for HTTP params (path/query/header/body).
- **`## Returns`** = `**Type:**` line + description
- **`## Examples`** = H3-titled examples, each with optional description text + code block
- **`## See Also`** = references to other members (backtick names) or guides (`Guide: \`slug\``)
- **`**Tags:**`** = comma-separated tags in backticks
- **Final blockquote** starting with `**Deprecated:**` = deprecation notice

#### Kind Selection Guide

| Kind | Use when documenting |
|------|---------------------|
| `function` | Standalone functions |
| `method` | Functions on a class or object |
| `class` | Class definitions (methods go in `children/` subdirectory) |
| `namespace` | Grouping containers (API categories, modules) |
| `constant` | Constant values, configuration objects |
| `type` | Type aliases, interfaces, enums |
| `property` | Properties on a class or object |
| `component` | UI components (React, Vue, etc.) |
| `command` | CLI commands and subcommands |
| `resource` | Infrastructure/config resources (Terraform, K8s) |

#### Signature Language

Signatures default to TypeScript. For non-TypeScript packages, add a `**Signature Language:**` line:

```markdown
**Kind:** command
**Signature Language:** bash

```bash
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```
```

### Guide Files — Prose Documentation

```markdown
# Getting Started

**Type:** quickstart
**Level:** beginner

> Set up my-package and make your first API call in under 5 minutes.

This guide walks you through installation, configuration,
and your first API call.

## Installation

Install with npm:

```bash
npm install my-package
```

## Configuration

Create a config file at your project root:

```typescript
import { configure } from "my-package";

configure({ apiKey: process.env.MY_API_KEY });
```

## Your First Call

Now you can make API calls:

```typescript
import { createUser } from "my-package";

const user = await createUser({ name: "Alice", email: "alice@example.com" });
console.log(user.id);
```

## See Also

- `createUser` - Full API reference
- Guide: `authentication` - Auth setup

**Tags:** `setup`, `beginner`
```

Parsing rules:
- **H1** = guide title
- **`**Type:**`** = one of: `quickstart`, `tutorial`, `concept`, `howto`, `example`
- **`**Level:**`** = one of: `beginner`, `intermediate`, `advanced`
- **First blockquote** = summary
- **Text** before first H2 = intro
- **H2 sections** = top-level sections
- **H3 within H2** = subsections
- **Code blocks** within sections = inline examples
- **`## See Also`** and **`**Tags:**`** = same as member format

#### Guide Type Selection

| Type | Purpose | Example |
|------|---------|---------|
| `quickstart` | Get running fast, minimal explanation | "5-minute setup" |
| `tutorial` | Learning-oriented, step-by-step | "Build a CRUD app" |
| `concept` | Explain how/why things work | "How authentication works" |
| `howto` | Solve a specific problem | "Handle webhook retries" |
| `example` | Complete working code | "Stripe checkout integration" |

### Type Files — Schema Definitions

```markdown
# User

**Type:** `object`

> A user account in the system.

Represents a registered user with profile information
and account settings.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `email` | string | ✓ | Email address |
| `role` | `"admin" \| "user"` | | User role (default: `"user"`) |
| `createdAt` | string | ✓ | ISO 8601 timestamp |
| `metadata` | object | | Arbitrary key-value data |

## Example

```json
{
  "id": "usr_abc123",
  "name": "Alice",
  "email": "alice@example.com",
  "role": "user",
  "createdAt": "2025-01-15T08:30:00Z",
  "metadata": {}
}
```
```

Parsing rules:
- **H1** = type name
- **`**Type:**`** = JSON schema type (`object`, `string`, `array`, etc.)
- **First blockquote** = summary
- **Text** after blockquote = description
- **`## Properties`** = table with Property, Type, Required, Description columns
- **`## Example`** = example JSON

---

## Step 3: Validate

Run the health check to find issues:

```bash
lrn health ./my-package
lrn health ./my-package --verbose    # detailed diagnostics
```

Health checks four categories:

| Category | Codes | What it checks |
|----------|-------|----------------|
| Structure | S001–S006 | Required files exist, directory layout is correct |
| Content | C001–C006 | Summaries, descriptions, parameters present |
| Format | F001–F005 | Heading levels, code block syntax |
| Reference | R001–R004 | Internal links, type references resolve |

Fix any errors, then re-run until the package passes. Aim for a health score above 80%.

---

## Step 4: Parse to IR

Convert the validated markdown to lrn's IR JSON format:

```bash
lrn parse ./my-package --out my-package.lrn.json
```

Optionally verify the round-trip:

```bash
lrn format my-package.lrn.json --out /tmp/my-package-formatted
diff -r ./my-package /tmp/my-package-formatted
```

A clean diff means your package round-trips correctly.

---

## Step 5: Configure for Local Use

Add the package to your project's `lrn.config.json`:

```json
{
  "packages": {
    "my-package": { "path": "./my-package.lrn.json" }
  }
}
```

Then sync:

```bash
lrn sync
```

No authentication required for local path packages.

---

## Step 6: Verify

Query your package to confirm everything works:

```bash
lrn my-package                    # Package overview
lrn my-package list               # All members
lrn my-package createUser         # Member details
lrn my-package guides             # List guides
lrn my-package guide getting-started  # Read a guide
lrn my-package types              # List types
lrn my-package search "user"      # Search
```

---

## Quality Guidelines

### What makes good lrn documentation

1. **Every member has a summary.** Summaries appear in list views. Without one, the member is invisible to discovery.
2. **Summaries are one line.** They should complete the sentence "This member ___." Keep them under 80 characters.
3. **Signatures are human-readable.** Write `(name: string, age: number) => User`, not the full TypeScript AST.
4. **Parameters have types and descriptions.** A parameter without a type is ambiguous. A parameter without a description is cryptic.
5. **Examples are real.** Show actual usage, not pseudocode. Include imports when they matter.
6. **Guides complement, not duplicate.** Guides explain workflows and concepts. Member docs explain individual APIs. Don't repeat member details in guides.
7. **Tags enable filtering.** Use tags consistently across members to support `lrn <package> list --tag <tag>`.
8. **Nest members logically.** Class methods go under the class (`ClassName/method.md`). API categories use namespaces (`payments/create.md`).

### Common mistakes

- Missing `**Kind:**` line — the parser needs it to set the member kind
- Writing `**Kind:** Function` instead of `**Kind:** function` — kinds are lowercase
- Putting the summary in plain text instead of a blockquote (`>`)
- Using `## Parameters` with a bullet list instead of a table
- Forgetting the `✓` in the Required column (leaving it blank means optional)
- Using H1 (`#`) inside sections — H1 is reserved for the file title

### Classification

Set the package classification in `index.md` based on what the package primarily documents:

| Classification | Examples |
|---------------|----------|
| `api` | REST/GraphQL endpoints (Stripe, GitHub API) |
| `library` | Functions, classes, types (lodash, React) |
| `components` | UI elements with props/variants (daisyUI, Radix) |
| `cli` | Commands with flags/args (Docker, git) |
| `config` | Declarative resources (Terraform, K8s manifests) |
| `framework` | Hybrid of multiple types (Next.js, Astro) |

Classification is auto-detected from member kinds if not set explicitly.

---

## Config Resolution

lrn looks for configuration in this order:

1. `lrn.config.json` in the current directory (and parent directories)
2. `"lrn"` key in `package.json`
3. `~/.lrn/config.json` (global)

Package data is cached at `~/.lrn/packages/<package-name>/`. Local path packages (configured with `"path"`) are read directly from the specified path.

---

## Generating llms-full.txt

If you want a single concatenated file (useful for projects that don't use the lrn CLI):

```bash
lrn llms-full ./my-package --out llms-full.txt
```

---

## Quick Reference — Authoring Commands

```bash
lrn crawl <url>              # Crawl docs to markdown
lrn health <dir>             # Validate against spec
lrn parse <dir> --out <file> # Markdown → IR JSON
lrn format <ir.json> --out <dir>  # IR JSON → markdown (round-trip)
lrn llms-full <dir>          # Generate concatenated file
lrn sync                     # Reload packages from config
```
