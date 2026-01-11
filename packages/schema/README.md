# @lrn/schema

The Intermediate Representation (IR) schema for lrn. This package defines the data structures used to represent programming interface documentation in a unified, query-optimized format.

## Overview

lrn ingests documentation from multiple sources (OpenAPI specs, TypeScript definitions, markdown docs) and normalizes them into a common IR. This IR is designed for:

1. **Progressive disclosure**: Summaries for lists, full content on demand
2. **Token efficiency**: LLMs can drill down to exactly what they need
3. **Unified access**: API members and prose guides are peers
4. **Composability**: Structured output that works with standard tools (jq, grep, etc.)

## Core Concepts

### Package

A `Package` is the top-level container representing a complete documentation unit. It contains three types of content:

```typescript
interface Package {
  name: string;           // "stripe", "react", etc.
  version?: string;       // semver
  summary?: string;       // one-liner for lists
  description?: string;   // full description
  source: SourceInfo;

  members: Member[];      // structured API docs
  guides: Guide[];        // prose documentation
  schemas: Record<string, Schema>;  // type definitions
}
```

**Why this structure?**

- `members` and `guides` are separate arrays (not mixed) because they have different shapes and query patterns, but they're both first-class citizens at the package level
- `schemas` is a map (not array) for O(1) lookup when resolving `$ref` references
- `summary` vs `description` enables progressive disclosure at the package level

### Member

A `Member` represents a discrete unit of API surface: a function, class, endpoint, type, etc.

```typescript
interface Member {
  name: string;
  kind: 'function' | 'method' | 'class' | 'namespace' | 'constant' | 'type' | 'property';
  summary?: string;
  description?: string;
  signature?: string;
  parameters?: Parameter[];
  returns?: Returns;
  examples?: Example[];
  tags?: string[];
  children?: Member[];
  http?: HttpInfo;
  see?: Reference[];
  deprecated?: string;
}
```

**Design decisions:**

#### `kind` distinguishes member types uniformly

We use a single `kind` field rather than separate interfaces for each type. This simplifies querying and display logic—you can filter by `kind` without type narrowing.

The `kind` values cover both traditional programming constructs (`function`, `class`, `type`) and REST API concepts (`namespace` for API categories, `method` for endpoints).

#### `signature` is a string, not a structured type

```typescript
signature?: string;  // "(amount: number, currency: string) => Promise<Charge>"
```

This was intentional:
1. **Source diversity**: OpenAPI, TypeScript, and JSDoc express types very differently. Normalizing to a structured type system would require a complex type resolver.
2. **Human/LLM readable**: The string signature is immediately useful without needing to render a type tree.
3. **Detailed types available elsewhere**: When you need structured type info, it's in `parameters`, `returns`, and `schemas`.

#### `children` enables hierarchical structure

Members can nest: classes have methods, namespaces have members. This creates a tree addressable by dot-notation paths:

```
stripe.charges.create  →  Package("stripe") → Member("charges") → children → Member("create")
```

#### `http` is an optional extension

HTTP-specific details (method, path, responses) are in an optional `http` field rather than polluting the core model. A TypeScript library's functions don't need HTTP info; a REST API's endpoints do.

#### `summary` vs `description`

Every member has both:
- `summary`: One-liner for list views. Token-efficient.
- `description`: Full explanation for detail views.

This enables the progressive disclosure pattern:
```bash
lrn stripe list           # shows summaries
lrn stripe charges.create # shows full description
```

### Guide

A `Guide` represents prose documentation not tied to a single API member: tutorials, conceptual explanations, how-tos.

```typescript
interface Guide {
  slug: string;        // "handling-webhooks"
  title: string;       // "Handling Webhooks"
  summary?: string;
  intro?: string;
  sections: Section[];
  kind: 'quickstart' | 'tutorial' | 'concept' | 'howto' | 'example';
  tags?: string[];
  see?: Reference[];
  level?: 'beginner' | 'intermediate' | 'advanced';
}

interface Section {
  id: string;
  title: string;
  summary?: string;
  content: string;
  sections?: Section[];
  examples?: Example[];
}
```

**Design decisions:**

#### Sections enable progressive disclosure for prose

Raw markdown would force you to either show nothing or everything. By structuring guides into sections with summaries, we can show:

1. Guide list: title + summary
2. Guide overview: intro + section titles/summaries (TOC)
3. Section detail: specific section content
4. Full guide: everything

This mirrors the member hierarchy pattern.

#### `kind` follows the Diataxis framework

The [Diataxis framework](https://diataxis.fr/) categorizes documentation into four types based on user needs:

- **Tutorials** (learning-oriented): "Let me teach you"
- **How-to guides** (task-oriented): "Let me show you how to solve this"
- **Concepts** (understanding-oriented): "Let me explain how this works"
- **Reference** (information-oriented): "Here are the facts"

We adapted this slightly:
- `quickstart`: A minimal tutorial to get running fast
- `tutorial`: Full learning-oriented walkthrough
- `concept`: Explains how/why something works
- `howto`: Solve a specific problem
- `example`: Complete working code with explanation

Reference documentation is handled by `Member`, not `Guide`.

#### Shared tag namespace with Members

Both `Member.tags` and `Guide.tags` draw from the same namespace. This enables unified filtering:

```bash
lrn stripe list --tag payments  # returns members AND guides tagged "payments"
```

### Reference (Cross-linking)

The `see` field on both Member and Guide enables cross-references:

```typescript
interface Reference {
  type: 'member' | 'guide' | 'schema' | 'url';
  target: string;  // path, slug, schema name, or URL
  label?: string;
}
```

**Why typed references?**

Untyped string references (like `"charges.create"`) are ambiguous—is that a member path or a guide slug? The `type` field makes resolution unambiguous and enables different rendering (internal link vs external link vs type popup).

### Schema (Type Definitions)

Schemas define reusable data types, based on JSON Schema:

```typescript
interface Schema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  $ref?: string;
  // ... validation fields
}
```

**Why JSON Schema subset?**

1. OpenAPI uses JSON Schema, so conversion is straightforward
2. Well-understood format with existing tooling
3. Expressive enough for most API types
4. The `$ref` mechanism handles type relationships

Schemas are stored in `Package.schemas` and referenced by name. This avoids duplication and enables type exploration:

```bash
lrn stripe type Charge  # show the Charge schema
```

### Example

Examples are attached to Members, Guides, and Sections:

```typescript
interface Example {
  title?: string;
  language?: string;
  code: string;
  description?: string;
  standalone?: boolean;
}
```

The `standalone` flag helps LLMs decide whether code can be used as-is or needs adaptation:
- `standalone: true`: Complete, runnable example
- `standalone: false`: Snippet that needs surrounding context

## Query Patterns

The IR is optimized for these access patterns:

### Path-based lookup

```
lrn stripe charges.create
```

Navigate the member tree by dot-notation path. O(depth) lookup.

### Tag filtering

```
lrn stripe list --tag payments
```

Filter members/guides by tag. Tags are denormalized on each item for fast filtering.

### Text search

```
lrn stripe search "refund"
```

Search across names, summaries, descriptions. The `summary` field is weighted higher for relevance.

### Progressive drill-down

```
lrn stripe                    # package overview
lrn stripe list               # member summaries
lrn stripe charges            # namespace detail
lrn stripe charges.create     # member detail
lrn stripe charges.create --examples  # just examples
```

Each level reveals more detail, using more tokens only when needed.

## Configuration

The `LrnConfig` type defines the `lrn.config.json` file:

```typescript
interface LrnConfig {
  registry?: string;   // custom registry endpoint
  packages?: Record<string, PackageSpec>;
  cache?: string;      // cache directory
  defaultFormat?: 'text' | 'json' | 'markdown' | 'summary';
}

type PackageSpec =
  | string                    // semver: "^2.0.0"
  | { version?: string }      // explicit version
  | { path: string }          // local file
  | { url: string }           // remote URL
```

This enables:
- Pinning package versions (semver)
- Using local documentation files (internal APIs)
- Custom registry endpoints (enterprise)

## File Format

Package documentation is stored as `.lrn.json` files:

```json
{
  "name": "stripe",
  "version": "2024.1.0",
  "summary": "Payment processing API",
  "source": {
    "type": "openapi",
    "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"
  },
  "members": [...],
  "guides": [...],
  "schemas": {...}
}
```

These files are:
- Generated by adapters (OpenAPI parser, TypeScript extractor, etc.)
- Cached locally in `~/.lrn/packages/`
- Served by the lrn registry

## Usage

```typescript
import type { Package, Member, Guide } from '@lrn/schema';

// Type-safe package manipulation
function getMember(pkg: Package, path: string): Member | undefined {
  const parts = path.split('.');
  let members = pkg.members;

  for (const part of parts) {
    const member = members.find(m => m.name === part);
    if (!member) return undefined;
    members = member.children ?? [];
    if (parts.indexOf(part) === parts.length - 1) return member;
  }
}
```

## Versioning

This schema follows semver. Breaking changes (field removals, type changes) bump the major version. New optional fields bump the minor version.

Current version: **2.0.0**
