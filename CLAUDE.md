# CLAUDE.md - lrn Project Context

## What is lrn?

`lrn` (learn) is a universal CLI for learning and querying programming interfaces. It provides LLMs and developers with token-efficient access to API documentation through progressive discovery.

**Core insight**: LLMs waste enormous context loading full API docs when they only need specific details. `lrn` enables hierarchical navigation (index → category → endpoint → details) that can deliver 5-10x token reduction compared to dumping full documentation. Documentation is stored on-device for fast querying. Cli is designed to be highly compositional so that LLMs can be creative with their querying and usage optimizing at inference-time.

Example:

```bash
# LLM can construct queries dynamically
lrn stripe list --tag $(lrn stripe tags | grep -i payment) | \
  lrn stripe show --format json | \
  jq '[.[] | select(.method == "POST")]'
```

## Business Model

- **Open source CLI, monetized registry**: The CLI is free, the maintained registry of package documentation is the product
- **Registry as flywheel**: Company maintains a registry mapping packages to their documentation, crawled and structured for optimal lrn consumption
- **Crawl + LLM pipeline**: Docs sites are crawled, LLM extracts structure, humans QA, then published to registry
- **Long-term**: Once critical mass is reached, package maintainers will optimize their docs for lrn compatibility

## Project Structure

```
lrn/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── args.ts            # Argument parsing
│   ├── cache.ts           # Package cache management
│   ├── config.ts          # Configuration loading
│   ├── errors.ts          # Error types
│   ├── schema/            # IR type definitions
│   │   └── index.ts
│   ├── format/            # Output formatters (text, json, markdown, summary)
│   └── commands/          # CLI command implementations
├── specs/                 # Test specifications
│   └── fixtures/          # Test fixture data
├── package.json
├── tsconfig.json
└── bunfig.toml
```

Separate repo for registry data: `dreamfueldev/lrn-registry`

## Tech Stack

- **Language**: TypeScript (ESM)
- **Runtime/Toolchain**: Bun (package manager, bundler, test runner) — Bun is the standard toolchain across all lrn-project repos
- **CLI**: Node.js target (for npm compatibility)

## The IR (Intermediate Representation)

The IR is defined in `src/schema/index.ts`. Key types:

```typescript
interface Package {
  name: string;
  version?: string;
  summary?: string;
  description?: string;
  source: SourceInfo;          // where this came from (openapi, typescript, etc.)
  members: Member[];           // structured API documentation
  guides: Guide[];             // prose documentation
  schemas: Record<string, Schema>;  // reusable type definitions
  classification?: PackageClassification; // api, library, components, cli, config, framework
}

interface Member {
  name: string;                // e.g., "charges.create" or "useState"
  kind: 'function' | 'method' | 'class' | 'namespace' | 'constant' | 'type'
      | 'property' | 'component' | 'command' | 'resource';
  summary?: string;            // one-liner for list views
  description?: string;        // full description
  signature?: string;          // human-readable: "(options: Config) => Client"
  parameters?: Parameter[];
  returns?: Returns;
  examples?: Example[];
  tags?: string[];
  children?: Member[];         // nested members (class methods, namespace members)
  http?: HttpInfo;             // HTTP-specific (only for REST endpoints)
}

interface Guide {
  slug: string;                // URL-friendly identifier
  title: string;
  summary?: string;
  intro?: string;
  sections: Section[];
  kind: 'quickstart' | 'tutorial' | 'concept' | 'howto' | 'example';
  tags?: string[];
}
```

**Design rationale**:
- `kind` field distinguishes functions/classes/namespaces uniformly across interface types
- `signature` as string avoids type resolution complexity, still useful for LLMs
- `http` is optional extension - HTTP details don't pollute the core model
- `children` enables nesting (class methods, namespace members)
- `summary` vs `description` - summary for lists, description for detail views
- `guides` provides prose documentation alongside API reference

## CLI Interface

```bash
lrn                            # List all cached packages
lrn sync                       # Sync specs for project dependencies
lrn teach                      # Generate agent orientation and strategy
lrn <package>                  # Show package overview
lrn <package> list             # List members
lrn <package> <member.path>    # Show member details
lrn <package> guides           # List guides
lrn <package> guide <slug>     # Show guide
lrn <package> types            # List schemas
lrn <package> type <name>      # Show schema details
lrn <package> tags             # List tags with counts
lrn <package> search <query>   # Search within package
lrn search <query>             # Search across all packages
```

Key flags: `--format (text|json|markdown|summary)`, `--full`, `--deep`, `--tag`, `--kind`, `--json`

## Current Status

- [x] CLI implementation with 213 passing tests (see `TEST_PROGRESS.md` for details)
- [x] IR schema with Package, Member, Guide, Schema types
- [x] Output formatters (text, json, markdown, summary)
- [x] Package cache and config system
- [x] Search functionality (members, guides, tags, descriptions)
- [x] Filtering (--tag, --kind, --deprecated, combinations)
- [x] Package management commands (add, remove, sync)
- [ ] Registry API service (blocks: versions command)
- [ ] OpenAPI adapter
- [ ] TypeScript adapter
- [ ] Crawl + LLM extraction pipeline

### Test Progress

See `TEST_PROGRESS.md` for detailed tracking of:
- 853 passing tests, 49 TODO tests (95% complete)
- Categorized remaining work (registry features, config system, HTTP details, etc.)
- Priority order for implementation

## Commands

```bash
bun install           # Install dependencies
bun run build         # Build CLI
bun run dev           # Dev mode (watch)
bun test              # Run tests
bun run typecheck     # TypeScript checking
```

## Key Files

- `src/schema/index.ts` - IR type definitions (Package, Member, Guide, Schema, PackageClassification)
- `src/index.ts` - CLI entry point
- `src/commands/` - Command implementations
- `src/format/` - Output formatters
- `src/cache.ts` - Package loading from ~/.lrn/packages/
- `src/config.ts` - Config loading (lrn.config.json)
- `src/classify.ts` - Package classification detection from IR heuristics
- `src/orientation.ts` - Orientation blurb generation per classification
- `specs/fixtures/` - Test fixture packages (mathlib, acme-api, uikit, mycli, infra-aws)
- `TEST_PROGRESS.md` - Test implementation tracking

## Testing

Tests follow the project-wide public-API-only philosophy (see root `CLAUDE.md`). The public API is the CLI itself — all tests spawn `lrn` as a subprocess via the `runCLI` helper and assert on stdout, stderr, and exit codes. No internal modules are imported directly in test files.

Tests use `createTestCache()` to set up a temporary cache directory with fixture packages, then invoke CLI commands against that cache.

## Test Fixtures

Five fixture packages in `specs/fixtures/packages/`:

- **mathlib** - TypeScript library example (functions, classes, types)
  - Functions: add, subtract, multiply, divide, sqrt, pow
  - Classes: Calculator (with methods), Vector
  - Types: NumberPair, CalculatorOptions
  - Includes deprecated member (oldSum) and nested children

- **acme-api** - REST API example (OpenAPI-style)
  - Namespaces: users, products, orders (with nested items)
  - HTTP methods with paths, query params, request/response schemas
  - Multiple guides: quickstart, authentication, webhooks
  - Rich schema definitions: User, Product, Order, etc.

- **uikit** - UI component library (component kind members)
  - Components: Button, Card, Modal, Badge
  - Guide: color-system

- **mycli** - CLI tool (command kind members)
  - Commands: run, build, ps, stop
  - Guide: quickstart

- **infra-aws** - Infrastructure/config (resource kind members)
  - Resources: aws_lambda_function, aws_s3_bucket, aws_iam_role
  - Guide: getting-started

Tests use `createTestCache()` to set up a temporary cache with fixtures.
