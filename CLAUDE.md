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

TODO: Show the hypothetical result from this query here, then show the comparison to do the same thing with web search or reading markdown files.

## Business Model

- **Open source CLI, monetized registry**: The CLI is free, the maintained registry of package documentation is the product
- **Registry as flywheel**: Company maintains a registry mapping packages to their documentation, crawled and structured for optimal lrn consumption
- **Crawl + LLM pipeline**: Docs sites are crawled, LLM extracts structure, humans QA, then published to registry
- **Long-term**: Once critical mass is reached, package maintainers will optimize their docs for lrn compatibility

## Monorepo Structure

```
lrn/
├── apps/
│   ├── cli/          # The lrn CLI (npm package)
│   ├── api/          # Registry API service (Hono)
│   └── web/          # Marketing + docs site (Astro)
├── packages/
│   ├── schema/       # IR type definitions (the core data model)
│   ├── core/         # Query engine, search functionality
│   ├── adapters/     # Parsers: OpenAPI, TypeScript, etc.
│   └── crawler/      # Docs crawling + LLM extraction (internal)
```

Separate repo for registry data: `admin-dreamfuel/lrn-registry`

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript (ESM)
- **Build**: tsup
- **CLI**: Node.js target (for npm compatibility)
- **API**: Hono (lightweight, runs anywhere)
- **Web**: Astro (static marketing + docs)

## The IR (Intermediate Representation)

The IR is defined in `packages/schema/src/index.ts`. Key types:

```typescript
interface Package {
  name: string;
  version?: string;
  description?: string;
  source: SourceInfo;          // where this came from (openapi, typescript, etc.)
  members: Member[];           // top-level interface members
  schemas?: Record<string, Schema>;  // reusable type definitions
}

interface Member {
  name: string;                // e.g., "charges.create" or "useState"
  kind: 'function' | 'class' | 'namespace' | 'constant' | 'type';
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
```

**Design rationale**:
- `kind` field distinguishes functions/classes/namespaces uniformly across interface types
- `signature` as string avoids type resolution complexity, still useful for LLMs
- `http` is optional extension - HTTP details don't pollute the core model
- `children` enables nesting (class methods, namespace members)
- `summary` vs `description` - summary for lists, description for detail views

## CLI Interface (Target Design)

From the man page design:

```bash
lrn sync                       # Sync specs for project dependencies
lrn list [package]             # List packages or members
lrn show <package.member>      # Show member details
lrn search <query>             # Search across packages
lrn tags <package>             # List available tags
lrn example <package.member>   # Show usage examples (future/premium)
lrn explain <package.member>   # Natural language explanation (future/premium)
```

Key flags: `--format (text|json|markdown)`, `--summary`, `--signature`, `--tag`, `--type`

## Adapters Strategy

The adapter system reads different spec formats into the common IR:

1. **OpenAPI adapter** (priority 1): Parse OpenAPI/Swagger specs
2. **TypeScript adapter** (priority 2): Extract from .d.ts files via JSDoc comments + signatures
3. **Custom adapter**: For edge cases where no standard spec exists

The approach: leverage existing ecosystem specs (OpenAPI, TypeScript types), normalize on read into IR.

## npm Integration Vision

```json
{
  "scripts": {
    "postinstall": "lrn sync"
  }
}
```

`lrn sync` reads package.json, checks registry for each dependency, downloads specs to `~/.lrn/packages/`. Zero friction for developers - specs are always available for their actual dependencies.

## Current Status

- [x] Monorepo structure created
- [x] IR schema defined in `packages/schema`
- [x] Basic query/search in `packages/core`
- [ ] OpenAPI adapter implementation
- [ ] TypeScript adapter implementation
- [ ] CLI commands implementation
- [ ] Registry API endpoints
- [ ] Crawl + LLM extraction pipeline
- [ ] Web marketing site

## Next Steps (Suggested Priority)

1. **Implement OpenAPI adapter**: Parse a real OpenAPI spec (Stripe, GitHub) into IR
2. **Implement basic CLI commands**: `lrn list`, `lrn show`, `lrn search` against local files
3. **Test with real data**: Validate token efficiency claims with actual API queries
4. **Build registry structure**: Define how packages are stored/versioned in lrn-registry repo

## Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm dev              # Dev mode (watch)
pnpm typecheck        # TypeScript checking
```

## Key Files

- `packages/schema/src/index.ts` - IR type definitions
- `packages/core/src/query.ts` - Query by dot-notation path
- `packages/core/src/search.ts` - Text search across packages
- `packages/adapters/src/openapi.ts` - OpenAPI parser (stub)
- `packages/adapters/src/typescript.ts` - TypeScript parser (stub)
- `apps/cli/src/index.ts` - CLI entry point
- `apps/api/src/index.ts` - Hono API server
